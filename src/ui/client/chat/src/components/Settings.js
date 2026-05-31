// Settings overlay — identities + notifications, in-app modal.
import { useEffect, useState } from 'preact/hooks';
import { html } from '../html.js';
import { settingsOpen, notifMutedSig, CHANNEL_META } from '../state.js';
import { toggleMute } from '../notify.js';

const API = '/ui/settings/api';

async function jget(p) {
  const r = await fetch(p, { credentials: 'same-origin' });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}
async function jsend(p, method, body) {
  const r = await fetch(p, {
    method, credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}

function chanLabel(c) {
  const m = CHANNEL_META[c];
  return m ? `${m.icon} ${m.label}` : c;
}

export function Settings() {
  const open = settingsOpen.value;
  const [identities, setIdentities] = useState([]);
  const [channels, setChannels] = useState([]);
  const [deepLinkChannels, setDeepLinkChannels] = useState([]);
  const [chan, setChan] = useState('');
  const [handle, setHandle] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [deepLink, setDeepLink] = useState(null); // { id, channel, url, expiresAt }
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStatus(null);
    setChallenge(null);
    setDeepLink(null);
    setCode('');
    refresh();
  }, [open]);

  async function refresh() {
    const r = await jget(`${API}/identities`);
    if (!r.ok) {
      setStatus({ err: r.data?.error || `HTTP ${r.status}` });
      return;
    }
    setIdentities(r.data.identities || []);
    setDeepLinkChannels(r.data.deepLinkChannels || []);
    // Channels: derive what's NOT already linked from CHANNEL_META, minus web.
    const linked = new Set((r.data.identities || []).map((i) => i.channel));
    const opts = Object.keys(CHANNEL_META).filter((c) => c !== 'web' && !linked.has(c));
    setChannels(opts);
    if (opts.length && !opts.includes(chan)) setChan(opts[0]);
  }

  async function startLink() {
    if (!handle.trim()) return setStatus({ err: 'Enter a handle.' });
    setBusy(true);
    setStatus(null);
    try {
      const r = await jsend(`${API}/identities/link/start`, 'POST', { channel: chan, handle: handle.trim() });
      if (!r.ok) return setStatus({ err: r.data?.message || r.data?.error || `HTTP ${r.status}` });
      setChallenge({ id: r.data.challengeId, channel: r.data.channel, handle: r.data.handle, expiresAt: r.data.expiresAt });
      setStatus({ ok: `Code DM'd to ${r.data.channel}:${r.data.handle}.` });
    } finally { setBusy(false); }
  }

  async function startDeepLink() {
    setBusy(true);
    setStatus(null);
    try {
      const r = await jsend(`${API}/identities/link/start-deeplink`, 'POST', { channel: chan });
      if (!r.ok) return setStatus({ err: r.data?.message || r.data?.error || `HTTP ${r.status}` });
      setDeepLink({ id: r.data.challengeId, channel: r.data.channel, url: r.data.deepLink, expiresAt: r.data.expiresAt });
      window.open(r.data.deepLink, '_blank', 'noopener');
      setStatus({ ok: `Opened ${chanLabel(r.data.channel)}. Confirm the link there, then come back.` });
    } finally { setBusy(false); }
  }

  // Poll status while a deep-link challenge is pending.
  useEffect(() => {
    if (!deepLink) return undefined;
    const t = setInterval(async () => {
      const r = await jget(`${API}/identities/link/status?challengeId=${encodeURIComponent(deepLink.id)}`);
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

  async function verify() {
    if (!challenge || !code.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      const r = await jsend(`${API}/identities/link/verify`, 'POST', { challengeId: challenge.id, code: code.trim() });
      if (!r.ok) {
        const left = r.data?.attemptsRemaining != null ? ` (${r.data.attemptsRemaining} attempts left)` : '';
        return setStatus({ err: (r.data?.message || r.data?.error || `HTTP ${r.status}`) + left });
      }
      setStatus({ ok: `Linked ${r.data.channel}:${r.data.handle}.` });
      setChallenge(null);
      setHandle('');
      setCode('');
      refresh();
    } finally { setBusy(false); }
  }

  async function unlink(channel, h) {
    if (!confirm(`Unlink ${channel}:${h}?`)) return;
    const r = await jsend(`${API}/identities/${encodeURIComponent(channel)}/${encodeURIComponent(h)}`, 'DELETE');
    if (!r.ok) return setStatus({ err: r.data?.message || r.data?.error || `HTTP ${r.status}` });
    setStatus({ ok: `Unlinked ${channel}:${h}.` });
    refresh();
  }

  function close() { settingsOpen.value = false; }
  function onBackdrop(e) { if (e.target.classList.contains('settings-backdrop')) close(); }
  function onKey(e) { if (e.key === 'Escape') close(); }

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  const muted = notifMutedSig.value;
  return html`
    <div class="settings-backdrop" onClick=${onBackdrop}>
      <div class="settings-modal" role="dialog" aria-label="Settings">
        <header class="settings-head">
          <span class="title">Settings</span>
          <button type="button" class="icon-btn" aria-label="Close" onClick=${close}>\u2715</button>
        </header>
        <div class="settings-body">
          <section>
            <h3>Notifications</h3>
            <label class="settings-row">
              <input type="checkbox" checked=${!muted} onChange=${toggleMute} />
              <span>Browser notifications for new messages</span>
            </label>
            <p class="muted">${muted
              ? 'Currently muted. New messages will not raise notifications.'
              : 'Enabled. Permission is requested on first toggle.'}</p>
          </section>

          <section>
            <h3>Linked identities</h3>
            <p class="muted">Identities let NanoClaw recognize you across channels. Add more so any channel you DM the bot from is treated as the same user.</p>
            ${identities.length === 0
              ? html`<p class="muted">No identities yet.</p>`
              : html`
                <table class="settings-table">
                  <thead><tr><th>Channel</th><th>Handle</th><th>Primary</th><th></th></tr></thead>
                  <tbody>
                    ${identities.map((i) => html`
                      <tr>
                        <td>${chanLabel(i.channel)}</td>
                        <td><code>${i.handle}</code></td>
                        <td>${i.primary ? 'yes' : ''}</td>
                        <td>${identities.length > 1
                          ? html`<button class="danger" onClick=${() => unlink(i.channel, i.handle)}>Unlink</button>`
                          : html`<span class="muted">last</span>`}</td>
                      </tr>
                    `)}
                  </tbody>
                </table>
              `}

            <h4>Link a new identity</h4>
            ${channels.length === 0
              ? html`<p class="muted">No additional channels available.</p>`
              : deepLinkChannels.includes(chan)
                ? html`
                  <div class="settings-row">
                    <select value=${chan} onChange=${(e) => { setChan(e.target.value); setDeepLink(null); setChallenge(null); setStatus(null); }}>
                      ${channels.map((c) => html`<option value=${c}>${chanLabel(c)}</option>`)}
                    </select>
                    <button onClick=${startDeepLink} disabled=${busy || !!deepLink}>Open ${chanLabel(chan)} to confirm</button>
                  </div>
                  ${deepLink ? html`
                    <div class="settings-row" style="margin-top:8px">
                      <a href=${deepLink.url} target="_blank" rel="noopener">Reopen link</a>
                      <button class="ghost" onClick=${() => { setDeepLink(null); setStatus(null); }}>Cancel</button>
                      <span class="muted">expires ${new Date(deepLink.expiresAt).toLocaleTimeString()}</span>
                    </div>
                  ` : null}
                `
                : html`
                  <div class="settings-row">
                    <select value=${chan} onChange=${(e) => { setChan(e.target.value); setDeepLink(null); setChallenge(null); setStatus(null); }}>
                      ${channels.map((c) => html`<option value=${c}>${chanLabel(c)}</option>`)}
                    </select>
                    <input placeholder="handle" value=${handle} onInput=${(e) => setHandle(e.target.value)} />
                    <button onClick=${startLink} disabled=${busy || !!challenge}>Send code</button>
                  </div>
                  ${challenge ? html`
                    <div class="settings-row" style="margin-top:8px">
                      <input placeholder="6-digit code" maxlength="6" value=${code} onInput=${(e) => setCode(e.target.value)} style="width:120px" />
                      <button onClick=${verify} disabled=${busy || !code.trim()}>Verify</button>
                      <button class="ghost" onClick=${() => { setChallenge(null); setCode(''); setStatus(null); }}>Cancel</button>
                      <span class="muted">expires ${new Date(challenge.expiresAt).toLocaleTimeString()}</span>
                    </div>
                  ` : null}
                `}
          </section>

          ${status ? html`<div class=${'settings-status ' + (status.err ? 'err' : 'ok')}>${status.err || status.ok}</div>` : null}
        </div>
      </div>
    </div>
  `;
}
