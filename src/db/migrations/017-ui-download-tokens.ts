import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

export const migration017: Migration = {
  version: 17,
  name: 'ui-download-tokens',
  up(db: Database.Database) {
    db.exec(`
      CREATE TABLE ui_download_tokens (
        token_hash      TEXT PRIMARY KEY,
        issuer_user_id  TEXT NOT NULL REFERENCES users(id),
        recipient_user_id TEXT REFERENCES users(id),
        group_id        TEXT NOT NULL REFERENCES agent_groups(id),
        rel_path        TEXT NOT NULL,
        created_at      TEXT NOT NULL,
        expires_at      TEXT NOT NULL,
        uses_left       INTEGER NOT NULL,
        first_redeemed_at TEXT,
        first_redeemed_ip TEXT,
        first_redeemed_ua TEXT
      );
      CREATE INDEX idx_ui_download_tokens_expires ON ui_download_tokens(expires_at);
      CREATE INDEX idx_ui_download_tokens_issuer ON ui_download_tokens(issuer_user_id);
    `);
  },
};
