/**
 * File browser HTTP server. Separate from the webhook server so it can bind
 * to loopback by default and be feature-flagged independently.
 *
 * Env:
 *   FILE_BROWSER_ENABLED   — 'true' to start the server
 *   FILE_BROWSER_PORT      — default 3001
 *   FILE_BROWSER_BIND      — default '127.0.0.1' (set to '0.0.0.0' only behind
 *                            a TLS-terminating reverse proxy)
 *   FILE_BROWSER_SECURE    — 'true' to mark cookies Secure (set when fronted
 *                            by HTTPS). Defaults to false so loopback dev works.
 */
import http from 'http';

import { readEnvFile } from '../env.js';
import { log } from '../log.js';
import { purgeExpired } from './db.js';
import { handle } from './routes.js';

const DEFAULT_PORT = 3001;
const PURGE_INTERVAL_MS = 60 * 60 * 1000; // 1h

let server: http.Server | null = null;
let purgeTimer: NodeJS.Timeout | null = null;

function readConfig(): { enabled: boolean; port: number; bind: string; secure: boolean } {
  const env = readEnvFile(['FILE_BROWSER_ENABLED', 'FILE_BROWSER_PORT', 'FILE_BROWSER_BIND', 'FILE_BROWSER_SECURE']);
  const enabled = (process.env.FILE_BROWSER_ENABLED || env.FILE_BROWSER_ENABLED) === 'true';
  const port = parseInt(process.env.FILE_BROWSER_PORT || env.FILE_BROWSER_PORT || String(DEFAULT_PORT), 10);
  const bind = process.env.FILE_BROWSER_BIND || env.FILE_BROWSER_BIND || '127.0.0.1';
  const secure = (process.env.FILE_BROWSER_SECURE || env.FILE_BROWSER_SECURE) === 'true';
  return { enabled, port, bind, secure };
}

export function startFileBrowser(): void {
  const cfg = readConfig();
  if (!cfg.enabled) {
    log.info('File browser disabled (set FILE_BROWSER_ENABLED=true to start)');
    return;
  }
  if (server) return;

  server = http.createServer((req, res) => {
    handle(req, res, cfg.secure).catch((err) => {
      log.error('File browser dispatch threw', { err });
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    });
  });

  server.listen(cfg.port, cfg.bind, () => {
    log.info('File browser server started', { bind: cfg.bind, port: cfg.port, secure: cfg.secure });
  });

  purgeTimer = setInterval(() => {
    try {
      purgeExpired();
    } catch (err) {
      log.warn('File browser purge failed', { err });
    }
  }, PURGE_INTERVAL_MS);
  purgeTimer.unref?.();
}

export async function stopFileBrowser(): Promise<void> {
  if (purgeTimer) {
    clearInterval(purgeTimer);
    purgeTimer = null;
  }
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
    log.info('File browser server stopped');
  }
}
