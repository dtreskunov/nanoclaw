import { getDb } from '../../db/connection.js';
import { log } from '../../log.js';
import {
  getPendingApproval,
  approvePendingUser,
  resolveApproval,
} from '../../modules/permissions/db/pending-user-approvals.js';
import {
  initPerUserAgentGroupFs,
  scaffoldPerUserAgentGroupDb,
  userAgentGroupFolder,
} from '../../modules/permissions/user-approval.js';
import { registerResource } from '../crud.js';

/**
 * `ncl pending-approvals` — admin surface for OIDC sign-in requests that
 * landed in `pending_user_approvals` (an unrecognized Google account hit
 * the callback). `approve` mints the user, links the OIDC subject,
 * grants membership to an agent group (auto-provisioned per-user unless
 * an explicit `--group` is given), and marks the row resolved. `deny`
 * just marks it resolved.
 *
 * The same flow runs automatically when an admin taps Approve on the DM
 * card delivered by src/modules/permissions/user-approval.ts. This CLI
 * surface is the fallback / scripted entry point — they call the same
 * shared helpers.
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
        'Approve a pending OIDC sign-in. Mints a new user, links the OIDC subject, and auto-provisions a ' +
        'per-user agent group (folder = <provider>-<sub>) with the new user as scoped admin. ' +
        'Use --id <approval-id> [--group <ag-id>] [--display-name <name>] [--note <text>]. ' +
        'Pass --group to grant access to an existing group instead of auto-provisioning.',
      handler: async (args, ctx) => {
        const id = args.id as string;
        if (!id) throw new Error('--id is required');
        const row = getPendingApproval(id);
        if (!row) throw new Error(`No pending approval: ${id}`);
        if (row.status !== 'pending') throw new Error(`Approval ${id} is already ${row.status}`);

        const overrideGroupId = (args.group as string) || null;
        if (overrideGroupId) {
          const ag = getDb().prepare('SELECT id FROM agent_groups WHERE id = ?').get(overrideGroupId);
          if (!ag) throw new Error(`Unknown agent group: ${overrideGroupId}`);
        }

        const displayName = (args['display-name'] as string) || null;
        const note = (args.note as string) || null;
        const resolverUserId = ctx.caller === 'host' ? 'cli-host' : ((ctx as { userId?: string }).userId ?? 'cli-host');

        const result = approvePendingUser({
          id,
          resolverUserId,
          displayName,
          note,
          agentGroupId: overrideGroupId,
          provisionAgentGroup: overrideGroupId
            ? undefined
            : ({ row: r }) =>
                scaffoldPerUserAgentGroupDb({
                  provider: r.provider,
                  sub: r.sub,
                  displayName: r.display_name,
                  email: r.email,
                }),
          postCommit: ({ agentGroupId, row: r }) => {
            if (!agentGroupId || overrideGroupId) return;
            const folder = userAgentGroupFolder(r.provider, r.sub);
            const name = r.display_name || r.email || folder;
            initPerUserAgentGroupFs(agentGroupId, folder, name);
          },
        });

        return {
          approved: true,
          userId: result.userId,
          displayName: result.displayName,
          provider: row.provider,
          email: row.email,
          grantedAgentGroupId: result.agentGroupId,
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
