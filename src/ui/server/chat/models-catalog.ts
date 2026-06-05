/**
 * Model catalog backed by models.dev.
 *
 * Wire format is opaque to the client. The host translates between the bare
 * model id (what users see and pick) and the on-disk `container_configs.model`
 * value at the API boundary:
 *
 *   - claude   → DB value === bare id. No translation.
 *   - opencode → DB value === `<OPENCODE_PROVIDER>/<bare-id>` (e.g.
 *                `openrouter/anthropic/claude-sonnet-4.6`). The opencode
 *                container provider sets OPENCODE_MODEL from the DB value
 *                verbatim, so the prefix is required at storage time.
 *                See src/providers/opencode.ts. The client always works
 *                with the bare id.
 *   - mock     → no UI catalog; not exposed by the admin endpoint.
 *
 * Catalog cached in memory (~1h TTL + brief negative cache on failure).
 */
import { log } from '../../../log.js';
import { readEnvFile } from '../../../env.js';

const MODELS_DEV_URL = 'https://models.dev/api.json';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface ModelSuggestion {
  /** Bare model id (what the user sees and the input stores). */
  id: string;
  /** Human-friendly display name. */
  label: string;
  /** Short summary (context window + cost), shown next to the id. */
  detail?: string;
  /** Full description for the tooltip. */
  tooltip?: string;
  /** Numeric facets (for rendering / future filters). */
  contextWindow?: number;
  inputCostPerMTok?: number;
  outputCostPerMTok?: number;
  knowledgeCutoff?: string;
  releaseDate?: string;
  modalitiesIn?: string[];
  modalitiesOut?: string[];
}

interface ModelsDevModel {
  id: string;
  name?: string;
  family?: string;
  reasoning?: boolean;
  tool_call?: boolean;
  knowledge?: string;
  release_date?: string;
  modalities?: { input?: string[]; output?: string[] };
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
      cache = { fetchedAt: Date.now(), catalog: null };
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function formatDetail(m: ModelsDevModel): string | undefined {
  const parts: string[] = [];
  const ctx = m.limit?.context;
  if (ctx) parts.push(`${Math.round(ctx / 1024)}k ctx`);
  if (m.cost?.input != null && m.cost?.output != null) {
    parts.push(`$${m.cost.input}/$${m.cost.output} per Mtok`);
  }
  return parts.length ? parts.join(' · ') : undefined;
}

function formatTooltip(m: ModelsDevModel, providerLabel: string): string {
  const lines: string[] = [];
  lines.push(`${providerLabel} · ${m.name?.trim() || m.id}`);
  if (m.family && m.family !== m.id) lines.push(`Family: ${m.family}`);
  if (m.limit?.context) {
    const out = m.limit.output ? ` · output up to ${m.limit.output.toLocaleString()}` : '';
    lines.push(`Context: ${m.limit.context.toLocaleString()} tokens${out}`);
  }
  if (m.cost?.input != null && m.cost?.output != null) {
    lines.push(`Cost: $${m.cost.input} in · $${m.cost.output} out (per Mtok)`);
  }
  if (m.knowledge) lines.push(`Knowledge cutoff: ${m.knowledge}`);
  if (m.release_date) lines.push(`Released: ${m.release_date}`);
  if (m.modalities?.input?.length) lines.push(`Input: ${m.modalities.input.join(', ')}`);
  if (m.modalities?.output?.length) lines.push(`Output: ${m.modalities.output.join(', ')}`);
  const caps: string[] = [];
  if (m.tool_call) caps.push('tools');
  if (m.reasoning) caps.push('reasoning');
  if (caps.length) lines.push(`Capabilities: ${caps.join(', ')}`);
  return lines.join('\n');
}

function mapModel(m: ModelsDevModel, providerLabel: string): ModelSuggestion {
  return {
    id: m.id,
    label: m.name?.trim() || m.id,
    detail: formatDetail(m),
    tooltip: formatTooltip(m, providerLabel),
    contextWindow: m.limit?.context,
    inputCostPerMTok: m.cost?.input,
    outputCostPerMTok: m.cost?.output,
    knowledgeCutoff: m.knowledge,
    releaseDate: m.release_date,
    modalitiesIn: m.modalities?.input,
    modalitiesOut: m.modalities?.output,
  };
}

export interface ModelCatalogResult {
  models: ModelSuggestion[];
  source: 'models.dev' | 'unavailable';
  /** Label for the upstream catalog (e.g. "openrouter", "anthropic"). */
  upstream: string | null;
}

/** Returns suggestions whose `id` is the bare model id (no prefix). */
export async function listModelsForProvider(agentProvider: string): Promise<ModelCatalogResult> {
  // mock is intentionally not surfaced through the admin UI — it's a
  // test-only provider and the dropdown shouldn't tempt users into picking
  // it. If you need it, set via `ncl groups config update --provider mock`.
  if (agentProvider === 'mock') {
    return { models: [], source: 'models.dev', upstream: null };
  }

  const catalog = await fetchCatalog();
  if (!catalog) return { models: [], source: 'unavailable', upstream: null };

  let upstreamKey: string | null = null;
  if (agentProvider === 'claude') upstreamKey = 'anthropic';
  else if (agentProvider === 'opencode') upstreamKey = opencodeUpstream();

  if (!upstreamKey) return { models: [], source: 'models.dev', upstream: null };
  const p = catalog[upstreamKey];
  if (!p) return { models: [], source: 'models.dev', upstream: upstreamKey };

  const providerLabel = p.name?.trim() || upstreamKey;
  return {
    models: Object.values(p.models)
      .map((m) => mapModel(m, providerLabel))
      .sort((a, b) => a.label.localeCompare(b.label)),
    source: 'models.dev',
    upstream: upstreamKey,
  };
}

/** Look up details for a specific bare id (used for the "current selection" panel). */
export async function getModelDetails(agentProvider: string, bareId: string): Promise<ModelSuggestion | null> {
  const result = await listModelsForProvider(agentProvider);
  return result.models.find((m) => m.id === bareId) ?? null;
}

// ── prefix translation (opencode opaqueness boundary) ─────────────────────

function opencodeUpstream(): string | null {
  const env = readEnvFile(['OPENCODE_PROVIDER']);
  const v = (env.OPENCODE_PROVIDER || '').trim();
  return v || null;
}

/** Translate a stored DB model value to the bare id the user sees. */
export function bareIdForResponse(agentProvider: string | null, dbValue: string | null): string | null {
  if (!dbValue) return dbValue;
  if (agentProvider === 'opencode') {
    const prefix = opencodeUpstream();
    if (prefix && dbValue.startsWith(prefix + '/')) {
      return dbValue.slice(prefix.length + 1);
    }
  }
  return dbValue;
}

/** Translate a bare id (from the user) back to the DB wire value. */
export function dbValueFromBareId(agentProvider: string | null, bareId: string | null): string | null {
  if (bareId == null || bareId === '') return null;
  if (agentProvider === 'opencode') {
    const prefix = opencodeUpstream();
    if (prefix) {
      // Be tolerant — if the user pasted a value already containing the
      // prefix, accept it as-is.
      if (bareId.startsWith(prefix + '/')) return bareId;
      return `${prefix}/${bareId}`;
    }
  }
  return bareId;
}
