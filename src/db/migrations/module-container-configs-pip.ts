import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

export const moduleContainerConfigsPip: Migration = {
  version: 19,
  name: 'container-configs-pip',
  up(db: Database.Database) {
    db.prepare("ALTER TABLE container_configs ADD COLUMN packages_pip TEXT NOT NULL DEFAULT '[]'").run();
  },
};
