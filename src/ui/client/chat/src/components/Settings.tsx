// Settings overlay — identities + notifications, in-app modal.
import './Settings.css';
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { settingsOpen, notifMutedSig, CHANNEL_META } from '../state';
import { toggleMute } from '../notify';
import { requestConfirm } from './PromptModal';
import type { Identity } from '../types';

const API = '/ui/settings/api';

interface JResp<T = unknown> { ok: boolean; status: number; data: T }

async function jget<T = Record<string, unknown>>(p: string): Promise<JResp<T>> {
  const r = await fetch(p, { credentials: 'same-origin' });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) as T };
}
async function jsend<T = Record<string, unknown>>(p: string, method: string, body?: unknown): Promise<JResp<T>> {
  const r = await fetch(p, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) as T };
}

function chanLabel(c: string): string {
  const m = CHANNEL_META[c];
  return m ? `${m.icon} ${m.label}` : c;
}

interface IdentitiesResponse {
  identities?: Identity[];
  deepLinkChannels?: string[];
  availableChannels?: string[];
}
interface ChallengeResponse {
  challengeId: string;
  channel: string;
  handle: string;
  expiresAt: string;
  deepLink?: string;
  message?: string;
  error?: string;
  attemptsRemaining?: number;
  consumed?: boolean;
  expired?: boolean;
}
interface Status { ok?: string; err?: string }

