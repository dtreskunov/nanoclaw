import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // container/agent-runner tests run under Bun (they depend on bun:sqlite).
    // See container/agent-runner/package.json "test" script.
    // container/*.test.ts: top-level only — container/agent-runner tests run
    // under Bun (they depend on bun:sqlite) and must not be picked up here.
    include: ['src/**/*.test.ts', 'setup/**/*.test.ts', 'scripts/**/*.test.ts', 'container/*.test.ts'],
    env: {
      // Tests that boot real channel adapters (e.g. the resend webhook
      // adapter) start the shared HTTP server. Bind an ephemeral port so the
      // suite never collides with a running nanoclaw service on the default
      // production port (3000), which otherwise crashes the vitest worker
      // with EADDRINUSE via the uncaught-exception handler.
      WEBHOOK_PORT: '0',
    },
  },
});
