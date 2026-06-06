// Per-group admin modal — config, members, scoped admin grants.
// Visible only when the active group's `isAdmin` is true. Reuses the
// existing .settings-backdrop / .settings-modal chrome for visual parity.
import './GroupAdmin.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';

import {
  groupAdminOpen,
  groupId,
  groups,
} from '../state';
import { Combobox, type ComboboxOption } from './Combobox';
import { InfoIcon, Tooltip } from './Tooltip';
import { showToast } from './Toast';
import { useBackButtonCloses } from '../modalBackButton';

type Tab = 'settings' | 'members' | 'roles';

interface HeaderActions {
  refresh: () => void;
  apply: () => void;
  busy: boolean;
  canSave: boolean;
}


interface SettingsResponse {
  id: string;
  name: string;
  folder: string;
  createdAt: string;
  updatedAt: string | null;
  config: {
    provider: string | null;
    model: string | null;
    effort: string | null;
    image_tag: string | null;
    assistant_name: string | null;
    max_messages_per_prompt: number | null;
    cli_scope: string | null;
    voice_mode: string | null;
  };
  defaults: {
    provider: string | null;
    model: string | null;
    image_tag: string | null;
  };
  validProviders: string[];
  validCliScopes: string[];
  validVoiceModes: string[];
  runningSessionCount: number;
  selectedModelDetail: { label: string; detail?: string; tooltip?: string } | null;
  selectedImageDetail: { label: string; createdAt: string | null; size: number | null } | null;
  actorIsElevated: boolean;
}

interface MemberDto {
  userId: string;
  displayName: string | null;
  primaryHandle: string | null;
  primaryChannel: string | null;
  isExplicitMember: boolean;
  isAdmin: boolean;
}

interface RoleDto {
  userId: string;
  displayName: string | null;
  primaryHandle: string | null;
  primaryChannel: string | null;
  grantedAt: string;
  grantedBy: string | null;
}

interface UserSearchDto {
  userId: string;
  displayName: string | null;
  kind: string;
  primaryHandle: string | null;
  primaryChannel: string | null;
}

interface ModelSuggestion {
  id: string;
  label: string;
  detail?: string;
  tooltip?: string;
}

interface ModelsResponse {
  models: ModelSuggestion[];
  source: 'models.dev' | 'unavailable';
  upstream: string | null;
}

interface ImageSuggestion {
  value: string;
  label: string;
  createdAt: string | null;
  size: number | null;
  isDefault: boolean;
}

interface ImagesResponse {
  images: ImageSuggestion[];
}

const PROVIDER_INFO: Record<string, string> = {
  claude: 'Claude — Anthropic models via the official SDK. Uses your OneCLI-injected Anthropic API key.',
  opencode: 'OpenCode — multi-provider gateway (OpenRouter, DeepSeek, OpenCode Zen, Anthropic, etc.) selected by host OPENCODE_PROVIDER. Wire prefix is handled automatically.',
};

