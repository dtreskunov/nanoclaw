// Per-group admin modal — config, members, scoped admin grants.
// Visible only when the active group's `isAdmin` is true. Reuses the
// existing .settings-backdrop / .settings-modal chrome for visual parity.
import './GroupAdmin.css';
import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';

import {
  groupAdminOpen,
  groupId,
  groups,
} from '../state';
import { showToast } from './Toast';
import { requestConfirm } from './PromptModal';

type Tab = 'settings' | 'members' | 'roles';

interface Status { ok?: string; err?: string }

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
  };
  validProviders: string[];
  validCliScopes: string[];
  runningSessionCount: number;
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
  value: string;
  label: string;
  detail?: string;
}

interface ModelsResponse {
  models: ModelSuggestion[];
  source: 'models.dev' | 'unavailable';
  prefix: string | null;
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
  useEffect(() => { setTab('settings'); }, [open, gid]);

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

  return (
    <div class="settings-backdrop" onClick={onBackdrop}>
      <div class="settings-modal" role="dialog" aria-label={title}>
        <header class="settings-head">
          <span class="title">{title}</span>
          <button type="button" class="icon-btn" aria-label="Close" onClick={close}>{'\u2715'}</button>
        </header>
        <nav class="group-admin-tabs">
          <button type="button" class={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>Settings</button>
          <button type="button" class={tab === 'members' ? 'active' : ''} onClick={() => setTab('members')}>Members</button>
          <button type="button" class={tab === 'roles' ? 'active' : ''} onClick={() => setTab('roles')}>Admins</button>
        </nav>
        <div class="settings-body">
          {tab === 'settings' ? <SettingsTab gid={gid} /> : null}
          {tab === 'members' ? <MembersTab gid={gid} /> : null}
          {tab === 'roles' ? <RolesTab gid={gid} /> : null}
        </div>
      </div>
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────

function SettingsTab({ gid }: { gid: string }): JSX.Element {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [draft, setDraft] = useState<SettingsResponse['config'] | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState<ModelsResponse | null>(null);

  async function refresh(): Promise<void> {
    const r = await call<SettingsResponse>(apiPath(gid, '/settings'));
    if (!r.ok) { setStatus({ err: errMsg(r.data, `HTTP ${r.status}`) }); return; }
    setData(r.data);
    setDraft({ ...r.data.config });
    setStatus(null);
  }

  useEffect(() => { refresh(); }, [gid]);

  // Refetch model suggestions whenever the provider changes (including the
  // initial load). Cheap: server caches the upstream catalog.
  const provider = draft?.provider ?? null;
  useEffect(() => {
    if (!provider) { setModels(null); return; }
    let cancelled = false;
    (async () => {
      const r = await call<ModelsResponse>(apiPath(gid, `/models?provider=${encodeURIComponent(provider)}`));
      if (cancelled) return;
      setModels(r.ok ? r.data : { models: [], source: 'unavailable', prefix: null });
    })();
    return () => { cancelled = true; };
  }, [provider, gid]);

  if (!data || !draft) return <p class="muted">Loading…</p>;

  function update<K extends keyof SettingsResponse['config']>(k: K, v: SettingsResponse['config'][K]): void {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  }

  function changed(): boolean {
    if (!data || !draft) return false;
    for (const k of Object.keys(draft) as (keyof SettingsResponse['config'])[]) {
      if (draft[k] !== data.config[k]) return true;
    }
    return false;
  }

  async function save(): Promise<void> {
    if (!draft) return;
    setBusy(true);
    setStatus(null);
    try {
      const r = await call<SettingsResponse>(apiPath(gid, '/settings'), 'PATCH', draft);
      if (!r.ok) { setStatus({ err: errMsg(r.data, `HTTP ${r.status}`) }); return; }
      setData(r.data);
      setDraft({ ...r.data.config });
      setStatus({ ok: r.data.runningSessionCount > 0
        ? `Saved. Restart the group to apply (${r.data.runningSessionCount} running session${r.data.runningSessionCount === 1 ? '' : 's'}).`
        : 'Saved.' });
    } finally { setBusy(false); }
  }

  async function restart(rebuild: boolean): Promise<void> {
    const label = rebuild ? 'Restart with rebuild' : 'Restart';
    const ok = await requestConfirm({
      title: label,
      message: rebuild
        ? 'Rebuild the container image, then restart all running sessions for this group?'
        : 'Restart all running sessions for this group?',
      okLabel: label,
      danger: false,
    });
    if (!ok) return;
    setBusy(true);
    setStatus(null);
    try {
      const r = await call<{ restarted: number; rebuilt: boolean }>(apiPath(gid, '/restart'), 'POST', { rebuild });
      if (!r.ok) { setStatus({ err: errMsg(r.data, `HTTP ${r.status}`) }); return; }
      setStatus({ ok: `Restarted ${r.data.restarted} session${r.data.restarted === 1 ? '' : 's'}${rebuild ? ' (rebuilt image).' : '.'}` });
      refresh();
    } finally { setBusy(false); }
  }

  return (
    <section>
      <p class="muted">
        Folder <code>{data.folder}</code>{data.updatedAt ? ` · last updated ${new Date(data.updatedAt).toLocaleString()}` : ''}
        {data.runningSessionCount > 0 ? ` · ${data.runningSessionCount} running session${data.runningSessionCount === 1 ? '' : 's'}` : ' · no running sessions'}
      </p>

      <Field label="Provider">
        <select
          value={draft.provider ?? ''}
          disabled={busy}
          onChange={(e: JSX.TargetedEvent<HTMLSelectElement>) => update('provider', e.currentTarget.value || null)}
        >
          {(data.validProviders).map((p) => <option value={p} key={p}>{p}</option>)}
        </select>
      </Field>

      <Field label="Model">
        <ModelField
          gid={gid}
          provider={draft.provider}
          value={draft.model}
          busy={busy}
          models={models}
          onChange={(v) => update('model', v)}
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
        <input
          type="text"
          value={draft.image_tag ?? ''}
          disabled={busy}
          onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => update('image_tag', e.currentTarget.value || null)}
        />
      </Field>

      <Field label="Assistant name">
        <input
          type="text"
          value={draft.assistant_name ?? ''}
          disabled={busy}
          onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => update('assistant_name', e.currentTarget.value || null)}
        />
      </Field>

      <Field label="Max messages / prompt">
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

      <Field label="CLI scope">
        <select
          value={draft.cli_scope ?? ''}
          disabled={busy}
          onChange={(e: JSX.TargetedEvent<HTMLSelectElement>) => update('cli_scope', e.currentTarget.value || null)}
        >
          {(data.validCliScopes).map((s) => <option value={s} key={s}>{s}</option>)}
        </select>
      </Field>

      <div class="settings-row" style="margin-top:16px">
        <button type="button" onClick={save} disabled={busy || !changed()}>Save</button>
        <button type="button" class="ghost" onClick={() => restart(false)} disabled={busy}>Restart</button>
        <button type="button" class="ghost" onClick={() => restart(true)} disabled={busy}>Restart + rebuild image</button>
      </div>

      {status ? <div class={'settings-status ' + (status.err ? 'err' : 'ok')}>{status.err || status.ok}</div> : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: preact.ComponentChildren }): JSX.Element {
  return (
    <div class="settings-row group-admin-field">
      <label class="group-admin-label">{label}</label>
      <div class="group-admin-control">{children}</div>
    </div>
  );
}

function ModelField({
  gid,
  provider,
  value,
  busy,
  models,
  onChange,
}: {
  gid: string;
  provider: string | null;
  value: string | null;
  busy: boolean;
  models: ModelsResponse | null;
  onChange: (v: string | null) => void;
}): JSX.Element {
  const listId = `models-${gid}`;
  // Placeholder shows the expected wire format. For opencode this is
  // "<OPENCODE_PROVIDER>/<model>" (the prefix comes from the server because
  // OPENCODE_PROVIDER lives in the host .env, not per-group).
  const placeholder = (() => {
    if (provider === 'opencode' && models?.prefix) return `${models.prefix}/model-id`;
    if (provider === 'claude') return 'claude-sonnet-4-6';
    return 'provider-specific';
  })();
  const helpText = (() => {
    if (provider === 'mock') return null;
    if (!models) return null;
    if (models.source === 'unavailable') {
      return 'Model catalog unavailable — type the model id manually.';
    }
    if (provider === 'opencode' && !models.prefix) {
      return 'OPENCODE_PROVIDER not set in .env — no suggestions; type the full provider/model id manually.';
    }
    if (provider === 'opencode' && models.models.length === 0) {
      return `No models found in catalog for OPENCODE_PROVIDER="${models.prefix}". Type manually.`;
    }
    if (provider === 'opencode' && models.prefix) {
      return `Format: ${models.prefix}/<model-id>. ${models.models.length} suggestions from models.dev.`;
    }
    if (provider === 'claude' && models.models.length > 0) {
      return `${models.models.length} suggestions from models.dev.`;
    }
    return null;
  })();
  return (
    <div class="group-admin-model-wrap">
      <input
        type="text"
        list={models && models.models.length > 0 ? listId : undefined}
        value={value ?? ''}
        disabled={busy}
        onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => onChange(e.currentTarget.value || null)}
        placeholder={placeholder}
        autocomplete="off"
        spellcheck={false}
      />
      {models && models.models.length > 0 ? (
        <datalist id={listId}>
          {models.models.map((m) => (
            <option value={m.value} key={m.value}>
              {m.label}
              {m.detail ? ` — ${m.detail}` : ''}
            </option>
          ))}
        </datalist>
      ) : null}
      {helpText ? <p class="group-admin-help">{helpText}</p> : null}
    </div>
  );
}

// ── Members ───────────────────────────────────────────────────────────────

function MembersTab({ gid }: { gid: string }): JSX.Element {
  const [members, setMembers] = useState<MemberDto[] | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(): Promise<void> {
    const r = await call<{ members: MemberDto[] }>(apiPath(gid, '/members'));
    if (!r.ok) { setStatus({ err: errMsg(r.data, `HTTP ${r.status}`) }); return; }
    setMembers(r.data.members);
    setStatus(null);
  }
  useEffect(() => { refresh(); }, [gid]);

  async function add(userId: string): Promise<void> {
    setBusy(true);
    setStatus(null);
    try {
      const r = await call(apiPath(gid, '/members'), 'POST', { userId });
      if (!r.ok) { setStatus({ err: errMsg(r.data, `HTTP ${r.status}`) }); return; }
      showToast('Member added');
      refresh();
    } finally { setBusy(false); }
  }

  async function remove(m: MemberDto): Promise<void> {
    const ok = await requestConfirm({
      title: 'Remove member',
      message: `Remove ${userLabel(m)} from this group?`,
      okLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setStatus(null);
    try {
      const r = await call(apiPath(gid, `/members/${encodeURIComponent(m.userId)}`), 'DELETE');
      if (!r.ok) { setStatus({ err: errMsg(r.data, `HTTP ${r.status}`) }); return; }
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

      {status ? <div class={'settings-status ' + (status.err ? 'err' : 'ok')}>{status.err || status.ok}</div> : null}
    </section>
  );
}

// ── Roles (scoped admin grants on this group) ─────────────────────────────

function RolesTab({ gid }: { gid: string }): JSX.Element {
  const [admins, setAdmins] = useState<RoleDto[] | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(): Promise<void> {
    const r = await call<{ admins: RoleDto[] }>(apiPath(gid, '/roles'));
    if (!r.ok) { setStatus({ err: errMsg(r.data, `HTTP ${r.status}`) }); return; }
    setAdmins(r.data.admins);
    setStatus(null);
  }
  useEffect(() => { refresh(); }, [gid]);

  async function grant(userId: string): Promise<void> {
    setBusy(true);
    setStatus(null);
    try {
      const r = await call<{ ok?: boolean; alreadyGranted?: boolean }>(
        apiPath(gid, '/roles'), 'POST', { userId },
      );
      if (!r.ok) { setStatus({ err: errMsg(r.data, `HTTP ${r.status}`) }); return; }
      showToast(r.data.alreadyGranted ? 'Already an admin' : 'Admin granted');
      refresh();
    } finally { setBusy(false); }
  }

  async function revoke(a: RoleDto): Promise<void> {
    const ok = await requestConfirm({
      title: 'Revoke admin',
      message: `Revoke admin role from ${userLabel(a)} on this group?`,
      okLabel: 'Revoke',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setStatus(null);
    try {
      const r = await call(apiPath(gid, `/roles/${encodeURIComponent(a.userId)}`), 'DELETE');
      if (!r.ok) { setStatus({ err: errMsg(r.data, `HTTP ${r.status}`) }); return; }
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

      {status ? <div class={'settings-status ' + (status.err ? 'err' : 'ok')}>{status.err || status.ok}</div> : null}
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
