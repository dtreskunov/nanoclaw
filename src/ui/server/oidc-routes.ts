/**
 * OIDC HTTP routes.
 *
 * Endpoints:
 *   GET  /ui/auth/oidc/<provider>/start?next=...   → redirect to provider auth URL
 *   GET  /ui/auth/oidc/<provider>/callback?code=&state=... → exchange + log in / queue approval
 *
 * Sign-in resolution:
 *   1. (provider, sub) matches an oidc_links row → log in as that user.
 *   2. email matches an existing identity (channel='resend' for now) AND
 *      email_verified is true → auto-link (insert oidc_links row), log in.
 *   3. Otherwise → create a pending_user_approvals row, render "waiting for
 *      admin approval" page with instructions for the admin to run
 *      `ncl pending-approvals approve <id>`.
 *
 * State + PKCE verifier are kept in an in-process Map (single host
 * process; survives only as long as the server runs). A stale flow after
 * a host restart just makes the user click sign-in again — no security
 * concern, just a UX inconvenience.
 */
import http from 'http';
import { randomBytes } from 'node:crypto';
import { URL } from 'url';

import { log } from '../../log.js';
import { getIdentity } from '../../modules/permissions/db/identities.js';
import { insertOidcLink, getOidcLink, touchOidcLink } from '../../modules/permissions/db/oidc-links.js';
import {
  createPendingApproval,
  findPendingByOidcSub,
  getPendingApproval,
} from '../../modules/permissions/db/pending-user-approvals.js';
import { requestUserApproval } from '../../modules/permissions/user-approval.js';

import { buildSessionCookie, createUiSessionForUser } from './auth.js';
import { getBranding } from './branding.js';
import { getOidcProvider, listConfiguredProviders } from './oidc/registry.js';
import { postLoginRedirect } from './onboarding.js';

const STATE_COOKIE = 'oidc_state';
const STATE_TTL_MS = 10 * 60 * 1000;
const LANDING = '/ui/chat/';

interface PendingFlow {
  state: string;
  codeVerifier: string;
  next: string;
  provider: string;
  redirectUri: string;
  expiresAt: number;
}

const flows = new Map<string, PendingFlow>();

function sweepFlows(): void {
  const now = Date.now();
  for (const [k, v] of flows) if (v.expiresAt < now) flows.delete(k);
}

/** Test-only seam: drop in-process state. */
export function _resetOidcState(): void {
  flows.clear();
}

function sanitizeNext(next: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith('/ui/')) return null;
  return next;
}

function buildRedirectUri(req: http.IncomingMessage, provider: string): string {
  const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0].trim() || 'http';
  const host = req.headers.host || 'localhost';
  return `${proto}://${host}/ui/auth/oidc/${provider}/callback`;
}

