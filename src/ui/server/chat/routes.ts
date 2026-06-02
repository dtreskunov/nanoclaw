/**
 * HTTP route handlers for the chat web app (mounted at /ui/chat by the
 * UI shell in ../server.ts). The shell owns shared auth at /ui/auth/* and
 * mints the cookie this dispatcher reads.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { URL } from 'url';

import Router from 'find-my-way';

import { GROUPS_DIR } from '../../../config.js';
import { getAgentGroup } from '../../../db/agent-groups.js';
import { getDb } from '../../../db/connection.js';
import { getSession } from '../../../db/sessions.js';
import { log } from '../../../log.js';
import { listAccessibleAgentGroups } from '../../../modules/permissions/access.js';
import { hasAdminPrivilege, isGlobalAdmin, isOwner } from '../../../modules/permissions/db/user-roles.js';
import { dispatchResponse } from '../../../response-registry.js';
import type { PendingApproval } from '../../../types.js';
import { authenticate, recordAccess } from '../auth.js';
import { createDownloadToken, redeemDownloadToken } from '../download-tokens.js';
import { uiBaseUrl } from '../server.js';
import { classify, resolveSafe } from './classify.js';
import { handleChatRequest, handleChatUpgrade } from './chat.js';
import { handleWriteRequest } from './write.js';

export { handleChatUpgrade };

// UI assets live under src/ (not compiled by tsc); resolve from project root,
// which the host always runs from.
const UI_DIR = path.resolve(process.cwd(), 'src', 'ui', 'client', 'chat');
const MAX_INLINE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024; // 100 MB
const ASSET_VERSION = String(Date.now());

/** Path prefix the chat web app is mounted under on the shared HTTP server. */
export const CHAT_MOUNT_PREFIX = '/ui/chat';

interface Ctx {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
}

export async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const ctx: Ctx = { req, res, url };

  // Strip the mount prefix so route patterns stay local.
  let pathname = url.pathname;
  if (pathname === CHAT_MOUNT_PREFIX) {
    // /ui/chat (no trailing slash) → redirect to /ui/chat/ so relative URLs resolve.
    res.writeHead(308, { Location: CHAT_MOUNT_PREFIX + '/' });
    res.end();
    return;
  }
  if (pathname.startsWith(CHAT_MOUNT_PREFIX + '/')) {
    pathname = pathname.slice(CHAT_MOUNT_PREFIX.length) || '/';
  }

  try {
    const found = router.find(req.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'PATCH', pathname);
    if (found) {
      await (found.handler as unknown as RouteHandler)(ctx, found.params as Record<string, string>);
      return;
    }
    // Fall-through: chat + write modules still own their own internal
    // dispatch. Try them before returning 404.
    const session = authenticate(req);
    if (!session) return json(ctx, 401, { error: 'unauthorized' });
    if (await handleChatRequest(req, res, pathname, session.userId)) return;
    if (await handleWriteRequest(req, res, url, pathname, session.userId)) return;
    return json(ctx, 404, { error: 'not_found' });
  } catch (err) {
    log.error('File browser handler threw', { url: req.url, err });
    return json(ctx, 500, { error: 'internal_error' });
  }
}

// ── router ────────────────────────────────────────────────────────────────

type RouteHandler = (ctx: Ctx, params: Record<string, string>) => void | Promise<void>;
type FmwMethod = Parameters<ReturnType<typeof Router>['on']>[0];

const router = Router({
  caseSensitive: true,
  ignoreTrailingSlash: false,
  // Never invoked — we dispatch via router.find() — but the option is required.
  defaultRoute: (_req, res) => {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end('{"error":"not_found"}');
  },
});

/** Register a RouteHandler with find-my-way. The cast hides the fact
 * that we don't use FMW's (req, res, params) calling convention — we
 * call handlers ourselves from find() with a Ctx. */
function on(method: FmwMethod, route: string, handler: RouteHandler): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router.on(method, route, handler as any);
}

/** Wrap a handler that requires an authenticated session; injects userId.
 *
 * When the request is a top-level browser navigation (Sec-Fetch-Mode:
 * navigate, GET, accepts HTML), redirect to the shared login page with
 * `?next=` set to the original URL so the user lands back on the file
 * after signing in. XHR/fetch from the SPA still gets a JSON 401. */
