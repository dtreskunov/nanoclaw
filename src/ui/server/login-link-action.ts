/**
 * Delivery action handler: mint_login_link.
 *
 * Container agent invokes the `request_login_link` MCP tool, which writes
 * a `{action:'mint_login_link', userId, ...}` system message. The host
 * picks it up here, mints a magic link, and DMs the URL to the user via
 * their direct DM channel — never via the originating thread, which may
 * be a group chat where the link would be exposed to everyone.
 */
import { registerDeliveryAction, getDeliveryAdapter } from '../../delivery.js';
import { log } from '../../log.js';
import { ensureUserDm } from '../../modules/permissions/user-dm.js';
import { issueMagicLink } from './auth.js';
import { isUiEnabled, uiBaseUrl } from './server.js';

registerDeliveryAction('mint_login_link', async (content, session) => {
  const userId = content.userId as string | undefined;
  const originChannelType = (content.channelType as string | undefined) ?? null;
  const originPlatformId = (content.platformId as string | undefined) ?? null;
  const originThreadId = (content.threadId as string | null | undefined) ?? null;

  if (!userId) {
    log.warn('mint_login_link missing userId', { sessionId: session.id });
    return;
  }

  const adapter = getDeliveryAdapter();
  if (!adapter) {
    log.warn('mint_login_link no adapter', { sessionId: session.id });
    return;
  }

  // Always deliver to the user's DM — never the originating thread, which
  // may be a group chat. If we can't resolve a DM, fall back to the origin
  // thread only when it's already a 1:1 with this user (same platform_id).
  const dm = await ensureUserDm(userId);
  let targetChannelType: string | null;
  let targetPlatformId: string | null;
  let targetThreadId: string | null;
  if (dm) {
    targetChannelType = dm.channel_type;
    targetPlatformId = dm.platform_id;
    targetThreadId = null;
  } else {
    // No DM channel resolvable. The only safe origin fallback is when the
    // origin chat IS the user's DM (handle matches platform_id on the same
    // channel). Group chats, threads, etc. never qualify.
    const handle = userId.includes(':') ? userId.slice(userId.indexOf(':') + 1) : userId;
    const isOriginAlreadyUserDm =
      originChannelType !== null && originPlatformId !== null && originPlatformId === handle;
    if (!isOriginAlreadyUserDm) {
      log.warn('mint_login_link: cannot resolve DM and origin is not a 1:1 with the user', {
        userId,
        originChannelType,
        originPlatformId,
        sessionId: session.id,
      });
      return;
    }
    targetChannelType = originChannelType;
    targetPlatformId = originPlatformId;
    targetThreadId = originThreadId;
  }

  let text: string;
  if (!isUiEnabled()) {
    text = 'Web UI is not enabled on this server.';
  } else {
    const { token } = issueMagicLink(userId);
    const url = `${uiBaseUrl()}/auth/redeem?t=${token}`;
    text = `Here's your one-time login link (valid for 10 minutes):\n\n${url}`;
  }

  try {
    await adapter.deliver(targetChannelType, targetPlatformId, targetThreadId, 'chat', JSON.stringify({ text }));
    log.info('Login link delivered', {
      userId,
      targetChannelType,
      targetPlatformId,
      sessionId: session.id,
    });
  } catch (err) {
    log.error('Failed to deliver login link', { userId, sessionId: session.id, err });
  }
});
