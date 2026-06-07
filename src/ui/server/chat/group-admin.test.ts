/**
 * Tests for `POST /api/groups/:gid/admin/archive` — the UI archive surface.
 *
 * Covered (matching the user requirement that SCOPED admins must be
 * able to archive their own group):
 * - 200 for owner, global admin, AND scoped admin of the group.
 * - 403 for non-admin members.
 * - 403 for users with no relationship to the group.
 * - 400 when confirm_folder does not match.
 * - Side-effects on success: DB rows cascade-deleted, folder renamed
 *   with ~ suffix, archive.json + ARCHIVE_RESTORE.md written.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { Writable } from 'stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_ROOT = '/tmp/nanoclaw-test-ui-archive-group';
const TEST_GROUPS_DIR = path.join(TEST_ROOT, 'groups');
const TEST_DATA_DIR = path.join(TEST_ROOT, 'data');

vi.mock('../../../config.js', async () => {
  const actual = await vi.importActual<typeof import('../../../config.js')>('../../../config.js');
  return {
    ...actual,
    GROUPS_DIR: '/tmp/nanoclaw-test-ui-archive-group/groups',
    DATA_DIR: '/tmp/nanoclaw-test-ui-archive-group/data',
  };
});

vi.mock('../../../container-runner.js', () => ({
  wakeContainer: vi.fn().mockResolvedValue(undefined),
  isContainerRunning: vi.fn().mockReturnValue(false),
  getActiveContainerCount: vi.fn().mockReturnValue(0),
  killContainer: vi.fn(),
  buildAgentGroupImage: vi.fn().mockResolvedValue(undefined),
}));

let mockUserId: string | null = null;
vi.mock('../auth.js', () => ({
  authenticate: () => (mockUserId ? { userId: mockUserId } : null),
  recordAccess: vi.fn(),
}));

import { initTestDb, closeDb, runMigrations, getDb, getAgentGroup } from '../../../db/index.js';
import { grantRole } from '../../../modules/permissions/db/user-roles.js';
import { addMember } from '../../../modules/permissions/db/agent-group-members.js';
import { handle } from './routes.js';

const NOW = () => new Date().toISOString();

interface CapturedRes {
  done: Promise<void>;
  res: http.ServerResponse;
  status(): number;
  body(): unknown;
}

function makeRes(): CapturedRes {
  let status = 0;
  const chunks: Buffer[] = [];
  let resolve!: () => void;
  const done = new Promise<void>((r) => {
    resolve = r;
  });
  const w = new Writable({
    write(chunk, _enc, cb): void {
      chunks.push(Buffer.from(chunk));
      cb();
    },
  });
  const res = w as unknown as http.ServerResponse;
  res.writeHead = ((s: number) => {
    status = s;
    return res;
  }) as http.ServerResponse['writeHead'];
  w.on('finish', resolve);
  return {
    done,
    res,
    status: () => status,
    body: () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return raw;
      }
    },
  };
}

function makeReq(method: string, url: string, body?: unknown): http.IncomingMessage {
  const buf = body !== undefined ? Buffer.from(JSON.stringify(body)) : Buffer.alloc(0);
  let pulled = false;
  return {
    method,
    url,
    headers: { host: 'localhost', 'content-type': 'application/json' },
    socket: { remoteAddress: '127.0.0.1' },
    [Symbol.asyncIterator]() {
      return {
        next: () => {
          if (pulled || buf.length === 0) return Promise.resolve({ value: undefined, done: true });
          pulled = true;
          return Promise.resolve({ value: buf, done: false });
        },
      };
    },
  } as unknown as http.IncomingMessage;
}

async function call(method: string, url: string, body?: unknown): Promise<CapturedRes> {
  const cap = makeRes();
  await handle(makeReq(method, url, body), cap.res);
  try {
    cap.res.end();
  } catch {
    /* already ended */
  }
  await cap.done;
  return cap;
}

function seedUser(id: string, name = 'Test'): void {
  getDb()
    .prepare(`INSERT INTO users (id, kind, display_name, created_at) VALUES (?, 'web', ?, ?)`)
    .run(id, name, NOW());
}

function seedGroup(id: string, folder: string): void {
  getDb()
    .prepare(`INSERT INTO agent_groups (id, name, folder, agent_provider, created_at) VALUES (?, ?, ?, NULL, ?)`)
    .run(id, folder, folder, NOW());
  getDb().prepare(`INSERT INTO container_configs (agent_group_id, updated_at) VALUES (?, ?)`).run(id, NOW());
  fs.mkdirSync(path.join(TEST_GROUPS_DIR, folder), { recursive: true });
  fs.writeFileSync(path.join(TEST_GROUPS_DIR, folder, 'CLAUDE.local.md'), '# seed\n', 'utf-8');
}