function authed(fn: (ctx: Ctx, userId: string, params: Record<string, string>) => void | Promise<void>): RouteHandler {
  return async (ctx, params) => {
    const session = authenticate(ctx.req);
    if (!session) {
      if (isBrowserNavigation(ctx.req)) return redirectToLogin(ctx);
      return json(ctx, 401, { error: 'unauthorized' });
    }
    return fn(ctx, session.userId, params);
  };
}

function isBrowserNavigation(req: http.IncomingMessage): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const mode = req.headers['sec-fetch-mode'];
  if (mode === 'navigate') return true;
  // Older browsers without Sec-Fetch-Mode: fall back to Accept sniffing.
  // XHR/fetch typically sends Accept: */* or application/json.
  if (mode == null) {
    const accept = String(req.headers['accept'] || '');
    if (accept.includes('text/html')) return true;
  }
  return false;
}

function redirectToLogin(ctx: Ctx): void {
  // req.url is the original mount-relative URL (the chat dispatcher only
  // mutates a local `pathname`), so it already starts with /ui/chat/...
  // and is safe as the next= target.
  const next = ctx.req.url || CHAT_MOUNT_PREFIX + '/';
  const loginUrl = `/ui/login?next=${encodeURIComponent(next)}`;
  ctx.res.writeHead(303, { Location: loginUrl });
  ctx.res.end();
}

// Static + public.
on('GET', '/', (ctx) => serveStatic(ctx, 'index.html'));
on('GET', '/index.html', (ctx) => serveStatic(ctx, 'index.html'));
on('GET', '/manifest.webmanifest', (ctx) => serveStatic(ctx, 'manifest.webmanifest'));
on('GET', '/icon.svg', (ctx) => serveStatic(ctx, 'icon.svg'));
on('GET', '/dist/*', (ctx, params) => serveStatic(ctx, 'dist/' + params['*']));
on('GET', '/dl', (ctx) => handleTokenDownload(ctx));

// Authenticated.
on(
  'GET',
  '/api/me',
  authed((ctx, userId) => handleMe(ctx, userId)),
);
on(
  'GET',
  '/api/groups',
  authed((ctx, userId) => handleGroups(ctx, userId)),
);

// File/dir resources: path-in-URL, single endpoint per kind.
//   GET|HEAD /api/groups/:gid/files/<rel/path>           → file bytes
//   GET      /api/groups/:gid/files/<rel/path>?meta=1    → file metadata JSON
//   GET      /api/groups/:gid/dirs[/<rel/path>/]         → directory listing JSON
//   GET      /api/groups/:gid/zip?path=&path=...         → multi-path zip
const filesHandler = authed((ctx, userId, params) => {
  const rel = safeDecode(params['*']);
  if (rel == null) return json(ctx, 400, { error: 'invalid_path' });
  if (ctx.req.method === 'GET' && ctx.url.searchParams.has('meta')) return handleMeta(ctx, userId, params.gid, rel);
  return handleFile(ctx, userId, params.gid, rel);
});
on('GET', '/api/groups/:gid/files/*', filesHandler);
on('HEAD', '/api/groups/:gid/files/*', filesHandler);

const dirsHandler = authed((ctx, userId, params) => {
  const raw = params['*'] ?? '';
  const stripped = raw.replace(/\/$/, '');
  const rel = stripped ? safeDecode(stripped) : '';
  if (rel == null) return json(ctx, 400, { error: 'invalid_path' });
  return handleTree(ctx, userId, params.gid, rel);
});
on('GET', '/api/groups/:gid/dirs', dirsHandler);
on('GET', '/api/groups/:gid/dirs/*', dirsHandler);

on(
  'GET',
  '/api/groups/:gid/zip',
  authed((ctx, userId, params) => handleZip(ctx, userId, params.gid, ctx.url.searchParams.getAll('path'))),
);

on(
  'POST',
  '/api/groups/:gid/share-token',
  authed((ctx, userId, params) => handleShareToken(ctx, userId, params.gid)),
);
// Pending approvals visible to this user (banner inbox in ChatMain).
on(
  'GET',
  '/api/approvals',
  authed((ctx, userId) => handleListApprovals(ctx, userId)),
);
on(
  'POST',
  '/api/approvals/:id/respond',
  authed((ctx, userId, params) => handleRespondApproval(ctx, userId, params.id)),
);
// ── handlers ──────────────────────────────────────────────────────────────

