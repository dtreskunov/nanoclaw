import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

export const moduleContainerConfigsTranscriptionModel: Migration = {
  version: 26,
  name: 'container-configs-transcription-model',
  up(db: Database.Database) {
    db.prepare('ALTER TABLE container_configs ADD COLUMN transcription_model TEXT').run();
  },
};
