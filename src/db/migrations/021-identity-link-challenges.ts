import type Database from 'better-sqlite3';

import type { Migration } from './index.js';

/**
 * Identity linking (Phase 4b): challenges issued when a logged-in user
 * wants to claim a (channel_type, handle) — e.g. "link my Telegram
 * @alice". The host DMs a short code to the claimed handle; the user
 * pastes it back, the row is consumed, an `identities` row is inserted.
 *
 * - `code_hash` is sha256(plaintext) — plaintext is only ever in the DM.
 * - `expires_at` is enforced in the query, not by a sweep; rows linger
 *   for audit. A future sweeper can prune `created_at < now - 7d`.
 * - `consumed_at` non-null = successful verify; further attempts on the
 *   same id are rejected as already-consumed.
 * - No UNIQUE on (channel_type, handle) — multiple users may *attempt*
 *   to claim the same handle simultaneously; first successful verify
 *   wins because `identities` PK is (channel, handle), and the second
 *   verify's INSERT throws.
 */
export const migration021: Migration = {
  version: 21,
  name: 'identity-link-challenges',
  up(db: Database.Database) {
    db.exec(`
      CREATE TABLE identity_link_challenges (
        id            TEXT PRIMARY KEY,
        user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        channel_type  TEXT NOT NULL,
        handle        TEXT NOT NULL,
        code_hash     TEXT NOT NULL,
        expires_at    TEXT NOT NULL,
        attempts      INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        consumed_at   TEXT
      );
      CREATE INDEX identity_link_challenges_by_user ON identity_link_challenges(user_id);
      CREATE INDEX identity_link_challenges_active
        ON identity_link_challenges(user_id, expires_at)
        WHERE consumed_at IS NULL;
    `);
  },
};
