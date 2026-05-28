/**
 * Chat side-panel for the file browser UI.
 *
 * Web channel auto-provisioning + REST endpoints + WebSocket fan-out for
 * outbound. Mounted under `/ui/files/api/groups/<groupId>/chat/...` by the
 * file browser router (see ../routes.ts). The web channel adapter
 * (src/channels/web.ts) handles the actual inbound injection and outbound
 * pub/sub.
 */
import crypto from 'crypto';
import http from 'http';
import type internal from 'stream';

import Busboy from 'busboy';
import { WebSocketServer, type WebSocket } from 'ws';

import { getAgentGroup } from '../../db/agent-groups.js';
import { getDb } from '../../db/connection.js';
import {
  createMessagingGroup,
  createMessagingGroupAgent,
  getMessagingGroupAgents,
  getMessagingGroupByPlatform,
} from '../../db/messaging-groups.js';
import { deleteSession, findSessionForAgent } from '../../db/sessions.js';
import { openInboundDb, openOutboundDb, sessionDir } from '../../session-manager.js';
import { canAccessAgentGroup } from '../../modules/permissions/access.js';
import { log } from '../../log.js';
import { subscribeWeb, submitWebInbound, WEB_CHANNEL_TYPE, type WebSubscriber } from '../../channels/web.js';
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
  if (send) return { kind: 'send', groupId: send[1], threadId: send[2] };
  const hist = pathname.match(/^\/api\/groups\/([^/]+)\/chat\/([^/]+)\/history$/);
  if (hist) return { kind: 'history', groupId: hist[1], threadId: hist[2] };
  const del = pathname.match(/^\/api\/groups\/([^/]+)\/chat\/([^/]+)$/);
  if (del) return { kind: 'delete', groupId: del[1], threadId: del[2] };
  return null;
}

function writeJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
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
    try {
      const messages = readChatHistory(userId, m.groupId, m.threadId);
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
      const threads = listChatThreads(userId, m.groupId);
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
  timestamp: string;
  text: string;
  files?: { filename: string; size: number }[];
}

/**
 * Read merged inbound + outbound history for a (user, group, thread) from
 * the session DBs. Returns [] if no session exists yet.
 */
function readChatHistory(userId: string, groupId: string, threadId: string): HistoryMessage[] {
  const platformId = platformIdFor(userId, groupId);
  const mg = getMessagingGroupByPlatform(WEB_CHANNEL_TYPE, platformId);
  if (!mg) return [];
  const session = findSessionForAgent(groupId, mg.id, threadId);
  if (!session) return [];

  const messages: HistoryMessage[] = [];
  try {
    const inDb = openInboundDb(groupId, session.id);
    try {
      const rows = inDb
        .prepare("SELECT timestamp, content FROM messages_in WHERE channel_type = 'web' AND thread_id = ? ORDER BY seq")
        .all(threadId) as { timestamp: string; content: string }[];
      for (const r of rows) {
        const parsed = parseInboundContent(r.content);
        if (parsed != null)
          messages.push({ direction: 'in', timestamp: r.timestamp, text: parsed.text, files: parsed.files });
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
          "SELECT timestamp, kind, content FROM messages_out WHERE channel_type = 'web' AND thread_id = ? ORDER BY seq",
        )
        .all(threadId) as { timestamp: string; kind: string; content: string }[];
      for (const r of rows) {
        if (r.kind !== 'chat' && r.kind !== 'text') continue;
        const parsed = parseOutboundContent(r.content);
        messages.push({ direction: 'out', timestamp: r.timestamp, text: parsed.text, files: parsed.files });
      }
    } finally {
      outDb.close();
    }
  } catch {
    // outbound DB may not exist
  }

  messages.sort((a, b) => {
    const ta = Date.parse(a.timestamp.includes('T') ? a.timestamp : a.timestamp.replace(' ', 'T') + 'Z');
    const tb = Date.parse(b.timestamp.includes('T') ? b.timestamp : b.timestamp.replace(' ', 'T') + 'Z');
    return ta - tb;
  });
  return messages;
}

