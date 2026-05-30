/**
 * Google OIDC provider. Uses the standard authorization-code flow with
 * PKCE (S256). Configured via env vars OIDC_GOOGLE_CLIENT_ID and
 * OIDC_GOOGLE_CLIENT_SECRET.
 *
 * Userinfo is fetched from googleapis instead of verifying the returned
 * id_token, to avoid taking a JWT library dependency. See
 * provider.ts for the security rationale.
 */
import { createHash } from 'node:crypto';

import { log } from '../../../log.js';
import { readEnvFile } from '../../../env.js';

import type { OidcProvider, OidcUserInfo } from './provider.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const SCOPE = 'openid email profile';

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function readGoogleCreds(): { clientId: string | null; clientSecret: string | null } {
  const env = readEnvFile(['OIDC_GOOGLE_CLIENT_ID', 'OIDC_GOOGLE_CLIENT_SECRET']);
  return {
    clientId: process.env.OIDC_GOOGLE_CLIENT_ID || env.OIDC_GOOGLE_CLIENT_ID || null,
    clientSecret: process.env.OIDC_GOOGLE_CLIENT_SECRET || env.OIDC_GOOGLE_CLIENT_SECRET || null,
  };
}

export const googleProvider: OidcProvider = {
  name: 'google',
  label: 'Google',
  isConfigured(): boolean {
    const { clientId, clientSecret } = readGoogleCreds();
    return !!(clientId && clientSecret);
  },

  buildAuthUrl({ state, codeVerifier, redirectUri }): string {
    const { clientId } = readGoogleCreds();
    if (!clientId) throw new Error('google provider not configured');
    const codeChallenge = base64url(createHash('sha256').update(codeVerifier).digest());
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPE,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'online',
      prompt: 'select_account',
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode({ code, codeVerifier, redirectUri }): Promise<OidcUserInfo> {
    const { clientId, clientSecret } = readGoogleCreds();
    if (!clientId || !clientSecret) throw new Error('google provider not configured');

    const tokenBody = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    });
    const tokenResp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });
    if (!tokenResp.ok) {
      const text = await tokenResp.text().catch(() => '');
      log.warn('oidc google token exchange failed', { status: tokenResp.status, body: text.slice(0, 200) });
      throw new Error(`token exchange failed: ${tokenResp.status}`);
    }
    const tokenData = (await tokenResp.json()) as { access_token?: string };
    if (!tokenData.access_token) throw new Error('token exchange returned no access_token');

    const userResp = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userResp.ok) {
      const text = await userResp.text().catch(() => '');
      log.warn('oidc google userinfo failed', { status: userResp.status, body: text.slice(0, 200) });
      throw new Error(`userinfo failed: ${userResp.status}`);
    }
    const claims = (await userResp.json()) as Record<string, unknown>;
    const sub = typeof claims.sub === 'string' ? claims.sub : null;
    if (!sub) throw new Error('userinfo missing sub');
    return {
      sub,
      email: typeof claims.email === 'string' ? claims.email : null,
      emailVerified: claims.email_verified === true,
      displayName: typeof claims.name === 'string' ? claims.name : null,
      claims,
    };
  },
};
