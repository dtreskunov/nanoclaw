import type Database from 'better-sqlite3';

import type { Migration } from './index.js';

/**
 * Tighten `unregistered_senders.user_id` to a real FK on `users(id)`.
 *
 * Migration 018 normalized most user-id references to UUIDs, but rows
 * inserted into `unregistered_senders` since then can still arrive as
 * `${channel}:${handle}` namespaced strings (the dropped-messages writer
 * just stamps whatever the caller hands it). With Option B making
 * `messages_in.sender_user_id` the canonical UUID, the dropped-sender
 * record should match the same shape.
 *
 * Rebuild path (SQLite can't add a FK to an existing column):
 *   1. Backfill: for each row with a non-UUID user_id, look up
 *      `identities` by (channel, handle) split on the first ':' and
 *      rewrite to the resolved users.id; null out the unresolvable.
 *   2. Recreate the table with `user_id TEXT REFERENCES users(id)
 *      ON DELETE SET NULL`.
 *   3. Copy + swap.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const migration023: Migration = {
  version: 23,
  name: 'unregistered-senders-uuid',
  up: (db: Database.Database) => {
    type Row = { rowid: number; user_id: string | null; channel_type: string };
    const rows = db
      .prepare('SELECT rowid, user_id, channel_type FROM unregistered_senders WHERE user_id IS NOT NULL')
      .all() as Row[];

    const lookupByPair = db.prepare('SELECT user_id FROM identities WHERE channel = ? AND handle = ? LIMIT 1');
    const userExists = db.prepare('SELECT 1 FROM users WHERE id = ?');
    const updateUserId = db.prepare('UPDATE unregistered_senders SET user_id = ? WHERE rowid = ?');

    for (const r of rows) {
      const v = r.user_id;
      if (!v) continue;

      if (UUID_RE.test(v)) {
        // Already UUID-shaped; verify it exists, otherwise null it out
        // so the FK we're about to add doesn't fail.
        if (!userExists.get(v)) updateUserId.run(null, r.rowid);
        continue;
      }

      // Try to resolve the namespaced form via identities.
      const idx = v.indexOf(':');
      let channel: string;
      let handle: string;
      if (idx < 0) {
        channel = r.channel_type;
        handle = v;
      } else {
        channel = v.slice(0, idx);
        handle = v.slice(idx + 1);
      }
      const hit = lookupByPair.get(channel, handle) as { user_id: string } | undefined;
      updateUserId.run(hit?.user_id ?? null, r.rowid);
    }

    db.exec(`
      CREATE TABLE unregistered_senders__new (
        channel_type    TEXT NOT NULL,
        platform_id     TEXT NOT NULL,
        user_id         TEXT REFERENCES users(id) ON DELETE SET NULL
                        CHECK (user_id IS NULL OR (
                          length(user_id) = 36
                          AND substr(user_id, 9, 1) = '-'
                          AND substr(user_id, 14, 1) = '-'
                          AND substr(user_id, 19, 1) = '-'
                          AND substr(user_id, 24, 1) = '-'
                        )),
        sender_name     TEXT,
        reason          TEXT NOT NULL,
        messaging_group_id TEXT,
        agent_group_id  TEXT,
        message_count   INTEGER NOT NULL DEFAULT 1,
        first_seen      TEXT NOT NULL,
        last_seen       TEXT NOT NULL,
        PRIMARY KEY (channel_type, platform_id)
      );

      INSERT INTO unregistered_senders__new
        (channel_type, platform_id, user_id, sender_name, reason,
         messaging_group_id, agent_group_id, message_count, first_seen, last_seen)
      SELECT channel_type, platform_id, user_id, sender_name, reason,
             messaging_group_id, agent_group_id, message_count, first_seen, last_seen
        FROM unregistered_senders;

      DROP TABLE unregistered_senders;
      ALTER TABLE unregistered_senders__new RENAME TO unregistered_senders;

      CREATE INDEX IF NOT EXISTS idx_unregistered_senders_last_seen
        ON unregistered_senders(last_seen);
    `);
  },
};
