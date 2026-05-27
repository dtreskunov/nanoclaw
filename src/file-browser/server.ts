/**
 * File browser. Mounts under {@link MOUNT_PREFIX} on the shared HTTP server
 * (see ../webhook-server.ts). No dedicated listener — the routes piggyback
 * on the public webhook port and rely on the bearer-token cookie + magic
 * link redemption for auth.
 *
 * Env:
 *   FILE_BROWSER_ENABLED   — 'true' to mount the routes
 *   FILE_BROWSER_SECURE    — 'true' to mark cookies Secure (set when fronted
 *                            by HTTPS).
 *   FILE_BROWSER_BASE_URL  — explicit external base URL used when minting
 *                            magic-link URLs. Defaults to
 *                            http://localhost:${WEBHOOK_PORT}${MOUNT_PREFIX}.
 */
import { readEnvFile } from '../env.js';
import { log } from '../log.js';
import { ensureSharedHttpServer, mountHandler } from '../webhook-server.js';
import { purgeExpired } from './db.js';
import { handle, MOUNT_PREFIX } from './routes.js';

const PURGE_INTERVAL_MS = 60 * 60 * 1000;

let purgeTimer: NodeJS.Timeout | null = null;
let mounted = false;

function readConfig(): { enabled: boolean; secure: boolean } {
  const env = readEnvFile(['FILE_BROWSER_ENABLED', 'FILE_BROWSER_SECURE']);
  const enabled = (process.env.FILE_BROWSER_ENABLED || env.FILE_BROWSER_ENABLED) === 'true';
  const secure = (process.env.FILE_BROWSER_SECURE || env.FILE_BROWSER_SECURE) === 'true';
  return { enabled, secure };
}

export function startFileBrowser(): void {
  const cfg = readConfig();
  if (!cfg.enabled) {
    log.info('File browser disabled (set FILE_BROWSER_ENABLED=true to mount)');
    return;
  }
  if (mounted) return;

  ensureSharedHttpServer();
  mountHandler(MOUNT_PREFIX, (req, res) =>
    handle(req, res, cfg.secure).catch((err) => {
      log.error('File browser dispatch threw', { err });
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    }),
  );
  mounted = true;
  log.info('File browser mounted', { prefix: MOUNT_PREFIX, secure: cfg.secure });

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
  // Shared server lifecycle is owned by stopWebhookServer; nothing to do here.
}

/** Compute the external base URL used for magic-link URLs. */
export function fileBrowserBaseUrl(): string {
  const env = readEnvFile(['FILE_BROWSER_BASE_URL', 'WEBHOOK_PORT']);
  const explicit = process.env.FILE_BROWSER_BASE_URL || env.FILE_BROWSER_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const port = process.env.WEBHOOK_PORT || env.WEBHOOK_PORT || '3000';
  return `http://localhost:${port}${MOUNT_PREFIX}`;
}
