import type Database from 'better-sqlite3';

import type { Migration } from './index.js';

/**
 * Relax `pending_user_approvals.UNIQUE(provider, sub)` to a partial
 * unique index that only fires for in-flight (pending) rows. Resolved
 * rows (approved / denied / expired) accumulate for audit; a returning
 * user who was previously denied gets a fresh pending row instead of
 * having their historical denial overwritten.
 *
 * SQLite has no DROP CONSTRAINT, so we rebuild the table (same shape as
 * migration 023).
 */
export const migration024: Migration = {
  version: 24,
  name: 'pending-user-approvals-partial-unique',
  up: (db: Database.Database) => {
    db.exec(`
      CREATE TABLE pending_user_approvals__new (
        id                     TEXT PRIMARY KEY,
        provider               TEXT NOT NULL,
        sub                    TEXT NOT NULL,
        email                  TEXT,
        display_name           TEXT,
        claims_json            TEXT,
        approver_user_id       TEXT,
        approver_channel_type  TEXT,
        approver_platform_id   TEXT,
        approver_message_token TEXT,
        status                 TEXT NOT NULL DEFAULT 'pending',
        created_at             TEXT NOT NULL DEFAULT (datetime('now')),
        resolved_at            TEXT,
        resolved_by_user_id    TEXT,
        resolution_note        TEXT,
        granted_agent_group_id TEXT
      );

      INSERT INTO pending_user_approvals__new
        (id, provider, sub, email, display_name, claims_json,
         approver_user_id, approver_channel_type, approver_platform_id,
         approver_message_token, status, created_at, resolved_at,
         resolved_by_user_id, resolution_note, granted_agent_group_id)
      SELECT id, provider, sub, email, display_name, claims_json,
             approver_user_id, approver_channel_type, approver_platform_id,
             approver_message_token, status, created_at, resolved_at,
             resolved_by_user_id, resolution_note, granted_agent_group_id
        FROM pending_user_approvals;

      DROP TABLE pending_user_approvals;
      ALTER TABLE pending_user_approvals__new RENAME TO pending_user_approvals;

      CREATE INDEX pending_user_approvals_by_status
        ON pending_user_approvals(status);

      -- At most one in-flight row per OIDC subject. Resolved rows
      -- accumulate freely for audit.
      CREATE UNIQUE INDEX pending_user_approvals_one_pending_per_sub
        ON pending_user_approvals(provider, sub)
        WHERE status = 'pending';
    `);
  },
};
