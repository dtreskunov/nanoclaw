/**
 * Discover the set of agent providers at startup by parsing the
 * container-side registration barrel
 * (container/agent-runner/src/providers/index.ts), which is the canonical
 * source of truth — every provider the runtime can actually use is declared
 * there in REQUIRED_PROVIDER_MODULES / OPTIONAL_PROVIDER_MODULES.
 *
 * Why parse instead of import: that file is part of a separate package
 * (`nanoclaw-agent-runner`) built for the container runtime (Bun), it
 * dynamically imports SDKs that aren't host dependencies, and importing it
 * here would pull in optional provider SDKs the host doesn't ship.
 *
 * Parsed once at module load and cached. If parsing fails for any reason
 * we fall back to the historical hardcoded list so the admin UI still
 * works; the failure is logged so it gets noticed in production.
 */
import fs from 'fs';
import path from 'path';

import { log } from '../../../log.js';

const PROVIDERS_INDEX = path.resolve(process.cwd(), 'container', 'agent-runner', 'src', 'providers', 'index.ts');

const FALLBACK_PROVIDERS = ['claude', 'mock', 'opencode'] as const;

function parseProviders(): readonly string[] {
  let src: string;
  try {
    src = fs.readFileSync(PROVIDERS_INDEX, 'utf8');
  } catch (err) {
    log.warn('agent-providers: index.ts unreadable, falling back to defaults', {
      path: PROVIDERS_INDEX,
      err: String(err),
    });
    return FALLBACK_PROVIDERS;
  }
  // Pull the contents of REQUIRED_PROVIDER_MODULES + OPTIONAL_PROVIDER_MODULES
  // string literals. Each entry looks like `'./<name>.js'`.
  const arrayRe = /(?:REQUIRED|OPTIONAL)_PROVIDER_MODULES\s*=\s*\[([^\]]*)\]/g;
  const moduleRe = /['"]\.\/([A-Za-z0-9_-]+)\.js['"]/g;
  const names = new Set<string>();
  let arr: RegExpExecArray | null;
  while ((arr = arrayRe.exec(src)) !== null) {
    let m: RegExpExecArray | null;
    while ((m = moduleRe.exec(arr[1]!)) !== null) {
      names.add(m[1]!);
    }
  }
  if (names.size === 0) {
    log.warn('agent-providers: parsed no entries, falling back to defaults', { path: PROVIDERS_INDEX });
    return FALLBACK_PROVIDERS;
  }
  return [...names].sort();
}

/** All providers the agent-runner can load. Used for server-side validation. */
export const VALID_AGENT_PROVIDERS: readonly string[] = parseProviders();

/** Providers offered in the admin UI picker. `mock` is intentionally hidden
 * — see chat/group-admin.ts. */
export const SELECTABLE_AGENT_PROVIDERS: readonly string[] = VALID_AGENT_PROVIDERS.filter((p) => p !== 'mock');
