import { randomUUID } from 'node:crypto';

import { getDb } from '../../db/connection.js';
import { log } from '../../log.js';
import { addMember } from '../../modules/permissions/db/agent-group-members.js';
import { insertIdentity } from '../../modules/permissions/db/identities.js';
import { insertOidcLink } from '../../modules/permissions/db/oidc-links.js';
import { getPendingApproval, resolveApproval } from '../../modules/permissions/db/pending-user-approvals.js';
import { createUser } from '../../modules/permissions/db/users.js';
import { registerResource } from '../crud.js';

/**
 * `ncl pending-approvals` — admin surface for OIDC sign-in requests that
 * landed in `pending_user_approvals` (an unrecognized Google account hit
 * the callback). `approve` mints the user, links the OIDC subject,
 * grants membership to the named agent group, and marks the row resolved.
 * `deny` just marks it resolved.
 */
registerResource({
  name: 'pending-approval',
  plural: 'pending-approvals',
  table: 'pending_user_approvals',
  description:
    'Pending user-approval — an unrecognized OIDC sign-in waiting for an admin to approve. Created by the /ui/auth/oidc/<provider>/callback route. Approve to mint the user, link the OIDC subject, and optionally grant membership to an agent group.',
  idColumn: 'id',
  columns: [
    { name: 'id', type: 'string', description: 'Approval id (pua-…).' },
    { name: 'provider', type: 'string', description: 'OIDC provider (e.g. "google").' },
    { name: 'sub', type: 'string', description: 'OIDC subject claim — stable per-account identifier.' },
    { name: 'email', type: 'string', description: 'Email from the userinfo response (for display).' },
    { name: 'display_name', type: 'string', description: 'Name from the userinfo response.' },
    { name: 'claims_json', type: 'string', description: 'Full userinfo claims snapshot.' },
    { name: 'status', type: 'string', description: 'pending | approved | denied | expired.' },
    { name: 'created_at', type: 'string', description: 'When the request was queued.' },
    { name: 'resolved_at', type: 'string', description: 'When approve/deny ran.' },
    { name: 'resolved_by_user_id', type: 'string', description: 'Who resolved it (null = ncl from host shell).' },
    {
      name: 'granted_agent_group_id',
      type: 'string',
      description: 'Agent group the new user got member access to (approve only).',
    },
    { name: 'resolution_note', type: 'string', description: 'Optional admin note attached at resolve time.' },
  ],
  operations: { list: 'open', get: 'open' },
  customOperations: {
    approve: {
      access: 'approval',
      description:
        'Approve a pending OIDC sign-in. Mints a new user, links the OIDC subject, and optionally grants ' +
        'membership to an agent group. Use --id <approval-id> [--group <ag-id>] [--display-name <name>] [--note <text>]. ' +
        'Without --group the user can log in but will see no accessible groups until a separate `ncl members add` runs.',
      handler: async (args, ctx) => {
        const id = args.id as string;
        if (!id) throw new Error('--id is required');
        const row = getPendingApproval(id);
        if (!row) throw new Error(`No pending approval: ${id}`);
        if (row.status !== 'pending') throw new Error(`Approval ${id} is already ${row.status}`);

        const groupId = (args.group as string) || null;
        if (groupId) {
          const ag = getDb().prepare('SELECT id FROM agent_groups WHERE id = ?').get(groupId);
          if (!ag) throw new Error(`Unknown agent group: ${groupId}`);
        }

        const displayName =
          (args['display-name'] as string) || row.display_name || row.email || `User ${row.sub.slice(0, 8)}`;
        const note = (args.note as string) || null;
        const resolverUserId = ctx.caller === 'host' ? null : ((ctx as { userId?: string }).userId ?? null);
        const userId = randomUUID();
        const now = new Date().toISOString();

        getDb().transaction(() => {
          createUser({
            id: userId,
            kind: row.provider === 'google' ? 'oidc' : row.provider,
            display_name: displayName,
            created_at: now,
          });
          insertIdentity({ userId, channel: 'web', handle: userId, primary: true });
          insertOidcLink({
            provider: row.provider,
            sub: row.sub,
            user_id: userId,
            email: row.email,
            claims: row.claims_json ? (JSON.parse(row.claims_json) as Record<string, unknown>) : null,
          });
          if (groupId) {
            addMember({ user_id: userId, agent_group_id: groupId, added_by: resolverUserId, added_at: now });
          }
          resolveApproval({
            id,
            status: 'approved',
            resolved_by_user_id: resolverUserId ?? 'cli-host',
            granted_agent_group_id: groupId,
            note,
          });
        })();

        log.info('oidc approval approved', {
          id,
          user_id: userId,
          provider: row.provider,
          sub: row.sub,
          email: row.email,
          granted_agent_group_id: groupId,
        });
        return {
          approved: true,
          userId,
          displayName,
          provider: row.provider,
          email: row.email,
          grantedAgentGroupId: groupId,
        };
      },
    },
    deny: {
      access: 'approval',
      description:
        'Deny a pending OIDC sign-in. Marks the row denied; no user is created. ' +
        'Use --id <approval-id> [--note <text>]. The user sees an unchanged pending page until they ' +
        're-attempt sign-in (which will re-queue if the row is still pending, but stays denied if rejected).',
      handler: async (args, ctx) => {
        const id = args.id as string;
        if (!id) throw new Error('--id is required');
        const row = getPendingApproval(id);
        if (!row) throw new Error(`No pending approval: ${id}`);
        if (row.status !== 'pending') throw new Error(`Approval ${id} is already ${row.status}`);
        const note = (args.note as string) || null;
        const resolverUserId = ctx.caller === 'host' ? 'cli-host' : ((ctx as { userId?: string }).userId ?? 'agent');
        resolveApproval({
          id,
          status: 'denied',
          resolved_by_user_id: resolverUserId,
          granted_agent_group_id: null,
          note,
        });
        log.info('oidc approval denied', { id, provider: row.provider, sub: row.sub, email: row.email });
        return { denied: true, provider: row.provider, email: row.email };
      },
    },
  },
});
