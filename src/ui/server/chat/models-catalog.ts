/**
 * Model catalog backed by OpenRouter /api/v1/models.
 *
 * Wire format is opaque to the client. The host translates between the bare
 * model id (what users see and pick) and the on-disk `container_configs.model`
 * value at the API boundary:
 *
 *   - claude   → DB value === bare id (no provider prefix, e.g. "claude-sonnet-4.6").
 *                The OpenRouter catalog uses "anthropic/claude-sonnet-4.6"; we
 *                strip the prefix before exposing to the client.
 *   - opencode → DB value === `<OPENCODE_PROVIDER>/<bare-id>` (e.g.
 *                `openrouter/anthropic/claude-sonnet-4.6`). The opencode
 *                container provider sets OPENCODE_MODEL from the DB value
 *                verbatim, so the prefix is required at storage time.
 *                See src/providers/opencode.ts. The client always works
 *                with the bare id (the full OpenRouter model id).
 *   - mock     → no UI catalog; not exposed by the admin endpoint.
 *
 * Catalog cached in memory (~1h TTL + brief negative cache on failure).
 */
import { log } from '../../../log.js';
import { readEnvFile } from '../../../env.js';
import { proxyFetch } from './onecli-proxy.js';

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
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

interface OpenRouterModel {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
    modality?: string;
  };
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
  };
  supported_parameters?: string[];
  knowledge_cutoff?: string;
  created?: number;
}

interface OpenRouterResponse {
  data: OpenRouterModel[];
}

interface CacheEntry {
  fetchedAt: number;
  models: OpenRouterModel[] | null; // null = last fetch failed
}

let cache: CacheEntry | null = null;
let inflight: Promise<OpenRouterModel[] | null> | null = null;

async function fetchCatalog(): Promise<OpenRouterModel[] | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS && cache.models) {
    return cache.models;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const r = await proxyFetch(OPENROUTER_MODELS_URL, { timeout: 15_000 });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = (await r.json()) as OpenRouterResponse;
      cache = { fetchedAt: Date.now(), models: json.data };
      return json.data;
    } catch (err) {
      log.warn('OpenRouter models fetch failed', { err: String(err) });
      cache = { fetchedAt: Date.now(), models: null };
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function perTokenToPMtok(perToken: string | undefined): number | undefined {
  if (perToken == null) return undefined;
  const n = parseFloat(perToken);
  if (isNaN(n)) return undefined;
  return Math.round(n * 1_000_000 * 100) / 100; // 2 decimal places
}

function formatDetail(m: OpenRouterModel): string | undefined {
  const parts: string[] = [];
  const ctx = m.context_length;
  if (ctx) parts.push(`${Math.round(ctx / 1024)}k ctx`);
  const inCost = perTokenToPMtok(m.pricing?.prompt);
  const outCost = perTokenToPMtok(m.pricing?.completion);
  if (inCost != null && outCost != null) {
    parts.push(`$${inCost}/$${outCost} per Mtok`);
  }
  return parts.length ? parts.join(' · ') : undefined;
}

function formatTooltip(m: OpenRouterModel): string {
  const lines: string[] = [];
  lines.push(m.name?.trim() || m.id);
  if (m.context_length) {
    const maxOut = m.top_provider?.max_completion_tokens;
    const out = maxOut ? ` · output up to ${maxOut.toLocaleString()}` : '';
    lines.push(`Context: ${m.context_length.toLocaleString()} tokens${out}`);
  }
  const inCost = perTokenToPMtok(m.pricing?.prompt);
  const outCost = perTokenToPMtok(m.pricing?.completion);
  if (inCost != null && outCost != null) {
    lines.push(`Cost: $${inCost} in · $${outCost} out (per Mtok)`);
  }
  if (m.knowledge_cutoff) lines.push(`Knowledge cutoff: ${m.knowledge_cutoff}`);
  if (m.created) lines.push(`Created: ${new Date(m.created * 1000).toISOString().slice(0, 10)}`);
  if (m.architecture?.input_modalities?.length) lines.push(`Input: ${m.architecture.input_modalities.join(', ')}`);
  if (m.architecture?.output_modalities?.length) lines.push(`Output: ${m.architecture.output_modalities.join(', ')}`);
  if (m.description) lines.push(m.description.slice(0, 200));
  return lines.join('\n');
}

function mapModel(m: OpenRouterModel, bareId: string): ModelSuggestion {
  return {
    id: bareId,
    label: m.name?.trim() || bareId,
    detail: formatDetail(m),
    tooltip: formatTooltip(m),
    contextWindow: m.context_length,
    inputCostPerMTok: perTokenToPMtok(m.pricing?.prompt),
    outputCostPerMTok: perTokenToPMtok(m.pricing?.completion),
    knowledgeCutoff: m.knowledge_cutoff,
    modalitiesIn: m.architecture?.input_modalities,
    modalitiesOut: m.architecture?.output_modalities,
  };
}

export interface ModelCatalogResult {
  models: ModelSuggestion[];
  source: 'openrouter' | 'unavailable';
  /** Label for the upstream catalog (e.g. "openrouter", "anthropic"). */
  upstream: string | null;
}

export interface ModelFilterOptions {
  /** Only include models whose input modalities contain this value. */
  inputModality?: string;
  /** Only include models whose output modalities contain this value. */
  outputModality?: string;
}

/** Returns suggestions whose `id` is the bare model id (no prefix). */
export async function listModelsForProvider(
  agentProvider: string,
  filter?: ModelFilterOptions,
): Promise<ModelCatalogResult> {
  // mock is intentionally not surfaced through the admin UI — it's a
  // test-only provider and the dropdown shouldn't tempt users into picking
  // it. If you need it, set via `ncl groups config update --provider mock`.
  if (agentProvider === 'mock') {
    return { models: [], source: 'openrouter', upstream: null };
  }

  const allModels = await fetchCatalog();
  if (!allModels) return { models: [], source: 'unavailable', upstream: null };

  // Determine which models to show and how to derive the bare ID.
  let filterPrefix: string | null = null;
  let upstream: string | null = null;

  if (agentProvider === 'claude') {
    filterPrefix = 'anthropic/';
    upstream = 'anthropic';
  } else if (agentProvider === 'opencode') {
    upstream = opencodeUpstream();
    // opencode uses the full OpenRouter model id as the bare id
    filterPrefix = null;
  } else if (agentProvider === 'openrouter') {
    upstream = 'openrouter';
    filterPrefix = null;
  }

  if (!upstream) return { models: [], source: 'openrouter', upstream: null };

  const models: ModelSuggestion[] = [];
  for (const m of allModels) {
    if (filterPrefix && !m.id.startsWith(filterPrefix)) continue;
    if (filter?.inputModality && !m.architecture?.input_modalities?.includes(filter.inputModality)) continue;
    if (filter?.outputModality && !m.architecture?.output_modalities?.includes(filter.outputModality)) continue;
    const bareId = filterPrefix ? m.id.slice(filterPrefix.length) : m.id;
    models.push(mapModel(m, bareId));
  }

  models.sort((a, b) => a.label.localeCompare(b.label));
  return { models, source: 'openrouter', upstream };
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
    // Always prepend — the bare id may itself start with `<prefix>/`
    // (e.g. OpenRouter's `openrouter/free` router model), so a "tolerant"
    // skip would conflate two different DB values.
    if (prefix) return `${prefix}/${bareId}`;
  }
  return bareId;
}
