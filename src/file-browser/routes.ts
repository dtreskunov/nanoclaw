/**
 * HTTP route handlers for the file browser. One dispatcher; the server
 * module wraps it in a real `http.Server`.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { URL } from 'url';

import { GROUPS_DIR } from '../config.js';
import { getAgentGroup } from '../db/agent-groups.js';
import { log } from '../log.js';
import { listAccessibleAgentGroups } from '../modules/permissions/access.js';
import { hasAdminPrivilege } from '../modules/permissions/db/user-roles.js';
import {
  authenticate,
  buildClearCookie,
  buildSessionCookie,
  logout as authLogout,
  recordAccess,
  redeemAndCreateSession,
} from './auth.js';
import { classify, resolveSafe } from './classify.js';

// UI assets live under src/ (not compiled by tsc); resolve from project root,
// which the host always runs from.
const UI_DIR = path.resolve(process.cwd(), 'src', 'file-browser', 'ui');
const MAX_INLINE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

/** Path prefix the file browser is mounted under on the shared HTTP server. */
export const MOUNT_PREFIX = '/files';

interface Ctx {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
  secureCookie: boolean;
}

export async function handle(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  secureCookie: boolean,
): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const ctx: Ctx = { req, res, url, secureCookie };

  // Strip the mount prefix so internal route matching stays local.
  let pathname = url.pathname;
  if (pathname === MOUNT_PREFIX) {
    // /files (no trailing slash) → redirect to /files/ so relative URLs resolve.
    res.writeHead(308, { Location: MOUNT_PREFIX + '/' });
    res.end();
    return;
  }
  if (pathname.startsWith(MOUNT_PREFIX + '/')) {
    pathname = pathname.slice(MOUNT_PREFIX.length) || '/';
  }

  try {
    // Public routes.
    if (req.method === 'GET' && pathname === '/auth/redeem') return handleRedeem(ctx);
    if (req.method === 'POST' && pathname === '/auth/logout') return handleLogout(ctx);
    if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) return serveStatic(ctx, 'index.html');
    if (req.method === 'GET' && pathname.startsWith('/ui/')) return serveStatic(ctx, pathname.slice('/ui/'.length));

    // Authenticated routes.
    const session = authenticate(req);
    if (!session) return json(ctx, 401, { error: 'unauthorized' });

    if (req.method === 'GET' && pathname === '/api/me') return handleMe(ctx, session.userId);
    if (req.method === 'GET' && pathname === '/api/groups') return handleGroups(ctx, session.userId);

    const groupMatch = pathname.match(/^\/api\/groups\/([^/]+)\/(tree|file)$/);
    if (req.method === 'GET' && groupMatch) {
      const [, groupId, kind] = groupMatch;
      const relPath = url.searchParams.get('path') ?? '';
      if (kind === 'tree') return handleTree(ctx, session.userId, groupId, relPath);
      if (kind === 'file') return handleFile(ctx, session.userId, groupId, relPath);
    }

    return json(ctx, 404, { error: 'not_found' });
  } catch (err) {
    log.error('File browser handler threw', { url: req.url, err });
    return json(ctx, 500, { error: 'internal_error' });
  }
}

// ── handlers ──────────────────────────────────────────────────────────────

function handleRedeem(ctx: Ctx): void {
  const token = ctx.url.searchParams.get('t');
  if (!token) return text(ctx, 400, 'Missing token');
  const result = redeemAndCreateSession(token);
  if (!result) {
    recordAccess({ userId: null, groupId: null, path: null, action: 'auth.redeem_failed', req: ctx.req });
    return text(ctx, 400, 'Invalid or expired link');
  }
  recordAccess({ userId: result.userId, groupId: null, path: null, action: 'auth.login', req: ctx.req });
  ctx.res.writeHead(303, {
    Location: MOUNT_PREFIX + '/',
    'Set-Cookie': buildSessionCookie(result.token, ctx.secureCookie),
  });
  ctx.res.end();
}

function handleLogout(ctx: Ctx): void {
  authLogout(ctx.req);
  recordAccess({ userId: null, groupId: null, path: null, action: 'auth.logout', req: ctx.req });
  ctx.res.writeHead(303, { Location: MOUNT_PREFIX + '/', 'Set-Cookie': buildClearCookie(ctx.secureCookie) });
  ctx.res.end();
}

function handleMe(ctx: Ctx, userId: string): void {
  json(ctx, 200, { userId });
}

function handleGroups(ctx: Ctx, userId: string): void {
  const groups = listAccessibleAgentGroups(userId).map((g) => ({
    id: g.id,
    name: g.name,
    folder: g.folder,
    isAdmin: hasAdminPrivilege(userId, g.id),
  }));
  json(ctx, 200, { groups });
}

