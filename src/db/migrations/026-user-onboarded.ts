import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

/**
 * Mark users that have completed the first-login onboarding flow.
 *
 * NULL = needs onboarding (shown the splash + name prompts on next OIDC
 * login). Backfilled to NOW for every pre-existing user so we don't pop
 * the wizard at anyone who's already been using the system.
 */
export const migration026: Migration = {
  version: 26,
  name: 'user-onboarded',
  up(db: Database.Database) {
    db.exec(`
      ALTER TABLE users ADD COLUMN onboarded_at TEXT;
      UPDATE users SET onboarded_at = COALESCE(onboarded_at, datetime('now'));
    `);
  },
};