beforeEach(() => {
  if (fs.existsSync(TEST_ROOT)) fs.rmSync(TEST_ROOT, { recursive: true });
  fs.mkdirSync(TEST_GROUPS_DIR, { recursive: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  const db = initTestDb();
  runMigrations(db);
  mockUserId = null;
});

afterEach(() => {
  closeDb();
  if (fs.existsSync(TEST_ROOT)) fs.rmSync(TEST_ROOT, { recursive: true });
});

describe('POST /api/groups/:gid/admin/archive', () => {
  it('owner can archive', async () => {
    seedUser('web:owner');
    grantRole({
      user_id: 'web:owner',
      role: 'owner',
      agent_group_id: null,
      granted_by: 'web:owner',
      granted_at: NOW(),
    });
    seedGroup('ag-own', 'own-grp');
    mockUserId = 'web:owner';

    const res = await call('POST', '/ui/chat/api/groups/ag-own/admin/archive', { confirm_folder: 'own-grp' });
    expect(res.status()).toBe(200);
    const body = res.body() as { ok: boolean; folder: string; archivedFolder: string };
    expect(body.ok).toBe(true);
    expect(body.folder).toBe('own-grp');
    expect(fs.existsSync(path.join(TEST_GROUPS_DIR, 'own-grp~', 'archive.json'))).toBe(true);
    expect(getAgentGroup('ag-own')).toBeUndefined();
  });

  it('global admin can archive', async () => {
    seedUser('web:gadmin');
    grantRole({
      user_id: 'web:gadmin',
      role: 'admin',
      agent_group_id: null,
      granted_by: 'web:gadmin',
      granted_at: NOW(),
    });
    seedGroup('ag-gadm', 'gadm-grp');
    mockUserId = 'web:gadmin';

    const res = await call('POST', '/ui/chat/api/groups/ag-gadm/admin/archive', { confirm_folder: 'gadm-grp' });
    expect(res.status()).toBe(200);
    expect(getAgentGroup('ag-gadm')).toBeUndefined();
  });

  it('SCOPED admin of the group can archive (load-bearing — scoped admins must own this op)', async () => {
    seedUser('web:scoped');
    seedGroup('ag-scoped', 'scoped-grp');
    grantRole({
      user_id: 'web:scoped',
      role: 'admin',
      agent_group_id: 'ag-scoped',
      granted_by: 'web:scoped',
      granted_at: NOW(),
    });
    mockUserId = 'web:scoped';

    const res = await call('POST', '/ui/chat/api/groups/ag-scoped/admin/archive', { confirm_folder: 'scoped-grp' });
    expect(res.status()).toBe(200);
    expect(getAgentGroup('ag-scoped')).toBeUndefined();
    expect(fs.existsSync(path.join(TEST_GROUPS_DIR, 'scoped-grp~'))).toBe(true);
  });

  it('plain member (no admin role) is rejected with 403', async () => {
    seedUser('web:member');
    seedGroup('ag-mem', 'mem-grp');
    addMember({ user_id: 'web:member', agent_group_id: 'ag-mem', added_by: null, added_at: NOW() });
    mockUserId = 'web:member';

    const res = await call('POST', '/ui/chat/api/groups/ag-mem/admin/archive', { confirm_folder: 'mem-grp' });
    expect(res.status()).toBe(403);
    expect(getAgentGroup('ag-mem')).toBeDefined();
    expect(fs.existsSync(path.join(TEST_GROUPS_DIR, 'mem-grp'))).toBe(true);
  });

  it('non-member with no privilege is rejected with 403', async () => {
    seedUser('web:nobody');
    seedGroup('ag-priv', 'priv-grp');
    mockUserId = 'web:nobody';

    const res = await call('POST', '/ui/chat/api/groups/ag-priv/admin/archive', { confirm_folder: 'priv-grp' });
    expect(res.status()).toBe(403);
    expect(getAgentGroup('ag-priv')).toBeDefined();
  });

  it('returns 400 when confirm_folder does not match', async () => {
    seedUser('web:owner');
    grantRole({
      user_id: 'web:owner',
      role: 'owner',
      agent_group_id: null,
      granted_by: 'web:owner',
      granted_at: NOW(),
    });
    seedGroup('ag-bad', 'bad-grp');
    mockUserId = 'web:owner';

    const res = await call('POST', '/ui/chat/api/groups/ag-bad/admin/archive', { confirm_folder: 'wrong' });
    expect(res.status()).toBe(400);
    expect(getAgentGroup('ag-bad')).toBeDefined();
  });

  it('returns 403 for missing groups (does not leak existence)', async () => {
    seedUser('web:owner');
    grantRole({
      user_id: 'web:owner',
      role: 'owner',
      agent_group_id: null,
      granted_by: 'web:owner',
      granted_at: NOW(),
    });
    mockUserId = 'web:owner';

    const res = await call('POST', '/ui/chat/api/groups/ag-missing/admin/archive', { confirm_folder: 'x' });
    expect(res.status()).toBe(403);
  });
});