function formatAge(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const diffMs = Date.now() - t;
  const day = 24 * 3600 * 1000;
  const hour = 3600 * 1000;
  if (diffMs < hour) return 'just now';
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  const days = Math.floor(diffMs / day);
  if (days < 7) return `${days}d ago`;
  if (days < 60) return `${Math.floor(days / 7)}w ago`;
  if (days < 730) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function formatSize(bytes: number | null): string | null {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function apiPath(gid: string, sub: string): string {
  return `/ui/chat/api/groups/${encodeURIComponent(gid)}/admin${sub}`;
}

async function call<T>(
  url: string,
  method: string = 'GET',
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: T }> {
  const r = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: T = {} as T;
  try { data = (await r.json()) as T; } catch { /* non-JSON */ }
  return { ok: r.ok, status: r.status, data };
}

function errMsg(d: unknown, fallback: string): string {
  const e = (d as { error?: unknown })?.error;
  return typeof e === 'string' && e ? e : fallback;
}

function userLabel(u: { displayName?: string | null; primaryHandle?: string | null; primaryChannel?: string | null; userId: string }): string {
  if (u.displayName) return u.displayName;
  if (u.primaryHandle) return `${u.primaryChannel ?? '?'}:${u.primaryHandle}`;
  return u.userId;
}

export function GroupAdmin(): JSX.Element | null {
  const open = groupAdminOpen.value;
  const gid = groupId.value;
  const [tab, setTab] = useState<Tab>('settings');
  const actionsRef = useRef<HeaderActions | null>(null);
  const [, forceRender] = useState(0);
  useEffect(() => { setTab('settings'); }, [open, gid]);
  useBackButtonCloses(open, () => { groupAdminOpen.value = false; });

  if (!open || !gid) return null;
  const group = groups.value.find((g) => g.id === gid);
  const title = group ? `Admin · ${group.name}` : 'Admin';

  function close(): void { groupAdminOpen.value = false; }
  function onBackdrop(e: JSX.TargetedMouseEvent<HTMLDivElement>): void {
    if ((e.target as HTMLElement).classList.contains('settings-backdrop')) close();
  }
  function onKey(e: KeyboardEvent): void { if (e.key === 'Escape') close(); }

  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const ha = actionsRef.current;
  const setActions = (a: HeaderActions | null) => { actionsRef.current = a; forceRender((n) => n + 1); };

  return (
    <div class="settings-backdrop" onClick={onBackdrop}>
      <div class="settings-modal" role="dialog" aria-label={title}>
        <header class="settings-head">
          <span class="title">{title}</span>
          <div class="settings-head-actions">
            {tab === 'settings' && ha ? (
              <>
                <Tooltip text="Re-fetch settings from server">
                  <button type="button" class="icon-btn" aria-label="Refresh" onClick={ha.refresh} disabled={ha.busy}>&#x21bb;</button>
                </Tooltip>
                <Tooltip text={ha.canSave ? 'Save changes' : 'Nothing to save'}>
                  <button type="button" class="icon-btn" aria-label="Save" onClick={ha.apply} disabled={ha.busy || !ha.canSave}>&#x2713;</button>
                </Tooltip>
              </>
            ) : null}
            <button type="button" class="icon-btn" aria-label="Close" onClick={close}>{'\u2715'}</button>
          </div>
        </header>
        <nav class="group-admin-tabs">
          <button type="button" class={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>Settings</button>
          <button type="button" class={tab === 'members' ? 'active' : ''} onClick={() => setTab('members')}>Members</button>
          <button type="button" class={tab === 'roles' ? 'active' : ''} onClick={() => setTab('roles')}>Admins</button>
        </nav>
        <div class="settings-body">
          {tab === 'settings' ? <SettingsTab gid={gid} onClose={close} onActions={setActions} /> : null}
          {tab === 'members' ? <MembersTab gid={gid} /> : null}
          {tab === 'roles' ? <RolesTab gid={gid} /> : null}
        </div>
      </div>
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────

function SettingsTab({ gid, onClose, onActions }: { gid: string; onClose: () => void; onActions: (a: HeaderActions | null) => void }): JSX.Element {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [draft, setDraft] = useState<SettingsResponse['config'] | null>(null);
  const [draftName, setDraftName] = useState('');
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState<ModelsResponse | null>(null);
  const [images, setImages] = useState<ImagesResponse | null>(null);

  async function refresh(): Promise<void> {
    setBusy(true);
    try {
      const r = await call<SettingsResponse>(apiPath(gid, '/settings'));
      if (!r.ok) { showToast(errMsg(r.data, `HTTP ${r.status}`), 'err'); return; }
      setData(r.data);
      setDraft({ ...r.data.config });
      setDraftName(r.data.name);
    } finally { setBusy(false); }
  }

  useEffect(() => { refresh(); }, [gid]);

  // Image list is global (not per-provider) — fetch once when the modal opens.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await call<ImagesResponse>(apiPath(gid, '/images'));
      if (!cancelled) setImages(r.ok ? r.data : { images: [] });
    })();
    return () => { cancelled = true; };
  }, [gid]);

  // Refetch model suggestions whenever the provider changes.
  const provider = draft?.provider ?? null;
  useEffect(() => {
    if (!provider) { setModels(null); return; }
    let cancelled = false;
    (async () => {
      const r = await call<ModelsResponse>(apiPath(gid, `/models?provider=${encodeURIComponent(provider)}`));
      if (cancelled) return;
      setModels(r.ok ? r.data : { models: [], source: 'unavailable', upstream: null });
    })();
    return () => { cancelled = true; };
  }, [provider, gid]);

  if (!data || !draft) return <p class="muted">Loading…</p>;

  function update<K extends keyof SettingsResponse['config']>(k: K, v: SettingsResponse['config'][K]): void {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  }

  async function runRestart(rebuild: boolean): Promise<{ ok: boolean; restarted?: number }> {
    const r = await call<{ restarted: number; rebuilt: boolean }>(apiPath(gid, '/restart'), 'POST', { rebuild });
    if (!r.ok) { showToast(errMsg(r.data, `HTTP ${r.status}`), 'err'); return { ok: false }; }
    return { ok: true, restarted: r.data.restarted };
  }

  // Which fields actually require a container restart to take effect?
  const RESTART_REQUIRING_FIELDS = new Set([
    'provider', 'model', 'effort', 'image_tag', 'assistant_name', 'max_messages_per_prompt',
  ]);

  function changedFields(): Set<string> {
    const out = new Set<string>();
    if (!data || !draft) return out;
    if (draftName.trim() !== data.name) out.add('name');
    for (const k of Object.keys(draft) as (keyof SettingsResponse['config'])[]) {
      if (draft[k] !== data.config[k]) out.add(k);
    }
    return out;
  }
  const pending = changedFields();
  const changed = pending.size > 0;
  // Restart needed if any restart-requiring field changed.
  const needsRestart = [...pending].some((f) => RESTART_REQUIRING_FIELDS.has(f));
  // Rebuild is auto-suggested only when the new image_tag isn't in the
  // local image list (the only common "rebuild from this UI" scenario —
  // package / MCP / Dockerfile changes go through the CLI).
  const needsRebuild = pending.has('image_tag')
    && draft.image_tag != null
    && !!images
    && !images.images.some((i) => i.value === draft.image_tag);

  // Action checkboxes — auto-set from `needsRestart` / `needsRebuild`, but
  // the user can override (e.g. tick Restart even when only cli_scope
  // changed, to force agents to pick up the new scope sooner).
  const [restartChecked, setRestartChecked] = useState(false);
  const [rebuildChecked, setRebuildChecked] = useState(false);
  // Keep the suggested defaults in sync with what's pending; once the user
  // toggles a checkbox manually we treat it as sticky for this draft.
  const [restartTouched, setRestartTouched] = useState(false);
  const [rebuildTouched, setRebuildTouched] = useState(false);
  useEffect(() => { if (!restartTouched) setRestartChecked(needsRestart || needsRebuild); }, [needsRestart, needsRebuild, restartTouched]);
  useEffect(() => { if (!rebuildTouched) setRebuildChecked(needsRebuild); }, [needsRebuild, rebuildTouched]);
  useEffect(() => {
    // After a save round-trip, draft === data again, so pending is empty;
    // reset the manual-override flag so the next edit picks suggestions
    // fresh.
    if (!changed) { setRestartTouched(false); setRebuildTouched(false); }
  }, [changed]);

  // Rebuild implies restart. Force it on if the user ticks rebuild.
  const effectiveRestart = restartChecked || rebuildChecked;
  const effectiveRebuild = rebuildChecked;

  // Report actions to parent header.
  const canSave = changed || effectiveRestart || effectiveRebuild;
  useEffect(() => {
    onActions({ refresh, apply, busy, canSave });
    return () => onActions(null);
  }, [busy, canSave]);

  async function apply(): Promise<void> {
    if (!draft) return;
    setBusy(true);
    try {
      // Save config changes.
      if (changed) {
        const body: Record<string, unknown> = { ...draft };
        if (data && draftName.trim() !== data.name) body.name = draftName.trim();
        const r = await call<SettingsResponse>(apiPath(gid, '/settings'), 'PATCH', body);
        if (!r.ok) { showToast(errMsg(r.data, `HTTP ${r.status}`), 'err'); return; }
        setData(r.data);
        setDraft({ ...r.data.config });
        setDraftName(r.data.name);
        groups.value = groups.value.map((g) => g.id === gid ? { ...g, name: r.data.name } : g);
      }
      // Restart / rebuild without confirmation.
      if (effectiveRebuild || effectiveRestart) {
        const r = await runRestart(effectiveRebuild);
        if (!r.ok) return;
        const msg = effectiveRebuild
          ? `Rebuilt image and restarted ${r.restarted} session${r.restarted === 1 ? '' : 's'}.`
          : `Restarted ${r.restarted} session${r.restarted === 1 ? '' : 's'}.`;
        showToast(msg);
      } else {
        showToast('Saved.');
      }
      onClose();
    } finally { setBusy(false); }
  }

  // Model options for the combobox; reflects current selection's detail/tooltip.
  const modelOptions: ComboboxOption[] = (models?.models ?? []).map((m) => ({
    value: m.id,
    label: m.label,
    detail: m.detail,
    tooltip: m.tooltip,
  }));

  const imageOptions: ComboboxOption[] = (images?.images ?? []).map((i) => {
    const age = formatAge(i.createdAt);
    const size = formatSize(i.size);
    const detailParts = [age, size, i.isDefault ? 'default' : null].filter(Boolean) as string[];
    return {
      value: i.value,
      label: i.label,
      detail: detailParts.length ? detailParts.join(' · ') : undefined,
      tooltip: [
        i.value,
        i.createdAt ? `Created: ${new Date(i.createdAt).toLocaleString()}` : null,
        size ? `Size: ${size}` : null,
        i.isDefault ? 'Install default image (used when image_tag is unset).' : null,
      ].filter(Boolean).join('\n'),
    };
  });

  // Find the selected image's metadata for the "underneath the box" panel.
  const selectedImg = images?.images.find((i) => i.value === draft.image_tag) ?? null;
  const selectedImgAge = formatAge(selectedImg?.createdAt ?? null);
  const selectedImgSize = formatSize(selectedImg?.size ?? null);

  return (
    <section>
      <div class="group-admin-toolbar">
        <p class="muted">
          Folder <code>{data.folder}</code>{data.updatedAt ? ` · last updated ${new Date(data.updatedAt).toLocaleString()}` : ''}
          {data.runningSessionCount > 0 ? ` · ${data.runningSessionCount} running session${data.runningSessionCount === 1 ? '' : 's'}` : ' · no running sessions'}
        </p>
      </div>

      <Field label="Name">
        <input
          type="text"
          value={draftName}
          disabled={busy}
          maxLength={100}
          onInput={(e) => setDraftName((e.target as HTMLInputElement).value)}
        />
      </Field>

      <Field
        label="Provider"
        info={draft.provider ? PROVIDER_INFO[draft.provider] ?? `Provider "${draft.provider}".` : undefined}
      >
        <Combobox
          value={draft.provider}
          options={(() => {
            const selectable = data.validProviders.slice();
            // If the saved provider isn't in the selectable list (e.g. legacy
            // 'mock'), keep it visible so the user can see their state and
            // still switch away to a supported value.
            if (draft.provider && !selectable.includes(draft.provider)) {
              selectable.push(draft.provider);
            }
            return selectable.map((p) => ({
              value: p,
              label: p,
              tooltip: PROVIDER_INFO[p],
            }));
          })()}
          placeholder={data.defaults.provider ? `default: ${data.defaults.provider}` : 'pick a provider'}
          disabled={busy}
          freeform={false}
          onChange={(v) => update('provider', v)}
        />
      </Field>

      <Field label="Model">
        <div class="group-admin-stack">
          <Combobox
            value={draft.model}
            options={modelOptions}
            placeholder={data.defaults.model ? `default: ${data.defaults.model}` : 'pick or type a model id'}
            disabled={busy || !provider}
            onChange={(v) => update('model', v)}
          />
          {(() => {
            const matched = modelOptions.find((o) => o.value === draft.model);
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
            if (draft.model) {
              return <p class="group-admin-help">Not in catalog — saved as a custom value.</p>;
            }
            return null;
          })()}
        </div>
      </Field>

      <Field label="Effort">
        <input
          type="text"
          value={draft.effort ?? ''}
          disabled={busy}
          onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => update('effort', e.currentTarget.value || null)}
          placeholder="provider-specific (e.g. high)"
        />
      </Field>

      <Field label="Image tag">
        <div class="group-admin-stack">
          <Combobox
            value={draft.image_tag}
            options={imageOptions}
            placeholder={data.defaults.image_tag ? `default: ${data.defaults.image_tag}` : 'pick an image'}
            disabled={busy}
            onChange={(v) => update('image_tag', v)}
          />
          {selectedImg ? (
            <div class="group-admin-selected-info">
              <div class="selected-title">
                {selectedImg.label}
                {(selectedImgAge || selectedImgSize) ? (
                  <span class="selected-detail"> · {[selectedImgAge, selectedImgSize].filter(Boolean).join(' · ')}</span>
                ) : null}
                {selectedImg.isDefault ? <span class="selected-detail"> · default</span> : null}
              </div>
              {selectedImg.createdAt ? (
                <pre class="selected-tooltip">Created: {new Date(selectedImg.createdAt).toLocaleString()}</pre>
              ) : null}
            </div>
          ) : (draft.image_tag && images) ? (
            <p class="group-admin-help">Tag not in local image list — will fail at container start if not pulled.</p>
          ) : null}
        </div>
      </Field>

      <Field label="Assistant name">
        <input
          type="text"
          value={draft.assistant_name ?? ''}
          disabled={busy}
          onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => update('assistant_name', e.currentTarget.value || null)}
        />
      </Field>

      <Field
        label="Max messages / prompt"
        info="Hard cap on how many history messages get included in each model call. Higher = more context but more cost; lower = faster + cheaper but the agent forgets sooner. Leave blank for the provider default."
      >
        <input
          type="number"
          min={1}
          max={1000}
          value={draft.max_messages_per_prompt ?? ''}
          disabled={busy}
          onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => {
            const v = e.currentTarget.value;
            update('max_messages_per_prompt', v ? Number(v) : null);
          }}
        />
      </Field>

      <Field
        label="CLI scope"
        info={'Controls which `ncl` commands an agent in this group can run.\n' +
          'disabled = no CLI access.\n' +
          'group = limited to the group\'s own resources.\n' +
          'global = unrestricted (owner / global admin only — use sparingly).'}
      >
        <Combobox
          value={draft.cli_scope}
          options={data.validCliScopes
            // `global` is privilege escalation for a scoped admin (the agent
            // can run any `ncl` command system-wide), so hide it from
            // non-elevated admins. Server enforces independently.
            .filter((s) => s !== 'global' || data.actorIsElevated || draft.cli_scope === 'global')
            .map((s) => ({
              value: s,
              label: s,
              tooltip: s === 'global' && !data.actorIsElevated
                ? 'Owner / global admin only.'
                : undefined,
            }))}
          placeholder="pick a scope"
          disabled={busy}
          freeform={false}
          onChange={(v) => update('cli_scope', v)}
        />
      </Field>

      <Field
        label="Voice mode"
        info={'Controls the push-to-talk microphone button in the chat composer.\n' +
          'off = no mic button.\n' +
          'transcribe = record speech and send as text (Chrome/Edge only, uses Web Speech API).\n' +
          'audio = record and send as an audio file attachment.'}
      >
        <Combobox
          value={draft.voice_mode}
          options={(data.validVoiceModes || ['off', 'transcribe', 'audio']).map((s) => ({
            value: s,
            label: s,
          }))}
          placeholder="off"
          disabled={busy}
          freeform={false}
          onChange={(v) => update('voice_mode', v)}
        />
      </Field>

      <div class="settings-row group-admin-actions" style="margin-top:16px">
        <label class="group-admin-check">
          <input
            type="checkbox"
            checked={restartChecked}
            disabled={busy || rebuildChecked /* rebuild always restarts */}
            onChange={(e) => {
              setRestartChecked((e.target as HTMLInputElement).checked);
              setRestartTouched(true);
            }}
          />
          <span>Restart sessions</span>
          <Tooltip text={'Stop and respawn all running container sessions for this group so they pick up the saved config.\nAuto-selected when you change provider, model, effort, image tag, assistant name, or max messages per prompt. CLI scope alone does not need a restart — it is re-read on every CLI call.\nActive conversations resume on the next user message.'}>
            <span class="info-icon" aria-label="More info">i</span>
          </Tooltip>
        </label>
        <label class="group-admin-check">
          <input
            type="checkbox"
            checked={rebuildChecked}
            disabled={busy}
            onChange={(e) => {
              setRebuildChecked((e.target as HTMLInputElement).checked);
              setRebuildTouched(true);
            }}
          />
          <span>Rebuild image</span>
          <Tooltip text={'Rebuild the container image before restarting.\nAuto-selected when the chosen image tag does not exist locally. Otherwise normally only needed after `ncl groups config add-package` / `add-mcp-server` or a base-image change — that workflow lives in the CLI today, not this UI.\nA rebuild always implies a restart and takes minutes, not seconds.'}>
            <span class="info-icon" aria-label="More info">i</span>
          </Tooltip>
        </label>
      </div>
    </section>
  );
}

