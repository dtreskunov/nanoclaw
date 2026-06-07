/**
 * Permission decisions for adding/removing an agent-to-agent destination
 * between two groups.
 *
 * Auto-apply when the requester is admin on BOTH source and target groups
 * (they already have unilateral authority on both sides — no second party
 * to ask). Otherwise, require approval from a target-group admin.
 *
 * The source-only path is the interesting case: the requester can already
 * add destinations within the source group via the existing per-group
 * admin surface, but the ACL row also grants the source agent the right
 * to send messages and forward files INTO the target session — that is
 * the target group's concern, hence the target-side approval.
 */
import { getAgentGroup } from '../../db/agent-groups.js';
import { hasAdminPrivilege } from '../permissions/db/user-roles.js';

export type LinkAuthDecision =
  | { mode: 'auto'; reason: 'admin_on_both' }
  | { mode: 'needs-approval'; reason: 'admin_source_only'; approverAgentGroupId: string }
  | { mode: 'denied'; reason: LinkAuthDenyReason };

export type LinkAuthDenyReason = 'unknown_source_group' | 'unknown_target_group' | 'self_link' | 'not_admin_on_source';

export function authorizeAgentLink(
  userId: string,
  sourceAgentGroupId: string,
  targetAgentGroupId: string,
): LinkAuthDecision {
  if (!sourceAgentGroupId || !targetAgentGroupId) {
    return { mode: 'denied', reason: !sourceAgentGroupId ? 'unknown_source_group' : 'unknown_target_group' };
  }
  if (sourceAgentGroupId === targetAgentGroupId) {
    return { mode: 'denied', reason: 'self_link' };
  }
  if (!getAgentGroup(sourceAgentGroupId)) {
    return { mode: 'denied', reason: 'unknown_source_group' };
  }
  if (!getAgentGroup(targetAgentGroupId)) {
    return { mode: 'denied', reason: 'unknown_target_group' };
  }

  // Source admin is the floor — without it the user cannot mutate the
  // source group's destinations at all. Owners and global admins satisfy
  // this via hasAdminPrivilege.
  if (!hasAdminPrivilege(userId, sourceAgentGroupId)) {
    return { mode: 'denied', reason: 'not_admin_on_source' };
  }

  if (hasAdminPrivilege(userId, targetAgentGroupId)) {
    return { mode: 'auto', reason: 'admin_on_both' };
  }

  return {
    mode: 'needs-approval',
    reason: 'admin_source_only',
    approverAgentGroupId: targetAgentGroupId,
  };
}

/**
 * Removal authorization. Removing a destination only revokes capability —
 * it cannot leak data or escalate privilege — so source-side admin is
 * sufficient. Do NOT tighten this without a clear threat model.
 */
export function authorizeAgentLinkRemoval(
  userId: string,
  sourceAgentGroupId: string,
): { allowed: boolean; reason: 'not_admin_on_source' | 'unknown_source_group' | 'ok' } {
  if (!getAgentGroup(sourceAgentGroupId)) {
    return { allowed: false, reason: 'unknown_source_group' };
  }
  if (!hasAdminPrivilege(userId, sourceAgentGroupId)) {
    return { allowed: false, reason: 'not_admin_on_source' };
  }
  return { allowed: true, reason: 'ok' };
}
