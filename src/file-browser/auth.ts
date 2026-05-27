/**
 * Cookie + magic-link authentication for the file browser.
 *
 * Bearer-token model with server-side session table — no signed cookies, no
 * shared HMAC key. The token in the cookie / URL is opaque; the DB stores
 * only sha256(token).
 */
import http from 'http';

import { log } from '../log.js';
import { createMagicLink, createSession, deleteSession, lookupSession, logAccess, redeemMagicLink } from './db.js';

const COOKIE_NAME = 'file_browser_session';
export const MAGIC_LINK_TTL_MS = 10 * 60 * 1000; // 10 min
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function issueMagicLink(userId: string): { token: string; expiresAt: string } {
  const out = createMagicLink(userId, MAGIC_LINK_TTL_MS);
  log.info('File browser magic link issued', { userId, expiresAt: out.expiresAt });
  return out;
}

/** Returns user_id on success; null on invalid/expired/already-redeemed. */
export function redeemAndCreateSession(token: string): { token: string; userId: string; expiresAt: string } | null {
  const userId = redeemMagicLink(token);
  if (!userId) return null;
  const session = createSession(userId, SESSION_TTL_MS);
  log.info('File browser session created', { userId, expiresAt: session.expiresAt });
  return { token: session.token, userId, expiresAt: session.expiresAt };
}

export function authenticate(req: http.IncomingMessage): { userId: string } | null {
  const token = readCookie(req, COOKIE_NAME);
  if (!token) return null;
  const session = lookupSession(token);
  if (!session) return null;
  return { userId: session.userId };
}

export function logout(req: http.IncomingMessage): void {
  const token = readCookie(req, COOKIE_NAME);
  if (token) deleteSession(token);
}

export function buildSessionCookie(token: string, secure: boolean): string {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  const parts = [`${COOKIE_NAME}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function buildClearCookie(secure: boolean): string {
  const parts = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function readCookie(req: http.IncomingMessage, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    if (k === name) return part.slice(eq + 1).trim();
  }
  return null;
}

export function recordAccess(args: {
  userId: string | null;
  groupId: string | null;
  path: string | null;
  action: string;
  req: http.IncomingMessage;
}): void {
  const fwd = args.req.headers['x-forwarded-for'];
  const ip = (typeof fwd === 'string' ? fwd.split(',')[0]?.trim() : null) || args.req.socket.remoteAddress || null;
  logAccess({ userId: args.userId, groupId: args.groupId, path: args.path, action: args.action, ip });
}
