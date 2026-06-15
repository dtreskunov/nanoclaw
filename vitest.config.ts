import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // container/agent-runner tests run under Bun (they depend on bun:sqlite).
    // See container/agent-runner/package.json "test" script.
    include: ['src/**/*.test.ts', 'setup/**/*.test.ts', 'scripts/**/*.test.ts'],
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
