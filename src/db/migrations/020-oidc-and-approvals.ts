import type Database from 'better-sqlite3';

import type { Migration } from './index.js';

/**
 * OIDC sign-in (Phase 3): `oidc_links` binds an external OIDC subject to
 * one of our users; `pending_user_approvals` holds the request when an
 * unrecognized OIDC subject signs in for the first time, until an admin
 * approves and assigns access to an agent group.
 *
 * Notes:
 * - `oidc_links` PK is `(provider, sub)` — the OIDC subject claim is
 *   stable per (issuer, account) and is what we should match on, NOT email
 *   (email can change, sub cannot).
 * - We denormalize `email` on both tables for audit / display; the
 *   authoritative claim snapshot lives in `claims_json`.
 * - `pending_user_approvals` is UNIQUE on (provider, sub) so repeated
 *   sign-in attempts from the same Google account before approval coalesce
 *   into one pending row, not a flood.
 */
export const migration020: Migration = {
  version: 20,
  name: 'oidc-and-approvals',
  up(db: Database.Database) {
    db.exec(`
      CREATE TABLE oidc_links (
        provider     TEXT NOT NULL,
        sub          TEXT NOT NULL,
        user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email        TEXT,
        claims_json  TEXT,
        linked_at    TEXT NOT NULL DEFAULT (datetime('now')),
        last_seen_at TEXT,
        PRIMARY KEY (provider, sub)
      );
      CREATE INDEX oidc_links_by_user ON oidc_links(user_id);
      CREATE INDEX oidc_links_by_email ON oidc_links(email);

      CREATE TABLE pending_user_approvals (
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
        granted_agent_group_id TEXT,
        UNIQUE(provider, sub)
      );
      CREATE INDEX pending_user_approvals_by_status ON pending_user_approvals(status);
    `);
  },
};
