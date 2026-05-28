import type { Migration } from './index.js';

// Persistent map: resend threadId → the original conversation root
// Message-ID. The upstream @resend/chat-sdk-adapter keeps reply-header
// state purely in memory; after a host restart it can't build the
// outbound In-Reply-To / References headers, which breaks email
// threading and shards one Gmail conversation across many sessions.
// This table is the on-disk backing store so headers survive restarts.
export const moduleResendThreadRoots: Migration = {
  version: 18,
  name: 'resend-thread-roots',
  up(db) {
    db.exec(`
      CREATE TABLE resend_thread_roots (
        thread_id       TEXT PRIMARY KEY,
        root_message_id TEXT NOT NULL,
        created_at      TEXT NOT NULL
      );
    `);
  },
};