function handleMe(ctx: Ctx, userId: string): void {
  const row = getDb().prepare('SELECT display_name FROM users WHERE id = ?').get(userId) as
    | { display_name: string | null }
    | undefined;
  const displayName = row?.display_name?.trim() || null;
  json(ctx, 200, { userId, displayName });
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

interface ApprovalDto {
  approvalId: string;
  action: string;
  title: string;
  details: string | null;
  options: { label: string; value: string }[];
  agentGroupId: string | null;
  agentGroupName: string | null;
  createdAt: string;
}

/** Build a one-line description of the approval from the persisted payload
 * for known actions. The original `question` text from requestApproval is
 * not stored on the row, so we re-derive a comparable summary here. */
function describeApproval(action: string, payloadJson: string): string | null {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(payloadJson) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (action === 'install_packages') {
    const apt = Array.isArray(payload.apt) ? (payload.apt as string[]) : [];
    const npm = Array.isArray(payload.npm) ? (payload.npm as string[]) : [];
    const pkgs = [...apt.map((p) => `apt: ${p}`), ...npm.map((p) => `npm: ${p}`)].join(', ');
    const reason = typeof payload.reason === 'string' && payload.reason ? ` — ${payload.reason}` : '';
    return pkgs ? `${pkgs}${reason}` : reason || null;
  }
  if (action === 'add_mcp_server') {
    const name = typeof payload.name === 'string' ? payload.name : '';
    const url = typeof payload.url === 'string' ? payload.url : '';
    const command = typeof payload.command === 'string' ? payload.command : '';
    const transport = typeof payload.transport === 'string' ? payload.transport.toUpperCase() : '';
    if (url) return `${name} (${transport} ${url})`;
    if (command) return `${name} (stdio: ${command})`;
    return name || null;
  }
  if (action === 'cli_command') {
    const frame = (payload.frame as Record<string, unknown> | undefined) || undefined;
    if (frame) {
      const cmd = typeof frame.command === 'string' ? frame.command : '';
      const args = frame.args as Record<string, unknown> | undefined;
      if (args && typeof args === 'object') {
        const parts = Object.entries(args)
          .filter(([k]) => k !== 'help')
          .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
          .join(' ');
        return parts ? `${cmd} ${parts}` : cmd || null;
      }
      return cmd || null;
    }
  }
  return null;
}

function handleListApprovals(ctx: Ctx, userId: string): void {
  // pending_approvals are unbounded global rows; filter to those the user
  // is eligible to approve. Owner/global-admin sees all (incl. agent_group_id IS NULL);
  // a scoped admin sees only rows for their agent groups.
  const rows = getDb()
    .prepare("SELECT * FROM pending_approvals WHERE status = 'pending' ORDER BY created_at DESC")
    .all() as PendingApproval[];
  const elevated = isOwner(userId) || isGlobalAdmin(userId);
  const groupNameCache = new Map<string, string | null>();
  const visible: ApprovalDto[] = [];
  for (const r of rows) {
    if (r.agent_group_id == null) {
      if (!elevated) continue;
    } else if (!hasAdminPrivilege(userId, r.agent_group_id)) {
      continue;
    }
    // Display group: prefer row.agent_group_id; fall back to the session's
    // agent group (cli_command rows have null agent_group_id but their
    // session is scoped to one).
    let displayGroupId: string | null = r.agent_group_id;
    if (displayGroupId == null && r.session_id) {
      const s = getSession(r.session_id);
      displayGroupId = s?.agent_group_id ?? null;
    }
    let groupName: string | null = null;
    if (displayGroupId) {
      if (groupNameCache.has(displayGroupId)) {
        groupName = groupNameCache.get(displayGroupId) ?? null;
      } else {
        const g = getAgentGroup(displayGroupId);
        groupName = g?.name ?? null;
        groupNameCache.set(displayGroupId, groupName);
      }
    }
    let options: { label: string; value: string }[] = [];
    try {
      const parsed = JSON.parse(r.options_json) as { label?: string; value?: string }[];
      if (Array.isArray(parsed)) {
        options = parsed
          .filter((o) => o && typeof o.label === 'string' && typeof o.value === 'string')
          .map((o) => ({ label: o.label as string, value: o.value as string }));
      }
    } catch {
      // ignore — fall back to empty options
    }
    visible.push({
      approvalId: r.approval_id,
      action: r.action,
      title: r.title,
      details: describeApproval(r.action, r.payload),
      options,
      agentGroupId: displayGroupId,
      agentGroupName: groupName,
      createdAt: r.created_at,
    });
  }
  json(ctx, 200, { approvals: visible });
}

async function handleRespondApproval(ctx: Ctx, userId: string, approvalId: string): Promise<void> {
  const row = getDb().prepare('SELECT * FROM pending_approvals WHERE approval_id = ?').get(approvalId) as
    | PendingApproval
    | undefined;
  if (!row) return json(ctx, 404, { error: 'not_found' });
  if (row.status !== 'pending') return json(ctx, 409, { error: 'not_pending' });
  if (row.agent_group_id == null) {
    if (!isOwner(userId) && !isGlobalAdmin(userId)) return json(ctx, 403, { error: 'forbidden' });
  } else if (!hasAdminPrivilege(userId, row.agent_group_id)) {
    return json(ctx, 403, { error: 'forbidden' });
  }

  let body: { value?: unknown };
  try {
    body = (await readJsonBody(ctx.req)) as { value?: unknown };
  } catch {
    return json(ctx, 400, { error: 'invalid_body' });
  }
  const value = typeof body?.value === 'string' ? body.value : null;
  if (!value) return json(ctx, 400, { error: 'value_required' });

  const claimed = await dispatchResponse({
    questionId: approvalId,
    value,
    userId,
    channelType: 'web',
    platformId: userId,
    threadId: null,
  });
  if (!claimed) {
    log.warn('Web approval response unclaimed', { approvalId, userId, value });
    return json(ctx, 500, { error: 'unhandled' });
  }
  json(ctx, 200, { ok: true });
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
    'Last-Modified': stat.mtime.toUTCString(),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=0, must-revalidate',
  };
  headers['Content-Disposition'] = `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(filename)}"`;

  // HTML rendered inline is same-origin to the UI, so a malicious page
  // could read the auth cookie via JS or fetch the UI's APIs. Sandbox it
  // so the document gets an opaque origin (no document.cookie / no
  // same-origin fetch) while still allowing scripts, forms, and the
  // browser to load sibling assets via the same /raw route. Asset GETs
  // are still cookie-authenticated because cookies attach by URL, not
  // origin — so relative <img src>, <link href>, etc. work normally.
  if (mime.type === 'text/html; charset=utf-8') {
    headers['Content-Security-Policy'] = 'sandbox allow-scripts allow-forms';
  }

  recordAccess({ userId, groupId: group.id, path: relPath, action: 'file', req: ctx.req });
  ctx.res.writeHead(200, headers);
  if (ctx.req.method === 'HEAD') {
    ctx.res.end();
    return;
  }
  fs.createReadStream(abs).pipe(ctx.res);
}

