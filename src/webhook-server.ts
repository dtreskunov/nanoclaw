/**
 * Shared HTTP server. Hosts Chat SDK adapter webhooks under /webhook/{name}
 * and any modules that mount themselves under a path prefix via
 * {@link mountHandler}.
 *
 * Lazy-started: either {@link registerWebhookAdapter} or
 * {@link ensureSharedHttpServer} brings it up. Binds 0.0.0.0:WEBHOOK_PORT
 * (default 3000) — mounts inherit that public interface, so authentication
 * is on the mount.
 *
 * Routes requests by path:
 *   /webhook/{adapterName} → chat.webhooks[adapterName](request)
 *   /webhook/{path}        → raw handler from registerWebhookHandler(path, ...)
 * Raw routes let modules receive non-Chat-SDK webhooks (GitHub, payment
 * providers, health checks) on the same server without opening a second port.
 */
import http from 'http';
import type internal from 'stream';

import type { Chat } from 'chat';

import { log } from './log.js';

const DEFAULT_PORT = 3000;

interface WebhookEntry {
  chat: Chat;
  adapterName: string;
}

type MountHandler = (req: http.IncomingMessage, res: http.ServerResponse) => void | Promise<void>;
type UpgradeHandler = (req: http.IncomingMessage, socket: internal.Duplex, head: Buffer) => void | Promise<void>;

/**
 * Host-based handler. Inspects the request (typically its `Host` header) and
 * either fully handles it (returns true) or declines (returns false) so the
 * request falls through to the normal path-prefix mounts. Checked before
 * mounts, so a declined request behaves exactly as if no host handler existed.
 */
type HostHandler = (req: http.IncomingMessage, res: http.ServerResponse) => boolean | Promise<boolean>;

/** Node-style handler for raw (non-Chat-SDK) webhook routes. */
export type RawWebhookHandler = (req: http.IncomingMessage, res: http.ServerResponse) => void | Promise<void>;

interface Mount {
  prefix: string; // e.g. '/files' (no trailing slash)
  handler: MountHandler;
}

interface UpgradeMount {
  prefix: string;
  handler: UpgradeHandler;
}

const routes = new Map<string, WebhookEntry>();
const rawRoutes = new Map<string, RawWebhookHandler>();
const mounts: Mount[] = [];
const upgradeMounts: UpgradeMount[] = [];
const hostHandlers: HostHandler[] = [];
let server: http.Server | null = null;

