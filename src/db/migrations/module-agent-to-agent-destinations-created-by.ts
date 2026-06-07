import type Database from 'better-sqlite3';

import type { Migration } from './index.js';

/**
 * Adds `created_by` (nullable) to `agent_destinations` for audit.
 * Existing rows (channel destinations from initial backfill, and any
 * pre-feature agent destinations) stay NULL — we don't know who added
 * them, and that's acceptable.
 *
 * Nullable on purpose: the column is informational, not load-bearing
 * for routing or ACL. UI surfaces "added by …" when populated.
 */
export const moduleAgentToAgentDestinationsCreatedBy: Migration = {
  version: 1,
  name: 'agent-destinations-created-by',
  up(db: Database.Database) {
    db.exec(`ALTER TABLE agent_destinations ADD COLUMN created_by TEXT REFERENCES users(id)`);
  },
};