// File extensions we'll try to extract embedded metadata from. music-metadata
// covers audio/video container tags (ID3, Vorbis, MP4 atoms…); exifr covers
// image EXIF. Both are dynamically imported — if either isn't installed the
// endpoint just returns basic stat info.
const AUDIO_META_EXTS = new Set(['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.oga', '.opus', '.flac', '.weba']);
const VIDEO_META_EXTS = new Set(['.mp4', '.m4v', '.mov', '.webm', '.ogv']);
const IMAGE_META_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tif', '.tiff', '.heic', '.heif']);

async function handleMeta(ctx: Ctx, userId: string, groupId: string, relPath: string): Promise<void> {
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

  const ext = path.extname(abs).toLowerCase();
  const out: Record<string, unknown> = {
    name: path.basename(abs),
    size: stat.size,
    mtime: stat.mtime.toISOString(),
    mime: mimeFor(ext).type,
    ext,
  };
  const media = await readMediaTags(abs, ext);
  if (media?.tags) out.tags = media.tags;
  if (media?.lyrics) out.lyrics = media.lyrics;
  return json(ctx, 200, out);
}

interface MediaMeta {
  tags: Record<string, string> | null;
  lyrics: string | null;
}

async function readMediaTags(abs: string, ext: string): Promise<MediaMeta | null> {
  try {
    if (AUDIO_META_EXTS.has(ext) || VIDEO_META_EXTS.has(ext)) {
      const mm = await import('music-metadata').catch(() => null);
      if (!mm) return null;
      const parsed = await mm.parseFile(abs, { duration: true });
      const c = parsed.common;
      const f = parsed.format;
      const t: Record<string, string> = {};
      if (c.title) t.Title = c.title;
      if (c.artist) t.Artist = c.artist;
      if (c.albumartist && c.albumartist !== c.artist) t['Album artist'] = c.albumartist;
      if (c.album) t.Album = c.album;
      if (c.year) t.Year = String(c.year);
      if (c.track?.no != null) t.Track = c.track.of ? `${c.track.no}/${c.track.of}` : String(c.track.no);
      if (c.genre?.length) t.Genre = c.genre.join(', ');
      if (c.composer?.length) t.Composer = c.composer.join(', ');
      if (f.duration) t.Duration = formatDuration(f.duration);
      if (f.bitrate) t.Bitrate = `${Math.round(f.bitrate / 1000)} kbps`;
      if (f.sampleRate) t['Sample rate'] = `${f.sampleRate} Hz`;
      if (f.numberOfChannels) t.Channels = String(f.numberOfChannels);
      if (f.codec) t.Codec = f.codec;
      if (f.container && f.container !== f.codec) t.Container = f.container;
      let lyrics: string | null = null;
      const rawLyrics = (c as { lyrics?: unknown }).lyrics;
      if (Array.isArray(rawLyrics)) {
        const texts: string[] = [];
        for (const l of rawLyrics) {
          if (typeof l === 'string') texts.push(l);
          else if (l && typeof l === 'object' && typeof (l as { text?: unknown }).text === 'string') {
            texts.push((l as { text: string }).text);
          }
        }
        const joined = texts.join('\n\n').trim();
        if (joined) lyrics = joined;
      } else if (typeof rawLyrics === 'string' && rawLyrics.trim()) {
        lyrics = rawLyrics.trim();
      }
      return { tags: Object.keys(t).length > 0 ? t : null, lyrics };
    }
    if (IMAGE_META_EXTS.has(ext)) {
      const exifr = await import('exifr').catch(() => null);
      if (!exifr) return null;
      const fn =
        (exifr as { parse?: (p: string) => Promise<Record<string, unknown> | undefined> }).parse ??
        (exifr as { default?: { parse: (p: string) => Promise<Record<string, unknown> | undefined> } }).default?.parse;
      if (!fn) return null;
      const e = await fn(abs).catch(() => null);
      if (!e) return null;
      const t: Record<string, string> = {};
      const make = e.Make ? String(e.Make).trim() : '';
      const model = e.Model ? String(e.Model).trim() : '';
      if (make || model) t.Camera = [make, model].filter(Boolean).join(' ');
      if (e.LensModel) t.Lens = String(e.LensModel);
      if (e.DateTimeOriginal) {
        const d = e.DateTimeOriginal instanceof Date ? e.DateTimeOriginal : new Date(String(e.DateTimeOriginal));
        if (!Number.isNaN(d.getTime())) t.Taken = d.toISOString();
      }
      if (typeof e.ExposureTime === 'number' && e.ExposureTime > 0) {
        t.Exposure = e.ExposureTime >= 1 ? `${e.ExposureTime} s` : `1/${Math.round(1 / e.ExposureTime)} s`;
      }
      if (typeof e.FNumber === 'number') t.Aperture = `f/${e.FNumber}`;
      if (e.ISO != null) t.ISO = String(e.ISO);
      if (typeof e.FocalLength === 'number') t['Focal length'] = `${e.FocalLength} mm`;
      const w = e.ImageWidth ?? e.ExifImageWidth;
      const h = e.ImageHeight ?? e.ExifImageHeight;
      if (typeof w === 'number' && typeof h === 'number') t.Dimensions = `${w} × ${h}`;
      if (e.Orientation != null) t.Orientation = String(e.Orientation);
      if (e.latitude != null && e.longitude != null)
        t.GPS = `${Number(e.latitude).toFixed(5)}, ${Number(e.longitude).toFixed(5)}`;
      return { tags: Object.keys(t).length > 0 ? t : null, lyrics: null };
    }
  } catch (err) {
    // music-metadata throws on malformed media; treat as "no tags".
    log.debug('media metadata extraction failed', { abs, err });
  }
  return null;
}

