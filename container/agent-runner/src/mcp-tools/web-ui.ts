/**
 * Web UI MCP tool: request_login_link.
 *
 * The container agent can't mint magic links — that requires the central
 * DB on the host. So we emit a system action; the host's mint_login_link
 * handler creates the link and DMs it to the user via the channel adapter.
 */
import { writeMessageOut } from '../db/messages-out.js';
import { getSessionRouting } from '../db/session-routing.js';
import { registerTools } from './server.js';
import type { McpToolDefinition } from './types.js';

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function err(text: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${text}` }], isError: true };
}

export const requestLoginLink: McpToolDefinition = {
  tool: {
    name: 'request_login_link',
    description:
      "Mint and send a one-time web UI login link to a user via the current channel. " +
      "Use when the user asks to see, browse, or download their files. The host generates " +
      "the link and delivers it as a follow-up message — do NOT include the link in your " +
      "own reply (you don't have one) and do NOT ask the user to send /web-login. " +
      "Pass the requesting user's namespaced id (e.g. 'resend:user@example.com', " +
      "'telegram:12345') — usually the sender of the message you're responding to.",
    inputSchema: {
      type: 'object' as const,
      properties: {
        userId: {
          type: 'string',
          description: "Namespaced user id, e.g. 'resend:user@example.com'.",
        },
      },
      required: ['userId'],
    },
  },
  async handler(args) {
    const userId = args.userId as string | undefined;
    if (!userId) return err('userId is required');

    const r = getSessionRouting();
    const id = `mint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    writeMessageOut({
      id,
      kind: 'system',
      platform_id: r.platform_id,
      channel_type: r.channel_type,
      thread_id: r.thread_id,
      content: JSON.stringify({
        action: 'mint_login_link',
        userId,
        platformId: r.platform_id,
        channelType: r.channel_type,
        threadId: r.thread_id,
      }),
    });

    return ok(
      `Login link requested for ${userId}. The host will deliver it to them via this channel — your reply doesn't need to include the link.`,
    );
  },
};

registerTools([requestLoginLink]);
