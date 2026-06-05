/**
 * Model catalog backed by models.dev.
 *
 * Returns model suggestions in the wire format the runtime expects for each
 * agent provider:
 *   - claude   → bare model id (`claude-sonnet-4-6`), Anthropic SDK input.
 *   - opencode → `<OPENCODE_PROVIDER>/<bare-id>` from .env, e.g.
 *                `openrouter/anthropic/claude-sonnet-4.6` or
 *                `anthropic/claude-sonnet-4-20250514`. The opencode container
 *                provider sets OPENCODE_MODEL to whatever the per-group
 *                config holds, so the string must include the OPENCODE_PROVIDER
 *                prefix (see src/providers/opencode.ts).
 *   - mock     → no catalog.
 *
 * The full models.dev payload is large (~hundreds of providers); cached in
 * memory with a TTL. Network failures fall back to an empty list — callers
 * surface the input as plain text in that case.
 */
import { log } from '../../../log.js';
import { readEnvFile } from '../../../env.js';

const MODELS_DEV_URL = 'https://models.dev/api.json';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface ModelSuggestion {
  /** Full wire value to store as container_configs.model. */
  value: string;
  /** Human-friendly label (id or name from models.dev). */
  label: string;
  /** Optional secondary line — context window, cost, etc. */
  detail?: string;
}

interface ModelsDevModel {
  id: string;
  name?: string;
  limit?: { context?: number; output?: number };
  cost?: { input?: number; output?: number };
}
interface ModelsDevProvider {
  id: string;
  name?: string;
  models: Record<string, ModelsDevModel>;
}
type ModelsDevCatalog = Record<string, ModelsDevProvider>;

interface CacheEntry {
  fetchedAt: number;
  catalog: ModelsDevCatalog | null; // null = last fetch failed
}

let cache: CacheEntry | null = null;
let inflight: Promise<ModelsDevCatalog | null> | null = null;

async function fetchCatalog(): Promise<ModelsDevCatalog | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS && cache.catalog) {
    return cache.catalog;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const r = await fetch(MODELS_DEV_URL, { signal: controller.signal });
      clearTimeout(timer);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = (await r.json()) as ModelsDevCatalog;
      cache = { fetchedAt: Date.now(), catalog: json };
      return json;
    } catch (err) {
      log.warn('models.dev fetch failed', { err: String(err) });
      // Cache the failure briefly to avoid hammering on repeated requests.
      cache = { fetchedAt: Date.now(), catalog: null };
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function formatDetail(m: ModelsDevModel): string | undefined {
  const ctx = m.limit?.context;
  const cost = m.cost;
  const parts: string[] = [];
  if (ctx) parts.push(`${Math.round(ctx / 1024)}k ctx`);
  if (cost?.input != null && cost.output != null) {
    parts.push(`$${cost.input}/$${cost.output} per Mtok`);
  }
  return parts.length ? parts.join(' · ') : undefined;
}

/**
 * Returns model suggestions for the given agent provider.
 * `prefix` (for opencode) identifies which models.dev provider to query and
 * what wire prefix to apply.
 */
export async function listModelsForProvider(agentProvider: string): Promise<{
  models: ModelSuggestion[];
  source: 'models.dev' | 'unavailable';
  /** For opencode: the OPENCODE_PROVIDER value used to pick the catalog. */
  prefix: string | null;
}> {
  if (agentProvider === 'mock') {
    return { models: [], source: 'models.dev', prefix: null };
  }

  const catalog = await fetchCatalog();
  if (!catalog) return { models: [], source: 'unavailable', prefix: null };

  if (agentProvider === 'claude') {
    const p = catalog['anthropic'];
    if (!p) return { models: [], source: 'models.dev', prefix: null };
    return {
      models: Object.values(p.models)
        .map((m) => ({
          value: m.id,
          label: m.name?.trim() || m.id,
          detail: formatDetail(m),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      source: 'models.dev',
      prefix: null,
    };
  }

  if (agentProvider === 'opencode') {
    // The OPENCODE_PROVIDER env var picks which catalog section applies
    // and what wire prefix the per-group model string must carry. Without
    // it we can't suggest anything meaningful — fall back to empty.
    const env = readEnvFile(['OPENCODE_PROVIDER']);
    const prefix = (env.OPENCODE_PROVIDER || '').trim();
    if (!prefix) return { models: [], source: 'models.dev', prefix: null };
    const p = catalog[prefix];
    if (!p) return { models: [], source: 'models.dev', prefix };
    return {
      models: Object.values(p.models)
        .map((m) => ({
          value: `${prefix}/${m.id}`,
          label: m.name?.trim() || m.id,
          detail: formatDetail(m),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      source: 'models.dev',
      prefix,
    };
  }

  return { models: [], source: 'models.dev', prefix: null };
}
