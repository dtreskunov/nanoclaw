/**
 * Typing indicator refresh — default module.
 *
 * Most platforms expire a typing indicator after 5–10s, so a one-shot
 * call on message arrival goes stale long before the agent finishes
 * thinking. This module keeps it alive by re-firing `setTyping` on a
 * short interval — but only while the agent is actually WORKING, gated
 * on the heartbeat file's mtime after an initial grace period.
 *
 * Shutdown signal: the container writes `turn_ended_at` to
 * `session_state` on the SDK's `result` / `error` event. The host's
 * active delivery loop calls `checkTurnEndedAndStop` once per tick (~1s)
 * to drop the indicator as soon as that flips, so a final answer or a
 * follow-up question stops the dots without waiting for the heartbeat
 * to age out.
 *
 * Default module status:
 *   - Lives in src/modules/ for signaling (not really core), but ships
 *     on main and is imported directly by core. No registry, no hook.
 *   - Removing requires editing src/router.ts, src/delivery.ts, and
 *     src/container-runner.ts to drop the calls.
 */
import fs from 'fs';

import { heartbeatPath, readSessionProgress, readSessionTurnEndedAt } from '../../session-manager.js';

const TYPING_REFRESH_MS = 4000;
/**
 * Grace window from startTypingRefresh: fire typing unconditionally
 * for this long regardless of heartbeat state. Covers container
 * spawn/wake latency (5–12s on cold start before first heartbeat).
 */
const TYPING_GRACE_MS = 15000;
/**
 * After the grace window, a heartbeat must be mtimed within this
 * many ms of now to count as "agent is working." Heartbeats land
 * every few hundred ms during active work, so 6s is well above
 * the working floor and small enough to stop typing quickly when
 * the agent goes idle.
 */
const HEARTBEAT_FRESH_MS = 6000;

interface TypingAdapter {
  setTyping?(channelType: string, platformId: string, threadId: string | null, hint?: string): Promise<void>;
  clearTyping?(channelType: string, platformId: string, threadId: string | null): Promise<void>;
}

interface TypingTarget {
  agentGroupId: string;
  channelType: string;
  platformId: string;
  threadId: string | null;
  interval: NodeJS.Timeout;
  startedAt: number;
}

let adapter: TypingAdapter | null = null;
const typingRefreshers = new Map<string, TypingTarget>();

/**
 * Bind the typing module to the channel delivery adapter so it can
 * call `setTyping`. Called once by `src/delivery.ts` inside
 * `setDeliveryAdapter`. Passing a fresh adapter replaces the prior
 * binding and leaves active refreshers in place (they'll use the
 * new adapter on their next tick).
 */
export function setTypingAdapter(a: TypingAdapter): void {
  adapter = a;
}

async function triggerTyping(
  sessionId: string,
  agentGroupId: string,
  channelType: string,
  platformId: string,
  threadId: string | null,
): Promise<void> {
  const hint = readSessionProgress(agentGroupId, sessionId) ?? undefined;
  try {
    await adapter?.setTyping?.(channelType, platformId, threadId, hint);
  } catch {
    // Typing is best-effort — don't let it fail delivery or routing.
  }
}

async function triggerClearTyping(channelType: string, platformId: string, threadId: string | null): Promise<void> {
  try {
    await adapter?.clearTyping?.(channelType, platformId, threadId);
  } catch {
    // Best-effort — same as triggerTyping.
  }
}

function isHeartbeatFresh(agentGroupId: string, sessionId: string): boolean {
  const hbPath = heartbeatPath(agentGroupId, sessionId);
  try {
    const stat = fs.statSync(hbPath);
    return Date.now() - stat.mtimeMs < HEARTBEAT_FRESH_MS;
  } catch {
    return false;
  }
}

export function startTypingRefresh(
  sessionId: string,
  agentGroupId: string,
  channelType: string,
  platformId: string,
  threadId: string | null,
): void {
  const existing = typingRefreshers.get(sessionId);
  if (existing) {
    // Already refreshing. Fire an immediate tick for the new inbound
    // event and reset the grace window — the new message restarts
    // the container-wake latency budget. Also clear any lingering
    // post-delivery pause: a new inbound means the user expects
    // typing to show immediately.
    triggerTyping(sessionId, agentGroupId, channelType, platformId, threadId).catch(() => {});
    existing.startedAt = Date.now();
    return;
  }

  // Immediate tick + periodic refresh.
  triggerTyping(sessionId, agentGroupId, channelType, platformId, threadId).catch(() => {});
  const startedAt = Date.now();
  const interval = setInterval(() => {
    const entry = typingRefreshers.get(sessionId);
    if (!entry) return; // stopped externally since this tick was scheduled

    // turn_ended_at is also checked from the active delivery poll
    // (`checkTurnEndedAndStop`) for sub-second clear, but keep the
    // same check here in case the delivery poll lags or the session
    // isn't being actively polled.
    if (stopIfTurnEnded(sessionId, entry)) return;

    const withinGrace = Date.now() - entry.startedAt < TYPING_GRACE_MS;
    if (withinGrace || isHeartbeatFresh(entry.agentGroupId, sessionId)) {
      triggerTyping(sessionId, entry.agentGroupId, entry.channelType, entry.platformId, entry.threadId).catch(() => {});
      return;
    }

    // Out of grace AND heartbeat stale — agent is idle, stop refreshing.
    clearInterval(entry.interval);
    typingRefreshers.delete(sessionId);
    triggerClearTyping(entry.channelType, entry.platformId, entry.threadId).catch(() => {});
  }, TYPING_REFRESH_MS);
  // unref so a stale refresher can't hold the event loop alive.
  interval.unref();
  typingRefreshers.set(sessionId, {
    agentGroupId,
    channelType,
    platformId,
    threadId,
    interval,
    startedAt,
  });
}

/**
 * Drop the typing indicator if the container has marked the current
 * turn as ended (final result delivered, or follow-up question asked
 * and now waiting on the user). Called once per active delivery tick
 * (~1s) so the dots disappear within a second of the agent finishing
 * — much faster than waiting for the next 4s refresh tick or for the
 * heartbeat to age out. Returns true if the refresher was stopped.
 */
export function checkTurnEndedAndStop(sessionId: string): boolean {
  const entry = typingRefreshers.get(sessionId);
  if (!entry) return false;
  return stopIfTurnEnded(sessionId, entry);
}

function stopIfTurnEnded(sessionId: string, entry: TypingTarget): boolean {
  const turnEndedAt = readSessionTurnEndedAt(entry.agentGroupId, sessionId);
  if (turnEndedAt <= entry.startedAt) return false;
  clearInterval(entry.interval);
  typingRefreshers.delete(sessionId);
  triggerClearTyping(entry.channelType, entry.platformId, entry.threadId).catch(() => {});
  return true;
}

export function stopTypingRefresh(sessionId: string): void {
  const entry = typingRefreshers.get(sessionId);
  if (!entry) return;
  clearInterval(entry.interval);
  typingRefreshers.delete(sessionId);
  triggerClearTyping(entry.channelType, entry.platformId, entry.threadId).catch(() => {});
}