function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function handleZip(ctx: Ctx, userId: string, groupId: string, paths: string[]): void {
  const group = resolveGroupAccess(userId, groupId);
  if (!group) return json(ctx, 403, { error: 'forbidden' });
  if (paths.length === 0) return json(ctx, 400, { error: 'no_paths' });
  if (paths.length > 500) return json(ctx, 400, { error: 'too_many_paths' });

  const isAdmin = hasAdminPrivilege(userId, group.id);
  const groupDir = path.resolve(GROUPS_DIR, group.folder);

  // Resolve + classify every requested path up front so we either
  // refuse the whole request or stream a complete archive.
  const resolved: { rel: string; abs: string; isDir: boolean }[] = [];
  for (const rel of paths) {
    if (!rel) return json(ctx, 400, { error: 'invalid_path' });
    const cls = classify(rel);
    if (cls.kind === 'hidden') return json(ctx, 404, { error: 'not_found', path: rel });
    if (cls.tier === 'admin' && !isAdmin) return json(ctx, 403, { error: 'forbidden', path: rel });
    const abs = resolveSafe(groupDir, rel);
    if (!abs) return json(ctx, 400, { error: 'invalid_path', path: rel });
    let stat: fs.Stats;
    try {
      stat = fs.statSync(abs);
    } catch {
      return json(ctx, 404, { error: 'not_found', path: rel });
    }
    resolved.push({ rel, abs, isDir: stat.isDirectory() });
  }

  // Build a friendly archive name: single dir → that dir's basename;
  // single file → that file's basename (without ext); multi → group folder.
  let baseName: string;
  if (resolved.length === 1) baseName = path.basename(resolved[0].rel) || group.folder;
  else baseName = `${group.folder}-files`;
  const zipName = `${baseName}.zip`;

  recordAccess({ userId, groupId: group.id, path: paths.join(','), action: 'zip', req: ctx.req });

  ctx.res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(zipName)}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });

  // Dynamic import to keep startup lean and so an absent archiver
  // dependency degrades gracefully (returns 500 rather than crashing
  // module load — though we install it as a regular dep so this should
  // never fire in practice).
  void (async () => {
    let archiverMod;
    try {
      archiverMod = (await import('archiver')).default;
    } catch (err) {
      log.error('archiver dynamic import failed', { err });
      try {
        ctx.res.end();
      } catch {
        /* ignore */
      }
      return;
    }
    const archive = archiverMod('zip', { zlib: { level: 6 } });
    archive.on('warning', (err: NodeJS.ErrnoException) => {
      // ENOENT in here is "we lost a race with rm" — log but don't fail.
      if (err.code === 'ENOENT') log.warn('zip archive missing entry', { err });
      else log.error('zip archive warning', { err });
    });
    archive.on('error', (err: Error) => {
      log.error('zip archive error', { err });
      try {
        ctx.res.destroy(err);
      } catch {
        /* ignore */
      }
    });
    archive.pipe(ctx.res);
    for (const { rel, abs, isDir } of resolved) {
      const inZipBase = path.basename(rel);
      if (isDir) archive.directory(abs, inZipBase);
      else archive.file(abs, { name: inZipBase });
    }
    await archive.finalize();
  })();
}

