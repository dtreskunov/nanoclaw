// Modal for "Share with link" — picks duration + use count and mints a
// magic-link download URL via POST /api/groups/:gid/share-token.
import { useEffect, useRef, useState } from 'preact/hooks';
import { html } from '../html.js';
import { shareModalRequest } from '../state.js';
import { postJson } from '../api.js';

const DURATIONS = [
  { label: '15 minutes', minutes: 15 },
  { label: '1 hour', minutes: 60 },
  { label: '1 day', minutes: 60 * 24 },
  { label: '7 days', minutes: 60 * 24 * 7 },
];

export function ShareLinkModal() {
  const req = shareModalRequest.value;
  const [ttl, setTtl] = useState(60);
  const [uses, setUses] = useState(1);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { url, expiresAt, ttlMinutes, uses }
  const [error, setError] = useState(null);
  const urlRef = useRef(null);

  // Reset whenever a new request opens.
  useEffect(() => {
    if (!req) return;
    setTtl(60);
    setUses(1);
    setBusy(false);
    setResult(null);
    setError(null);
  }, [req?.entry?.path, req?.groupId]);

  useEffect(() => {
    if (!req) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [req]);

  if (!req) return null;
  const { groupId, entry } = req;
  const title = entry?.name || (entry?.path || '').slice((entry?.path || '').lastIndexOf('/') + 1);

  function close() { shareModalRequest.value = null; }
  function onBackdrop(e) { if (e.target.classList.contains('settings-backdrop')) close(); }

  async function mint() {
    setBusy(true);
    setError(null);
    try {
      const r = await postJson(`api/groups/${encodeURIComponent(groupId)}/share-token`, {
        path: entry.path,
        ttlMinutes: ttl,
        uses,
      });
      if (!r.ok) {
        setError(r.data?.error || `HTTP ${r.status}`);
        return;
      }
      setResult(r.data);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!result?.url) return;
    try {
      await navigator.clipboard.writeText(result.url);
    } catch {
      if (urlRef.current) {
        urlRef.current.select();
        try { document.execCommand('copy'); } catch { /* ignore */ }
      }
    }
  }

  async function shareSystem() {
    if (!result?.url || !navigator.share) return;
    try { await navigator.share({ title, url: result.url }); } catch (err) {
      if (err && err.name !== 'AbortError') setError(String(err));
    }
  }

  const expiresLabel = result?.expiresAt ? new Date(result.expiresAt).toLocaleString() : null;

  return html`
    <div class="settings-backdrop" onClick=${onBackdrop}>
      <div class="settings-modal" role="dialog" aria-label="Share with link" style="max-width:520px">
        <header class="settings-head">
          <span class="title">Share with link</span>
          <button type="button" class="icon-btn" aria-label="Close" onClick=${close}>\u2715</button>
        </header>
        <div class="settings-body">
          <p class="muted" style="margin-top:0">
            Anyone with this link can download <code>${title}</code> until it expires
            or the use count is exhausted. No sign-in required.
          </p>

          ${result ? html`
            <section>
              <h3>Link ready</h3>
              <div class="settings-row">
                <input ref=${urlRef} type="text" readonly value=${result.url}
                       onClick=${(e) => e.target.select()} />
              </div>
              <p class="muted">
                Valid for ${result.ttlMinutes} min${expiresLabel ? ` (until ${expiresLabel})` : ''},
                ${result.uses} download${result.uses === 1 ? '' : 's'}.
              </p>
              <div class="settings-row">
                <button type="button" onClick=${copy}>Copy link</button>
                ${navigator.share ? html`<button type="button" class="ghost" onClick=${shareSystem}>Share\u2026</button>` : null}
                <button type="button" class="ghost" onClick=${() => setResult(null)}>Mint another</button>
              </div>
            </section>
          ` : html`
            <section>
              <h3>Valid for</h3>
              <div class="settings-row">
                <select value=${ttl} onChange=${(e) => setTtl(Number(e.target.value))}>
                  ${DURATIONS.map((d) => html`<option value=${d.minutes}>${d.label}</option>`)}
                </select>
                <span class="muted">or custom (minutes):</span>
                <input type="number" min="1" max="10080" value=${ttl}
                       onInput=${(e) => setTtl(Math.max(1, Math.min(10080, Number(e.target.value) || 1)))} />
              </div>
              <p class="muted">Maximum 7 days (10080 minutes).</p>

              <h3>Number of downloads</h3>
              <div class="settings-row">
                <input type="number" min="1" max="100" value=${uses}
                       onInput=${(e) => setUses(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} />
                <button type="button" class="ghost" onClick=${() => setUses(1)} disabled=${uses === 1}>Single use</button>
              </div>
              <p class="muted">Maximum 100. The link stops working once exhausted.</p>
            </section>
          `}

          ${error ? html`<div class="settings-status err">${error}</div>` : null}
        </div>
        <div class="settings-row" style="padding:10px 16px;border-top:1px solid var(--border);justify-content:flex-end">
          ${result
            ? html`<button type="button" onClick=${close}>Done</button>`
            : html`
              <button type="button" class="ghost" onClick=${close} disabled=${busy}>Cancel</button>
              <button type="button" onClick=${mint} disabled=${busy}>${busy ? 'Creating\u2026' : 'Create link'}</button>
            `}
        </div>
      </div>
    </div>
  `;
}
