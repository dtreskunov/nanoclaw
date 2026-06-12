/**
 * Home Assistant channel adapter (v2) — native, self-registers on import.
 *
 * Bridges NanoClaw to Home Assistant's [webhook-conversation] custom
 * component (https://github.com/EuleMitKeule/webhook-conversation). HA's
 * conversation agent POSTs a turn to `/webhook/homeassistant`; this adapter
 * routes it through the configured agent group and holds the HTTP request
 * open until the agent's reply lands in `outbound.db` (surfaced via the
 * adapter's `deliver` callback), then returns it in the shape HA expects.
 *
 * Request body (webhook-conversation conversation schema, subset we use):
 *   {
 *     "conversation_id": "abc123",   // stable while HA continues the convo
 *     "query": "latest user message",
 *     "messages": [{ "role": "...", "content": "..." }, ...],
 *     "system_prompt": "optional extra instructions",
 *     "exposed_entities": [{ entity_id, name, state, area_name, ... }],
 *     "user_id": "ha user id", "user_name": "John Doe",
 *     "language": "en-US"
 *   }
 *
 * Response (chat-only — we never return `tool_calls`, see buildTurn):
 *   `{ "output": "<reply text>" }` — a single JSON body. NanoClaw produces
 *   one complete message per turn (it has no token streaming), so the webhook
 *   always replies non-streaming; disable "Enable streaming" on the HA
 *   integration so it reads this plain-JSON body instead of expecting NDJSON.
 *
 * Clarifying questions: HA is synchronous request/response with no interactive
 * controls, so when the agent emits a chat-sdk `ask_question` we render the
 * prompt with its options as a natural inline list ("Which lamp? Desk, Floor,
 * or Corner?", see `renderAskQuestion`), always ending with a question mark.
 * That settles the held request instead of letting it hang to the timeout,
 * and — because HA core continues a conversation whenever the assistant's
 * reply ends with "?" — keeps the same conversation_id (and reopens the voice
 * mic), so the user's answer returns as the next turn in the same conversation
 * with full prior context.
 *
 * Security: the endpoint is on the shared public HTTP server, so auth lives
 * on the mount. HTTP Basic credentials are checked against
 * HA_WEBHOOK_USERNAME / HA_WEBHOOK_PASSWORD (constant-time compare). The
 * factory returns null (adapter skipped) unless HA_WEBHOOK_AGENT_GROUP is
 * set — that env var names the agent group every HA turn is routed to.
 *
 * Turn lifecycle: each HA POST is one inbound message in the conversation's
 * session. HA resends the full `messages` array each call, but the session
 * already holds prior turns, so we forward only the new content (the latest
 * query plus any tool results that arrived since the last exchange). The
 * agent's reply is captured by the first `deliver` for that (platformId,
 * threadId), which settles the held request with the reply text.
 *
 * Session continuity: HA core keeps a conversation alive (same
 * conversation_id, voice mic reopened) when the assistant's reply ends with a
 * question mark; `renderAskQuestion` ends every clarifying reply with "?" to
 * trigger that. We key the session directly off `conversation_id`, and HA
 * resends the full transcript in `messages` on every call, so `buildTurn`
 * plumbs the prior turns into the prompt — the agent keeps context across the
 * round-trip even if HA opens a fresh conversation_id (and thus a fresh
 * session) between turns.
 */
import crypto from 'node:crypto';
import type http from 'node:http';

import {
  createMessagingGroup,
  createMessagingGroupAgent,
  getMessagingGroupAgents,
  getMessagingGroupByPlatform,
} from '../db/messaging-groups.js';
import { readEnvFile } from '../env.js';
import { log } from '../log.js';
import { mountHandler } from '../webhook-server.js';
import type { ChannelAdapter, ChannelSetup, InboundEvent, OutboundMessage } from './adapter.js';
import { registerChannelAdapter } from './channel-registry.js';

export const HA_CHANNEL_TYPE = 'homeassistant';
const WEBHOOK_PATH = '/webhook/homeassistant';
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_OUTPUT_FIELD = 'output';

interface HaConfig {
  agentGroupId: string;
  username?: string;
  password?: string;
  timeoutMs: number;
}

/** A webhook-conversation message entry. */
interface HaMessage {
  role: string;
  content?: string;
  tool_call_id?: string;
  tool_name?: string;
}

/** Parsed subset of the webhook-conversation conversation payload. */
interface HaPayload {
  conversation_id?: string;
  query?: string;
  messages?: HaMessage[];
  system_prompt?: string;
  exposed_entities?: unknown;
  user_id?: string;
  user_name?: string;
  language?: string;
}

