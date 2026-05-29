/**
 * Chat side-panel for the file browser UI.
 *
 * Web channel auto-provisioning + REST endpoints + WebSocket fan-out for
 * outbound. Mounted under `/ui/chat/api/groups/<groupId>/chat/...` by the
 * file browser router (see ../routes.ts). The web channel adapter
 * (src/channels/web.ts) handles the actual inbound injection and outbound
 * pub/sub.
 */
import crypto from 'crypto';
import http from 'http';
import type internal from 'stream';

import Busboy from 'busboy';
import { WebSocketServer, type WebSocket } from 'ws';

import { getAgentGroup } from '../../../db/agent-groups.js';
import { getDb } from '../../../db/connection.js';
import {
  createMessagingGroup,
  createMessagingGroupAgent,
  getMessagingGroup,
  getMessagingGroupAgents,
  getMessagingGroupAgentByPair,
  getMessagingGroupByPlatform,
} from '../../../db/messaging-groups.js';
import { deleteSession, findSessionByAgentGroup, findSessionForAgent } from '../../../db/sessions.js';
import { openInboundDb, openOutboundDb, sessionDir, writeSessionMessage } from '../../../session-manager.js';
import { canAccessAgentGroup } from '../../../modules/permissions/access.js';
import { getUser } from '../../../modules/permissions/db/users.js';
import { log } from '../../../log.js';
import { getChannelAdapter } from '../../../channels/channel-registry.js';
import { subscribeWeb, submitWebInbound, WEB_CHANNEL_TYPE, type WebSubscriber } from '../../../channels/web.js';
import { setResendPendingWebOverride } from '../../../channels/resend.js';
import type { OutboundMessage } from '../../../channels/adapter.js';
import { authenticate, COOKIE_NAME } from '../auth.js';
import fs from 'fs';

/** Map (userId, agentGroupId) → deterministic web platform_id. */
function platformIdFor(userId: string, agentGroupId: string): string {
  return `${userId}#${agentGroupId}`;
}

/**
 * Idempotently ensure a `web` messaging group exists for this (user, agent
 * group) and is wired to that agent group. Returns the messaging_group id.
 */
function ensureWebMessagingGroup(userId: string, agentGroupId: string): string {
  const platformId = platformIdFor(userId, agentGroupId);
  let mg = getMessagingGroupByPlatform(WEB_CHANNEL_TYPE, platformId);
  if (!mg) {
    const id = `mg-web-${crypto.randomBytes(6).toString('hex')}`;
    createMessagingGroup({
      id,
      channel_type: WEB_CHANNEL_TYPE,
      platform_id: platformId,
      name: null,
      is_group: 0,
      unknown_sender_policy: 'request_approval',
      denied_at: null,
      created_at: new Date().toISOString(),
    });
    mg = getMessagingGroupByPlatform(WEB_CHANNEL_TYPE, platformId)!;
  }
  const wired = getMessagingGroupAgents(mg.id).some((a) => a.agent_group_id === agentGroupId);
  if (!wired) {
    createMessagingGroupAgent({
      id: `mga-web-${crypto.randomBytes(6).toString('hex')}`,
      messaging_group_id: mg.id,
      agent_group_id: agentGroupId,
      engage_mode: 'pattern',
      engage_pattern: '.',
      sender_scope: 'all',
      ignored_message_policy: 'drop',
      session_mode: 'per-thread',
      priority: 0,
      created_at: new Date().toISOString(),
    });
  }
  return mg.id;
}

interface ChatContext {
  userId: string;
  groupId: string;
  platformId: string;
  threadId: string;
}

/**
 * Match `/api/groups/<groupId>/chat/...` (after the mount prefix has been
 * stripped). Returns null if not a chat path.
 */
export function matchChatPath(
  pathname: string,
):
  | { kind: 'start'; groupId: string }
  | { kind: 'send'; groupId: string; threadId: string }
  | { kind: 'history'; groupId: string; threadId: string }
  | { kind: 'threads'; groupId: string }
  | { kind: 'delete'; groupId: string; threadId: string }
  | null {
  const start = pathname.match(/^\/api\/groups\/([^/]+)\/chat\/start$/);
  if (start) return { kind: 'start', groupId: start[1] };
  const threads = pathname.match(/^\/api\/groups\/([^/]+)\/chat\/threads$/);
  if (threads) return { kind: 'threads', groupId: threads[1] };
  const send = pathname.match(/^\/api\/groups\/([^/]+)\/chat\/([^/]+)\/send$/);
  if (send) return { kind: 'send', groupId: decodeURIComponent(send[1]), threadId: decodeURIComponent(send[2]) };
  const hist = pathname.match(/^\/api\/groups\/([^/]+)\/chat\/([^/]+)\/history$/);
  if (hist) return { kind: 'history', groupId: decodeURIComponent(hist[1]), threadId: decodeURIComponent(hist[2]) };
  const del = pathname.match(/^\/api\/groups\/([^/]+)\/chat\/([^/]+)$/);
  if (del) return { kind: 'delete', groupId: decodeURIComponent(del[1]), threadId: decodeURIComponent(del[2]) };
  return null;
}

function writeJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    // All chat-api responses are dynamic per-user state; the browser
    // (especially on mobile after backgrounding) was serving stale
    // /history responses from cache on visibility-resume catchup,
    // so the just-arrived agent reply wasn't visible until a hard
    // reload. no-store is the right tier for this content.
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: http.IncomingMessage, max = 64 * 1024): Promise<unknown> {
  const chunks: Buffer[] = [];
  let n = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    n += buf.length;
    if (n > max) throw new Error('body_too_large');
    chunks.push(buf);
  }
  if (n === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/** Limits for multipart chat uploads. Tweak if needed; mirrors the
 * documented design (per-file 25 MB, per-message 50 MB, max 10 files). */
const UPLOAD_MAX_FILE_SIZE = 25 * 1024 * 1024;
const UPLOAD_MAX_TOTAL_SIZE = 50 * 1024 * 1024;
const UPLOAD_MAX_FILES = 10;
const UPLOAD_MAX_FILENAME = 255;

interface ParsedUpload {
  text: string;
  files: { filename: string; contentType: string; buffer: Buffer }[];
}

/**
 * Parse a `multipart/form-data` body for the chat send endpoint.
 * Resolves with the accumulated text + files; rejects with a tagged error
 * for size/count violations (caller maps these to HTTP status codes).
 */
function readMultipartBody(req: http.IncomingMessage): Promise<ParsedUpload> {
  return new Promise((resolve, reject) => {
    let bb: ReturnType<typeof Busboy>;
    try {
      bb = Busboy({
        headers: req.headers,
        limits: {
          fileSize: UPLOAD_MAX_FILE_SIZE,
          files: UPLOAD_MAX_FILES,
          fields: 4,
          fieldNameSize: 64,
          fieldSize: 64 * 1024,
        },
      });
    } catch (err) {
      reject(Object.assign(new Error('invalid_multipart'), { detail: (err as Error).message }));
      return;
    }
    const out: ParsedUpload = { text: '', files: [] };
    let totalBytes = 0;
    let aborted = false;
    const fail = (code: string, detail?: string) => {
      if (aborted) return;
      aborted = true;
      req.unpipe(bb);
      req.resume();
      reject(Object.assign(new Error(code), detail ? { detail } : {}));
    };

    bb.on('field', (name, value) => {
      if (name === 'text' && typeof value === 'string') out.text = value;
    });
    bb.on('file', (_name, stream, info) => {
      const rawName = info.filename || 'upload';
      const filename = rawName.slice(0, UPLOAD_MAX_FILENAME);
      const contentType = info.mimeType || 'application/octet-stream';
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => {
        if (aborted) return;
        totalBytes += chunk.length;
        if (totalBytes > UPLOAD_MAX_TOTAL_SIZE) {
          stream.resume();
          fail('total_too_large');
          return;
        }
        chunks.push(chunk);
      });
      stream.on('limit', () => fail('file_too_large', `file=${filename}`));
      stream.on('end', () => {
        if (aborted) return;
        out.files.push({ filename, contentType, buffer: Buffer.concat(chunks) });
      });
    });
    bb.on('filesLimit', () => fail('too_many_files'));
    bb.on('error', (err) => fail('multipart_error', (err as Error).message));
    bb.on('close', () => {
      if (aborted) return;
      resolve(out);
    });
    req.pipe(bb);
  });
}

