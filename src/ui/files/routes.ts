/**
 * HTTP route handlers for the file browser (mounted at /ui/files by the
 * UI shell in ../server.ts). The shell owns shared auth at /ui/auth/* and
 * mints the cookie this dispatcher reads.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { URL } from 'url';

import { GROUPS_DIR } from '../../config.js';
import { getAgentGroup } from '../../db/agent-groups.js';
import { getDb } from '../../db/connection.js';
import { log } from '../../log.js';
import { listAccessibleAgentGroups } from '../../modules/permissions/access.js';
import { hasAdminPrivilege } from '../../modules/permissions/db/user-roles.js';
import { authenticate, recordAccess } from '../auth.js';
import { redeemDownloadToken } from '../download-tokens.js';
import { classify, resolveSafe } from './classify.js';
import { handleChatRequest, handleChatUpgrade } from './chat.js';

export { handleChatUpgrade };

// UI assets live under src/ (not compiled by tsc); resolve from project root,
// which the host always runs from.
const UI_DIR = path.resolve(process.cwd(), 'src', 'ui', 'files', 'ui');
const MAX_INLINE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024; // 100 MB
const ASSET_VERSION = String(Date.now());

/** Path prefix the file browser is mounted under on the shared HTTP server. */
export const FILES_MOUNT_PREFIX = '/ui/files';

interface Ctx {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
}

export async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const ctx: Ctx = { req, res, url };

  // Strip the mount prefix so internal route matching stays local.
  let pathname = url.pathname;
  if (pathname === FILES_MOUNT_PREFIX) {
    // /ui/files (no trailing slash) → redirect to /ui/files/ so relative URLs resolve.
    res.writeHead(308, { Location: FILES_MOUNT_PREFIX + '/' });
    res.end();
    return;
  }
  if (pathname.startsWith(FILES_MOUNT_PREFIX + '/')) {
    pathname = pathname.slice(FILES_MOUNT_PREFIX.length) || '/';
  }

  try {
    // Public static routes.
    if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) return serveStatic(ctx, 'index.html');
    if (req.method === 'GET' && pathname === '/vendor/marked.umd.js')
      return serveVendor(ctx, 'marked/lib/marked.umd.js', 'application/javascript; charset=utf-8');
    if (req.method === 'GET' && pathname.startsWith('/ui/')) return serveStatic(ctx, pathname.slice('/ui/'.length));

    // Public token-based download (no cookie required). Always sent as
    // attachment; never sets a session.
    if (req.method === 'GET' && pathname === '/dl') return handleTokenDownload(ctx);

    // Authenticated routes.
    const session = authenticate(req);
    if (!session) return json(ctx, 401, { error: 'unauthorized' });

    if (req.method === 'GET' && pathname === '/api/me') return handleMe(ctx, session.userId);
    if (req.method === 'GET' && pathname === '/api/groups') return handleGroups(ctx, session.userId);

    if (await handleChatRequest(req, res, pathname, session.userId)) return;

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

function handleMe(ctx: Ctx, userId: string): void {
  json(ctx, 200, { userId });
}

function handleGroups(ctx: Ctx, userId: string): void {
  const accessible = listAccessibleAgentGroups(userId);
  // Cheap per-group last-activity lookup so the dropdown can sort by recency.
  type Row = { agent_group_id: string; last_active: string | null };
  const rows = getDb()
    .prepare('SELECT agent_group_id, MAX(last_active) AS last_active FROM sessions GROUP BY agent_group_id')
    .all() as Row[];
  const lastByGroup = new Map<string, string | null>();
  for (const r of rows) lastByGroup.set(r.agent_group_id, r.last_active);
  const groups = accessible.map((g) => ({
    id: g.id,
    name: g.name,
    folder: g.folder,
    isAdmin: hasAdminPrivilege(userId, g.id),
    lastActivityAt: lastByGroup.get(g.id) ?? null,
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

function handleTokenDownload(ctx: Ctx): void {
  const token = ctx.url.searchParams.get('t');
  if (!token) return text(ctx, 400, 'Missing token');

  const fwd = ctx.req.headers['x-forwarded-for'];
  const ip = (typeof fwd === 'string' ? fwd.split(',')[0]?.trim() : null) || ctx.req.socket.remoteAddress || null;
  const ua = (ctx.req.headers['user-agent'] as string | undefined) ?? null;

  const row = redeemDownloadToken(token, ip, ua);
  if (!row) {
    recordAccess({ userId: null, groupId: null, path: null, action: 'dl_invalid', req: ctx.req });
    return text(ctx, 404, 'Link is invalid, expired, or already used.');
  }

  const group = getAgentGroup(row.group_id);
  if (!group) {
    log.warn('download token references missing group', { groupId: row.group_id });
    return text(ctx, 404, 'Not found');
  }

  // Re-validate visibility — file may have been moved/hidden since issuance.
  const cls = classify(row.rel_path);
  if (cls.kind === 'hidden') return text(ctx, 404, 'Not found');

  const groupDir = path.resolve(GROUPS_DIR, group.folder);
  const abs = resolveSafe(groupDir, row.rel_path);
  if (!abs) return text(ctx, 400, 'Invalid path');

  let stat: fs.Stats;
  try {
    stat = fs.statSync(abs);
  } catch {
    return text(ctx, 404, 'Not found');
  }
  if (!stat.isFile()) return text(ctx, 400, 'Not a file');
  if (stat.size > MAX_DOWNLOAD_BYTES) return text(ctx, 413, 'File too large');

  const filename = path.basename(abs);
  const ext = path.extname(filename).toLowerCase();
  const mime = mimeFor(ext);
  recordAccess({
    userId: row.recipient_user_id ?? row.issuer_user_id,
    groupId: row.group_id,
    path: row.rel_path,
    action: 'dl_token',
    req: ctx.req,
  });
  ctx.res.writeHead(200, {
    'Content-Type': mime.type,
    'Content-Length': stat.size,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
  });
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
const AUDIO_EXTS: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.flac': 'audio/flac',
  '.weba': 'audio/webm',
};
const VIDEO_EXTS: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
};
const PDF_MIME = 'application/pdf';

function mimeFor(ext: string): { type: string; inlineSafe: boolean } {
  if (ext in IMAGE_EXTS) return { type: IMAGE_EXTS[ext], inlineSafe: ext !== '.svg' };
  if (ext in AUDIO_EXTS) return { type: AUDIO_EXTS[ext], inlineSafe: true };
  if (ext in VIDEO_EXTS) return { type: VIDEO_EXTS[ext], inlineSafe: true };
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
  if (ext === '.html') {
    const body = fs.readFileSync(full, 'utf8').replace(/(<script\s+src="ui\/app\.js)"/g, `$1?v=${ASSET_VERSION}"`);
    const buf = Buffer.from(body, 'utf8');
    ctx.res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': buf.length,
      'Cache-Control': 'no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
    ctx.res.end(buf);
    return;
  }
  ctx.res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': 'no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  fs.createReadStream(full).pipe(ctx.res);
}

/** Serve a file from node_modules (vendored client lib). */
function serveVendor(ctx: Ctx, relName: string, contentType: string): void {
  if (relName.includes('..')) return text(ctx, 400, 'Bad request');
  const full = path.join(process.cwd(), 'node_modules', relName);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(full);
  } catch {
    return text(ctx, 404, 'Not found');
  }
  if (!stat.isFile()) return text(ctx, 404, 'Not found');
  ctx.res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size,
    'Cache-Control': 'public, max-age=86400',
  });
  fs.createReadStream(full).pipe(ctx.res);
}