/** An in-flight HTTP request awaiting the agent's reply. */
interface PendingRequest {
  res: http.ServerResponse;
  timer: ReturnType<typeof setTimeout>;
  /** Set once we've started/finished responding so we never double-write. */
  settled: boolean;
}

function readConfig(): HaConfig | null {
  const env = readEnvFile([
    'HA_WEBHOOK_AGENT_GROUP',
    'HA_WEBHOOK_USERNAME',
    'HA_WEBHOOK_PASSWORD',
    'HA_WEBHOOK_TIMEOUT',
  ]);
  const agentGroupId = process.env.HA_WEBHOOK_AGENT_GROUP || env.HA_WEBHOOK_AGENT_GROUP;
  if (!agentGroupId) return null;
  const timeoutSec = parseInt(process.env.HA_WEBHOOK_TIMEOUT || env.HA_WEBHOOK_TIMEOUT || '', 10);
  return {
    agentGroupId,
    username: process.env.HA_WEBHOOK_USERNAME || env.HA_WEBHOOK_USERNAME,
    password: process.env.HA_WEBHOOK_PASSWORD || env.HA_WEBHOOK_PASSWORD,
    timeoutMs: Number.isFinite(timeoutSec) && timeoutSec > 0 ? timeoutSec * 1000 : DEFAULT_TIMEOUT_MS,
  };
}

/** Deterministic platform_id for the agent group all HA turns route to. */
function platformIdFor(agentGroupId: string): string {
  return `ha:${agentGroupId}`;
}

function pendingKey(platformId: string, threadId: string | null): string {
  return `${platformId}::${threadId ?? ''}`;
}

/** Timing-safe string compare that tolerates differing lengths. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) {
    // Still run a compare against a same-length buffer to avoid leaking
    // length via early return timing; result is discarded.
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Idempotently ensure a `homeassistant` messaging group exists for the
 * configured agent group and is wired to it. Public sender policy +
 * `sender_scope: 'all'` — the HTTP Basic auth on the mount is the trust
 * boundary, so authenticated turns always engage.
 */
