/**
 * Unknown-user approval flow.
 *
 * When an OIDC callback can't resolve a sign-in to an existing user (no
 * matching `oidc_links` row, no auto-link by verified email), it queues a
 * `pending_user_approvals` row and calls `requestUserApproval` to:
 *
 *   1. Pick an eligible approver (global admin → owner — same as `pickApprover(null)`).
 *   2. Open / reuse a DM to that approver on a reachable channel.
 *   3. Persist `approver_user_id` / `approver_channel_type` / `approver_platform_id`
 *      on the pending row (so the response handler can authorize the click).
 *   4. Deliver an Approve / Reject card.
 *
 * On approve: the response handler in this file mints a new user, links
 * the OIDC subject, seeds the `web` identity, scaffolds a per-user agent
 * group (folder = `<provider>-<sub>`, stable across email/display-name
 * changes), grants the user `admin` on it, and resolves the pending row.
 *
 * On reject: just resolves the row as `denied`. The pending page polls the
 * row and renders a terminal denial view when it next refreshes.
 *
 * Dedup: if `approver_user_id` is already set on the row, we don't re-pick
 * or re-deliver — repeated sign-in attempts from the same Google account
 * coalesce onto the existing card (the row's UNIQUE(provider, sub) plus
 * the existing `findPendingByOidcSub` lookup in oidc-routes ensure the
 * same id is reused).
 *
 * Failure modes (logged + row NOT updated, so a future attempt can retry):
 *   - No eligible approver in user_roles — fresh install, no owner yet.
 *   - Approver has no reachable DM (no user_dms row + channel can't
 *     openDM) — e.g. owner hasn't registered on any channel we're wired to.
 *   - Delivery adapter missing.
 */
import { normalizeOptions, type RawOption } from '../../channels/ask-question.js';
import { createAgentGroup } from '../../db/agent-groups.js';
import { getDeliveryAdapter } from '../../delivery.js';
import { initGroupFilesystem } from '../../group-init.js';
import { log } from '../../log.js';
import { registerResponseHandler, type ResponsePayload } from '../../response-registry.js';
import { pickApprovalDelivery, pickApprover } from '../approvals/primitive.js';
import { getIdentity } from './db/identities.js';
import {
  approvePendingUser,
  getPendingApproval,
  resolveApproval,
  setApprover,
  type PendingUserApproval,
} from './db/pending-user-approvals.js';
import { isGlobalAdmin, isOwner } from './db/user-roles.js';

const APPROVAL_OPTIONS: RawOption[] = [
  { label: 'Approve', selectedLabel: '✅ Approved', value: 'approve' },
  { label: 'Reject', selectedLabel: '❌ Rejected', value: 'reject' },
];

// ── Folder slug ──────────────────────────────────────────────────────────

/**
 * Build the per-user agent group folder slug. Stable across email or
 * display-name changes — the OIDC `(provider, sub)` pair is the only
 * identifier Google guarantees won't change. Google `sub` is digits-only;
 * other providers may emit anything, so strip to filesystem-safe chars.
 */
export function userAgentGroupFolder(provider: string, sub: string): string {
  const safeSub = sub.replace(/[^A-Za-z0-9_-]/g, '');
  if (!safeSub) {
    throw new Error(`OIDC sub for provider "${provider}" sanitized to empty string`);
  }
  return `${provider}-${safeSub}`;
}

// ── Agent group provisioning ─────────────────────────────────────────────

export interface ScaffoldPerUserAgentGroupInput {
  provider: string;
  sub: string;
  displayName: string | null;
  email: string | null;
}

/**
 * Create the agent_groups row for a freshly-approved user. DB-only — the
 * filesystem init (`initGroupFilesystem`) is intentionally split out so it
 * runs AFTER the surrounding transaction commits (see {@link approvePendingUser}
 * postCommit). Returns the new agent_group_id.
 *
 * Collision policy: the schema's UNIQUE on `agent_groups.folder` will
 * surface a SQLite constraint error if the same `(provider, sub)` is
 * provisioned twice. That should never happen in normal flow (the OIDC
 * callback only reaches approval queueing for sign-ins with no existing
 * oidc_link row), so we don't suppress it — it indicates a bug upstream.
 */
