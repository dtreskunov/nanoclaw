/**
 * Reusable model selector with combobox + detail panel.
 * Fetches model catalog from the server for a given provider and renders
 * a searchable dropdown with model metadata.
 */
import { useEffect, useState } from 'preact/hooks';
import { Combobox, type ComboboxOption } from './Combobox';

interface ModelSuggestion {
  id: string;
  label: string;
  detail?: string;
  tooltip?: string;
}

interface ModelsResponse {
  models: ModelSuggestion[];
  source: 'openrouter' | 'unavailable';
  upstream: string | null;
}

export interface ModelSelectorProps {
  /** Current model value (bare id). */
  value: string | null;
  /** Provider to fetch models for (e.g. 'openrouter', 'claude'). */
  provider: string | null;
  /** Placeholder text when no model is selected. */
  placeholder?: string;
  /** Whether the field is disabled. */
  disabled?: boolean;
  /** API base path for fetching (e.g. '/ui/chat/api/groups/:gid/admin'). */
  apiBasePath: string;
  /** Filter to models that accept this input modality (e.g. 'audio'). */
  inputModality?: string;
  /** Filter to models that produce this output modality (e.g. 'text'). */
  outputModality?: string;
  /** Called when the user picks or types a model id. */
  onChange: (value: string | null) => void;
}

async function fetchJson<T>(url: string): Promise<{ ok: boolean; data: T; status: number }> {
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    const data = await res.json();
    return { ok: res.ok, data, status: res.status };
  } catch {
    return { ok: false, data: {} as T, status: 0 };
  }
}

export function ModelSelector({ value, provider, placeholder, disabled, apiBasePath, inputModality, outputModality, onChange }: ModelSelectorProps) {
  const [models, setModels] = useState<ModelsResponse | null>(null);

  useEffect(() => {
    if (!provider) { setModels(null); return; }
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams({ provider });
      if (inputModality) params.set('inputModality', inputModality);
      if (outputModality) params.set('outputModality', outputModality);
      const r = await fetchJson<ModelsResponse>(
        `${apiBasePath}/models?${params.toString()}`,
      );
      if (cancelled) return;
      setModels(r.ok ? r.data : { models: [], source: 'unavailable', upstream: null });
    })();
    return () => { cancelled = true; };
  }, [provider, apiBasePath, inputModality, outputModality]);

  const options: ComboboxOption[] = (models?.models ?? []).map((m) => ({
    value: m.id,
    label: m.label,
    detail: m.detail,
    tooltip: m.tooltip,
  }));

  const matched = options.find((o) => o.value === value);

  return (
    <div class="group-admin-stack">
      <Combobox
        value={value}
        options={options}
        placeholder={placeholder || 'pick or type a model id'}
        disabled={disabled || !provider}
        onChange={onChange}
      />
      {(() => {
        if (matched) {
          return (
            <div class="group-admin-selected-info">
              <div class="selected-title">
                {matched.label}
                {matched.detail ? <span class="selected-detail"> · {matched.detail}</span> : null}
              </div>
              {matched.tooltip ? (
                <pre class="selected-tooltip">{matched.tooltip.split('\n').slice(1).join('\n')}</pre>
              ) : null}
            </div>
          );
        }
        if (models?.source === 'unavailable') {
          return <p class="group-admin-help">Catalog unavailable — saved as-is.</p>;
        }
        if (value) {
          return <p class="group-admin-help">Not in catalog — saved as a custom value.</p>;
        }
        return null;
      })()}
    </div>
  );
}