function ensureMessagingGroup(agentGroupId: string): void {
  const platformId = platformIdFor(agentGroupId);
  let mg = getMessagingGroupByPlatform(HA_CHANNEL_TYPE, platformId);
  if (!mg) {
    createMessagingGroup({
      id: `mg-ha-${crypto.randomBytes(6).toString('hex')}`,
      channel_type: HA_CHANNEL_TYPE,
      platform_id: platformId,
      name: 'Home Assistant',
      is_group: 0,
      unknown_sender_policy: 'public',
      denied_at: null,
      created_at: new Date().toISOString(),
    });
    mg = getMessagingGroupByPlatform(HA_CHANNEL_TYPE, platformId)!;
  }
  const wired = getMessagingGroupAgents(mg.id).some((a) => a.agent_group_id === agentGroupId);
  if (!wired) {
    createMessagingGroupAgent({
      id: `mga-ha-${crypto.randomBytes(6).toString('hex')}`,
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
}

/**
 * Build a turn from an HA payload.
 *
 * Returns the user-visible `text`: the prior conversation turns, any tool
 * results, then the actual query. We deliberately do NOT forward HA's
 * per-request `system_prompt` or the `exposed_entities` state blob: that
 * payload is multi-KB and pushes weak models toward malformed output, and the
 * agent can read live home state on demand via Home Assistant's MCP server
 * anyway.
 *
 * HA resends the full transcript in `messages` on every call. We plumb the
 * earlier user/assistant turns into the prompt so the agent keeps context
 * across a clarifying-question round-trip even when HA opens a fresh
 * conversation_id (and thus a fresh session) between turns. The trailing user
 * turn duplicates `query`, so it's dropped from the replayed history.
 */
export function buildTurn(payload: HaPayload): { text: string } {
  const messages = payload.messages ?? [];
  const query = (payload.query ?? '').trim();
  const out: string[] = [];

  // ── Prior conversation turns ─────────────────────────────────────────
  const prior = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  // Drop the trailing user turn that duplicates the current `query`.
  if (query && prior.length > 0) {
    const last = prior[prior.length - 1];
    if (last.role === 'user' && (last.content ?? '').trim() === query) prior.pop();
  }
  if (prior.length > 0) {
    out.push('[Conversation so far]');
    for (const m of prior) {
      out.push(`${m.role === 'user' ? 'User' : 'Assistant'}: ${(m.content ?? '').trim()}`);
    }
    out.push('[End conversation so far]');
    out.push('');
  }

  // ── Tool results + the user's query ──────────────────────────────────
  const toolResults = messages.filter((m) => m.role === 'tool_result');
  for (const tr of toolResults) {
    const name = tr.tool_name ? `Tool Result: ${tr.tool_name}` : 'Tool Result';
    out.push(`[${name}]`);
    out.push(tr.content ?? '');
    out.push('[End Tool Result]');
    out.push('');
  }

  if (query) out.push(query);

  return { text: out.join('\n').trim() };
}

/**
 * Render a chat-sdk `ask_question` payload as plain text.
 *
 * HA's webhook-conversation integration is synchronous request/response and
 * cannot show interactive option buttons — if we ignore the question the held
 * HTTP request just hangs until it times out. We render the prompt followed by
 * the options as a natural inline list ("Which lamp? Desk, Floor, or
 * Corner?"), always ending with a question mark. That settles the request,
 * lets HA speak/show the prompt, and — because HA core continues a
 * conversation whenever the assistant's reply ends with "?" — keeps the same
 * conversation_id (and reopens the voice mic), so the user's answer comes back
 * as the next turn in the same conversation, where the agent resolves it from
 * context. Returns null if the payload isn't a usable ask_question.
 */
export function renderAskQuestion(content: Record<string, unknown>): string | null {
  if (content.type !== 'ask_question') return null;
  const prompt = content.question ?? content.title;
  const promptText = typeof prompt === 'string' ? prompt.trim() : '';
  const labels = Array.isArray(content.options)
    ? content.options
        .map((o) => (o && typeof o === 'object' ? (o as Record<string, unknown>).label : undefined))
        .filter((l): l is string => typeof l === 'string' && l.trim().length > 0)
    : [];
  if (!promptText && labels.length === 0) return null;

  const parts: string[] = [];
  if (promptText) {
    // Give the prompt its own terminal punctuation so the options read as a
    // follow-up question rather than running into it.
    parts.push(/[?;？.!]$/.test(promptText) ? promptText : `${promptText}?`);
  }
  if (labels.length > 0) parts.push(`${joinOptions(labels)}?`);

  let text = parts.join(' ').trim();
  // Guarantee a trailing question mark. HA core only continues a conversation
  // (keeping the same conversation_id and reopening the voice mic) when the
  // assistant's reply ends with "?" / ";" / "？". See "Session continuity".
  if (text && !/[?;？]$/.test(text)) text += '?';
  return text || null;
}

/** Join option labels into a natural list: "A", "A or B", "A, B, or C". */
function joinOptions(labels: string[]): string {
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`;
}

/** Extract the reply text from an outbound message's parsed content. */
export function extractOutboundText(message: OutboundMessage): string | null {
  const content = message.content;
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object') {
    const obj = content as Record<string, unknown>;
    const text = obj.markdown ?? obj.text;
    if (typeof text === 'string') return text;
    // chat-sdk ask_question: flatten to text so the held HA request settles
    // with the prompt instead of hanging until timeout.
    const asked = renderAskQuestion(obj);
    if (asked !== null) return asked;
  }
  return null;
}

function createAdapter(config: HaConfig): ChannelAdapter {
  let setupCallbacks: ChannelSetup | null = null;
  const pending = new Map<string, PendingRequest>();

  function clearPending(key: string): void {
    const p = pending.get(key);
    if (p) {
      clearTimeout(p.timer);
      pending.delete(key);
    }
  }

  async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'method_not_allowed' }));
      return;
    }

    // ── HTTP Basic auth ──────────────────────────────────────────────
    if (config.username && config.password) {
      const header = req.headers.authorization || '';
      const m = header.match(/^Basic\s+(.+)$/i);
      let ok = false;
      if (m) {
        const decoded = Buffer.from(m[1], 'base64').toString('utf8');
        const sep = decoded.indexOf(':');
        if (sep >= 0) {
          const u = decoded.slice(0, sep);
          const p = decoded.slice(sep + 1);
          ok = safeEqual(u, config.username) && safeEqual(p, config.password);
        }
      }
      if (!ok) {
        res.writeHead(401, {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Basic realm="nanoclaw-homeassistant"',
        });
        res.end(JSON.stringify({ error: 'unauthorized' }));
        return;
      }
    }

    // ── Parse body ───────────────────────────────────────────────────
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    let payload: HaPayload;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as HaPayload;
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid_json' }));
      return;
    }

    if (!setupCallbacks) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'adapter_not_ready' }));
      return;
    }

    // Key the session directly off HA's conversation_id, which stays stable
    // while HA continues a conversation; fall back to a fresh id otherwise.
    const threadId = (payload.conversation_id || `ha-${Date.now()}`).trim();
    const platformId = platformIdFor(config.agentGroupId);
    const { text } = buildTurn(payload);
    if (!text) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'empty_query' }));
      return;
    }

    const senderId = payload.user_id ? `ha-user:${payload.user_id}` : 'ha-user:default';
    const messageId = `ha-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const key = pendingKey(platformId, threadId);

    // Supersede any in-flight request for the same conversation (HA retries,
    // overlapping turns) so we don't leak a held socket.
    const existing = pending.get(key);
    if (existing && !existing.settled) {
      existing.settled = true;
      clearTimeout(existing.timer);
      try {
        existing.res.writeHead(409, { 'Content-Type': 'application/json' });
        existing.res.end(JSON.stringify({ error: 'superseded' }));
      } catch {
        // swallow — socket may already be gone
      }
    }

    const timer = setTimeout(() => {
      const p = pending.get(key);
      if (!p || p.settled) return;
      p.settled = true;
      pending.delete(key);
      try {
        p.res.writeHead(504, { 'Content-Type': 'application/json' });
        p.res.end(JSON.stringify({ [DEFAULT_OUTPUT_FIELD]: 'Request timed out' }));
      } catch (err) {
        log.warn('HA webhook timeout response failed', { err });
      }
      log.warn('HA webhook turn timed out', { threadId, timeoutMs: config.timeoutMs });
    }, config.timeoutMs);

    pending.set(key, { res, timer, settled: false });

    // ── Route inbound ────────────────────────────────────────────────
    const event: InboundEvent = {
      channelType: HA_CHANNEL_TYPE,
      platformId,
      threadId,
      message: {
        id: messageId,
        kind: 'chat',
        timestamp: new Date().toISOString(),
        isMention: true,
        isGroup: false,
        content: JSON.stringify({
          text,
          sender: senderId,
          senderId,
          senderName: payload.user_name,
        }),
      },
    };

    try {
      await setupCallbacks.onInboundEvent(event);
    } catch (err) {
      log.error('HA webhook failed to route inbound', { threadId, err });
      clearPending(key);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'routing_failed' }));
      } else {
        try {
          res.end();
        } catch {
          // swallow
        }
      }
    }
  }

  const adapter: ChannelAdapter = {
    name: 'homeassistant',
    channelType: HA_CHANNEL_TYPE,
    supportsThreads: true,
    supportsMultiFile: false,

    async setup(cfg: ChannelSetup): Promise<void> {
      setupCallbacks = cfg;
      ensureMessagingGroup(config.agentGroupId);
      mountHandler(WEBHOOK_PATH, (req, res) => {
        void handleRequest(req, res);
      });
      log.info('Home Assistant channel ready', {
        path: WEBHOOK_PATH,
        agentGroupId: config.agentGroupId,
        authRequired: Boolean(config.username && config.password),
      });
    },

    async teardown(): Promise<void> {
      for (const [key, p] of pending) {
        clearTimeout(p.timer);
        if (!p.settled) {
          try {
            p.res.writeHead(503, { 'Content-Type': 'application/json' });
            p.res.end(JSON.stringify({ error: 'shutting_down' }));
          } catch {
            // swallow
          }
        }
        pending.delete(key);
      }
      setupCallbacks = null;
    },

    isConnected(): boolean {
      return setupCallbacks !== null;
    },

    async deliver(platformId, threadId, message: OutboundMessage): Promise<string | undefined> {
      const key = pendingKey(platformId, threadId);
      const p = pending.get(key);
      if (!p || p.settled) return undefined;

      const text = extractOutboundText(message);
      if (text === null) return undefined; // non-text payload (card, etc.) — ignore

      // The first text reply settles the held request.
      p.settled = true;
      clearPending(key);
      try {
        p.res.writeHead(200, { 'Content-Type': 'application/json' });
        p.res.end(JSON.stringify({ [DEFAULT_OUTPUT_FIELD]: text }));
      } catch (err) {
        log.warn('HA webhook response write failed', { err });
      }
      return undefined;
    },
  };

  return adapter;
}

registerChannelAdapter('homeassistant', {
  factory: () => {
    const config = readConfig();
    if (!config) return null;
    return createAdapter(config);
  },
});
