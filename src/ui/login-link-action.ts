/**
 * Delivery action handler: mint_login_link.
 *
 * Container agent invokes the `request_login_link` MCP tool, which writes
 * a `{action:'mint_login_link', userId, ...}` system message. The host
 * picks it up here, mints a magic link, and delivers the URL as a chat
 * message back to the user via the same channel/thread.
 */
import { registerDeliveryAction, getDeliveryAdapter } from '../delivery.js';
import { log } from '../log.js';
import { issueMagicLink } from './auth.js';
import { isUiEnabled, uiBaseUrl } from './server.js';

registerDeliveryAction('mint_login_link', async (content, session) => {
  const userId = content.userId as string | undefined;
  const channelType = (content.channelType as string | undefined) ?? null;
  const platformId = (content.platformId as string | undefined) ?? null;
  const threadId = (content.threadId as string | null | undefined) ?? null;

  if (!userId) {
    log.warn('mint_login_link missing userId', { sessionId: session.id });
    return;
  }

  const adapter = getDeliveryAdapter();
  if (!adapter || !channelType || !platformId) {
    log.warn('mint_login_link missing adapter or routing', {
      sessionId: session.id,
      hasAdapter: !!adapter,
      channelType,
      platformId,
    });
    return;
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
    await adapter.deliver(channelType, platformId, threadId, 'chat', JSON.stringify({ text }));
    log.info('Login link delivered', { userId, sessionId: session.id });
  } catch (err) {
    log.error('Failed to deliver login link', { userId, sessionId: session.id, err });
  }
});
