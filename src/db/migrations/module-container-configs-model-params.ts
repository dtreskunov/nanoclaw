import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

export const moduleContainerConfigsModelParams: Migration = {
  version: 27,
  name: 'container-configs-model-params',
  up(db: Database.Database) {
    db.prepare("ALTER TABLE container_configs ADD COLUMN model_params TEXT NOT NULL DEFAULT '{}'").run();
  },
};
