/**
 * Approval handler for `add_agent_destination` requests.
 *
 * Fires when an admin of the target agent group approves an inter-agent
 * link request that wasn't auto-applied. The handler creates the destination
 * row(s) under the approver's user id (audit) and notifies the source agent.
 */
import { log } from '../../log.js';
import { getAgentGroup } from '../../db/agent-groups.js';
import type { ApprovalHandlerContext } from '../approvals/index.js';
import { AgentLinkError, applyAgentLink } from './apply-link.js';

export async function applyAgentLinkApproval(ctx: ApprovalHandlerContext): Promise<void> {
  const { payload, userId, notify } = ctx;
  const sourceAgentGroupId = payload.sourceAgentGroupId as string;
  const targetAgentGroupId = payload.targetAgentGroupId as string;
  const localName = payload.localName as string;
  const alsoReverse = payload.alsoReverse === true;
  const reverseLocalName = (payload.reverseLocalName as string | null) ?? undefined;

  const targetGroup = getAgentGroup(targetAgentGroupId);

  try {
    const result = await applyAgentLink({
      sourceAgentGroupId,
      targetAgentGroupId,
      localName,
      createdBy: userId || null,
      alsoReverse,
      reverseLocalName,
    });
    const reverseNote = result.reverse ? ` Reverse link added as "${result.reverse.local_name}".` : '';
    const targetName = targetGroup?.name ?? targetAgentGroupId;
    notify(`Link approved: "${targetName}" is now available as destination "${localName}".${reverseNote}`);
    log.info('agent-link approval applied', {
      sourceAgentGroupId,
      targetAgentGroupId,
      localName,
      alsoReverse,
      approver: userId,
    });
  } catch (err) {
    if (err instanceof AgentLinkError) {
      notify(`Link approval failed: ${err.message}`);
    } else {
      notify('Link approval failed unexpectedly.');
      log.error('agent-link approval failed', { err, sourceAgentGroupId, targetAgentGroupId });
    }
  }
}