function handleTree(ctx: Ctx, userId: string, groupId: string, relPath: string): void {
  const group = resolveGroupAccess(userId, groupId);
  if (!group) return json(ctx, 403, { error: 'forbidden' });

  const groupDir = path.resolve(GROUPS_DIR, group.folder);
  const abs = resolveSafe(groupDir, relPath);
  if (!abs) return json(ctx, 400, { error: 'invalid_path' });

  let stat: fs.Stats;
  try {
    stat = fs.statSync(abs);
  } catch {
    return json(ctx, 404, { error: 'not_found' });
  }
  if (!stat.isDirectory()) return json(ctx, 400, { error: 'not_a_directory' });

  const isAdmin = hasAdminPrivilege(userId, group.id);
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch (err) {
    log.warn('readdir failed', { groupId, relPath, err });
    return json(ctx, 500, { error: 'readdir_failed' });
  }

  const out = [];
  for (const e of entries) {
    const childRel = relPath ? `${relPath}/${e.name}` : e.name;
    const cls = classify(childRel);
    if (cls.kind === 'hidden') continue;
    if (cls.tier === 'admin' && !isAdmin) continue;

    let size: number | null = null;
    let mtime: string | null = null;
    try {
      const s = fs.statSync(path.join(abs, e.name));
      size = s.isFile() ? s.size : null;
      mtime = s.mtime.toISOString();
    } catch {
      // dangling symlink or race; skip stat fields.
    }
    out.push({
      name: e.name,
      path: childRel,
      type: e.isDirectory() ? 'dir' : e.isFile() ? 'file' : 'other',
      size,
      mtime,
      readonly: cls.readonly,
      tier: cls.tier,
    });
  }
  out.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  recordAccess({ userId, groupId: group.id, path: relPath, action: 'tree', req: ctx.req });
  json(ctx, 200, { path: relPath, entries: out });
}

function handleFile(ctx: Ctx, userId: string, groupId: string, relPath: string): void {
  const group = resolveGroupAccess(userId, groupId);
  if (!group) return json(ctx, 403, { error: 'forbidden' });
  if (!relPath) return json(ctx, 400, { error: 'invalid_path' });

  const cls = classify(relPath);
  if (cls.kind === 'hidden') return json(ctx, 404, { error: 'not_found' });
  const isAdmin = hasAdminPrivilege(userId, group.id);
  if (cls.tier === 'admin' && !isAdmin) return json(ctx, 403, { error: 'forbidden' });

  const groupDir = path.resolve(GROUPS_DIR, group.folder);
  const abs = resolveSafe(groupDir, relPath);
  if (!abs) return json(ctx, 400, { error: 'invalid_path' });

  let stat: fs.Stats;
  try {
    stat = fs.statSync(abs);
  } catch {
    return json(ctx, 404, { error: 'not_found' });
  }
  if (!stat.isFile()) return json(ctx, 400, { error: 'not_a_file' });
  if (stat.size > MAX_DOWNLOAD_BYTES) return json(ctx, 413, { error: 'too_large' });

  const filename = path.basename(abs);
  const ext = path.extname(filename).toLowerCase();
  const mime = mimeFor(ext);
  const inline = mime.inlineSafe && stat.size <= MAX_INLINE_BYTES;

  const headers: http.OutgoingHttpHeaders = {
    'Content-Type': mime.type,
    'Content-Length': stat.size,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=0, must-revalidate',
  };
  headers['Content-Disposition'] = `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(filename)}"`;

  recordAccess({ userId, groupId: group.id, path: relPath, action: 'file', req: ctx.req });
  ctx.res.writeHead(200, headers);
  fs.createReadStream(abs).pipe(ctx.res);
}

// ── helpers ──────────────────────────────────────────────────────────────

function resolveGroupAccess(userId: string, groupId: string): { id: string; folder: string } | null {
  const groups = listAccessibleAgentGroups(userId);
  const match = groups.find((g) => g.id === groupId);
  if (!match) return null;
  const full = getAgentGroup(groupId);
  return full ? { id: full.id, folder: full.folder } : null;
}

const TEXT_EXTS = new Set([
  '.txt',
  '.md',
  '.json',
  '.yaml',
  '.yml',
  '.log',
  '.csv',
  '.tsv',
  '.html',
  '.css',
  '.js',
  '.ts',
  '.tsx',
  '.jsx',
  '.py',
  '.sh',
  '.toml',
  '.ini',
  '.conf',
  '.env',
  '.xml',
  '.svg',
]);
const IMAGE_EXTS: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};
const PDF_MIME = 'application/pdf';

function mimeFor(ext: string): { type: string; inlineSafe: boolean } {
  if (ext in IMAGE_EXTS) return { type: IMAGE_EXTS[ext], inlineSafe: ext !== '.svg' };
  if (ext === '.pdf') return { type: PDF_MIME, inlineSafe: true };
  if (TEXT_EXTS.has(ext)) return { type: 'text/plain; charset=utf-8', inlineSafe: true };
  return { type: 'application/octet-stream', inlineSafe: false };
}

function json(ctx: Ctx, status: number, body: unknown): void {
  ctx.res.writeHead(status, { 'Content-Type': 'application/json' });
  ctx.res.end(JSON.stringify(body));
}

function text(ctx: Ctx, status: number, body: string): void {
  ctx.res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  ctx.res.end(body);
}

function serveStatic(ctx: Ctx, relName: string): void {
  // Lexical guard: no traversal, no absolute, no nested dirs (UI is flat).
  if (relName.includes('..') || relName.includes('/') || path.isAbsolute(relName)) {
    return text(ctx, 400, 'Bad request');
  }
  const full = path.join(UI_DIR, relName);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(full);
  } catch {
    return text(ctx, 404, 'Not found');
  }
  if (!stat.isFile()) return text(ctx, 404, 'Not found');
  const ext = path.extname(relName).toLowerCase();
  const type =
    ext === '.html'
      ? 'text/html; charset=utf-8'
      : ext === '.css'
        ? 'text/css; charset=utf-8'
        : ext === '.js'
          ? 'application/javascript; charset=utf-8'
          : 'application/octet-stream';
  ctx.res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size });
  fs.createReadStream(full).pipe(ctx.res);
}
