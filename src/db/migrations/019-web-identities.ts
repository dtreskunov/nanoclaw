import type Database from 'better-sqlite3';

import type { Migration } from './index.js';

/**
 * Backfill `(channel='web', handle=<user.id>)` identities for users who
 * have already touched the UI. Phase 1's migration 018 produced UUIDs for
 * everyone but only created identity rows for the channel each user
 * originally arrived on. Phase 2 makes the web channel first-class: a web
 * user's handle IS their UUID, recorded as an identity row so the generic
 * resolver in extractAndUpsertUser stops needing a special case.
 *
 * Backfill criteria — any of:
 *   - a row in `ui_sessions` (the user has logged in)
 *   - a row in `messaging_groups` with channel_type='web' and
 *     platform_id matching the user's UUID (a web messaging group exists)
 *
 * From here on, the redeem-magic-link path and the web chat startup path
 * both call `insertIdentity` defensively so new users don't need a
 * migration.
 */
export const migration019: Migration = {
  version: 19,
  name: 'web-identities',
  up(db: Database.Database) {
    const tableExists = (name: string): boolean => {
      const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name) as
        | { name: string }
        | undefined;
      return !!row;
    };

    const candidates = new Set<string>();

    if (tableExists('ui_sessions')) {
      const rows = db.prepare(`SELECT DISTINCT user_id FROM ui_sessions WHERE user_id IS NOT NULL`).all() as {
        user_id: string;
      }[];
      for (const r of rows) candidates.add(r.user_id);
    }

    const mgRows = db.prepare(`SELECT DISTINCT platform_id FROM messaging_groups WHERE channel_type='web'`).all() as {
      platform_id: string;
    }[];
    for (const r of mgRows) {
      const u = db.prepare(`SELECT id FROM users WHERE id=?`).get(r.platform_id) as { id: string } | undefined;
      if (u) candidates.add(u.id);
    }

    if (candidates.size === 0) return;

    const now = new Date().toISOString();
    const insert = db.prepare(
      `INSERT OR IGNORE INTO identities (user_id, channel, handle, verified_at, primary_for_channel)
       VALUES (?, 'web', ?, ?, 1)`,
    );
    for (const userId of candidates) insert.run(userId, userId, now);
  },
};