// User-initiated "magic link" share. Mints an unbound (recipient_user_id
// IS NULL) download token for a file the user can already see, and returns
// the public URL. Anyone with the link can download the file (until it
// expires or the use count is exhausted).
const SHARE_TTL_MIN_DEFAULT = 60; // 1h
const SHARE_TTL_MIN_MAX = 7 * 24 * 60; // 7 days
const SHARE_TTL_MIN_MIN = 1;
const SHARE_USES_DEFAULT = 1;
const SHARE_USES_MAX = 100;

async function handleShareToken(ctx: Ctx, userId: string, groupId: string): Promise<void> {
  let body: Record<string, unknown>;
  try {
    body = (await readJsonBody(ctx.req)) as Record<string, unknown>;
  } catch {
    return json(ctx, 400, { error: 'invalid_body' });
  }

  const rawPath = typeof body?.path === 'string' ? body.path : '';
  const relPath = rawPath.replace(/^\/+/, '');
  if (!relPath) return json(ctx, 400, { error: 'invalid_path' });

  const ttlMinutes = clampInt(body?.ttlMinutes, SHARE_TTL_MIN_DEFAULT, SHARE_TTL_MIN_MIN, SHARE_TTL_MIN_MAX);
  const uses = clampInt(body?.uses, SHARE_USES_DEFAULT, 1, SHARE_USES_MAX);

  const group = resolveGroupAccess(userId, groupId);
  if (!group) return json(ctx, 403, { error: 'forbidden' });

  const cls = classify(relPath);
  if (cls.kind === 'hidden') return json(ctx, 404, { error: 'not_found' });
  if (cls.tier === 'admin' && !hasAdminPrivilege(userId, group.id)) {
    return json(ctx, 403, { error: 'forbidden' });
  }

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

  const ttlMs = ttlMinutes * 60_000;
  const { token, expiresAt } = createDownloadToken({
    issuerUserId: userId,
    recipientUserId: null,
    groupId: group.id,
    relPath,
    ttlMs,
    uses,
  });
  const url = `${uiBaseUrl()}${CHAT_MOUNT_PREFIX.slice('/ui'.length)}/dl?t=${token}`;
  recordAccess({ userId, groupId: group.id, path: relPath, action: 'share_token', req: ctx.req });
  return json(ctx, 200, { url, token, expiresAt, ttlMinutes, uses });
}