function parseInboundContent(content: string): { text: string; files?: { filename: string; size: number }[] } | null {
  try {
    const o = JSON.parse(content);
    if (typeof o === 'string') return { text: o };
    if (typeof o?.text === 'string' || Array.isArray(o?.attachments)) {
      const text = typeof o?.text === 'string' ? o.text : '';
      const files = Array.isArray(o?.attachments)
        ? o.attachments
            .map((a: { filename?: string; name?: string; data?: string; size?: number }) => {
              // The on-disk inbox dir is the source of truth for the agent;
              // for history display we just need filename + an approximate
              // size (length of the base64 string ≈ 4/3 × bytes).
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
      return { text, files: files && files.length > 0 ? files : undefined };
    }
  } catch {
    /* not JSON */
  }
  return null;
}

function parseOutboundContent(content: string): { text: string; files?: { filename: string; size: number }[] } {
  try {
    const o = JSON.parse(content);
    if (typeof o === 'string') return { text: o };
    const text = typeof o?.text === 'string' ? o.text : typeof o?.markdown === 'string' ? o.markdown : '';
    const files = Array.isArray(o?.files)
      ? o.files
          .map((f: { filename?: string; name?: string; size?: number }) => ({
            filename: String(f?.filename ?? f?.name ?? ''),
            size: typeof f?.size === 'number' ? f.size : 0,
          }))
          .filter((f: { filename: string }) => f.filename)
      : undefined;
    return { text, files };
  } catch {
    return { text: content };
  }
}

interface ThreadSummary {
  threadId: string;
  title: string;
  lastActivityAt: string;
  messageCount: number;
}

/**
 * List all chat threads for (user, agent group). For each session we open
 * outbound.db to count messages + find max timestamp, and inbound.db to
 * grab the first user message as the title. N file opens per request —
 * fine at small scale, swap for a denormalized column when it bites.
 */
function listChatThreads(userId: string, groupId: string): ThreadSummary[] {
  const platformId = platformIdFor(userId, groupId);
  const mg = getMessagingGroupByPlatform(WEB_CHANNEL_TYPE, platformId);
  if (!mg) return [];

  type Row = { id: string; thread_id: string; last_active: string | null; created_at: string };
  const rows = getDb()
    .prepare(
      `SELECT id, thread_id, last_active, created_at FROM sessions
       WHERE agent_group_id = ? AND messaging_group_id = ? AND thread_id IS NOT NULL`,
    )
    .all(groupId, mg.id) as Row[];

  const out: ThreadSummary[] = [];
  for (const r of rows) {
    let title = '';
    let messageCount = 0;
    let maxTs = r.last_active || r.created_at;

    try {
      const inDb = openInboundDb(groupId, r.id);
      try {
        const first = inDb
          .prepare(
            "SELECT content, timestamp FROM messages_in WHERE channel_type = 'web' AND thread_id = ? ORDER BY seq LIMIT 1",
          )
          .get(r.thread_id) as { content: string; timestamp: string } | undefined;
        if (first) {
          const parsed = parseInboundContent(first.content);
          if (parsed?.text) title = parsed.text;
        }
        const inCount = inDb
          .prepare("SELECT COUNT(*) AS n FROM messages_in WHERE channel_type = 'web' AND thread_id = ?")
          .get(r.thread_id) as { n: number };
        messageCount += inCount.n;
        const inMax = inDb
          .prepare("SELECT MAX(timestamp) AS t FROM messages_in WHERE channel_type = 'web' AND thread_id = ?")
          .get(r.thread_id) as { t: string | null };
        if (inMax.t && inMax.t > maxTs) maxTs = inMax.t;
      } finally {
        inDb.close();
      }
    } catch {
      /* db missing */
    }

    try {
      const outDb = openOutboundDb(groupId, r.id);
      try {
        const outCount = outDb
          .prepare(
            "SELECT COUNT(*) AS n FROM messages_out WHERE channel_type = 'web' AND thread_id = ? AND kind IN ('chat','text')",
          )
          .get(r.thread_id) as { n: number };
        messageCount += outCount.n;
        const outMax = outDb
          .prepare("SELECT MAX(timestamp) AS t FROM messages_out WHERE channel_type = 'web' AND thread_id = ?")
          .get(r.thread_id) as { t: string | null };
        if (outMax.t) {
          const norm = outMax.t.includes('T') ? outMax.t : outMax.t.replace(' ', 'T') + 'Z';
          if (Date.parse(norm) > Date.parse(maxTs.includes('T') ? maxTs : maxTs.replace(' ', 'T') + 'Z'))
            maxTs = outMax.t;
        }
      } finally {
        outDb.close();
      }
    } catch {
      /* db missing */
    }

    // Strip the auto-prepended context blockquote from titles.
    const cleanTitle = title
      .replace(/^>\s*Context.*\n+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    out.push({
      threadId: r.thread_id,
      title: cleanTitle ? cleanTitle.slice(0, 60) : '(new chat)',
      lastActivityAt: maxTs,
      messageCount,
    });
  }

  out.sort((a, b) => {
    const ta = Date.parse(a.lastActivityAt.includes('T') ? a.lastActivityAt : a.lastActivityAt.replace(' ', 'T') + 'Z');
    const tb = Date.parse(b.lastActivityAt.includes('T') ? b.lastActivityAt : b.lastActivityAt.replace(' ', 'T') + 'Z');
    return tb - ta;
  });
  return out;
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

/** Match `/ui/files/api/groups/<groupId>/chat/<thread>/ws` on upgrade. */
function matchChatWsPath(pathname: string): { groupId: string; threadId: string } | null {
  const m = pathname.match(/^\/ui\/files\/api\/groups\/([^/]+)\/chat\/([^/]+)\/ws$/);
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

/** Upgrade handler — mount at `/ui/files` via mountUpgradeHandler. */
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
        ws.send(
          JSON.stringify({
            kind: 'outbound',
            messageKind: message.kind,
            content: message.content,
            files: message.files?.map((f) => ({ filename: f.filename, size: f.data.length })) ?? [],
            timestamp: new Date().toISOString(),
          }),
        );
      } catch (err) {
        log.warn('web chat ws send failed', { err });
      }
    },
    onInboundEcho(text, files) {
      try {
        ws.send(JSON.stringify({ kind: 'inbound', text, files: files ?? [], timestamp: new Date().toISOString() }));
      } catch (err) {
        log.warn('web chat ws echo failed', { err });
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
