/**
 * Public marketing / landing page, served at the apex `/` on the shared HTTP
 * server.
 *
 * Previously hosted on GitHub Pages; now served by the host so the apex origin
 * (e.g. https://bananaclaw.app) shows the landing page. The page has a
 * prominent "Log in" link pointing at `/ui/chat`, which naturally redirects to
 * the auth page when the visitor isn't signed in (and lands them in the chat
 * app when they are). No session cookie is read here — the landing page is
 * fully public.
 *
 * The HTML lives at `src/ui/landing-page/index.html` (committed). All its
 * imagery lives under `src/ui/landing-page/assets/` (committed) and is
 * referenced as `/assets/<path>` (e.g. `/assets/bananaclaw-logo.png`,
 * `/assets/screenshots/chat-mobile.png`). This module backs two mounts: `/`
 * (the page) and `/assets` (its imagery).
 */
import fs from 'fs';
import http from 'http';
import path from 'path';

import { log } from '../../log.js';
import { resolveSafe } from './chat/classify.js';
import { siteMimeFor } from './pages/site.js';

/** Path prefix the landing page's public imagery is served under. */
export const ASSETS_MOUNT_PREFIX = '/assets';

const LANDING_DIR = path.resolve(process.cwd(), 'src', 'ui', 'landing-page');
const HTML_PATH = path.join(LANDING_DIR, 'index.html');
const ASSETS_DIR = path.join(LANDING_DIR, 'assets');
const MAX_ASSET_BYTES = 50 * 1024 * 1024; // 50 MB ceiling for any single asset

function notFound(res: http.ServerResponse): void {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

function serveHtml(res: http.ServerResponse, method: string): void {
  let html: Buffer;
  try {
    html = fs.readFileSync(HTML_PATH);
  } catch (err) {
    log.error('Landing page index missing', { path: HTML_PATH, err });
    notFound(res);
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  if (method === 'HEAD') {
    res.end();
    return;
  }
  res.end(html);
}

function serveAsset(res: http.ServerResponse, method: string, relPath: string): void {
  const abs = resolveSafe(ASSETS_DIR, relPath);
  if (!abs) {
    notFound(res);
    return;
  }
  let stat: fs.Stats;
  try {
    stat = fs.statSync(abs);
  } catch {
    notFound(res);
    return;
  }
  if (!stat.isFile() || stat.size > MAX_ASSET_BYTES) {
    notFound(res);
    return;
  }
  res.writeHead(200, {
    'Content-Type': siteMimeFor(abs),
    'Content-Length': String(stat.size),
    'Cache-Control': 'public, max-age=3600',
  });
  if (method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(abs).pipe(res);
}

/**
 * Serves the landing HTML at the apex `/` and its public imagery under
 * `/assets/*`. Backs both mounts; anything else 404s.
 */
export async function handleLandingPage(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const method = req.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
    res.end('Method not allowed');
    return;
  }

  const pathname = (req.url || '/').split('?')[0].split('#')[0];

  if (pathname.startsWith(ASSETS_MOUNT_PREFIX + '/')) {
    serveAsset(res, method, pathname.slice(ASSETS_MOUNT_PREFIX.length + 1));
  } else if (pathname === '/' || pathname === '/index.html') {
    serveHtml(res, method);
  } else {
    notFound(res);
  }
}
