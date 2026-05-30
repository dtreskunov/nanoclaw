/**
 * User DM resolution.
 *
 * Exposes one primitive: `ensureUserDm(userId)` returns (or lazily creates)
 * the `messaging_groups` row that the host should deliver to when it wants
 * to DM a given user. Everything that needs to cold-DM a user — approvals,
 * pairing handshakes, host notifications — goes through this function.
 *
 * ## Two-class resolution
 *
 * Channels split cleanly into two classes based on whether the user id is
 * already the DM platform id:
 *
 *   - **Direct-addressable** (Telegram, WhatsApp, iMessage, email, Matrix):
 *     user handle IS the DM chat id. No adapter method needed; we just
 *     mint a messaging_group row with `platform_id = handle`.
 *
 *   - **Resolution-required** (Discord, Slack, Teams, Webex, gChat):
 *     user id and DM channel id are different. The adapter must implement
 *     `openDM(handle)`, which Chat SDK's `chat.openDM` handles for us via
 *     the bridge. The returned channel id becomes the `platform_id`.
 *
 * ## Caching
 *
 * Successful resolutions are persisted in `user_dms (user_id, channel_type
 * → messaging_group_id)`. The cache survives restarts; first-time DMs on a
 * given channel pay one `openDM` round trip, everyone after is a pure DB
 * read.
 *
 * The underlying platform APIs (`POST /users/@me/channels` on Discord,
 * `conversations.open` on Slack, etc.) are idempotent and return the same
 * channel on repeated calls, so re-resolving after a cache miss is always
 * safe — worst case we round-trip redundantly.
 */
import { getChannelAdapter } from '../../channels/channel-registry.js';
import { getMessagingGroup, getMessagingGroupByPlatform, createMessagingGroup } from '../../db/messaging-groups.js';
import { log } from '../../log.js';
import type { MessagingGroup } from '../../types.js';
import { getIdentitiesForUser } from './db/identities.js';
import { getUser } from './db/users.js';
import { getUserDm, upsertUserDm } from './db/user-dms.js';

/**
 * Return a messaging_group usable to DM this user, creating it lazily if
 * needed. Returns null when:
 *   - the user id isn't namespaced (no `kind:handle` prefix)
 *   - the user's channel has no adapter registered
 *   - the channel needs openDM but its adapter doesn't implement it
 *   - openDM throws (platform error, user blocked bot, etc.)
 *
 * Callers should treat null as "this user is unreachable on this channel".
 */
export async function ensureUserDm(userId: string): Promise<MessagingGroup | null> {
  const user = getUser(userId);
  if (!user) {
    log.warn('ensureUserDm: user not found', { userId });
    return null;
  }

  const parsed = parseUserId(userId);
  if (!parsed) {
    log.warn('ensureUserDm: user has no identity rows', { userId });
    return null;
  }
  const { channelType, handle } = parsed;

  // Cache hit: existing user_dms row → load and return the messaging_group.
  const cached = getUserDm(userId, channelType);
  if (cached) {
    const mg = getMessagingGroup(cached.messaging_group_id);
    if (mg) return mg;
    // Row points to a deleted messaging_group — fall through and re-resolve.
    log.warn('ensureUserDm: cached row references missing messaging_group, re-resolving', {
      userId,
      messagingGroupId: cached.messaging_group_id,
    });
  }

  // Cache miss: resolve the DM platform_id either via openDM or directly.
  const dmPlatformId = await resolveDmPlatformId(channelType, handle);
  if (!dmPlatformId) return null;

  // Find-or-create the underlying messaging_group. A DM we received
  // earlier may already have a row matching (channel_type, platform_id).
  const now = new Date().toISOString();
  let mg = getMessagingGroupByPlatform(channelType, dmPlatformId);
  if (!mg) {
    const mgId = `mg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    mg = {
      id: mgId,
      channel_type: channelType,
      platform_id: dmPlatformId,
      name: user.display_name,
      is_group: 0,
      unknown_sender_policy: 'strict',
      created_at: now,
    };
    createMessagingGroup(mg);
    log.info('ensureUserDm: created DM messaging_group', {
      userId,
      channelType,
      messagingGroupId: mgId,
    });
  }

  upsertUserDm({
    user_id: userId,
    channel_type: channelType,
    messaging_group_id: mg.id,
    resolved_at: now,
  });

  return mg;
}

/**
 * Call the adapter's openDM if it has one; otherwise fall through to using
 * the handle directly. Returns null if the adapter is missing entirely.
 *
 * Exported so callers that need to DM an arbitrary handle (e.g. the
 * identity-linking verification flow) can reuse it without having to
 * mint a fake user first.
 */
export async function resolveDmPlatformId(channelType: string, handle: string): Promise<string | null> {
  const adapter = getChannelAdapter(channelType);
  if (!adapter) {
    log.warn('ensureUserDm: no adapter for channel', { channelType });
    return null;
  }
  if (!adapter.openDM) {
    // Direct-addressable channel — handle doubles as the DM chat id.
    return handle;
  }
  try {
    return await adapter.openDM(handle);
  } catch (err) {
    log.error('ensureUserDm: adapter.openDM failed', { channelType, handle, err });
    return null;
  }
}

function parseUserId(userId: string): { channelType: string; handle: string } | null {
  // After migration 018, users.id is a UUID and `(channel, handle)` lives in
  // the `identities` table. Pick the user's primary identity (or first one
  // ordered by channel/handle). In a multi-identity future (Phase 4), callers
  // that want a specific channel should pass a channel preference; for now
  // every user has exactly one identity so "first" is unambiguous.
  const identities = getIdentitiesForUser(userId);
  if (identities.length === 0) return null;
  const primary = identities.find((i) => i.primary_for_channel === 1) ?? identities[0];
  return { channelType: primary.channel, handle: primary.handle };
}