export function Settings() {
  const open = settingsOpen.value;
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [deepLinkChannels, setDeepLinkChannels] = useState<string[]>([]);
  const [chan, setChan] = useState<string>('');
  const [handle, setHandle] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [challenge, setChallenge] = useState<{ id: string; channel: string; handle: string; expiresAt: string } | null>(null);
  const [deepLink, setDeepLink] = useState<{ id: string; channel: string; url: string; expiresAt: string } | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(): Promise<void> {
    const r = await jget<IdentitiesResponse>(`${API}/identities`);
    if (!r.ok) {
      setStatus({ err: (r.data as { error?: string })?.error || `HTTP ${r.status}` });
      return;
    }
    setIdentities(r.data.identities || []);
    setDeepLinkChannels(r.data.deepLinkChannels || []);
    const linked = new Set((r.data.identities || []).map((i) => i.channel));
    const available = Array.isArray(r.data.availableChannels)
      ? r.data.availableChannels
      : Object.keys(CHANNEL_META);
    const opts = available.filter((c) => c !== 'web' && c !== 'cli' && !linked.has(c));
    setChannels(opts);
    if (opts.length && !opts.includes(chan)) setChan(opts[0]!);
  }

  useEffect(() => {
    if (!open) return;
    setStatus(null);
    setChallenge(null);
    setDeepLink(null);
    setCode('');
    refresh();
  }, [open]);

  async function startLink(): Promise<void> {
    if (!handle.trim()) { setStatus({ err: 'Enter a handle.' }); return; }
    setBusy(true);
    setStatus(null);
    try {
      const r = await jsend<ChallengeResponse>(`${API}/identities/link/start`, 'POST', { channel: chan, handle: handle.trim() });
      if (!r.ok) { setStatus({ err: r.data.message || r.data.error || `HTTP ${r.status}` }); return; }
      setChallenge({ id: r.data.challengeId, channel: r.data.channel, handle: r.data.handle, expiresAt: r.data.expiresAt });
      setStatus({ ok: `Code DM'd to ${r.data.channel}:${r.data.handle}.` });
    } finally { setBusy(false); }
  }

  async function startDeepLink(): Promise<void> {
    setBusy(true);
    setStatus(null);
    try {
      const r = await jsend<ChallengeResponse>(`${API}/identities/link/start-deeplink`, 'POST', { channel: chan });
      if (!r.ok) { setStatus({ err: r.data.message || r.data.error || `HTTP ${r.status}` }); return; }
      setDeepLink({ id: r.data.challengeId, channel: r.data.channel, url: r.data.deepLink || '', expiresAt: r.data.expiresAt });
      window.open(r.data.deepLink, '_blank', 'noopener');
      setStatus({ ok: `Opened ${chanLabel(r.data.channel)}. Confirm the link there, then come back.` });
    } finally { setBusy(false); }
  }

  useEffect(() => {
    if (!deepLink) return undefined;
    const t = setInterval(async () => {
      const r = await jget<ChallengeResponse>(`${API}/identities/link/status?challengeId=${encodeURIComponent(deepLink.id)}`);
      if (!r.ok) return;
      if (r.data.consumed) {
        setStatus({ ok: `Linked ${r.data.channel}:${r.data.handle}.` });
        setDeepLink(null);
        refresh();
      } else if (r.data.expired) {
        setStatus({ err: 'Link expired — try again.' });
        setDeepLink(null);
      }
    }, 2000);
    return () => clearInterval(t);
  }, [deepLink]);

  async function verify(): Promise<void> {
    if (!challenge || !code.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      const r = await jsend<ChallengeResponse>(`${API}/identities/link/verify`, 'POST', { challengeId: challenge.id, code: code.trim() });
      if (!r.ok) {
        const left = r.data.attemptsRemaining != null ? ` (${r.data.attemptsRemaining} attempts left)` : '';
        setStatus({ err: (r.data.message || r.data.error || `HTTP ${r.status}`) + left });
        return;
      }
      setStatus({ ok: `Linked ${r.data.channel}:${r.data.handle}.` });
      setChallenge(null);
      setHandle('');
      setCode('');
      refresh();
    } finally { setBusy(false); }
  }

  async function unlink(channel: string, h: string): Promise<void> {
    const ok = await requestConfirm({
      title: 'Unlink identity',
      message: `Unlink ${channel}:${h}?`,
      okLabel: 'Unlink',
      danger: true,
    });
    if (!ok) return;
    const r = await jsend<{ message?: string; error?: string }>(`${API}/identities/${encodeURIComponent(channel)}/${encodeURIComponent(h)}`, 'DELETE');
    if (!r.ok) { setStatus({ err: r.data.message || r.data.error || `HTTP ${r.status}` }); return; }
    setStatus({ ok: `Unlinked ${channel}:${h}.` });
    refresh();
  }

  function close(): void { settingsOpen.value = false; }
  function onBackdrop(e: JSX.TargetedMouseEvent<HTMLDivElement>): void {
    if ((e.target as HTMLElement).classList.contains('settings-backdrop')) close();
  }
  function onKey(e: KeyboardEvent): void { if (e.key === 'Escape') close(); }

  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  const muted = notifMutedSig.value;
  return (
    <div class="settings-backdrop" onClick={onBackdrop}>
      <div class="settings-modal" role="dialog" aria-label="Settings">
        <header class="settings-head">
          <span class="title">Settings</span>
          <button type="button" class="icon-btn" aria-label="Close" onClick={close}>{'\u2715'}</button>
        </header>
        <div class="settings-body">
          <section>
            <h3>Notifications</h3>
            <label class="settings-row">
              <input type="checkbox" checked={!muted} onChange={toggleMute} />
              <span>Browser notifications for new messages</span>
            </label>
            <p class="muted">{muted
              ? 'Currently muted. New messages will not raise notifications.'
              : 'Enabled. Permission is requested on first toggle.'}</p>
          </section>

          <section>
            <h3>Linked identities</h3>
            <p class="muted">Identities let NanoClaw recognize you across channels. Add more so any channel you DM the bot from is treated as the same user.</p>
            {identities.length === 0
              ? <p class="muted">No identities yet.</p>
              : (
                <table class="settings-table">
                  <thead><tr><th>Channel</th><th>Handle</th><th>Primary</th><th></th></tr></thead>
                  <tbody>
                    {identities.map((i) => (
                      <tr key={i.channel + ':' + i.handle}>
                        <td>{chanLabel(i.channel)}</td>
                        <td><code>{i.handle}</code></td>
                        <td>{i.primary ? 'yes' : ''}</td>
                        <td>{identities.length > 1
                          ? <button class="danger" onClick={() => unlink(i.channel, i.handle)}>Unlink</button>
                          : <span class="muted">last</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

            <h4>Link a new identity</h4>
            {channels.length === 0
              ? <p class="muted">No additional channels available.</p>
              : deepLinkChannels.includes(chan)
                ? (
                  <>
                    <div class="settings-row">
                      <select value={chan} onChange={(e: JSX.TargetedEvent<HTMLSelectElement>) => { setChan(e.currentTarget.value); setDeepLink(null); setChallenge(null); setStatus(null); }}>
                        {channels.map((c) => <option value={c} key={c}>{chanLabel(c)}</option>)}
                      </select>
                      <button onClick={startDeepLink} disabled={busy || !!deepLink}>Open {chanLabel(chan)} to confirm</button>
                    </div>
                    {deepLink ? (
                      <div class="settings-row" style="margin-top:8px">
                        <a href={deepLink.url} target="_blank" rel="noopener">Reopen link</a>
                        <button class="ghost" onClick={() => { setDeepLink(null); setStatus(null); }}>Cancel</button>
                        <span class="muted">expires {new Date(deepLink.expiresAt).toLocaleTimeString()}</span>
                      </div>
                    ) : null}
                  </>
                )
                : (
                  <>
                    <div class="settings-row">
                      <select value={chan} onChange={(e: JSX.TargetedEvent<HTMLSelectElement>) => { setChan(e.currentTarget.value); setDeepLink(null); setChallenge(null); setStatus(null); }}>
                        {channels.map((c) => <option value={c} key={c}>{chanLabel(c)}</option>)}
                      </select>
                      <input placeholder="handle" value={handle} onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => setHandle(e.currentTarget.value)} />
                      <button onClick={startLink} disabled={busy || !!challenge}>Send code</button>
                    </div>
                    {challenge ? (
                      <div class="settings-row" style="margin-top:8px">
                        <input placeholder="6-digit code" maxlength={6} value={code} onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => setCode(e.currentTarget.value)} style="width:120px" />
                        <button onClick={verify} disabled={busy || !code.trim()}>Verify</button>
                        <button class="ghost" onClick={() => { setChallenge(null); setCode(''); setStatus(null); }}>Cancel</button>
                        <span class="muted">expires {new Date(challenge.expiresAt).toLocaleTimeString()}</span>
                      </div>
                    ) : null}
                  </>
                )}
          </section>

          {status ? <div class={'settings-status ' + (status.err ? 'err' : 'ok')}>{status.err || status.ok}</div> : null}
        </div>
      </div>
    </div>
  );
}
