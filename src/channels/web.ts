/**
 * Web channel — chat-in-browser side panel of the file browser UI.
 *
 * Each browser tab opens a fresh thread on page load (UUID minted server-side
 * via `POST /ui/files/api/groups/<groupId>/chat/start`) and connects a
 * WebSocket. POST `/send` synthesizes an `InboundEvent` via
 * `submitWebInbound` → `ChannelSetup.onInboundEvent`. The router writes the
 * row into the per-thread session's `inbound.db`; the container processes
 * it and writes to `outbound.db`; the host delivery loop calls back into
 * this adapter's `deliver`, which republishes to live WS subscribers.
 *
 * Pub/sub key: `${platformId}::${threadId}`. The platformId carries the
 * userId so two users on the same agent group don't cross-publish.
 *
 * No platform identity, no credentials — this adapter is always-on and
 * only enabled when the UI is mounted. Messaging-group rows are
 * auto-provisioned on first use by the chat route handler.
 */
import type { ChannelAdapter, ChannelSetup, InboundEvent, OutboundMessage } from './adapter.js';
import { registerChannelAdapter } from './channel-registry.js';
import { log } from '../log.js';

export const WEB_CHANNEL_TYPE = 'web';

/** A live subscriber — typically a WebSocket connection. */
export interface WebSubscriber {
  /** Called with each outbound row delivered for this (platformId, threadId). */
  onOutbound(message: OutboundMessage): void;
  /** Called with the user's own inbound right after it's accepted. */
  onInboundEcho(text: string): void;
}

let setupCallbacks: ChannelSetup | null = null;
const subscribers = new Map<string, Set<WebSubscriber>>();

function subKey(platformId: string, threadId: string | null): string {
  return `${platformId}::${threadId ?? ''}`;
}

/** Register a subscriber for live messages on this (platformId, threadId). */
export function subscribeWeb(platformId: string, threadId: string | null, sub: WebSubscriber): () => void {
  const key = subKey(platformId, threadId);
  let set = subscribers.get(key);
  if (!set) {
    set = new Set();
    subscribers.set(key, set);
  }
  set.add(sub);
  return () => {
    const s = subscribers.get(key);
    if (!s) return;
    s.delete(sub);
    if (s.size === 0) subscribers.delete(key);
  };
}

/**
 * Synthesize an inbound chat message from the web UI and inject it into
 * the router via the stored `ChannelSetup` callbacks. Returns the
 * generated message id.
 */
export async function submitWebInbound(args: {
  userId: string;
  platformId: string;
  threadId: string;
  text: string;
}): Promise<string> {
  if (!setupCallbacks) throw new Error('web channel not initialized');
  const id = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const event: InboundEvent = {
    channelType: WEB_CHANNEL_TYPE,
    platformId: args.platformId,
    threadId: args.threadId,
    message: {
      id,
      kind: 'chat',
      timestamp: new Date().toISOString(),
      isMention: true,
      isGroup: false,
      content: JSON.stringify({
        text: args.text,
        sender: args.userId,
        senderId: args.userId,
      }),
    },
  };
  // Echo to local subscribers immediately so the sending tab sees its own
  // message even if the router/container path is slow.
  const echoSet = subscribers.get(subKey(args.platformId, args.threadId));
  if (echoSet) {
    for (const sub of echoSet) {
      try {
        sub.onInboundEcho(args.text);
      } catch (err) {
        log.warn('web subscriber onInboundEcho threw', { err });
      }
    }
  }
  await setupCallbacks.onInboundEvent(event);
  return id;
}

function createAdapter(): ChannelAdapter {
  const adapter: ChannelAdapter = {
    name: 'web',
    channelType: WEB_CHANNEL_TYPE,
    supportsThreads: true,
    supportsMultiFile: true,

    async setup(config: ChannelSetup): Promise<void> {
      setupCallbacks = config;
      log.info('Web channel ready');
    },

    async teardown(): Promise<void> {
      setupCallbacks = null;
      subscribers.clear();
    },

    isConnected(): boolean {
      return setupCallbacks !== null;
    },

    async deliver(platformId, threadId, message: OutboundMessage): Promise<string | undefined> {
      const set = subscribers.get(subKey(platformId, threadId));
      if (!set || set.size === 0) {
        // No live tab — the row stays in outbound.db; reconnecting clients
        // can fetch history via the REST `messages` endpoint.
        return undefined;
      }
      for (const sub of set) {
        try {
          sub.onOutbound(message);
        } catch (err) {
          log.warn('web subscriber onOutbound threw', { err });
        }
      }
      return undefined;
    },
  };
  return adapter;
}

registerChannelAdapter('web', { factory: createAdapter });
