import { registerResource } from '../crud.js';
import { issueMagicLink } from '../../ui/server/auth.js';
import { uiBaseUrl } from '../../ui/server/server.js';
import { getUser } from '../../modules/permissions/db/users.js';

registerResource({
  name: 'user',
  plural: 'users',
  table: 'users',
  description:
    'User — a person who may be reachable on one or more messaging channels. Identities (channel + handle pairs) link a user to specific platform addresses; see the identities table.',
  idColumn: 'id',
  columns: [
    {
      name: 'id',
      type: 'string',
      description: 'User UUID (v4). Auto-generated when a new identity is observed; do not craft by hand.',
      required: true,
    },
    {
      name: 'kind',
      type: 'string',
      description:
        'Primary channel type for this user (e.g. "telegram", "discord"). Mostly informational once identities exist.',
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
        'Issue a one-time web-UI magic link for a user. Use --user <id>. Optionally --base-url <url> (defaults to UI_BASE_URL or http://localhost:${WEBHOOK_PORT}/ui). The link expires in 10 minutes and is single-use.',
      handler: async (args) => {
        const userId = (args.user as string) ?? (args.id as string);
        if (!userId) throw new Error('--user is required');
        if (!getUser(userId)) throw new Error(`unknown user: ${userId}`);
        const baseUrl = (args['base_url'] as string) || uiBaseUrl();
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
