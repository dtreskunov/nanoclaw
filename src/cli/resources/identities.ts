import { registerResource } from '../crud.js';

registerResource({
  name: 'identity',
  plural: 'identities',
  table: 'identities',
  description:
    'Identity — a (channel, handle) pair owned by a user. Multiple identities per user let one human be reached over many channels. Look up a user from a handle, or list every handle a user has.',
  idColumn: 'handle',
  columns: [
    { name: 'channel', type: 'string', description: 'Channel adapter type (e.g. "telegram", "discord").' },
    { name: 'handle', type: 'string', description: 'Platform-specific user handle. Format depends on the channel.' },
    { name: 'user_id', type: 'string', description: 'User UUID this identity belongs to.' },
    { name: 'verified_at', type: 'string', description: 'When this identity was added/verified.' },
    {
      name: 'primary_for_channel',
      type: 'number',
      description: '1 if this is the preferred identity for the user on this channel; 0 otherwise.',
    },
    { name: 'metadata_json', type: 'string', description: 'Optional JSON metadata (e.g. OIDC claims).' },
  ],
  operations: { list: 'open' },
});
