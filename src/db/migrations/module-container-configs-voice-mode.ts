import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

export const moduleContainerConfigsVoiceMode: Migration = {
  version: 25,
  name: 'container-configs-voice-mode',
  up(db: Database.Database) {
    db.prepare("ALTER TABLE container_configs ADD COLUMN voice_mode TEXT NOT NULL DEFAULT 'off'").run();
  },
};
