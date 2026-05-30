/**
 * OIDC provider registry. Each entry is a static `OidcProvider` instance;
 * `isConfigured()` decides whether it's offered at sign-in time. To add a
 * new provider, drop a module under `./oidc/` and append to PROVIDERS.
 */
import { googleProvider } from './google.js';

import type { OidcProvider } from './provider.js';

const PROVIDERS: OidcProvider[] = [googleProvider];

export function getOidcProvider(name: string): OidcProvider | undefined {
  return PROVIDERS.find((p) => p.name === name);
}

export function listConfiguredProviders(): OidcProvider[] {
  return PROVIDERS.filter((p) => p.isConfigured());
}