function readCookie(req: http.IncomingMessage, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

function buildStateCookie(value: string, secure: boolean): string {
  const parts = [
    `${STATE_COOKIE}=${value}`,
    'Path=/ui/auth/oidc',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(STATE_TTL_MS / 1000)}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function clearStateCookie(secure: boolean): string {
  const parts = [`${STATE_COOKIE}=`, 'Path=/ui/auth/oidc', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function renderHtml(res: http.ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

const PAGE_STYLE = `
  <style>
    :root {
      color-scheme: light dark;
      --surface: Canvas;
      --surface-fg: CanvasText;
      --border: rgba(127, 127, 127, 0.25);
      --muted: rgba(127, 127, 127, 0.7);
      --wash: rgba(127, 127, 127, 0.12);
      --shadow: rgba(0, 0, 0, 0.28);
      --accent: #1a73e8;
      --accent-hover: #1664c1;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; min-height: 100%; }
    body {
      font: 14px/1.5 system-ui, -apple-system, sans-serif;
      background: var(--surface); color: var(--surface-fg);
      min-height: 100vh; min-height: 100dvh;
      display: flex; align-items: center; justify-content: center;
      padding: 24px 16px;
    }
    .card {
      width: 100%; max-width: 420px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      box-shadow: 0 8px 28px var(--shadow);
      padding: 28px 28px 24px;
    }
    .brand {
      font-size: 13px; font-weight: 600;
      letter-spacing: 0.04em; text-transform: uppercase;
      color: var(--muted); margin-bottom: 12px;
    }
    h1 { font-size: 20px; margin: 0 0 16px; font-weight: 600; }
    p { margin: 8px 0; }
    .btn {
      display: block; width: 100%; text-align: center;
      padding: 10px 16px; margin: 8px 0;
      background: var(--accent); color: #fff;
      border-radius: 6px; text-decoration: none;
      font-weight: 500;
    }
    .btn:hover { background: var(--accent-hover); }
    .muted { color: var(--muted); font-size: 13px; }
    code {
      background: var(--wash); padding: 1px 5px;
      border-radius: 3px; font-size: 12.5px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
  </style>
`;

export function renderLoginPage(next: string | null): string {
  const brand = getBranding().name;
  const providers = listConfiguredProviders();
  const safeNext = sanitizeNext(next) || LANDING;
  const buttons = providers
    .map(
      (p) =>
        `<p><a class="btn" href="/ui/auth/oidc/${p.name}/start?next=${encodeURIComponent(safeNext)}">Sign in with ${p.label}</a></p>`,
    )
    .join('');
  const fallback =
    providers.length === 0
      ? `<p>No sign-in providers configured. Ask your operator to set <code>OIDC_GOOGLE_CLIENT_ID</code> and <code>OIDC_GOOGLE_CLIENT_SECRET</code> in <code>.env</code>, or to DM you a magic link.</p>`
      : `<p class="muted">Or wait for your operator to DM you a magic link.</p>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Sign in — ${brand}</title>${PAGE_STYLE}</head><body>
    <div class="card">
      <div class="brand">${brand}</div>
      <h1>Sign in</h1>
      ${buttons}
      ${fallback}
    </div>
  </body></html>`;
}

/** Page auto-refreshes every 60s so the user lands in the app the next tick after an admin approves. */
function renderPendingPage(pendingId: string, email: string | null): string {
  const brand = getBranding().name;
  const who = email ? `<code>${email}</code>` : 'this account';
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="60"><title>Pending approval — ${brand}</title>${PAGE_STYLE}</head><body>
    <div class="card">
      <div class="brand">${brand}</div>
      <h1>Waiting for admin approval</h1>
      <p>${who} isn't recognized yet. We've sent your sign-in request to an admin.</p>
      <p class="muted">This page checks for approval every minute. You can leave it open.</p>
      <p class="muted">Reference: <code>${pendingId}</code></p>
    </div>
  </body></html>`;
}

function renderDeniedPage(email: string | null): string {
  const brand = getBranding().name;
  const who = email ? `<code>${email}</code>` : 'this account';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Access denied — ${brand}</title>${PAGE_STYLE}</head><body>
    <div class="card">
      <div class="brand">${brand}</div>
      <h1>Access denied</h1>
      <p>${who} was not approved.</p>
      <p class="muted">You can try signing in again to request another review.</p>
      <p><a class="btn" href="/ui/login">Try again</a></p>
    </div>
  </body></html>`;
}

function renderError(message: string): string {
  const brand = getBranding().name;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Sign-in error</title>${PAGE_STYLE}</head><body>
    <div class="card">
      <div class="brand">${brand}</div>
      <h1>Sign-in failed</h1>
      <p>${message}</p>
      <p><a class="btn" href="/ui/login">Try again</a></p>
    </div>
  </body></html>`;
}

/**
 * Dispatcher for /ui/auth/oidc/* (mounted by server.ts under the existing
 * /ui/auth prefix — server.ts strips the prefix before delegating here,
 * so `pathname` here starts with `/oidc/`).
 */
export async function handleOidcRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  url: URL,
  secureCookie: boolean,
): Promise<void> {
  sweepFlows();

  // Status poller for the waiting page. Reuses the same URL the user lands
  // on after the callback, so the meta-refresh closes the loop without
  // bouncing through the provider again.
  const pendingMatch = pathname.match(/^\/oidc\/pending\/([A-Za-z0-9_-]+)$/);
  if (pendingMatch && req.method === 'GET') {
    return handlePendingPoll(res, pendingMatch[1], secureCookie);
  }

  // pathname is like /oidc/google/start or /oidc/google/callback
  const match = pathname.match(/^\/oidc\/([a-z0-9_-]+)\/(start|callback)$/);
  if (!match) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }
  const [, providerName, action] = match;
  const provider = getOidcProvider(providerName);
  if (!provider || !provider.isConfigured()) {
    renderHtml(res, 404, renderError(`Provider <code>${providerName}</code> is not configured.`));
    return;
  }

  if (req.method === 'GET' && action === 'start') {
    return handleStart(req, res, provider.name, url, secureCookie);
  }
  if (req.method === 'GET' && action === 'callback') {
    return handleCallback(req, res, provider.name, url, secureCookie);
  }
  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end('Method Not Allowed');
}

function handlePendingPoll(res: http.ServerResponse, pendingId: string, secureCookie: boolean): void {
  const row = getPendingApproval(pendingId);
  if (!row) {
    renderHtml(res, 404, renderError('Sign-in request not found. Start again.'));
    return;
  }
  if (row.status === 'approved') {
    // The approval handler created the user + oidc_link; look it up and
    // mint a UI session inline so the user lands in the app without
    // bouncing through the provider.
    const link = getOidcLink(row.provider, row.sub);
    if (!link) {
      log.warn('pending poll: approved row has no oidc_link', { pendingId, provider: row.provider });
      renderHtml(res, 500, renderError('Approval inconsistent. Sign in again.'));
      return;
    }
    completeLogin(res, link.user_id, LANDING, secureCookie);
    return;
  }
  if (row.status === 'denied') {
    renderHtml(res, 200, renderDeniedPage(row.email));
    return;
  }
  // 'pending' (or anything else) → keep waiting.
  renderHtml(res, 200, renderPendingPage(pendingId, row.email));
}

function handleStart(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  providerName: string,
  url: URL,
  secureCookie: boolean,
): void {
  const provider = getOidcProvider(providerName)!;
  const state = randomBytes(16).toString('hex');
  const codeVerifier = randomBytes(48).toString('base64url');
  const next = sanitizeNext(url.searchParams.get('next')) || LANDING;
  const redirectUri = buildRedirectUri(req, providerName);
  flows.set(state, {
    state,
    codeVerifier,
    next,
    provider: providerName,
    redirectUri,
    expiresAt: Date.now() + STATE_TTL_MS,
  });
  const authUrl = provider.buildAuthUrl({ state, codeVerifier, redirectUri });
  res.writeHead(303, {
    Location: authUrl,
    'Set-Cookie': buildStateCookie(state, secureCookie),
  });
  res.end();
}

async function handleCallback(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  providerName: string,
  url: URL,
  secureCookie: boolean,
): Promise<void> {
  const provider = getOidcProvider(providerName)!;
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const cookieState = readCookie(req, STATE_COOKIE);
  if (!state || !code) {
    renderHtml(res, 400, renderError('Missing code or state in callback.'));
    return;
  }
  if (cookieState !== state) {
    renderHtml(res, 400, renderError('State mismatch (possible CSRF). Start sign-in again.'));
    return;
  }
  const flow = flows.get(state);
  flows.delete(state);
  if (!flow || flow.provider !== providerName) {
    renderHtml(res, 400, renderError('Sign-in flow expired. Start again.'));
    return;
  }

  let info;
  try {
    info = await provider.exchangeCode({
      code,
      codeVerifier: flow.codeVerifier,
      redirectUri: flow.redirectUri,
    });
  } catch (err) {
    log.warn('oidc callback exchange failed', { provider: providerName, err: (err as Error).message });
    renderHtml(res, 502, renderError('Provider rejected the sign-in. Start again.'));
    return;
  }

  // 1. Existing link?
  const link = getOidcLink(providerName, info.sub);
  if (link) {
    touchOidcLink(providerName, info.sub, info.claims);
    completeLogin(res, link.user_id, flow.next, secureCookie);
    return;
  }

  // 2. Auto-link by verified email → existing resend identity.
  if (info.email && info.emailVerified) {
    const existing = getIdentity('resend', info.email);
    if (existing) {
      insertOidcLink({
        provider: providerName,
        sub: info.sub,
        user_id: existing.user_id,
        email: info.email,
        claims: info.claims,
      });
      log.info('oidc auto-linked by verified email', {
        provider: providerName,
        sub: info.sub,
        user_id: existing.user_id,
        email: info.email,
      });
      completeLogin(res, existing.user_id, flow.next, secureCookie);
      return;
    }
  }

  // 3. Queue for admin approval. Re-attempts (including after a prior
  // denial) coalesce on any in-flight pending row; otherwise a fresh
  // pending row is inserted so resolved rows accumulate for audit.
  let pending = findPendingByOidcSub(providerName, info.sub);
  if (!pending) {
    const created = createPendingApproval({
      provider: providerName,
      sub: info.sub,
      email: info.email,
      display_name: info.displayName,
      claims: info.claims,
    });
    pending = created.row;
    log.info('oidc pending approval created', {
      id: pending.id,
      provider: providerName,
      sub: info.sub,
      email: info.email,
    });
  }

  // Fire-and-forget: pick an approver, deliver an Approve/Reject card to
  // their primary DM. Idempotent — re-attempts that find an existing
  // pending row with approver_user_id already set are no-ops.
  requestUserApproval(pending.id).catch((err) =>
    log.error('requestUserApproval failed', { pendingId: pending?.id, err }),
  );

  // Redirect to the canonical waiting page URL so the meta-refresh re-hits
  // the status poller (rather than bouncing through the provider again).
  res.writeHead(303, {
    Location: `/ui/auth/oidc/pending/${pending.id}`,
    'Set-Cookie': clearStateCookie(secureCookie),
  });
  res.end();
}

function completeLogin(res: http.ServerResponse, userId: string, next: string, secureCookie: boolean): void {
  const session = createUiSessionForUser(userId);
  const destination = postLoginRedirect(userId, next);
  res.writeHead(303, {
    Location: destination,
    'Set-Cookie': [buildSessionCookie(session.token, secureCookie), clearStateCookie(secureCookie)],
  });
  res.end();
}
