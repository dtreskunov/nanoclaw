import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

import type { Migration } from './index.js';

/**
 * Identity model: separate "who the user is" (UUID) from "how they're addressable"
 * (one or more `(channel, handle)` rows). Pre-018, `users.id` was a composite
 * `"<channel>:<handle>"` string which conflated identity with addressing and
 * prevented a single user from having multiple platform handles.
 *
 * Backfill rule (matches the pre-018 parseUserId in user-dm.ts):
 *   - If `users.kind` matches the id's prefix → channel=prefix, handle=rest.
 *   - Else (e.g. Teams: kind='teams', id='29:xxx') → channel=kind, handle=id.
 *   - If the id has no colon at all → channel=kind, handle=id (defensive).
 *
 * Rewrites every FK column that holds a user id (with-FK or bare TEXT) in
 * a single transaction with FKs temporarily disabled (the connection-init
 * code sets `foreign_keys=ON`; we toggle it off for the bulk update and
 * restore the prior value at the end).
 */
export const migration018: Migration = {
  version: 18,
  name: 'identities',
  up(db: Database.Database) {
    db.exec(`
      CREATE TABLE identities (
        user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        channel              TEXT NOT NULL,
        handle               TEXT NOT NULL,
        verified_at          TEXT NOT NULL,
        primary_for_channel  INTEGER NOT NULL DEFAULT 0,
        metadata_json        TEXT,
        PRIMARY KEY (channel, handle)
      );
      CREATE INDEX idx_identities_user ON identities(user_id);
    `);

    const users = db.prepare('SELECT id, kind FROM users').all() as { id: string; kind: string }[];
    if (users.length === 0) return;

    const now = new Date().toISOString();
    const idMap = new Map<string, string>();

    const insertIdentity = db.prepare(
      `INSERT INTO identities (user_id, channel, handle, verified_at, primary_for_channel)
       VALUES (?, ?, ?, ?, 1)`,
    );

    for (const u of users) {
      const newId = randomUUID();
      idMap.set(u.id, newId);

      const idx = u.id.indexOf(':');
      let channel: string;
      let handle: string;
      if (idx < 0) {
        channel = u.kind || 'unknown';
        handle = u.id;
      } else {
        const prefix = u.id.slice(0, idx);
        const rest = u.id.slice(idx + 1);
        if (u.kind && u.kind !== prefix) {
          // Teams-style: kind doesn't match prefix → full id is the handle.
          channel = u.kind;
          handle = u.id;
        } else {
          channel = prefix;
          handle = rest;
        }
      }
      insertIdentity.run(newId, channel, handle, now);
    }

    // Rewrite every column holding a user id. FKs must be off so we can
    // mutate users.id (with-FK columns reference it); we update FK columns
    // first to keep the intermediate state self-consistent.
    const fkWasOn = (db.pragma('foreign_keys', { simple: true }) as number) === 1;
    if (fkWasOn) db.pragma('foreign_keys = OFF');

    try {
      const userIdCols: { table: string; col: string }[] = [
        { table: 'user_roles', col: 'user_id' },
        { table: 'user_roles', col: 'granted_by' },
        { table: 'agent_group_members', col: 'user_id' },
        { table: 'agent_group_members', col: 'added_by' },
        { table: 'user_dms', col: 'user_id' },
        { table: 'unregistered_senders', col: 'user_id' },
        { table: 'pending_sender_approvals', col: 'approver_user_id' },
        { table: 'pending_sender_approvals', col: 'sender_identity' },
        { table: 'pending_channel_approvals', col: 'approver_user_id' },
        { table: 'ui_sessions', col: 'user_id' },
        { table: 'ui_downloads', col: 'user_id' },
        { table: 'ui_download_tokens', col: 'issuer_user_id' },
        { table: 'ui_download_tokens', col: 'recipient_user_id' },
      ];

      const tableExists = (name: string): boolean =>
        db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(name) !== undefined;
      const columnExists = (table: string, col: string): boolean => {
        const info = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
        return info.some((c) => c.name === col);
      };

      for (const { table, col } of userIdCols) {
        if (!tableExists(table)) continue;
        if (!columnExists(table, col)) continue;
        const stmt = db.prepare(`UPDATE ${table} SET ${col} = ? WHERE ${col} = ?`);
        for (const [oldId, newId] of idMap) {
          stmt.run(newId, oldId);
        }
      }

      const updateUserPk = db.prepare('UPDATE users SET id = ? WHERE id = ?');
      for (const [oldId, newId] of idMap) {
        updateUserPk.run(newId, oldId);
      }
    } finally {
      if (fkWasOn) db.pragma('foreign_keys = ON');
    }
  },
};
