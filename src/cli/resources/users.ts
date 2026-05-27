import { registerResource } from '../crud.js';
import { issueMagicLink } from '../../file-browser/auth.js';
import { fileBrowserBaseUrl } from '../../file-browser/server.js';
import { getUser } from '../../modules/permissions/db/users.js';

registerResource({
  name: 'user',
  plural: 'users',
  table: 'users',
  description:
    'User — a messaging-platform identity. Each row is one sender on one channel. A single human may have multiple user rows across channels (no cross-channel linking yet).',
  idColumn: 'id',
  columns: [
    {
      name: 'id',
      type: 'string',
      description:
        'Namespaced "channel_type:handle" — e.g. "tg:6037840640", "discord:123456789", "email:user@example.com". Must be provided on create.',
      required: true,
    },
    {
      name: 'kind',
      type: 'string',
      description:
        'Channel type identifier (e.g. "telegram", "discord"). Used as a fallback for DM resolution when the id prefix doesn\'t match a registered adapter.',
      required: true,
    },
    {
      name: 'display_name',
      type: 'string',
      description:
        'Human-readable name. Shown in approval cards and logs. Often auto-populated from the channel adapter.',
      updatable: true,
    },
    { name: 'created_at', type: 'string', description: 'Auto-set.', generated: true },
  ],
  operations: { list: 'open', get: 'open', create: 'approval', update: 'approval' },
  customOperations: {
    'issue-link': {
      access: 'open',
      description:
        'Issue a one-time file-browser magic link for a user. Use --user <id>. Optionally --base-url <url> (defaults to FILE_BROWSER_BASE_URL or http://localhost:${WEBHOOK_PORT}/files). The link expires in 10 minutes and is single-use.',
      handler: async (args) => {
        const userId = (args.user as string) ?? (args.id as string);
        if (!userId) throw new Error('--user is required');
        if (!getUser(userId)) throw new Error(`unknown user: ${userId}`);
        const baseUrl = (args['base_url'] as string) || fileBrowserBaseUrl();
        const { token, expiresAt } = issueMagicLink(userId);
        return {
          user_id: userId,
          url: `${baseUrl.replace(/\/$/, '')}/auth/redeem?t=${token}`,
          expires_at: expiresAt,
        };
      },
    },
  },
});