/** REST handlers. Returns true if the path was a chat route. */
export async function handleChatRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  userId: string,
): Promise<boolean> {
  const m = matchChatPath(pathname);
  if (!m) return false;

  const access = canAccessAgentGroup(userId, m.groupId);
  if (!access.allowed) {
    writeJson(res, 403, { error: 'forbidden' });
    return true;
  }
  if (!getAgentGroup(m.groupId)) {
    writeJson(res, 404, { error: 'group_not_found' });
    return true;
  }

  if (m.kind === 'start') {
    if (req.method !== 'POST') {
      writeJson(res, 405, { error: 'method_not_allowed' });
      return true;
    }
    ensureWebMessagingGroup(userId, m.groupId);
    const threadId = crypto.randomUUID();
    writeJson(res, 200, { threadId, platformId: platformIdFor(userId, m.groupId) });
    return true;
  }

  if (m.kind === 'send') {
    if (req.method !== 'POST') {
      writeJson(res, 405, { error: 'method_not_allowed' });
      return true;
    }
    const ctype = (req.headers['content-type'] || '').toLowerCase();
    let text = '';
    let attachments: { filename: string; contentType: string; data: string; size: number }[] = [];
    if (ctype.startsWith('multipart/form-data')) {
      try {
        const parsed = await readMultipartBody(req);
        text = parsed.text;
        attachments = parsed.files.map((f) => ({
          filename: f.filename,
          contentType: f.contentType,
          data: f.buffer.toString('base64'),
          size: f.buffer.length,
        }));
      } catch (err) {
        const code = (err as Error).message;
        const status =
          code === 'file_too_large' || code === 'total_too_large' ? 413 : code === 'too_many_files' ? 400 : 400;
        writeJson(res, status, { error: code, detail: (err as { detail?: string }).detail });
        return true;
      }
    } else {
      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch (err) {
        writeJson(res, 400, { error: 'invalid_body', detail: (err as Error).message });
        return true;
      }
      const t = (body as { text?: unknown })?.text;
      if (typeof t === 'string') text = t;
    }
    if (!text && attachments.length === 0) {
      writeJson(res, 400, { error: 'empty_message' });
      return true;
    }

    // Cross-channel send: when the client passes ?channel=&mg=, dispatch
    // through that channel's adapter.deliver instead of the web inbound
    // path. The web case stays separate because web has no platform-side
    // delivery — the agent's reply IS the platform message.
    const q = new URLSearchParams((req.url || '').split('?')[1] || '');
    const qChannel = q.get('channel') || undefined;
    const qMg = q.get('mg') || undefined;

    if (qChannel && qMg && qChannel !== WEB_CHANNEL_TYPE) {
      try {
        const id = await sendViaChannelAdapter({
          userId,
          agentGroupId: m.groupId,
          threadId: m.threadId,
          channelType: qChannel,
          messagingGroupId: qMg,
          text,
          attachments,
        });
        writeJson(res, 200, { id });
      } catch (err) {
        const code = (err as Error).message;
        const status = code.startsWith('http_') ? Number(code.slice(5)) : 500;
        log.warn('cross-channel chat send failed', { userId, groupId: m.groupId, channel: qChannel, err });
        writeJson(res, Number.isFinite(status) ? status : 500, {
          error: code || 'send_failed',
          detail: (err as { detail?: string }).detail,
        });
      }
      return true;
    }

    ensureWebMessagingGroup(userId, m.groupId);
    const platformId = platformIdFor(userId, m.groupId);
    try {
      const id = await submitWebInbound({
        userId,
        platformId,
        threadId: m.threadId,
        text,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      writeJson(res, 200, { id });
    } catch (err) {
      log.error('web chat send failed', { userId, groupId: m.groupId, err });
      writeJson(res, 500, { error: 'send_failed' });
    }
    return true;
  }

  if (m.kind === 'history') {
    if (req.method !== 'GET') {
      writeJson(res, 405, { error: 'method_not_allowed' });
      return true;
    }
    const q = new URLSearchParams((req.url || '').split('?')[1] || '');
    const qChannel = q.get('channel') || undefined;
    const qMg = q.get('mg') || undefined;
    const override = qChannel && qMg ? { channelType: qChannel, messagingGroupId: qMg } : undefined;
    try {
      const messages = readChatHistory(userId, m.groupId, m.threadId, override);
      writeJson(res, 200, { messages });
    } catch (err) {
      log.warn('web chat history read failed', { userId, groupId: m.groupId, threadId: m.threadId, err });
      writeJson(res, 200, { messages: [] });
    }
    return true;
  }

  if (m.kind === 'threads') {
    if (req.method !== 'GET') {
      writeJson(res, 405, { error: 'method_not_allowed' });
      return true;
    }
    try {
      const threads = listAllThreadsForUser(userId, m.groupId);
      writeJson(res, 200, { threads });
    } catch (err) {
      log.warn('web chat threads list failed', { userId, groupId: m.groupId, err });
      writeJson(res, 200, { threads: [] });
    }
    return true;
  }

  if (m.kind === 'delete') {
    if (req.method !== 'DELETE') {
      writeJson(res, 405, { error: 'method_not_allowed' });
      return true;
    }
    try {
      const removed = deleteChatThread(userId, m.groupId, m.threadId);
      writeJson(res, removed ? 200 : 404, { ok: removed });
    } catch (err) {
      log.warn('web chat thread delete failed', { userId, groupId: m.groupId, threadId: m.threadId, err });
      writeJson(res, 500, { error: 'delete_failed' });
    }
    return true;
  }

  return false;
}

interface HistoryMessage {
  direction: 'in' | 'out';
  // messages_in.id / messages_out.id — stable per-row id the client uses
  // as the dedup key against live WS pushes.
  id: string;
  timestamp: string;
  text: string;
  files?: { filename: string; size: number; path?: string }[];
}

/**
 * Read merged inbound + outbound history for a (user, group, thread) from
 * the session DBs. Returns [] if no session exists yet.
 *
 * `override` lets the caller target a non-web messaging group; without it
 * defaults to the per-user web messaging group (legacy behavior).
 */
function readChatHistory(
  userId: string,
  groupId: string,
  threadId: string,
  override?: { channelType: string; messagingGroupId: string },
): HistoryMessage[] {
  const target = resolveTargetMessagingGroup(userId, groupId, override);
  if (!target) return [];
  const session = resolveSessionForMode(groupId, target.messagingGroupId, target.sessionMode, threadId);
  if (!session) return [];

  const messages: HistoryMessage[] = [];
  try {
    const inDb = openInboundDb(groupId, session.id);
    try {
      const rows = inDb
        .prepare('SELECT id, timestamp, content FROM messages_in WHERE channel_type = ? AND thread_id = ? ORDER BY seq')
        .all(target.channelType, threadId) as { id: string; timestamp: string; content: string }[];
      // Router namespaces ids as `<rawId>:<agentGroupId>` when writing
      // into per-agent session DBs (router.ts messageIdForAgent), but the
      // live WS echo from submitWebInbound sends the raw `<rawId>`. If we
      // leak the namespaced form to the client the dedup key (direction:id)
      // mismatches and the user's own message paints twice on visibility
      // resume. Strip the suffix here so history matches the echo.
      const suffix = `:${groupId}`;
      for (const r of rows) {
        const parsed = parseInboundContent(r.content);
        if (parsed != null) {
          const id = r.id.endsWith(suffix) ? r.id.slice(0, -suffix.length) : r.id;
          messages.push({ direction: 'in', id, timestamp: r.timestamp, text: parsed.text, files: parsed.files });
        }
      }
    } finally {
      inDb.close();
    }
  } catch {
    // inbound DB may not exist
  }

  try {
    const outDb = openOutboundDb(groupId, session.id);
    try {
      const rows = outDb
        .prepare(
          'SELECT id, timestamp, kind, content FROM messages_out WHERE channel_type = ? AND thread_id = ? ORDER BY seq',
        )
        .all(target.channelType, threadId) as { id: string; timestamp: string; kind: string; content: string }[];
      for (const r of rows) {
        if (r.kind !== 'chat' && r.kind !== 'text') continue;
        const parsed = parseOutboundContent(r.content);
        messages.push({ direction: 'out', id: r.id, timestamp: r.timestamp, text: parsed.text, files: parsed.files });
      }
    } finally {
      outDb.close();
    }
  } catch {
    // outbound DB may not exist
  }

  messages.sort((a, b) => Date.parse(normTs(a.timestamp)) - Date.parse(normTs(b.timestamp)));
  return messages;
}

/**
 * Resolve the (channelType, messagingGroupId, sessionMode) the user is
 * targeting. If `override` is provided, authorize that user is the
 * counterparty of that messaging group (web ownership or `user_dms`
 * entry). Returns null on auth failure or unknown mg.
 */
function resolveTargetMessagingGroup(
  userId: string,
  agentGroupId: string,
  override: { channelType: string; messagingGroupId: string } | undefined,
): { channelType: string; messagingGroupId: string; sessionMode: 'per-thread' | 'shared' | 'agent-shared' } | null {
  if (!override) {
    const platformId = platformIdFor(userId, agentGroupId);
    const mg = getMessagingGroupByPlatform(WEB_CHANNEL_TYPE, platformId);
    if (!mg) return null;
    return { channelType: WEB_CHANNEL_TYPE, messagingGroupId: mg.id, sessionMode: 'per-thread' };
  }
  if (!userOwnsMessagingGroup(userId, agentGroupId, override.channelType, override.messagingGroupId)) return null;
  const mga = getMessagingGroupAgentByPair(override.messagingGroupId, agentGroupId);
  if (!mga) return null;
  const mode = (mga.session_mode || 'per-thread') as 'per-thread' | 'shared' | 'agent-shared';
  return { channelType: override.channelType, messagingGroupId: override.messagingGroupId, sessionMode: mode };
}

/** Authorize: viewer is the counterparty of this messaging group. */
function userOwnsMessagingGroup(userId: string, agentGroupId: string, channelType: string, mgId: string): boolean {
  if (channelType === WEB_CHANNEL_TYPE) {
    const platformId = platformIdFor(userId, agentGroupId);
    const mg = getMessagingGroupByPlatform(WEB_CHANNEL_TYPE, platformId);
    return mg?.id === mgId;
  }
  // Accept either a user_dms row OR a userId whose channel prefix matches
  // the mg's channel and which is wired to this agent group. The latter
  // covers email-bot-style aliases where the cold-DM cache isn't written.
  const dmRow = getDb()
    .prepare('SELECT 1 FROM user_dms WHERE user_id = ? AND channel_type = ? AND messaging_group_id = ?')
    .get(userId, channelType, mgId);
  if (dmRow) return true;
  const viewerHandle = viewerHandleForChannel(userId, channelType);
  if (!viewerHandle) return false;
  const mgaRow = getDb()
    .prepare(
      `SELECT 1 FROM messaging_group_agents mga
         JOIN messaging_groups mg ON mg.id = mga.messaging_group_id
        WHERE mga.messaging_group_id = ? AND mga.agent_group_id = ? AND mg.channel_type = ?`,
    )
    .get(mgId, agentGroupId, channelType);
  return !!mgaRow;
}

function resolveSessionForMode(
  agentGroupId: string,
  messagingGroupId: string,
  sessionMode: 'per-thread' | 'shared' | 'agent-shared',
  threadId: string,
): { id: string } | undefined {
  // Look up the session that actually holds this thread's messages.
  // Order matters: a per-thread session for (ag, mg, threadId) is the
  // most specific match. Otherwise a shared session for (ag, mg) holds
  // every thread for that mg. Finally an agent-shared session (mg NULL)
  // is the fallback. Each step is scoped, so we never return a session
  // that belongs to a different messaging group.
  void sessionMode;
  return (
    findSessionForAgent(agentGroupId, messagingGroupId, threadId) ||
    findSessionForAgent(agentGroupId, messagingGroupId, null) ||
    findSessionByAgentGroup(agentGroupId)
  );
}

/**
 * Cross-channel web send: ship the viewer's message out through the
 * named channel's existing adapter.deliver, then log it as an inbound
 * row with trigger=0 (the agent sees it as context on its next natural
 * wake; no auto-response). Throws Error('http_NNN') with optional .detail
 * for the route handler to map to an HTTP status.
 */
async function sendViaChannelAdapter(args: {
  userId: string;
  agentGroupId: string;
  threadId: string;
  channelType: string;
  messagingGroupId: string;
  text: string;
  attachments: { filename: string; contentType: string; data: string; size: number }[];
}): Promise<string> {
  const target = resolveTargetMessagingGroup(args.userId, args.agentGroupId, {
    channelType: args.channelType,
    messagingGroupId: args.messagingGroupId,
  });
  if (!target) throw Object.assign(new Error('http_403'), { detail: 'not_owner_of_messaging_group' });

  const adapter = getChannelAdapter(args.channelType);
  if (!adapter || !adapter.isConnected()) {
    throw Object.assign(new Error('http_503'), { detail: 'channel_offline' });
  }
  if (!adapter.supportsMultiFile && args.attachments.length > 1) {
    throw Object.assign(new Error('http_400'), { detail: 'multifile_not_supported' });
  }

  const session = resolveSessionForMode(args.agentGroupId, target.messagingGroupId, target.sessionMode, args.threadId);
  if (!session) throw Object.assign(new Error('http_409'), { detail: 'no_active_session' });

  const mg = getMessagingGroup(target.messagingGroupId);
  if (!mg) throw Object.assign(new Error('http_404'), { detail: 'messaging_group_not_found' });

  const fileBuffers = args.attachments.map((a) => ({
    filename: a.filename,
    data: Buffer.from(a.data, 'base64'),
  }));
  const outbound: OutboundMessage = {
    kind: 'chat',
    content: { text: args.text, files: args.attachments.map((a) => ({ filename: a.filename, size: a.size })) },
    files: fileBuffers.length > 0 ? fileBuffers : undefined,
  };

  // Per-channel UX tweaks before the generic dispatch.
  if (args.channelType === 'resend') {
    const u = getUser(args.userId);
    const fallback = args.userId.includes(':') ? args.userId.split(':')[1] : args.userId;
    const localPart = fallback.split('@')[0] || fallback;
    const displayName = (u?.display_name && u.display_name.trim()) || localPart;
    setResendPendingWebOverride({
      fromName: `${displayName} (via web)`,
      extraHeaders: { 'X-Sent-Via': 'web-ui', 'X-Sent-By': args.userId },
    });
  }

  let platformMsgId: string | undefined;
  try {
    platformMsgId = await adapter.deliver(mg.platform_id, args.threadId, outbound);
  } catch (err) {
    // Clear stash even on failure so a later send doesn't pick up stale state.
    if (args.channelType === 'resend') setResendPendingWebOverride({ fromName: null, extraHeaders: null });
    throw Object.assign(new Error('http_500'), { detail: (err as Error).message || 'channel_send_failed' });
  }

  // Log the user's send as an inbound row so the agent acts on it. The
  // host's sweep gates on trigger=1 to wake an idle container; without
  // it, a web-relayed reply that arrives after the container has gone
  // idle just sits in the DB until the next natural wake.
  const id = `web-relay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const contentPayload: Record<string, unknown> = {
    text: args.text,
    sender: args.userId,
    senderId: args.userId,
    _via: 'web',
    _sender: args.userId,
    _platform_msg_id: platformMsgId,
  };
  if (args.attachments.length > 0) {
    contentPayload.files = args.attachments.map((a) => ({ filename: a.filename, size: a.size }));
  }
  writeSessionMessage(args.agentGroupId, session.id, {
    id,
    kind: 'chat',
    timestamp: new Date().toISOString(),
    platformId: mg.platform_id,
    channelType: args.channelType,
    threadId: args.threadId,
    content: JSON.stringify(contentPayload),
    trigger: 1,
  });
  return id;
}

function normTs(s: string): string {
  return s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
}

function parseInboundContent(
  content: string,
): { text: string; files?: { filename: string; size: number }[]; viaWeb?: boolean } | null {
  try {
    const o = JSON.parse(content);
    if (typeof o === 'string') return { text: o };
    if (typeof o?.text === 'string' || Array.isArray(o?.attachments) || Array.isArray(o?.files)) {
      const text = typeof o?.text === 'string' ? o.text : '';
      // `attachments` for native inbound (base64 + name/mimeType); `files`
      // for web-relayed sends (filename + size only).
      const filesArr = Array.isArray(o?.attachments) ? o.attachments : Array.isArray(o?.files) ? o.files : undefined;
      const files = filesArr
        ? filesArr
            .map((a: { filename?: string; name?: string; data?: string; size?: number }) => {
              const size =
                typeof a?.size === 'number'
                  ? a.size
                  : typeof a?.data === 'string'
                    ? Math.floor((a.data.length * 3) / 4)
                    : 0;
              return { filename: String(a?.name ?? a?.filename ?? ''), size };
            })
            .filter((f: { filename: string }) => f.filename)
        : undefined;
      return {
        text,
        files: files && files.length > 0 ? files : undefined,
        viaWeb: o?._via === 'web' || undefined,
      };
    }
  } catch {
    /* not JSON */
  }
  return null;
}

function parseOutboundContent(content: string): {
  text: string;
  files?: { filename: string; size: number; path?: string }[];
} {
  try {
    const o = JSON.parse(content);
    if (typeof o === 'string') return { text: o };
    const text = typeof o?.text === 'string' ? o.text : typeof o?.markdown === 'string' ? o.markdown : '';
    // file_paths is a parallel array to files written by send_file with
    // workspace-relative source paths (or null when the source isn't in
    // /workspace/agent). Lets the chat UI link the chip to the FILES
    // panel without changing the established `files: string[]` contract
    // that delivery / readOutboxFiles depend on.
    const filePaths: (string | null | undefined)[] = Array.isArray(o?.file_paths) ? o.file_paths : [];
    const files = Array.isArray(o?.files)
      ? o.files
          .map((f: { filename?: string; name?: string; size?: number } | string, i: number) => {
            if (typeof f === 'string') {
              const p = filePaths[i];
              return { filename: f, size: 0, path: typeof p === 'string' ? p : undefined };
            }
            const p = filePaths[i];
            return {
              filename: String(f?.filename ?? f?.name ?? ''),
              size: typeof f?.size === 'number' ? f.size : 0,
              path: typeof p === 'string' ? p : undefined,
            };
          })
          .filter((f: { filename: string }) => f.filename)
      : undefined;
    return { text, files };
  } catch {
    return { text: content };
  }
}

interface ThreadSummary {
  threadId: string;
  sessionId: string;
  channelType: string;
  messagingGroupId: string;
  platformId: string;
  sessionMode: 'per-thread' | 'shared' | 'agent-shared';
  title: string;
  lastActivityAt: string;
  messageCount: number;
  counterparty?: string;
  /** True when the web UI can dispatch a send through this channel's adapter. */
  canSend?: boolean;
}

interface UserMessagingContext {
  messagingGroupId: string;
  channelType: string;
  platformId: string;
  sessionMode: 'per-thread' | 'shared' | 'agent-shared';
}

/**
 * For a non-web channel, derive the viewer's platform identity on that
 * channel from their `userId`. `userId` is always `<channel>:<handle>`;
 * the handle is what shows up in `messages_in.platform_id` for inbound
 * DMs from that viewer. Returns null when the viewer has no identity on
 * the given channel (different channel prefix).
 */
function viewerHandleForChannel(userId: string, channelType: string): string | null {
  if (channelType === WEB_CHANNEL_TYPE) return null;
  const prefix = channelType + ':';
  if (!userId.startsWith(prefix)) return null;
  const handle = userId.slice(prefix.length);
  return handle || null;
}

/**
 * All messaging-group contexts the viewer could plausibly have threads
 * in, scoped to one agent group. Always includes the implicit web mg if
 * one exists. For every other mga wired to the agent group, includes the
 * mg iff the viewer's userId carries the matching channel prefix — we
 * don't require a user_dms entry, because email-bot-style adapters don't
 * always write one, and we filter per-thread later by inbound platform_id.
 */
function listUserMessagingContexts(userId: string, agentGroupId: string): UserMessagingContext[] {
  const out: UserMessagingContext[] = [];
  const seen = new Set<string>();

  // Web: implicit per-(user, agentGroup) mg.
  const webPlatformId = platformIdFor(userId, agentGroupId);
  const webMg = getMessagingGroupByPlatform(WEB_CHANNEL_TYPE, webPlatformId);
  if (webMg) {
    const mga = getMessagingGroupAgentByPair(webMg.id, agentGroupId);
    if (mga) {
      out.push({
        messagingGroupId: webMg.id,
        channelType: WEB_CHANNEL_TYPE,
        platformId: webMg.platform_id,
        sessionMode: (mga.session_mode || 'per-thread') as UserMessagingContext['sessionMode'],
      });
      seen.add(webMg.id);
    }
  }

  // Every other mga wired to this agent group. Include iff the viewer's
  // userId prefix matches the mg's channel.
  type Row = {
    mg_id: string;
    channel_type: string;
    platform_id: string;
    session_mode: string | null;
  };
  const rows = getDb()
    .prepare(
      `SELECT mg.id AS mg_id, mg.channel_type, mg.platform_id, mga.session_mode
         FROM messaging_groups mg
         JOIN messaging_group_agents mga ON mga.messaging_group_id = mg.id
        WHERE mga.agent_group_id = ? AND mg.channel_type != ?`,
    )
    .all(agentGroupId, WEB_CHANNEL_TYPE) as Row[];
  for (const r of rows) {
    if (seen.has(r.mg_id)) continue;
    const viewerHandle = viewerHandleForChannel(userId, r.channel_type);
    if (!viewerHandle) continue;
    out.push({
      messagingGroupId: r.mg_id,
      channelType: r.channel_type,
      platformId: viewerHandle,
      sessionMode: (r.session_mode || 'per-thread') as UserMessagingContext['sessionMode'],
    });
    seen.add(r.mg_id);
  }
  return out;
}

/** Channel-aware title extraction from an inbound `content` JSON blob. */
function extractTitle(channelType: string, content: string): string {
  if (channelType === 'resend') {
    try {
      const o = JSON.parse(content) as {
        subject?: unknown;
        metadata?: { subject?: unknown };
        headers?: { subject?: unknown };
      };
      const subj = o?.subject ?? o?.metadata?.subject ?? o?.headers?.subject;
      if (typeof subj === 'string' && subj.trim()) return subj.trim();
    } catch {
      /* fall through */
    }
  }
  const parsed = parseInboundContent(content);
  return parsed?.text ?? '';
}

/** Strip auto-prepended context blockquote + whitespace, cap to 60 chars. */
function finalizeTitle(raw: string): string {
  const cleaned = raw
    .replace(/^>\s*Context.*\n+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? cleaned.slice(0, 60) : '(new chat)';
}

/**
 * List all chat threads across every messaging group the viewer is in
 * for this agent group. We dispatch based on the actual session rows
 * (whether a session has a thread_id) rather than the configured
 * session_mode, so the listing stays correct when mga.session_mode and
 * the session table have drifted (e.g. mode was changed mid-life).
 */
function listAllThreadsForUser(userId: string, agentGroupId: string): ThreadSummary[] {
  const ctxs = listUserMessagingContexts(userId, agentGroupId);
  const out: ThreadSummary[] = [];

  // Per-mg: any session with thread_id IS NOT NULL is per-thread-style;
  // any session with thread_id IS NULL is shared-style. Either may exist.
  const sharedCtxs: UserMessagingContext[] = [];
  for (const ctx of ctxs) {
    enumeratePerThread(userId, agentGroupId, ctx, out);
    if (hasSharedSession(agentGroupId, ctx.messagingGroupId)) sharedCtxs.push(ctx);
  }
  for (const ctx of sharedCtxs) enumerateShared(agentGroupId, ctx, out);

  // Agent-shared session (one per agent group, no mg link in sessions).
  if (ctxs.length > 0 && hasAgentSharedSession(agentGroupId)) {
    enumerateAgentShared(agentGroupId, ctxs, out);
  }

  // Stamp canSend by channel — true iff the adapter is registered and
  // connected. Web is always sendable (handled by submitWebInbound).
  const canSendByChannel = new Map<string, boolean>();
  for (const t of out) {
    if (canSendByChannel.has(t.channelType)) continue;
    if (t.channelType === WEB_CHANNEL_TYPE) {
      canSendByChannel.set(t.channelType, true);
    } else {
      const a = getChannelAdapter(t.channelType);
      canSendByChannel.set(t.channelType, !!a && a.isConnected());
    }
  }
  for (const t of out) t.canSend = canSendByChannel.get(t.channelType) === true;

  out.sort((a, b) => Date.parse(normTs(b.lastActivityAt)) - Date.parse(normTs(a.lastActivityAt)));
  return out;
}

function hasSharedSession(agentGroupId: string, mgId: string): boolean {
  const row = getDb()
    .prepare(
      'SELECT 1 AS x FROM sessions WHERE agent_group_id = ? AND messaging_group_id = ? AND thread_id IS NULL LIMIT 1',
    )
    .get(agentGroupId, mgId);
  return !!row;
}

function hasAgentSharedSession(agentGroupId: string): boolean {
  const row = getDb()
    .prepare(
      'SELECT 1 AS x FROM sessions WHERE agent_group_id = ? AND messaging_group_id IS NULL AND thread_id IS NULL LIMIT 1',
    )
    .get(agentGroupId);
  return !!row;
}

/**
 * Enumerate per-thread-style sessions for a (ag, mg). For non-web
 * channels, only include threads where the inbound side's `platform_id`
 * matches the viewer's handle on that channel — otherwise the rail would
 * leak other users' threads on a shared mg (e.g. an email-bot alias).
 */
function enumeratePerThread(
  userId: string,
  agentGroupId: string,
  ctx: UserMessagingContext,
  out: ThreadSummary[],
): void {
  type Row = { id: string; thread_id: string; last_active: string | null; created_at: string };
  const rows = getDb()
    .prepare(
      `SELECT id, thread_id, last_active, created_at FROM sessions
       WHERE agent_group_id = ? AND messaging_group_id = ? AND thread_id IS NOT NULL`,
    )
    .all(agentGroupId, ctx.messagingGroupId) as Row[];
  const isWeb = ctx.channelType === WEB_CHANNEL_TYPE;
  const viewerHandle = isWeb ? null : viewerHandleForChannel(userId, ctx.channelType);
  if (!isWeb && !viewerHandle) return;
  for (const r of rows) {
    if (!isWeb && !threadBelongsToViewer(agentGroupId, r.id, ctx.channelType, r.thread_id, viewerHandle as string)) {
      continue;
    }
    const stats = readThreadStats(agentGroupId, r.id, ctx.channelType, r.thread_id);
    out.push({
      threadId: r.thread_id,
      sessionId: r.id,
      channelType: ctx.channelType,
      messagingGroupId: ctx.messagingGroupId,
      platformId: ctx.platformId,
      sessionMode: 'per-thread',
      title: finalizeTitle(stats.title),
      lastActivityAt: stats.maxTs || r.last_active || r.created_at,
      messageCount: stats.count,
      counterparty: isWeb ? undefined : ctx.platformId,
    });
  }
}

/**
 * True if some inbound message in this thread was sent by the viewer.
 * For most channels the sender lives in `content.sender` (Chat SDK
 * convention) rather than `messages_in.platform_id`, since platform_id
 * holds the *inbox* identity (e.g. the email-bot alias) for inbound
 * channels. We fall back to platform_id matching as a last resort.
 */
function threadBelongsToViewer(
  agentGroupId: string,
  sessionId: string,
  channelType: string,
  threadId: string,
  viewerHandle: string,
): boolean {
  try {
    const inDb = openInboundDb(agentGroupId, sessionId);
    try {
      const rows = inDb
        .prepare(
          'SELECT content, platform_id FROM messages_in WHERE channel_type = ? AND thread_id = ? ORDER BY seq LIMIT 5',
        )
        .all(channelType, threadId) as { content: string; platform_id: string }[];
      for (const r of rows) {
        if (r.platform_id === viewerHandle) return true;
        try {
          const o = JSON.parse(r.content) as { sender?: unknown; from?: unknown };
          const sender = typeof o?.sender === 'string' ? o.sender : typeof o?.from === 'string' ? o.from : null;
          if (sender && sender === viewerHandle) return true;
        } catch {
          /* not JSON */
        }
      }
      return false;
    } finally {
      inDb.close();
    }
  } catch {
    return false;
  }
}

function enumerateShared(agentGroupId: string, ctx: UserMessagingContext, out: ThreadSummary[]): void {
  const session = findSessionForAgent(agentGroupId, ctx.messagingGroupId, null);
  if (!session) return;
  collectThreadsFromSharedSession(agentGroupId, session.id, [{ ctx, mode: 'shared' }], out);
}

function enumerateAgentShared(agentGroupId: string, ctxs: UserMessagingContext[], out: ThreadSummary[]): void {
  const session = findSessionByAgentGroup(agentGroupId);
  if (!session) return;
  collectThreadsFromSharedSession(
    agentGroupId,
    session.id,
    ctxs.map((c) => ({ ctx: c, mode: 'agent-shared' as const })),
    out,
  );
}

/**
 * Enumerate distinct threads inside a shared/agent-shared session DB,
 * scoping to a list of (channelType, platformId) tuples the viewer owns.
 */
function collectThreadsFromSharedSession(
  agentGroupId: string,
  sessionId: string,
  scopes: { ctx: UserMessagingContext; mode: 'shared' | 'agent-shared' }[],
  out: ThreadSummary[],
): void {
  if (scopes.length === 0) return;
  let inDb: ReturnType<typeof openInboundDb>;
  try {
    inDb = openInboundDb(agentGroupId, sessionId);
  } catch {
    return;
  }
  try {
    const placeholders = scopes.map(() => '(channel_type = ? AND platform_id = ?)').join(' OR ');
    const params: string[] = [];
    for (const s of scopes) params.push(s.ctx.channelType, s.ctx.platformId);
    type GroupRow = { channel_type: string; platform_id: string; thread_id: string; max_ts: string | null; n: number };
    const groups = inDb
      .prepare(
        `SELECT channel_type, platform_id, thread_id, MAX(timestamp) AS max_ts, COUNT(*) AS n
           FROM messages_in
          WHERE thread_id IS NOT NULL AND (${placeholders})
          GROUP BY channel_type, platform_id, thread_id`,
      )
      .all(...params) as GroupRow[];

    const titleStmt = inDb.prepare(
      `SELECT content FROM messages_in
        WHERE channel_type = ? AND platform_id = ? AND thread_id = ?
        ORDER BY seq LIMIT 1`,
    );

    let outDb: ReturnType<typeof openOutboundDb> | undefined;
    try {
      try {
        outDb = openOutboundDb(agentGroupId, sessionId);
      } catch {
        outDb = undefined;
      }
      const outStmt = outDb?.prepare(
        `SELECT COUNT(*) AS n, MAX(timestamp) AS t FROM messages_out
          WHERE channel_type = ? AND thread_id = ? AND kind IN ('chat','text')`,
      );

      for (const g of groups) {
        const scope = scopes.find((s) => s.ctx.channelType === g.channel_type && s.ctx.platformId === g.platform_id);
        if (!scope) continue;
        const first = titleStmt.get(g.channel_type, g.platform_id, g.thread_id) as { content: string } | undefined;
        const title = first ? extractTitle(g.channel_type, first.content) : '';
        let count = g.n;
        let maxTs = g.max_ts ?? '';
        if (outStmt) {
          const oc = outStmt.get(g.channel_type, g.thread_id) as { n: number; t: string | null };
          count += oc.n;
          if (oc.t && (!maxTs || Date.parse(normTs(oc.t)) > Date.parse(normTs(maxTs)))) maxTs = oc.t;
        }
        out.push({
          threadId: g.thread_id,
          sessionId,
          channelType: g.channel_type,
          messagingGroupId: scope.ctx.messagingGroupId,
          platformId: g.platform_id,
          sessionMode: scope.mode,
          title: finalizeTitle(title),
          lastActivityAt: maxTs || new Date(0).toISOString(),
          messageCount: count,
          counterparty: g.channel_type !== WEB_CHANNEL_TYPE ? g.platform_id : undefined,
        });
      }
    } finally {
      outDb?.close();
    }
  } finally {
    inDb.close();
  }
}

/**
 * Per-thread session stats (title + count + max timestamp). Used by the
 * per-thread mode branch where each thread lives in its own session.
 */
function readThreadStats(
  agentGroupId: string,
  sessionId: string,
  channelType: string,
  threadId: string,
): { title: string; count: number; maxTs: string } {
  let title = '';
  let count = 0;
  let maxTs = '';
  try {
    const inDb = openInboundDb(agentGroupId, sessionId);
    try {
      const first = inDb
        .prepare('SELECT content FROM messages_in WHERE channel_type = ? AND thread_id = ? ORDER BY seq LIMIT 1')
        .get(channelType, threadId) as { content: string } | undefined;
      if (first) title = extractTitle(channelType, first.content);
      const c = inDb
        .prepare('SELECT COUNT(*) AS n, MAX(timestamp) AS t FROM messages_in WHERE channel_type = ? AND thread_id = ?')
        .get(channelType, threadId) as { n: number; t: string | null };
      count += c.n;
      if (c.t) maxTs = c.t;
    } finally {
      inDb.close();
    }
  } catch {
    /* inbound db missing */
  }
  try {
    const outDb = openOutboundDb(agentGroupId, sessionId);
    try {
      const c = outDb
        .prepare(
          "SELECT COUNT(*) AS n, MAX(timestamp) AS t FROM messages_out WHERE channel_type = ? AND thread_id = ? AND kind IN ('chat','text')",
        )
        .get(channelType, threadId) as { n: number; t: string | null };
      count += c.n;
      if (c.t && (!maxTs || Date.parse(normTs(c.t)) > Date.parse(normTs(maxTs)))) maxTs = c.t;
    } finally {
      outDb.close();
    }
  } catch {
    /* outbound db missing */
  }
  return { title, count, maxTs };
}

/**
 * Delete a chat thread — drops the sessions row and removes the on-disk
 * session directory. Returns true if a row was deleted. Does not stop a
 * running container (the host sweeper will tear it down when its DB
 * disappears).
 */
function deleteChatThread(userId: string, groupId: string, threadId: string): boolean {
  const platformId = platformIdFor(userId, groupId);
  const mg = getMessagingGroupByPlatform(WEB_CHANNEL_TYPE, platformId);
  if (!mg) return false;
  const session = findSessionForAgent(groupId, mg.id, threadId);
  if (!session) return false;
  const dir = sessionDir(groupId, session.id);
  deleteSession(session.id);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (err) {
    log.warn('failed to rm session dir', { dir, err });
  }
  return true;
}

// ── WebSocket upgrade ──

const wss = new WebSocketServer({ noServer: true });

/** Match `/ui/chat/api/groups/<groupId>/chat/<thread>/ws` on upgrade. */
function matchChatWsPath(pathname: string): { groupId: string; threadId: string } | null {
  const m = pathname.match(/^\/ui\/chat\/api\/groups\/([^/]+)\/chat\/([^/]+)\/ws$/);
  if (!m) return null;
  return { groupId: m[1], threadId: m[2] };
}

function readCookieToken(req: http.IncomingMessage): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    if (k === COOKIE_NAME) return part.slice(eq + 1).trim();
  }
  return null;
}

/** Upgrade handler — mount at `/ui/chat` via mountUpgradeHandler. */
export function handleChatUpgrade(req: http.IncomingMessage, socket: internal.Duplex, head: Buffer): void {
  const url = req.url || '/';
  const pathname = url.split('?')[0];
  const match = matchChatWsPath(pathname);
  if (!match) {
    socket.destroy();
    return;
  }
  const session = authenticate(req);
  if (!session) {
    // No cookie — reject with HTTP 401 before completing upgrade.
    socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\n\r\n');
    socket.destroy();
    return;
  }
  const access = canAccessAgentGroup(session.userId, match.groupId);
  if (!access.allowed) {
    socket.write('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n');
    socket.destroy();
    return;
  }
  // Verify token cookie was present (paranoia: authenticate succeeded so it
  // must have been). Used to silence the unused-import lint.
  if (!readCookieToken(req)) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    attachChatSocket(ws, {
      userId: session.userId,
      groupId: match.groupId,
      platformId: platformIdFor(session.userId, match.groupId),
      threadId: match.threadId,
    });
  });
}

function attachChatSocket(ws: WebSocket, ctx: ChatContext): void {
  // Auto-provision on connect so the messaging group exists before any
  // inbound. (POST /start already does this, but a client could open the
  // WS before calling /start — be defensive.)
  ensureWebMessagingGroup(ctx.userId, ctx.groupId);

  const subscriber: WebSubscriber = {
    onOutbound(message) {
      try {
        // send_file writes a `file_paths` array parallel to `files` with
        // workspace-relative source paths so the chat UI can link the
        // attachment chip into the FILES panel. Fish it out of the
        // parsed content (delivery.ts has already JSON.parsed it).
        const c = (typeof message.content === 'object' && message.content) as { file_paths?: unknown } | undefined;
        const filePaths: unknown[] = Array.isArray(c?.file_paths) ? c!.file_paths! : [];
        ws.send(
          JSON.stringify({
            kind: 'outbound',
            id: message.id,
            messageKind: message.kind,
            content: message.content,
            files:
              message.files?.map((f, i) => ({
                filename: f.filename,
                size: f.data.length,
                path: typeof filePaths[i] === 'string' ? (filePaths[i] as string) : undefined,
              })) ?? [],
            timestamp: new Date().toISOString(),
          }),
        );
      } catch (err) {
        log.warn('web chat ws send failed', { err });
      }
    },
    onInboundEcho(id, text, files) {
      try {
        ws.send(JSON.stringify({ kind: 'inbound', id, text, files: files ?? [], timestamp: new Date().toISOString() }));
      } catch (err) {
        log.warn('web chat ws echo failed', { err });
      }
    },
    onTyping(on, hint) {
      try {
        ws.send(JSON.stringify({ kind: 'typing', on, hint: hint ?? null }));
      } catch (err) {
        log.warn('web chat ws typing send failed', { err });
      }
    },
  };
  const unsubscribe = subscribeWeb(ctx.platformId, ctx.threadId, subscriber);

  ws.on('close', () => unsubscribe());
  ws.on('error', (err) => log.warn('web chat ws error', { err }));

  // Send a ready frame so the client can mark the connection open.
  try {
    ws.send(JSON.stringify({ kind: 'ready', threadId: ctx.threadId }));
  } catch {
    // swallow
  }
}
