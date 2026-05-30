/**
 * Identity-link challenge CRUD. A challenge is a short-lived (default
 * 10 min) verification record created when a logged-in user wants to
 * claim a (channel_type, handle). The code is DM'd to the claimed handle
 * in plaintext and stored here as `sha256` only.
 *
 * `consumed_at` non-null = successful verify; the row stays for audit
 * but won't validate a second time.
 */
import { createHash, randomUUID } from 'node:crypto';

import { getDb } from '../../../db/connection.js';

export interface IdentityLinkChallenge {
  id: string;
  user_id: string;
  channel_type: string;
  handle: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  created_at: string;
  consumed_at: string | null;
}

export const DEFAULT_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const MAX_ACTIVE_PER_USER = 3;

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** Six-digit numeric code. Padded so leading zeros survive. */
export function generateCode(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
}

export function countActiveForUser(userId: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM identity_link_challenges
       WHERE user_id = ? AND consumed_at IS NULL AND expires_at > datetime('now')`,
    )
    .get(userId) as { n: number };
  return row.n;
}

export function listActiveForUser(userId: string): IdentityLinkChallenge[] {
  return getDb()
    .prepare(
      `SELECT * FROM identity_link_challenges
       WHERE user_id = ? AND consumed_at IS NULL AND expires_at > datetime('now')
       ORDER BY created_at DESC`,
    )
    .all(userId) as IdentityLinkChallenge[];
}

export function getChallenge(id: string): IdentityLinkChallenge | undefined {
  return getDb().prepare('SELECT * FROM identity_link_challenges WHERE id = ?').get(id) as
    | IdentityLinkChallenge
    | undefined;
}

export function createChallenge(args: { user_id: string; channel_type: string; handle: string; ttl_ms?: number }): {
  row: IdentityLinkChallenge;
  code: string;
} {
  const code = generateCode();
  const id = `ilc-${randomUUID()}`;
  const ttl = args.ttl_ms ?? DEFAULT_TTL_MS;
  const expiresAt = new Date(Date.now() + ttl).toISOString();
  getDb()
    .prepare(
      `INSERT INTO identity_link_challenges
       (id, user_id, channel_type, handle, code_hash, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, args.user_id, args.channel_type, args.handle, sha256Hex(code), expiresAt);
  return { row: getChallenge(id)!, code };
}

/**
 * Increment attempts; return the new count. Caller should reject the
 * challenge when it crosses MAX_ATTEMPTS.
 */
export function incrementAttempts(id: string): number {
  getDb().prepare('UPDATE identity_link_challenges SET attempts = attempts + 1 WHERE id = ?').run(id);
  const row = getChallenge(id);
  return row ? row.attempts : 0;
}

export function verifyCode(id: string, plaintext: string): boolean {
  const row = getChallenge(id);
  if (!row) return false;
  return row.code_hash === sha256Hex(plaintext);
}

export function consumeChallenge(id: string): void {
  getDb().prepare(`UPDATE identity_link_challenges SET consumed_at = datetime('now') WHERE id = ?`).run(id);
}