function Field({
  label,
  info,
  children,
}: {
  label: string;
  info?: string;
  children: preact.ComponentChildren;
}): JSX.Element {
  return (
    <div class="settings-row group-admin-field">
      <label class="group-admin-label">
        {label}
        {info ? <InfoIcon text={info} /> : null}
      </label>
      <div class="group-admin-control">{children}</div>
    </div>
  );
}

// ── Members ───────────────────────────────────────────────────────────────

function MembersTab({ gid }: { gid: string }): JSX.Element {
  const [members, setMembers] = useState<MemberDto[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(): Promise<void> {
    const r = await call<{ members: MemberDto[] }>(apiPath(gid, '/members'));
    if (!r.ok) { showToast(errMsg(r.data, `HTTP ${r.status}`), 'err'); return; }
    setMembers(r.data.members);
  }
  useEffect(() => { refresh(); }, [gid]);

  async function add(userId: string): Promise<void> {
    setBusy(true);
    try {
      const r = await call(apiPath(gid, '/members'), 'POST', { userId });
      if (!r.ok) { showToast(errMsg(r.data, `HTTP ${r.status}`), 'err'); return; }
      showToast('Member added');
      refresh();
    } finally { setBusy(false); }
  }

  async function remove(m: MemberDto): Promise<void> {
    setBusy(true);
    try {
      const r = await call(apiPath(gid, `/members/${encodeURIComponent(m.userId)}`), 'DELETE');
      if (!r.ok) { showToast(errMsg(r.data, `HTTP ${r.status}`), 'err'); return; }
      showToast('Member removed');
      refresh();
    } finally { setBusy(false); }
  }

  if (!members) return <p class="muted">Loading…</p>;

  return (
    <section>
      <p class="muted">
        Members can interact with this group when channel routing requires "known" senders. Admins of the group are implicit members (shown below for context).
      </p>
      {members.length === 0
        ? <p class="muted">No members yet.</p>
        : (
          <table class="settings-table">
            <thead><tr><th>Name</th><th>Identity</th><th></th></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId}>
                  <td>
                    {m.displayName || <span class="muted">(no name)</span>}
                    {m.isAdmin ? <span class="group-admin-badge" title="Admin of this group">admin</span> : null}
                  </td>
                  <td>{m.primaryHandle ? <code>{m.primaryChannel}:{m.primaryHandle}</code> : <code class="muted">{m.userId}</code>}</td>
                  <td>
                    {m.isExplicitMember && !m.isAdmin
                      ? <button type="button" class="danger" disabled={busy} onClick={() => remove(m)}>Remove</button>
                      : <span class="muted">{m.isAdmin ? 'implicit' : ''}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

      <h4>Add a member</h4>
      <UserPicker
        gid={gid}
        excludeUserIds={new Set(members.map((m) => m.userId))}
        disabled={busy}
        onPick={add}
      />
    </section>
  );
}

// ── Roles (scoped admin grants on this group) ─────────────────────────────

function RolesTab({ gid }: { gid: string }): JSX.Element {
  const [admins, setAdmins] = useState<RoleDto[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(): Promise<void> {
    const r = await call<{ admins: RoleDto[] }>(apiPath(gid, '/roles'));
    if (!r.ok) { showToast(errMsg(r.data, `HTTP ${r.status}`), 'err'); return; }
    setAdmins(r.data.admins);
  }
  useEffect(() => { refresh(); }, [gid]);

  async function grant(userId: string): Promise<void> {
    setBusy(true);
    try {
      const r = await call<{ ok?: boolean; alreadyGranted?: boolean }>(
        apiPath(gid, '/roles'), 'POST', { userId },
      );
      if (!r.ok) { showToast(errMsg(r.data, `HTTP ${r.status}`), 'err'); return; }
      showToast(r.data.alreadyGranted ? 'Already an admin' : 'Admin granted');
      refresh();
    } finally { setBusy(false); }
  }

  async function revoke(a: RoleDto): Promise<void> {
    setBusy(true);
    try {
      const r = await call(apiPath(gid, `/roles/${encodeURIComponent(a.userId)}`), 'DELETE');
      if (!r.ok) { showToast(errMsg(r.data, `HTTP ${r.status}`), 'err'); return; }
      showToast('Admin revoked');
      refresh();
    } finally { setBusy(false); }
  }

  if (!admins) return <p class="muted">Loading…</p>;

  return (
    <section>
      <p class="muted">
        Admins of this group can change its settings, manage members, and grant/revoke admin on this group only. Global owner and global admins are not shown here — they manage all groups system-wide.
      </p>
      {admins.length === 0
        ? <p class="muted">No scoped admins. (Global admins still have full access.)</p>
        : (
          <table class="settings-table">
            <thead><tr><th>Name</th><th>Identity</th><th></th></tr></thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.userId}>
                  <td>{a.displayName || <span class="muted">(no name)</span>}</td>
                  <td>{a.primaryHandle ? <code>{a.primaryChannel}:{a.primaryHandle}</code> : <code class="muted">{a.userId}</code>}</td>
                  <td><button type="button" class="danger" disabled={busy} onClick={() => revoke(a)}>Revoke</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

      <h4>Grant admin</h4>
      <UserPicker
        gid={gid}
        excludeUserIds={new Set(admins.map((a) => a.userId))}
        disabled={busy}
        onPick={grant}
      />
    </section>
  );
}

// ── shared user picker ────────────────────────────────────────────────────

function UserPicker({
  gid,
  excludeUserIds,
  disabled,
  onPick,
}: {
  gid: string;
  excludeUserIds: Set<string>;
  disabled?: boolean;
  onPick: (userId: string) => Promise<void>;
}): JSX.Element {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<UserSearchDto[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await call<{ users: UserSearchDto[] }>(
          apiPath(gid, `/users-search?q=${encodeURIComponent(q)}`),
        );
        if (!cancelled && r.ok) setResults(r.data.users);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, gid]);

  const visible = results.filter((u) => !excludeUserIds.has(u.userId)).slice(0, 20);

  return (
    <>
      <div class="settings-row">
        <input
          type="text"
          placeholder="Search name, handle, or user id"
          value={q}
          onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => setQ(e.currentTarget.value)}
          disabled={disabled}
        />
      </div>
      {searching && visible.length === 0 ? <p class="muted">Searching…</p> : null}
      {visible.length > 0 ? (
        <ul class="group-admin-search-results">
          {visible.map((u) => (
            <li key={u.userId}>
              <button
                type="button"
                class="group-admin-search-row"
                disabled={disabled}
                onClick={() => onPick(u.userId)}
              >
                <span class="group-admin-search-name">{u.displayName || u.userId}</span>
                <span class="group-admin-search-handle">
                  {u.primaryHandle ? `${u.primaryChannel}:${u.primaryHandle}` : u.kind}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!searching && q && visible.length === 0 ? <p class="muted">No matches.</p> : null}
    </>
  );
}
