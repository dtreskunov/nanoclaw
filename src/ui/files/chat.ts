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

import { WebSocketServer, type WebSocket } from 'ws';

import { getAgentGroup } from '../../db/agent-groups.js';
import {
  createMessagingGroup,
  createMessagingGroupAgent,
  getMessagingGroupAgents,
  getMessagingGroupByPlatform,
} from '../../db/messaging-groups.js';
import { canAccessAgentGroup } from '../../modules/permissions/access.js';
import { log } from '../../log.js';
import { subscribeWeb, submitWebInbound, WEB_CHANNEL_TYPE, type WebSubscriber } from '../../channels/web.js';
import { authenticate, COOKIE_NAME } from '../auth.js';

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
): { kind: 'start'; groupId: string } | { kind: 'send'; groupId: string; threadId: string } | null {
  const start = pathname.match(/^\/api\/groups\/([^/]+)\/chat\/start$/);
  if (start) return { kind: 'start', groupId: start[1] };
  const send = pathname.match(/^\/api\/groups\/([^/]+)\/chat\/([^/]+)\/send$/);
  if (send) return { kind: 'send', groupId: send[1], threadId: send[2] };
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
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      writeJson(res, 400, { error: 'invalid_body', detail: (err as Error).message });
      return true;
    }
    const text = (body as { text?: unknown })?.text;
    if (typeof text !== 'string' || text.length === 0) {
      writeJson(res, 400, { error: 'missing_text' });
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
      });
      writeJson(res, 200, { id });
    } catch (err) {
      log.error('web chat send failed', { userId, groupId: m.groupId, err });
      writeJson(res, 500, { error: 'send_failed' });
    }
    return true;
  }

  return false;
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
          }),
        );
      } catch (err) {
        log.warn('web chat ws send failed', { err });
      }
    },
    onInboundEcho(text) {
      try {
        ws.send(JSON.stringify({ kind: 'inbound', text }));
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
