/**
 * OIDC provider abstraction. A provider knows how to build an
 * authorization URL and how to exchange a callback code for a verified
 * subject claim + email + display name.
 *
 * Implementations skip JWT/JWKS handling: after exchanging the auth code
 * for tokens over TLS (using our client_secret), they call the provider's
 * userinfo endpoint over TLS with the access_token. The userinfo response
 * is trusted because the bearer is bound to our client by the token
 * exchange. This avoids pulling in a JWT library while remaining safe
 * for server-side OAuth2 with confidential client.
 */

export interface OidcUserInfo {
  /** Stable per-account identifier from the provider (the `sub` claim). */
  sub: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  /** Raw claims for audit / future use. */
  claims: Record<string, unknown>;
}

export interface OidcProvider {
  /** Short identifier — also the URL slug (`/ui/auth/oidc/<name>/...`). */
  readonly name: string;
  /** Display label for the sign-in button. */
  readonly label: string;
  /** True iff the env is configured enough to use this provider. */
  isConfigured(): boolean;
  /**
   * Build the authorization redirect URL. The caller is responsible for
   * generating `state` and the PKCE `codeVerifier`; this returns the URL
   * and the derived `codeChallenge` (S256).
   */
  buildAuthUrl(args: { state: string; codeVerifier: string; redirectUri: string }): string;
  /** Exchange auth code → tokens → userinfo. */
  exchangeCode(args: { code: string; codeVerifier: string; redirectUri: string }): Promise<OidcUserInfo>;
}
