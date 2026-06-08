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
import { selectGroup } from '../actions';
import { Combobox, type ComboboxOption } from './Combobox';
import { ModelSelector } from './ModelSelector';
import { InfoIcon, Tooltip } from './Tooltip';
import { showToast } from './Toast';
import { useBackButtonCloses } from '../modalBackButton';

type Tab = 'models' | 'settings' | 'members' | 'roles' | 'destinations';

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
    transcription_model: string | null;
  };
  /** Freeform provider knobs. Edited via PATCH /model-params or `ncl groups config set-param`. */
  modelParams: Record<string, unknown>;
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
  site: {
    available: boolean;
    baseDomain: string | null;
    slug: string | null;
    fqdn: string | null;
    url: string | null;
    enabled: boolean;
  };
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
  const [tab, setTab] = useState<Tab>('models');
  const actionsRef = useRef<HeaderActions | null>(null);
  const [, forceRender] = useState(0);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  useEffect(() => { setTab('models'); setCloseConfirmOpen(false); }, [open, gid]);
  useBackButtonCloses(open, () => { groupAdminOpen.value = false; });

  if (!open || !gid) return null;
  const group = groups.value.find((g) => g.id === gid);
  const title = group ? `Admin · ${group.name}` : 'Admin';

  function hardClose(): void { groupAdminOpen.value = false; }
  function attemptClose(): void {
    if (actionsRef.current?.canSave) {
      setCloseConfirmOpen(true);
    } else {
      hardClose();
    }
  }
  function onBackdrop(e: JSX.TargetedMouseEvent<HTMLDivElement>): void {
    if ((e.target as HTMLElement).classList.contains('settings-backdrop')) attemptClose();
  }
  function onKey(e: KeyboardEvent): void { if (e.key === 'Escape') attemptClose(); }

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
            {(tab === 'models' || tab === 'settings') && ha ? (
              <>
                <Tooltip text={ha.canSave ? 'Save changes' : 'Nothing to save'}>
                  <button type="button" class="icon-btn" aria-label="Save" onClick={ha.apply} disabled={ha.busy || !ha.canSave}>&#x2713;</button>
                </Tooltip>
              </>
            ) : null}
            <button type="button" class="icon-btn" aria-label="Close" onClick={attemptClose}>{'\u2715'}</button>
          </div>
        </header>
        <nav class="group-admin-tabs">
          <button type="button" class={tab === 'models' ? 'active' : ''} onClick={() => setTab('models')}>Models</button>
          <button type="button" class={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>Settings</button>
          <button type="button" class={tab === 'members' ? 'active' : ''} onClick={() => setTab('members')}>Members</button>
          <button type="button" class={tab === 'roles' ? 'active' : ''} onClick={() => setTab('roles')}>Admins</button>
          <button type="button" class={tab === 'destinations' ? 'active' : ''} onClick={() => setTab('destinations')}>Destinations</button>
        </nav>
        <div class="settings-body">
          {(tab === 'models' || tab === 'settings')
            ? <SettingsTab gid={gid} section={tab} onClose={hardClose} onActions={setActions} />
            : null}
          {tab === 'members' ? <MembersTab gid={gid} /> : null}
          {tab === 'roles' ? <RolesTab gid={gid} /> : null}
          {tab === 'destinations' ? <DestinationsTab gid={gid} /> : null}
        </div>
        {closeConfirmOpen ? (
          <div
            class="settings-backdrop"
            onClick={(e) => {
              if ((e.target as HTMLElement).classList.contains('settings-backdrop')) setCloseConfirmOpen(false);
            }}
          >
            <div class="settings-modal ga-confirm-modal" role="dialog" aria-label="Discard changes?" style="max-width:420px">
              <header class="settings-head">
                <span class="title">Discard unsaved changes?</span>
                <button type="button" class="icon-btn" aria-label="Close" onClick={() => setCloseConfirmOpen(false)}>{'\u2715'}</button>
              </header>
              <div class="settings-body">
                <p class="group-admin-help">
                  You have unsaved changes. Closing now discards them.
                </p>
              </div>
              <footer class="settings-foot ga-confirm-foot">
                <button type="button" onClick={() => setCloseConfirmOpen(false)}>Keep editing</button>
                <button
                  type="button"
                  class="danger"
                  data-testid="discard-and-close-btn"
                  onClick={() => { setCloseConfirmOpen(false); hardClose(); }}
                >
                  Discard &amp; close
                </button>
              </footer>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────

function SettingsTab({ gid, section, onClose, onActions }: { gid: string; section: 'models' | 'settings'; onClose: () => void; onActions: (a: HeaderActions | null) => void }): JSX.Element {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [draft, setDraft] = useState<SettingsResponse['config'] | null>(null);
  const [draftName, setDraftName] = useState('');
  const [siteEnabled, setSiteEnabled] = useState(false);
  const [siteSlug, setSiteSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<ImagesResponse | null>(null);

  async function refresh(): Promise<void> {
    setBusy(true);
    try {
      const r = await call<SettingsResponse>(apiPath(gid, '/settings'));
      if (!r.ok) { showToast(errMsg(r.data, `HTTP ${r.status}`), 'err'); return; }
      setData(r.data);
      setDraft({ ...r.data.config });
      setDraftName(r.data.name);
      setSiteEnabled(r.data.site.enabled);
      setSiteSlug(r.data.site.slug ?? '');
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

  const provider = draft?.provider ?? null;

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
    if (data.site.available) {
      if (siteEnabled !== data.site.enabled) out.add('site_enabled');
      if (data.actorIsElevated && siteSlug.trim() !== (data.site.slug ?? '')) out.add('site_slug');
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

  // Restart / rebuild are confirmed in a dialog opened on Apply, rather than
  // toggled inline in the form. The checkboxes default to checked when the
  // pending changes only take effect after a restart / rebuild.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restartChecked, setRestartChecked] = useState(false);
  const [rebuildChecked, setRebuildChecked] = useState(false);

  // Danger zone (archive): typed-confirmation flow. The string the user
  // types must equal the group's folder slug exactly; the server re-checks.
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState('');
  const [archiveBusy, setArchiveBusy] = useState(false);

  // Rebuild implies restart. Force it on if the user ticks rebuild.
  const effectiveRestart = restartChecked || rebuildChecked;
  const effectiveRebuild = rebuildChecked;

  // Report actions to parent header. Apply only opens the confirmation
  // dialog — the actual save/restart happens in `doApply`.
  const canSave = changed;
  useEffect(() => {
    onActions({ refresh, apply, busy, canSave });
    return () => onActions(null);
  }, [busy, canSave, needsRestart, needsRebuild]);

  // Open the confirmation dialog, seeding the checkboxes from the suggested
  // defaults for the current pending changes.
  function apply(): void {
    if (!changed) return;
    setRestartChecked(needsRestart || needsRebuild);
    setRebuildChecked(needsRebuild);
    setConfirmOpen(true);
  }

  async function doApply(): Promise<void> {
    if (!draft) return;
    setBusy(true);
    try {
      // Save config changes.
      if (changed) {
        const body: Record<string, unknown> = { ...draft };
        if (data && draftName.trim() !== data.name) body.name = draftName.trim();
        if (pending.has('site_enabled')) body.site_enabled = siteEnabled;
        if (pending.has('site_slug')) body.site_slug = siteSlug.trim() || null;
        const r = await call<SettingsResponse>(apiPath(gid, '/settings'), 'PATCH', body);
        if (!r.ok) { showToast(errMsg(r.data, `HTTP ${r.status}`), 'err'); return; }
        setData(r.data);
        setDraft({ ...r.data.config });
        setDraftName(r.data.name);
        setSiteEnabled(r.data.site.enabled);
        setSiteSlug(r.data.site.slug ?? '');
        groups.value = groups.value.map((g) => g.id === gid ? { ...g, name: r.data.name } : g);
      }
      // Restart / rebuild as chosen in the confirmation dialog.
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
      setConfirmOpen(false);
      onClose();
    } finally { setBusy(false); }
  }

  async function doArchive(): Promise<void> {
    if (!data || archiveBusy) return;
    setArchiveBusy(true);
    try {
      const r = await call<{ ok: boolean; folder: string; archivedFolder: string }>(
        apiPath(gid, '/archive'),
        'POST',
        { confirm_folder: archiveConfirm.trim() },
      );
      if (!r.ok) { showToast(errMsg(r.data, `HTTP ${r.status}`), 'err'); return; }
      // Drop the archived group locally; the next sync tick would do this too
      // but doing it now keeps the UI responsive.
      const archivedId = gid;
      const remaining = groups.value.filter((g) => g.id !== archivedId);
      groups.value = remaining;
      setArchiveOpen(false);
      onClose();
      showToast(`Archived. Restore on the host with: ncl groups restore --folder ${r.data.folder}`);
      // If the archived group was current, switch to the first remaining one.
      if (groupId.value === archivedId && remaining[0]) {
        void selectGroup(remaining[0].id);
      }
    } finally { setArchiveBusy(false); }
  }

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

      {section === 'models' ? (
        <>
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
            <ModelSelector
              value={draft.model}
              provider={provider}
              placeholder={data.defaults.model ? `default: ${data.defaults.model}` : 'pick or type a model id'}
              disabled={busy}
              apiBasePath={apiPath(gid, '')}
              outputModality="text"
              onChange={(v) => update('model', v)}
            />
          </Field>

          <Field
            label="Transcription model"
            info={'OpenRouter model used when the main model cannot accept audio directly. When set, a mic button appears in the chat composer.\nLeave blank to disable voice input.'}
          >
            <ModelSelector
              value={draft.transcription_model}
              provider="openrouter"
              placeholder="google/gemini-2.0-flash-lite-001"
              disabled={busy}
              apiBasePath={apiPath(gid, '')}
              inputModality="audio"
              onChange={(v) => update('transcription_model', v)}
            />
          </Field>
        </>
      ) : null}

      {section === 'settings' ? (
        <>
      <Field label="Name">
        <input
          type="text"
          value={draftName}
          disabled={busy}
          maxLength={100}
          onInput={(e) => setDraftName((e.target as HTMLInputElement).value)}
        />
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

      {data.site.available ? (
        <Field
          label="Website"
          info={'Serve a public static website for this group from a folder in its workspace. Files in the FQDN-named folder become readable by anyone with the link \u2014 no login required. Separate from private file-share links.'}
        >
          <div class="group-admin-stack">
            <label class="group-admin-check">
              <input
                type="checkbox"
                checked={siteEnabled}
                disabled={busy}
                onChange={(e) => setSiteEnabled((e.target as HTMLInputElement).checked)}
              />
              <span>Enable website</span>
            </label>
            {data.actorIsElevated ? (
              <input
                type="text"
                value={siteSlug}
                disabled={busy}
                maxLength={63}
                placeholder={data.site.baseDomain ? `subdomain (.${data.site.baseDomain})` : 'subdomain'}
                onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => setSiteSlug(e.currentTarget.value)}
              />
            ) : null}
            {siteEnabled && data.site.url ? (
              <p class="group-admin-help">
                Live at <a href={data.site.url} target="_blank" rel="noopener noreferrer">{data.site.url}</a>{' '}
                — publish by writing files into the <code>{data.site.fqdn}</code> folder in the workspace.
              </p>
            ) : siteEnabled ? (
              <p class="group-admin-help">Save to allocate a subdomain and go live.</p>
            ) : (
              <p class="group-admin-help">Disabled — enable to publish a public static site on its own subdomain.</p>
            )}
          </div>
        </Field>
      ) : null}

      <div class="group-admin-danger-zone" data-testid="danger-zone">
        <button
          type="button"
          class="danger"
          data-testid="archive-btn"
          disabled={busy || archiveBusy}
          onClick={() => { setArchiveConfirm(''); setArchiveOpen(true); }}
        >
          Archive group…
        </button>
      </div>
        </>
      ) : null}

      <div class="settings-row group-admin-actions" style="margin-top:16px">
        <p class="group-admin-help">
          {changed
            ? `${pending.size} unsaved change${pending.size === 1 ? '' : 's'}. Click Save (✓) above to review and apply.`
            : 'No unsaved changes.'}
        </p>
      </div>

      {confirmOpen ? (
        <div
          class="settings-backdrop"
          onClick={(e) => {
            if ((e.target as HTMLElement).classList.contains('settings-backdrop') && !busy) setConfirmOpen(false);
          }}
        >
          <div class="settings-modal ga-confirm-modal" role="dialog" aria-label="Apply changes" style="max-width:440px">
            <header class="settings-head">
              <span class="title">Apply changes</span>
              <button type="button" class="icon-btn" aria-label="Close" disabled={busy} onClick={() => setConfirmOpen(false)}>{'\u2715'}</button>
            </header>
            <div class="settings-body">
              <p class="group-admin-help" style="margin-bottom:12px">
                {pending.size} setting{pending.size === 1 ? '' : 's'} will be saved:{' '}
                <code>{[...pending].join(', ')}</code>
              </p>
              <div class="ga-confirm-options">
                <label class="group-admin-check">
                  <input
                    type="checkbox"
                    checked={effectiveRestart}
                    disabled={busy || rebuildChecked /* rebuild always restarts */}
                    onChange={(e) => setRestartChecked((e.target as HTMLInputElement).checked)}
                  />
                  <span>Restart sessions</span>
                  <Tooltip text={'Stop and respawn all running container sessions for this group so they pick up the saved config.\nDefaults on when you change provider, model, effort, image tag, assistant name, or max messages per prompt. CLI scope alone does not need a restart — it is re-read on every CLI call.\nActive conversations resume on the next user message.'}>
                    <span class="info-icon" aria-label="More info">i</span>
                  </Tooltip>
                </label>
                <label class="group-admin-check">
                  <input
                    type="checkbox"
                    checked={rebuildChecked}
                    disabled={busy}
                    onChange={(e) => setRebuildChecked((e.target as HTMLInputElement).checked)}
                  />
                  <span>Rebuild image</span>
                  <Tooltip text={'Rebuild the container image before restarting.\nDefaults on when the chosen image tag does not exist locally. Otherwise normally only needed after `ncl groups config add-package` / `add-mcp-server` or a base-image change — that workflow lives in the CLI today, not this UI.\nA rebuild always implies a restart and takes minutes, not seconds.'}>
                    <span class="info-icon" aria-label="More info">i</span>
                  </Tooltip>
                </label>
              </div>
              {needsRestart && !effectiveRestart ? (
                <p class="ga-confirm-warn">
                  These changes won&rsquo;t take effect until the sessions restart.
                </p>
              ) : null}
            </div>
            <footer class="settings-foot ga-confirm-foot">
              <button type="button" disabled={busy} onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button type="button" class="primary" disabled={busy} onClick={doApply}>
                {busy
                  ? 'Applying…'
                  : effectiveRebuild
                    ? 'Save & rebuild'
                    : effectiveRestart
                      ? 'Save & restart'
                      : 'Save'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {archiveOpen ? (
        <div
          class="settings-backdrop"
          onClick={(e) => {
            if ((e.target as HTMLElement).classList.contains('settings-backdrop') && !archiveBusy) setArchiveOpen(false);
          }}
        >
          <div class="settings-modal ga-confirm-modal" role="dialog" aria-label="Archive group" style="max-width:440px">
            <header class="settings-head">
              <span class="title">Archive group</span>
              <button type="button" class="icon-btn" aria-label="Close" disabled={archiveBusy} onClick={() => setArchiveOpen(false)}>{'\u2715'}</button>
            </header>
            <div class="settings-body">
              <p class="group-admin-help" style="margin-bottom:12px">
                Running container sessions will stop and the group will be removed from this UI.
                Its folder is renamed with a <code>~</code> suffix — nothing is deleted.
              </p>
              <p class="group-admin-help" style="margin-bottom:12px">
                Restore is host-only: <code>ncl groups restore --folder {data.folder}</code>.
              </p>
              <p class="group-admin-help" style="margin-bottom:8px">
                Type <code>{data.folder}</code> to confirm:
              </p>
              <input
                type="text"
                data-testid="archive-confirm-input"
                value={archiveConfirm}
                disabled={archiveBusy}
                placeholder={data.folder}
                onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => setArchiveConfirm(e.currentTarget.value)}
              />
            </div>
            <footer class="settings-foot ga-confirm-foot">
              <button type="button" disabled={archiveBusy} onClick={() => setArchiveOpen(false)}>Cancel</button>
              <button
                type="button"
                class="danger"
                data-testid="archive-confirm-btn"
                disabled={archiveBusy || archiveConfirm.trim() !== data.folder}
                onClick={doArchive}
              >
                {archiveBusy ? 'Archiving…' : 'Archive group'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
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

// ── Destinations (agent-to-agent links) ──────────────────────────────────

/**
 * Some platform_ids (e.g. resend's `resend:user@host`) are already namespaced
 * with their channel_type; others (web, cli, telegram numerics) aren't.
 * Render `<channel>:<handle>` without double-prefixing, falling back to the
 * raw messaging-group id when neither is known.
 */
function formatChannelHandle(
  channelType: string | null,
  platformId: string | null,
  targetId: string,
): string {
  if (!channelType && !platformId) return targetId;
  if (!channelType) return platformId ?? targetId;
  if (!platformId) return channelType;
  return platformId.startsWith(`${channelType}:`) ? platformId : `${channelType}:${platformId}`;
}

interface DestinationDto {
  localName: string;
  targetType: 'agent' | 'channel';
  targetId: string;
  targetName: string | null;
  channelType: string | null;
  platformId: string | null;
  reverseLink: { localName: string; viewerCanRemove: boolean } | null;
  createdAt: string;
  createdBy: string | null;
}

interface DestinationCandidate {
  id: string;
  name: string;
  folder: string;
  adminOnTarget: boolean;
}

function DestinationsTab({ gid }: { gid: string }): JSX.Element {
  const [destinations, setDestinations] = useState<DestinationDto[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  async function refresh(): Promise<void> {
    const r = await call<{ destinations: DestinationDto[] }>(apiPath(gid, '/destinations'));
    if (!r.ok) { showToast(errMsg(r.data, `HTTP ${r.status}`), 'err'); return; }
    setDestinations(r.data.destinations);
  }
  useEffect(() => { refresh(); }, [gid]);

  async function remove(d: DestinationDto): Promise<void> {
    if (!confirm(`Remove destination "${d.localName}"?`)) return;
    setBusy(true);
    try {
      const r = await call(apiPath(gid, `/destinations/${encodeURIComponent(d.localName)}`), 'DELETE');
      if (!r.ok) { showToast(errMsg(r.data, `HTTP ${r.status}`), 'err'); return; }
      showToast('Destination removed');
      refresh();
    } finally { setBusy(false); }
  }

  async function removeReverse(d: DestinationDto): Promise<void> {
    if (!d.reverseLink) return;
    if (!confirm(`Remove the reverse link "${d.reverseLink.localName}" in "${d.targetName ?? d.targetId}"?`)) return;
    setBusy(true);
    try {
      const r = await call(
        apiPath(gid, `/destinations/${encodeURIComponent(d.localName)}/reverse`),
        'DELETE',
      );
      if (!r.ok) { showToast(errMsg(r.data, `HTTP ${r.status}`), 'err'); return; }
      showToast('Reverse link removed');
      refresh();
    } finally { setBusy(false); }
  }

  if (!destinations) return <p class="muted">Loading…</p>;

  const agents = destinations.filter((d) => d.targetType === 'agent');
  const channels = destinations.filter((d) => d.targetType === 'channel');

  return (
    <section>
      <p class="muted">
        Destinations are the names this agent uses to route messages — either to channels (auto-managed, listed below) or to other agent groups (added here).
      </p>

      <h4>Agent destinations</h4>
      {agents.length === 0
        ? <p class="muted">No agent destinations yet.</p>
        : (
          <table class="settings-table ga-destinations-table">
            <thead><tr><th>Target agent</th><th>Local name</th><th>Reverse link</th><th></th></tr></thead>
            <tbody>
              {agents.map((d) => (
                <tr key={d.localName}>
                  <td>
                    <div>{d.targetName ?? <span class="muted">(unnamed)</span>}</div>
                    <code class="muted ga-id-sub">{d.targetId}</code>
                  </td>
                  <td><code>{d.localName}</code></td>
                  <td>
                    {d.reverseLink ? (
                      <span class="ga-reverse">
                        <code>{d.reverseLink.localName}</code>
                        {d.reverseLink.viewerCanRemove ? (
                          <button
                            type="button"
                            class="ga-reverse-x"
                            title={`Remove reverse link "${d.reverseLink.localName}" in target group`}
                            disabled={busy}
                            onClick={() => removeReverse(d)}
                          >×</button>
                        ) : (
                          <Tooltip text="You must be an admin of the target group to remove its destinations.">
                            <span class="muted ga-id-sub">(target-admin only)</span>
                          </Tooltip>
                        )}
                      </span>
                    ) : (
                      <span class="muted">—</span>
                    )}
                  </td>
                  <td>
                    <button type="button" class="danger" disabled={busy} onClick={() => remove(d)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      <p class="muted ga-hint">
        A "reverse link" is a destination row in the <em>target</em> group's table pointing back at this one — created either by ticking the box when you add the link, or by an admin of that group adding it independently. Either way it shows up here.
      </p>

      <h4>Add an agent link</h4>
      {adding
        ? <AddDestinationForm gid={gid} onCancel={() => setAdding(false)} onDone={() => { setAdding(false); refresh(); }} />
        : <button type="button" onClick={() => setAdding(true)}>Link another agent…</button>}

      <h4 class="ga-section-h4">Channel destinations</h4>
      <p class="muted">
        Channels (chat platforms, email, web) are wired automatically when a messaging group is connected to this agent — read-only here.
      </p>
      {channels.length === 0
        ? <p class="muted">No channel destinations.</p>
        : (
          <table class="settings-table ga-destinations-table">
            <thead><tr><th>Channel</th><th>Local name</th></tr></thead>
            <tbody>
              {channels.map((d) => (
                <tr key={d.localName}>
                  <td>
                    <div>{d.targetName ?? <span class="muted">(unnamed)</span>}</div>
                    <code class="muted ga-id-sub">
                      {formatChannelHandle(d.channelType, d.platformId, d.targetId)}
                    </code>
                  </td>
                  <td><code>{d.localName}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </section>
  );
}

function AddDestinationForm({ gid, onCancel, onDone }: { gid: string; onCancel: () => void; onDone: () => void }): JSX.Element {
  const [candidates, setCandidates] = useState<DestinationCandidate[] | null>(null);
  const [targetId, setTargetId] = useState('');
  const [localName, setLocalName] = useState('');
  const [alsoReverse, setAlsoReverse] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await call<{ candidates: DestinationCandidate[] }>(apiPath(gid, '/destinations/candidates'));
      if (!r.ok) { showToast(errMsg(r.data, `HTTP ${r.status}`), 'err'); return; }
      setCandidates(r.data.candidates);
    })();
  }, [gid]);

  const selected = candidates?.find((c) => c.id === targetId) ?? null;

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    if (!targetId || !localName.trim()) return;
    setBusy(true);
    try {
      const r = await call<{ status: 'applied' | 'pending_approval' }>(
        apiPath(gid, '/destinations'),
        'POST',
        { targetAgentGroupId: targetId, localName: localName.trim(), alsoReverse },
      );
      if (!r.ok) { showToast(errMsg(r.data, `HTTP ${r.status}`), 'err'); return; }
      showToast(r.data.status === 'applied' ? 'Destination added' : 'Approval requested');
      onDone();
    } finally { setBusy(false); }
  }

  if (!candidates) return <p class="muted">Loading candidates…</p>;
  if (candidates.length === 0) return (
    <div>
      <p class="muted">No eligible target groups. You must be an admin (or member, when admin-on-target) of another agent group to link it.</p>
      <button type="button" onClick={onCancel}>Cancel</button>
    </div>
  );

  const options: ComboboxOption[] = candidates.map((c) => ({
    value: c.id,
    label: c.name,
    detail: c.adminOnTarget ? c.folder : `${c.folder} · needs approval`,
    tooltip: c.adminOnTarget
      ? `You are an admin of "${c.name}". Linking will apply immediately.`
      : `You are not an admin of "${c.name}". An admin of that group will be asked to approve the link.`,
  }));

  return (
    <form onSubmit={submit} class="ga-add-link-form">
      <Field label="Target agent group">
        <Combobox
          value={targetId || null}
          options={options}
          placeholder="Search by name or id…"
          disabled={busy}
          freeform={false}
          onChange={(v) => setTargetId(v ?? '')}
        />
      </Field>
      <Field label="Local name">
        <input
          type="text"
          value={localName}
          onInput={(e) => setLocalName((e.target as HTMLInputElement).value)}
          placeholder={selected?.folder ?? 'e.g. research-bot'}
          disabled={busy}
        />
      </Field>
      <Field label="Reverse link">
        <label class="ga-checkbox">
          <input
            type="checkbox"
            checked={alsoReverse}
            onChange={(e) => setAlsoReverse((e.target as HTMLInputElement).checked)}
            disabled={busy}
          />
          Also let the target agent send back to this one
        </label>
      </Field>
      {selected && !selected.adminOnTarget ? (
        <p class="muted ga-hint">
          You are not an admin of "{selected.name}" — an admin of that group will be asked to approve this link.
        </p>
      ) : null}
      <div class="settings-actions">
        <button type="submit" disabled={busy || !targetId || !localName.trim()}>
          {selected?.adminOnTarget ? 'Add' : 'Request'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
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
