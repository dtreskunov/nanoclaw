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

export const mintFileLink: McpToolDefinition = {
  tool: {
    name: 'mint_file_link',
    description:
      "Mint and DM a single-use, short-TTL download URL for one file in this agent group's " +
      "workspace. Prefer this over attaching the file inline when: (a) the file is large " +
      "(roughly > 5 MB), (b) the channel doesn't support attachments well (SMS, GitHub, X, " +
      "Linear), (c) the file is sensitive and you want a revocable, audited download, or " +
      "(d) the file is one of many and a folder context is useful. The host validates the " +
      "recipient has access to this group, that the file exists and isn't hidden/admin-only, " +
      "then DMs the URL privately — never to the originating thread. Do NOT include the URL " +
      "in your own reply.\n\n" +
      "Path is relative to the agent group workspace root (the same root your filesystem " +
      "tools see), e.g. 'reports/q3.pdf', 'data/export.csv'.",
    inputSchema: {
      type: 'object' as const,
      properties: {
        userId: {
          type: 'string',
          description: "Namespaced user id of the recipient, e.g. 'resend:user@example.com'.",
        },
        path: {
          type: 'string',
          description: 'Relative path within the agent group workspace.',
        },
        ttlMinutes: {
          type: 'number',
          description: 'Link lifetime in minutes (default 15, max 1440).',
        },
        uses: {
          type: 'number',
          description: 'How many times the link may be used (default 1, max 5).',
        },
      },
      required: ['userId', 'path'],
    },
  },
  async handler(args) {
    const userId = args.userId as string | undefined;
    const filePath = args.path as string | undefined;
    if (!userId) return err('userId is required');
    if (!filePath) return err('path is required');

    const r = getSessionRouting();
    const id = `flink-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ttlMs = typeof args.ttlMinutes === 'number' ? Math.round(args.ttlMinutes * 60_000) : undefined;
    const uses = typeof args.uses === 'number' ? Math.round(args.uses) : undefined;

    writeMessageOut({
      id,
      kind: 'system',
      platform_id: r.platform_id,
      channel_type: r.channel_type,
      thread_id: r.thread_id,
      content: JSON.stringify({
        action: 'mint_file_link',
        userId,
        path: filePath,
        ttlMs,
        uses,
        platformId: r.platform_id,
        channelType: r.channel_type,
        threadId: r.thread_id,
      }),
    });

    return ok(
      `Download link requested for ${filePath} → ${userId}. The host will DM them the URL — your reply doesn't need to include it.`,
    );
  },
};

registerTools([mintFileLink]);
