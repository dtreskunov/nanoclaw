import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

/**
 * Per-agent-group static website hosting.
 *
 * `site_slug` is the DNS label used to derive the public FQDN
 * (`<site_slug>.<PAGES_BASE_DOMAIN>`). It is UNIQUE across groups and
 * defaulted from a sanitized group name. `site_enabled` is the single
 * admin-facing toggle; when on, the workspace folder named exactly like
 * the FQDN is served fully public behind the reverse proxy wildcard.
 */
export const migration025: Migration = {
  version: 25,
  name: 'site-website',
  up(db: Database.Database) {
    db.exec(`
      ALTER TABLE agent_groups ADD COLUMN site_slug TEXT;
      ALTER TABLE agent_groups ADD COLUMN site_enabled INTEGER NOT NULL DEFAULT 0;
      CREATE UNIQUE INDEX idx_agent_groups_site_slug ON agent_groups(site_slug) WHERE site_slug IS NOT NULL;
    `);
  },
};
