import { registerResource } from '../crud.js';
import { searchMessages } from '../../search-index.js';
import type { CallerContext } from '../frame.js';

registerResource({
  name: 'session',
  plural: 'sessions',
  table: 'sessions',
  description:
    'Session — the runtime unit. Maps one (agent_group, messaging_group, thread) combination to a container with its own inbound.db and outbound.db. Created automatically by the router when a message arrives.',
  idColumn: 'id',
  scopeField: 'agent_group_id',
  columns: [
    { name: 'id', type: 'string', description: 'UUID.', generated: true },
    { name: 'agent_group_id', type: 'string', description: 'Agent group this session runs.' },
    {
      name: 'messaging_group_id',
      type: 'string',
      description: 'Messaging group this session serves. Null for agent-shared sessions.',
    },
    {
      name: 'thread_id',
      type: 'string',
      description: 'Thread ID. Only set for per-thread session mode.',
    },
    {
      name: 'agent_provider',
      type: 'string',
      description: 'Provider override. Null means inherit from agent group.',
    },
    {
      name: 'status',
      type: 'string',
      description: '"active" receives messages. "closed" is archived.',
      enum: ['active', 'closed'],
    },
    {
      name: 'container_status',
      type: 'string',
      description:
        '"running" — container alive and polling. "stopped" — container exited; the sweep will restart it automatically when due messages arrive. "idle" — reserved, currently unused.',
      enum: ['running', 'idle', 'stopped'],
    },
    { name: 'last_active', type: 'string', description: 'Last message or heartbeat. Used for stale detection.' },
    { name: 'created_at', type: 'string', description: 'Auto-set.', generated: true },
  ],
  operations: { list: 'open', get: 'open' },
  customOperations: {
    search: {
      access: 'open',
      description:
        'Search message history using full-text search. For agents: scoped to conversations with the current user on the current channel. Supports FTS5 syntax: prefix (deploy*), phrase ("deploy to prod"), boolean (deploy OR release).',
      args: [{ name: 'query', type: 'string', description: 'Search query.', required: true }],
      handler: async (args: Record<string, unknown>, ctx: CallerContext) => {
        const query = String(args.query ?? '');
        if (!query.trim()) throw new Error('--query is required');

        if (ctx.caller === 'agent') {
          // Same-MG scope: agent only sees threads with its current conversation partner.
          return searchMessages(query, {
            agentGroupId: ctx.agentGroupId,
            messagingGroupIds: [ctx.messagingGroupId],
          });
        }

        // Host caller: require --group (agent_group_id).
        const agentGroupId = String(args.agent_group_id ?? args.group ?? '');
        if (!agentGroupId) throw new Error('--group (agent group ID) is required for host-side search');
        return searchMessages(query, { agentGroupId });
      },
    },
  },
});