function clampInt(v: unknown, def: number, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : def;
  return Math.min(Math.max(n, min), max);
}

async function readJsonBody(req: http.IncomingMessage, max = 64 * 1024): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const c of req) {
    const buf = c as Buffer;
    total += buf.length;
    if (total > max) throw new Error('body_too_large');
    chunks.push(buf);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
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

// Additional mime types beyond the IMAGE/AUDIO/VIDEO/PDF tables — chosen
// because they show up as sub-resources of typical HTML/JS content and
// must be served with the right Content-Type for the browser to use them
// (fonts, JSON fetched by scripts, source maps, web workers, wasm, etc.).
const EXTRA_MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
};

function mimeFor(ext: string): { type: string; inlineSafe: boolean } {
  if (ext in IMAGE_EXTS) return { type: IMAGE_EXTS[ext], inlineSafe: ext !== '.svg' };
  if (ext in AUDIO_EXTS) return { type: AUDIO_EXTS[ext], inlineSafe: true };
  if (ext in VIDEO_EXTS) return { type: VIDEO_EXTS[ext], inlineSafe: true };
  if (ext === '.pdf') return { type: PDF_MIME, inlineSafe: true };
  if (ext in EXTRA_MIME) return { type: EXTRA_MIME[ext], inlineSafe: true };
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

function safeDecode(s: string): string | null {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

function serveStatic(ctx: Ctx, relName: string): void {
  // Lexical guard: no traversal, no absolute paths. Allow exactly one level
  // of subdirectory (e.g. `dist/app.js`) but reject anything deeper.
  if (relName.includes('..') || path.isAbsolute(relName)) {
    return text(ctx, 400, 'Bad request');
  }
  const segments = relName.split('/');
  if (segments.length > 2 || segments.some((s) => s === '')) {
    return text(ctx, 400, 'Bad request');
  }
  const full = path.join(UI_DIR, ...segments);
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
          : ext === '.svg'
            ? 'image/svg+xml'
            : ext === '.webmanifest'
              ? 'application/manifest+json; charset=utf-8'
              : 'application/octet-stream';
  if (ext === '.html') {
    const body = fs.readFileSync(full, 'utf8').replace(/(<script[^>]+src="dist\/app\.js)"/g, `$1?v=${ASSET_VERSION}"`);
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
