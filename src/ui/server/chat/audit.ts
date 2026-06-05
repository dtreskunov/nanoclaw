/**
 * Audit-log seam for chat-UI admin mutations.
 *
 * Phase 1: emits a structured log line. Phase 2 will swap this for a real
 * `admin_audit` table write — every chat-UI admin handler already calls
 * this, so no retrofit is needed.
 */
import { log } from '../../../log.js';

export interface AdminActionRecord {
  actorUserId: string;
  action: string;
  targetKind: string;
  targetId: string;
  payload?: Record<string, unknown>;
}

export function recordAdminAction(record: AdminActionRecord): void {
  log.info('admin_action', {
    actor: record.actorUserId,
    action: record.action,
    target: `${record.targetKind}:${record.targetId}`,
    payload: record.payload ?? {},
  });
}
