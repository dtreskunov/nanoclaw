import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

export const migration016: Migration = {
  version: 16,
  name: 'ui',
  up(db: Database.Database) {
    db.exec(`
      CREATE TABLE ui_sessions (
        token_hash  TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id),
        created_at  TEXT NOT NULL,
        expires_at  TEXT NOT NULL,
        last_used   TEXT
      );
      CREATE INDEX idx_ui_sessions_user ON ui_sessions(user_id);

      CREATE TABLE ui_magic_links (
        token_hash  TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id),
        created_at  TEXT NOT NULL,
        expires_at  TEXT NOT NULL,
        redeemed_at TEXT
      );

      CREATE TABLE ui_access_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     TEXT,
        group_id    TEXT,
        path        TEXT,
        action      TEXT NOT NULL,
        ip          TEXT,
        ts          TEXT NOT NULL
      );
      CREATE INDEX idx_ui_access_log_ts ON ui_access_log(ts);
    `);
  },
};
