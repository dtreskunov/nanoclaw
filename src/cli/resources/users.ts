import { registerResource } from '../crud.js';

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
});
