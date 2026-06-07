/**
 * Per-agent-group static website serving.
 *
 * Registered as a host handler on the shared HTTP server. When the request's
 * Host header maps to an enabled group's site FQDN, files are served from
 * `groups/<folder>/<fqdn>/` fully public. Otherwise the handler declines so
 * the request falls through to the normal UI mounts.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';

import { GROUPS_DIR } from '../../../config.js';
import { log } from '../../../log.js';
import { registerHostHandler } from '../../../webhook-server.js';
import { resolveSafe } from '../chat/classify.js';
import { pagesEnabled, resolveHostToGroup, siteMimeFor } from './site.js';

// Mirror the chat file route's ceiling so a runaway file can't be streamed
// unbounded over the public origin.
const MAX_SITE_BYTES = 100 * 1024 * 1024; // 100 MB

function safeDecode(s: string): string | null {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

function notFound(res: http.ServerResponse): void {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

/**
 * Host handler: returns true if it handled (served or rejected) a request
 * destined for a group website, false to decline.
 */
export function handlePagesRequest(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  if (!pagesEnabled()) return false;
  const match = resolveHostToGroup(req.headers.host);
  if (!match) return false;

  // From here on the request belongs to a website — we own the response.
  const method = req.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
    res.end('Method not allowed');
    return true;
  }

  const { group, fqdn } = match;
  const siteRoot = path.resolve(GROUPS_DIR, group.folder, fqdn);

  // Decode the request path, segment by segment, rejecting bad encodings.
  const rawPath = (req.url || '/').split('?')[0].split('#')[0];
  const decodedSegments: string[] = [];
  for (const seg of rawPath.split('/')) {
    if (!seg) continue;
    const dec = safeDecode(seg);
    if (dec === null) {
      notFound(res);
      return true;
    }
    decodedSegments.push(dec);
  }
  let relPath = decodedSegments.join('/');

  let abs = resolveSafe(siteRoot, relPath);
  if (!abs) {
    notFound(res);
    return true;
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(abs);
  } catch {
    notFound(res);
    return true;
  }

  // Directory (including '/') → serve index.html within it.
  if (stat.isDirectory()) {
    relPath = relPath ? `${relPath}/index.html` : 'index.html';
    abs = resolveSafe(siteRoot, relPath);
    if (!abs) {
      notFound(res);
      return true;
    }
    try {
      stat = fs.statSync(abs);
    } catch {
      notFound(res);
      return true;
    }
  }

  if (!stat.isFile() || stat.size > MAX_SITE_BYTES) {
    notFound(res);
    return true;
  }

  const contentType = siteMimeFor(abs);
  const baseHeaders: http.OutgoingHttpHeaders = {
    'Content-Type': contentType,
    'Last-Modified': stat.mtime.toUTCString(),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=60',
    'Accept-Ranges': 'bytes',
  };

  // Minimal single-range support (media seeking).
  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m && (m[1] || m[2])) {
      const size = stat.size;
      let start = m[1] ? parseInt(m[1], 10) : NaN;
      let end = m[2] ? parseInt(m[2], 10) : NaN;
      if (Number.isNaN(start)) {
        // suffix range: last N bytes
        start = Math.max(0, size - end);
        end = size - 1;
      } else if (Number.isNaN(end)) {
        end = size - 1;
      }
      if (start > end || start >= size) {
        res.writeHead(416, { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' });
        res.end();
        return true;
      }
      end = Math.min(end, size - 1);
      res.writeHead(206, {
        ...baseHeaders,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': end - start + 1,
      });
      if (method === 'HEAD') {
        res.end();
        return true;
      }
      fs.createReadStream(abs, { start, end }).pipe(res);
      return true;
    }
  }

  res.writeHead(200, { ...baseHeaders, 'Content-Length': stat.size });
  if (method === 'HEAD') {
    res.end();
    return true;
  }
  fs.createReadStream(abs).pipe(res);
  return true;
}

let registered = false;

/** Idempotently register the website host handler on the shared server. */
export function registerPagesHostHandler(): void {
  if (registered) return;
  if (!pagesEnabled()) {
    log.info('Static website feature disabled (set PAGES_BASE_DOMAIN to enable)');
    return;
  }
  registerHostHandler(handlePagesRequest);
  registered = true;
  log.info('Static website host handler registered');
}