/** Convert Node.js IncomingMessage to a Web API Request. */
async function toWebRequest(req: http.IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const body = Buffer.concat(chunks);

  const host = req.headers.host || 'localhost';
  const url = `http://${host}${req.url}`;

  const headers: Record<string, string> = {};
  for (const [key, val] of Object.entries(req.headers)) {
    if (typeof val === 'string') headers[key] = val;
    else if (Array.isArray(val)) headers[key] = val.join(', ');
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(url, {
    method: req.method || 'GET',
    headers,
    body: hasBody ? body : undefined,
  });
}

/** Write a Web API Response back to a Node.js ServerResponse. */
async function fromWebResponse(webRes: Response, nodeRes: http.ServerResponse): Promise<void> {
  nodeRes.writeHead(webRes.status, Object.fromEntries(webRes.headers.entries()));
  if (webRes.body) {
    const reader = webRes.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        nodeRes.write(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  nodeRes.end();
}

/**
 * Register a webhook adapter on the shared server.
 * Starts the server lazily on first call.
 *
 * `routingPath` is the URL segment (`/webhook/<routingPath>`); `adapterName`
 * stays the handler key into `chat.webhooks`. The split lets N instances of
 * one platform (each with its own Chat + signing secret) listen on distinct
 * URLs while dispatching to the same SDK adapter name. Defaulting
 * routingPath to adapterName keeps the historical single-instance route
 * byte-identical. Signature adopted verbatim from PR #2617 (@davekim917's
 * #1804 prototype) so the two changes converge textually.
 */
export function registerWebhookAdapter(chat: Chat, adapterName: string, routingPath: string = adapterName): void {
  routes.set(routingPath, { chat, adapterName });
  ensureSharedHttpServer();
  log.info('Webhook adapter registered', { adapter: adapterName, path: `/webhook/${routingPath}` });
}

/**
 * Register a raw Node-style handler at /webhook/{path} on the shared server.
 *
 * For webhooks that don't flow through a Chat SDK adapter (GitHub, payment
 * providers, health checks): modules register their endpoint here instead of
 * editing this file or standing up a second HTTP server on another port.
 * The handler owns the request/response directly.
 *
 * Starts the server lazily on first call.
 */
export function registerWebhookHandler(path: string, handler: RawWebhookHandler): void {
  rawRoutes.set(path, handler);
  ensureSharedHttpServer();
  log.info('Webhook handler registered', { path: `/webhook/${path}` });
}

/**
 * Mount a request handler under a path prefix on the shared server.
 * Starts the server lazily on first call. The handler receives requests
 * whose `req.url` path starts with `prefix` (or equals it).
 */
export function mountHandler(prefix: string, handler: MountHandler): void {
  const normalized = prefix === '/' ? '/' : prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  mounts.push({ prefix: normalized, handler });
  ensureSharedHttpServer();
  log.info('HTTP mount registered', { prefix: normalized });
}

/**
 * Mount a WebSocket upgrade handler under a path prefix. Matched the same
 * way as `mountHandler` (longest-prefix wins). The handler receives the
 * raw IncomingMessage / socket / head and is responsible for completing
 * the upgrade (e.g. via the `ws` library's `wss.handleUpgrade`).
 */
export function mountUpgradeHandler(prefix: string, handler: UpgradeHandler): void {
  const normalized = prefix === '/' ? '/' : prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  upgradeMounts.push({ prefix: normalized, handler });
  ensureSharedHttpServer();
  log.info('HTTP upgrade mount registered', { prefix: normalized });
}

/**
 * Register a host-based handler on the shared server. Handlers are consulted
 * in registration order before any path-prefix mount. A handler returns true
 * if it fully handled the request, or false to decline (the request then
 * falls through to the normal mount routing). Starts the server lazily.
 */
export function registerHostHandler(handler: HostHandler): void {
  hostHandlers.push(handler);
  ensureSharedHttpServer();
  log.info('HTTP host handler registered');
}

/** Public for modules that want the shared server up without registering a route. */
export function ensureSharedHttpServer(): void {
  ensureServer();
}
function ensureServer(): void {
  if (server) return;

  const port = parseInt(process.env.WEBHOOK_PORT || String(DEFAULT_PORT), 10);

  server = http.createServer(async (req, res) => {
    const url = req.url || '/';
    const pathname = url.split('?')[0];

    // 0. Host-based handlers (e.g. per-group static websites). Checked before
    //    mounts; a handler that declines (returns false) lets the request fall
    //    through to the normal path-prefix routing below.
    for (const h of hostHandlers) {
      try {
        if (await h(req, res)) return;
      } catch (err) {
        log.error('Host handler threw', { url: req.url, host: req.headers.host, err });
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
        }
        return;
      }
    }

    // 1. Mounts (longest prefix first so '/files/x' beats '/files' when both exist).
    for (const m of [...mounts].sort((a, b) => b.prefix.length - a.prefix.length)) {
      if (pathname === m.prefix || pathname.startsWith(m.prefix + '/')) {
        try {
          await m.handler(req, res);
        } catch (err) {
          log.error('Mount handler threw', { prefix: m.prefix, url: req.url, err });
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
          }
        }
        return;
      }
    }

    // 2. Built-in /webhook/{adapterName} routing.
    const match = url.match(/^\/webhook\/([^/?]+)/);
    if (!match) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    const adapterName = match[1];

    try {
      // Raw routes take priority — the handler writes the response itself.
      const rawHandler = rawRoutes.get(adapterName);
      if (rawHandler) {
        await rawHandler(req, res);
        return;
      }

      const entry = routes.get(adapterName);
      if (!entry) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Unknown adapter: ${adapterName}`);
        return;
      }

      const webReq = await toWebRequest(req);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const webhooks = entry.chat.webhooks as Record<string, (r: Request, opts?: any) => Promise<Response>>;
      const handler = webhooks[entry.adapterName];
      const webRes = await handler(webReq, {
        waitUntil: (p: Promise<unknown>) => {
          p.catch(() => {});
        },
      });
      await fromWebResponse(webRes, res);
    } catch (err) {
      log.error('Webhook handler error', { adapter: adapterName, url: req.url, err });
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    }
  });

  server.listen(port, '0.0.0.0', () => {
    log.info('Shared HTTP server started', {
      port,
      adapters: [...routes.keys()],
      mounts: mounts.map((m) => m.prefix),
    });
  });

  server.on('upgrade', async (req, socket, head) => {
    const url = req.url || '/';
    const pathname = url.split('?')[0];
    for (const m of [...upgradeMounts].sort((a, b) => b.prefix.length - a.prefix.length)) {
      if (pathname === m.prefix || pathname.startsWith(m.prefix + '/')) {
        try {
          await m.handler(req, socket, head);
        } catch (err) {
          log.error('Upgrade handler threw', { prefix: m.prefix, url: req.url, err });
          try {
            socket.destroy();
          } catch {
            // swallow
          }
        }
        return;
      }
    }
    socket.destroy();
  });
}

/** Shut down the shared HTTP server. */
export async function stopWebhookServer(): Promise<void> {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
    routes.clear();
    rawRoutes.clear();
    mounts.length = 0;
    upgradeMounts.length = 0;
    log.info('Shared HTTP server stopped');
  }
}
