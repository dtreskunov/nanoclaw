/**
 * Regression test for the `instance` NOT NULL gotcha.
 *
 * `messaging_groups.instance` is `TEXT NOT NULL` with no SQL default
 * (migration `messaging-group-instance`). The generic CRUD create omits
 * unset optional columns, which would violate NOT NULL. The `instance`
 * column declares `defaultFrom: 'channel_type'`, so when `--instance` is
 * not supplied it mirrors `channel_type` (the single-instance case).
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { initTestDb, closeDb, runMigrations } from '../../db/index.js';
import { lookup } from '../registry.js';
// Side-effect import: registers the `messaging-groups-*` commands.
import './messaging-groups.js';

const HOST_CTX = { caller: 'host' as const };

function createMessagingGroup(args: Record<string, unknown>) {
  const cmd = lookup('messaging-groups-create');
  if (!cmd) throw new Error('messaging-groups-create command not registered');
  return cmd.handler(cmd.parseArgs(args), HOST_CTX);
}

describe('messaging-groups create — instance defaulting', () => {
  beforeEach(() => {
    const db = initTestDb();
    runMigrations(db);
  });

  afterEach(() => {
    closeDb();
  });

  it('defaults instance to channel_type when --instance is omitted', async () => {
    const row = (await createMessagingGroup({
      channel_type: 'slack',
      platform_id: 'C123',
    })) as Record<string, unknown>;

    expect(row.instance).toBe('slack');
  });

  it('honors an explicit --instance value', async () => {
    const row = (await createMessagingGroup({
      channel_type: 'slack',
      platform_id: 'C999',
      instance: 'slack-secondary',
    })) as Record<string, unknown>;

    expect(row.instance).toBe('slack-secondary');
  });
});
