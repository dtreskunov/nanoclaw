/**
 * Pending user-approval CRUD. A row is created when an unrecognized OIDC
 * subject tries to sign in; an admin reviews and either approves
 * (creating the user + oidc_link + optional group membership) or denies.
 *
 * The `approver_message_token` is sha256-stored; the plaintext goes in
 * the approval DM link so the admin can click through without needing a
 * separate cookie session. Status transitions are pending → approved |
 * denied | expired (admin tooling or a sweep).
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { getDb } from '../../../db/connection.js';

export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired';

export interface PendingUserApproval {
  id: string;
  provider: string;
  sub: string;
  email: string | null;
  display_name: string | null;
  claims_json: string | null;
  approver_user_id: string | null;
  approver_channel_type: string | null;
  approver_platform_id: string | null;
  approver_message_token: string | null;
  status: ApprovalStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  resolution_note: string | null;
  granted_agent_group_id: string | null;
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/**
 * Find an existing pending row for (provider, sub) — used to coalesce
 * repeat sign-in attempts before approval.
 */
export function findPendingByOidcSub(provider: string, sub: string): PendingUserApproval | undefined {
  return getDb()
    .prepare(`SELECT * FROM pending_user_approvals WHERE provider = ? AND sub = ? AND status = 'pending'`)
    .get(provider, sub) as PendingUserApproval | undefined;
}

export function getPendingApproval(id: string): PendingUserApproval | undefined {
  return getDb().prepare('SELECT * FROM pending_user_approvals WHERE id = ?').get(id) as
    | PendingUserApproval
    | undefined;
}

export function listPendingApprovals(): PendingUserApproval[] {
  return getDb()
    .prepare(`SELECT * FROM pending_user_approvals WHERE status = 'pending' ORDER BY created_at`)
    .all() as PendingUserApproval[];
}

/**
 * Create a new pending row + issue a plaintext approval token (returned
 * once; only the hash is stored). The token is meant for embedding in a
 * DM'd approval link.
 */
export function createPendingApproval(args: {
  provider: string;
  sub: string;
  email: string | null;
  display_name: string | null;
  claims: Record<string, unknown> | null;
}): { row: PendingUserApproval; token: string } {
  const id = `pua-${randomBytes(6).toString('hex')}`;
  const token = randomBytes(24).toString('hex');
  getDb()
    .prepare(
      `INSERT INTO pending_user_approvals
         (id, provider, sub, email, display_name, claims_json, approver_message_token)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      args.provider,
      args.sub,
      args.email,
      args.display_name,
      args.claims ? JSON.stringify(args.claims) : null,
      sha256Hex(token),
    );
  const row = getPendingApproval(id)!;
  return { row, token };
}

export function setApprover(
  id: string,
  approver: { user_id: string; channel_type: string | null; platform_id: string | null },
): void {
  getDb()
    .prepare(
      `UPDATE pending_user_approvals
       SET approver_user_id = ?, approver_channel_type = ?, approver_platform_id = ?
       WHERE id = ?`,
    )
    .run(approver.user_id, approver.channel_type, approver.platform_id, id);
}

export function verifyApprovalToken(id: string, plaintext: string): boolean {
  const row = getPendingApproval(id);
  if (!row || !row.approver_message_token) return false;
  return row.approver_message_token === sha256Hex(plaintext);
}

export function resolveApproval(args: {
  id: string;
  status: 'approved' | 'denied';
  resolved_by_user_id: string;
  granted_agent_group_id: string | null;
  note: string | null;
}): void {
  getDb()
    .prepare(
      `UPDATE pending_user_approvals
       SET status = ?, resolved_at = datetime('now'),
           resolved_by_user_id = ?, granted_agent_group_id = ?, resolution_note = ?
       WHERE id = ? AND status = 'pending'`,
    )
    .run(args.status, args.resolved_by_user_id, args.granted_agent_group_id, args.note, args.id);
}

export { randomUUID };