export function scaffoldPerUserAgentGroupDb(input: ScaffoldPerUserAgentGroupInput): string {
  const folder = userAgentGroupFolder(input.provider, input.sub);
  const name = input.displayName || input.email || folder;
  const id = `ag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  createAgentGroup({
    id,
    name,
    folder,
    agent_provider: null,
    created_at: new Date().toISOString(),
  });
  log.info('Per-user agent group created', { id, folder, name, provider: input.provider, sub: input.sub });
  return id;
}

/**
 * Initialize the on-disk state for a per-user agent group. Idempotent.
 * Called from the postCommit hook in {@link approvePendingUser} so a
 * filesystem failure does not strand a half-committed user record.
 */
export function initPerUserAgentGroupFs(agentGroupId: string, folder: string, name: string): void {
  initGroupFilesystem({
    id: agentGroupId,
    name,
    folder,
    agent_provider: null,
    created_at: new Date().toISOString(),
  });
}

// ── Approval card delivery ───────────────────────────────────────────────

function buildQuestion(row: PendingUserApproval): { title: string; question: string } {
  const who = row.display_name || row.email || `${row.provider}/${row.sub}`;
  const lines: string[] = [];
  lines.push(`${who} signed in via ${row.provider} and is waiting for approval.`);
  if (row.email && row.email !== who) lines.push(`Email: ${row.email}`);
  lines.push(`Requested: ${row.created_at}`);
  lines.push('');
  lines.push('Approving creates a new user and a per-user agent group; the user logs in immediately.');
  return { title: '👤 New user wants access', question: lines.join('\n') };
}

export async function requestUserApproval(pendingId: string): Promise<void> {
  const row = getPendingApproval(pendingId);
  if (!row) {
    log.warn('requestUserApproval: pending row not found', { pendingId });
    return;
  }
  if (row.status !== 'pending') {
    log.debug('requestUserApproval: row not pending — skipping card', { pendingId, status: row.status });
    return;
  }
  if (row.approver_user_id) {
    // Card already delivered to an approver — repeated sign-in attempts
    // from the same Google account hit this branch via findPendingByOidcSub.
    log.debug('requestUserApproval: approver already assigned — skipping duplicate card', {
      pendingId,
      approver: row.approver_user_id,
    });
    return;
  }

  // No agent-group scope yet (the agent group is provisioned at approve time),
  // so pickApprover(null) gives us global admins + owners.
  const approvers = pickApprover(null);
  if (approvers.length === 0) {
    log.warn('User approval skipped — no owner or global admin configured', { pendingId });
    return;
  }

  const target = await pickApprovalDelivery(approvers, '');
  if (!target) {
    log.warn('User approval skipped — no DM channel for any approver', { pendingId });
    return;
  }

  setApprover(pendingId, {
    user_id: target.userId,
    channel_type: target.messagingGroup.channel_type,
    platform_id: target.messagingGroup.platform_id,
  });

  const adapter = getDeliveryAdapter();
  if (!adapter) {
    log.error('User approval row updated but no delivery adapter is wired', { pendingId });
    return;
  }

  const { title, question } = buildQuestion(row);
  const options = normalizeOptions(APPROVAL_OPTIONS);
  try {
    await adapter.deliver(
      target.messagingGroup.channel_type,
      target.messagingGroup.platform_id,
      null,
      'chat-sdk',
      JSON.stringify({
        type: 'ask_question',
        questionId: pendingId,
        title,
        question,
        options,
      }),
    );
    log.info('User approval card delivered', {
      pendingId,
      approver: target.userId,
      channel: target.messagingGroup.channel_type,
    });
  } catch (err) {
    log.error('User approval card delivery failed', { pendingId, err });
  }
}

// ── Response handler ─────────────────────────────────────────────────────

/**
 * Claim rule: questionId matches a row in pending_user_approvals. If no
 * such row, return false so the next handler gets a shot.
 *
 * Authorization: clicker must be an owner or global admin. Per-group
 * admins are not authorized — user onboarding is a global act.
 */
async function handleUserApprovalResponse(payload: ResponsePayload): Promise<boolean> {
  const row = getPendingApproval(payload.questionId);
  if (!row) return false;

  if (row.status !== 'pending') {
    log.debug('User approval click ignored — row already resolved', {
      pendingId: row.id,
      status: row.status,
    });
    return true;
  }

  const clickerId = payload.userId ? (getIdentity(payload.channelType, payload.userId)?.user_id ?? null) : null;
  if (!clickerId || (!isOwner(clickerId) && !isGlobalAdmin(clickerId))) {
    log.warn('User approval click rejected — unauthorized clicker', {
      pendingId: row.id,
      clickerId,
      expectedApprover: row.approver_user_id,
    });
    return true;
  }

  // chat-sdk buttons send the normalized value ('approve'/'reject'); the
  // resend email-reply path falls through to raw answer text ('Approve',
  // 'approved', etc.) because pending_user_approvals isn't recognized by
  // getAskQuestionRender. Normalize on both sides and refuse to act on
  // anything that doesn't clearly match either option.
  const decision = decideFromAnswer(payload.value);
  if (decision === 'approve') {
    try {
      approvePendingUser({
        id: row.id,
        resolverUserId: clickerId,
        provisionAgentGroup: ({ row: r }) =>
          scaffoldPerUserAgentGroupDb({
            provider: r.provider,
            sub: r.sub,
            displayName: r.display_name,
            email: r.email,
          }),
        postCommit: ({ agentGroupId, row: r }) => {
          if (!agentGroupId) return;
          const folder = userAgentGroupFolder(r.provider, r.sub);
          const name = r.display_name || r.email || folder;
          initPerUserAgentGroupFs(agentGroupId, folder, name);
        },
      });
    } catch (err) {
      log.error('User approval handler threw on approve', { pendingId: row.id, err });
    }
    return true;
  }

  if (decision === 'reject') {
    resolveApproval({
      id: row.id,
      status: 'denied',
      resolved_by_user_id: clickerId,
      granted_agent_group_id: null,
      note: null,
    });
    log.info('User approval denied', { pendingId: row.id, clickerId, provider: row.provider, sub: row.sub });
    return true;
  }

  log.warn('User approval reply ignored — could not interpret answer', {
    pendingId: row.id,
    rawValue: payload.value,
    clickerId,
  });
  return true;
}

/**
 * Map the response payload's `value` to either 'approve', 'reject', or
 * undefined (ambiguous — log and bail). Tolerates both the normalized
 * option values that chat-sdk button clicks send and the raw free-form
 * text that resend email replies carry through.
 */
function decideFromAnswer(raw: string | null | undefined): 'approve' | 'reject' | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase();
  if (/^(approve|approved|approves|yes|y|ok|allow|accept|accepted)\b/.test(v)) return 'approve';
  if (/^(reject|rejected|deny|denied|denies|no|n|cancel)\b/.test(v)) return 'reject';
  return undefined;
}

registerResponseHandler(handleUserApprovalResponse);
