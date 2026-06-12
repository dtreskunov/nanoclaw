import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

export const moduleContainerConfigsSmallModel: Migration = {
  version: 27,
  name: 'container-configs-small-model',
  up(db: Database.Database) {
    db.prepare('ALTER TABLE container_configs ADD COLUMN small_model TEXT').run();
  },
};
