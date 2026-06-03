import type Database from 'better-sqlite3';

import type { Migration } from './index.js';

/**
 * Web Push (PWA tier-2 notifications): per-device push subscriptions
 * registered by the chat UI service worker. One row per browser
 * `PushSubscription`; `endpoint` is the natural unique key.
 *
 * `fail_count` is bumped on transient delivery errors and the row is
 * dropped on permanent ones (404/410) — see modules/push/sender.ts.
 */
export const migration022: Migration = {
  version: 22,
  name: 'push-subscriptions',
  up(db: Database.Database) {
    db.exec(`
      CREATE TABLE push_subscriptions (
        id            TEXT PRIMARY KEY,
        user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint      TEXT NOT NULL UNIQUE,
        p256dh        TEXT NOT NULL,
        auth          TEXT NOT NULL,
        ua            TEXT,
        created_at    TEXT NOT NULL,
        last_used_at  TEXT,
        last_error    TEXT,
        fail_count    INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX push_subscriptions_by_user ON push_subscriptions(user_id);
    `);
  },
};
