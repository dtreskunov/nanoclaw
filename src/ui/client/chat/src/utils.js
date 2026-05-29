// Format helpers, DOM utilities, markdown rendering, file-link rewriter.
import { state } from './state.js';

export const $ = (id) => document.getElementById(id);

export function fmtBytes(n) {
  if (n == null) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' K';
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' M';
  return (n / 1024 / 1024 / 1024).toFixed(1) + ' G';
}

export function fmtBytesShort(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

export function fmtRelative(ts) {
  if (!ts) return '';
  const norm = ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z';
  const t = Date.parse(norm);
  if (!t) return '';
  const sec = Math.max(0, (Date.now() - t) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return Math.floor(sec / 60) + 'm';
  if (sec < 86400) return Math.floor(sec / 3600) + 'h';
  if (sec < 86400 * 7) return Math.floor(sec / 86400) + 'd';
  return new Date(t).toLocaleDateString();
}

export function fmtAbsolute(ts) {
  if (!ts) return '';
  const norm = ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z';
  const t = Date.parse(norm);
  if (!t) return '';
  return new Date(t).toLocaleString();
}

export function tsHTML(ts, cls) {
  const rel = fmtRelative(ts);
  if (!rel) return '';
  return `<span class="${cls || 'ts'}" title="${escapeAttr(fmtAbsolute(ts))}">${escapeHtml(rel)}</span>`;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function escapeAttr(s) { return escapeHtml(s); }

export function parentPath(p) { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }

export function emptyDiv(text) {
  const d = document.createElement('div');
  d.className = 'empty';
  d.textContent = text;
  return d;
}

export function renderMarkdown(text) {
  if (typeof window.marked === 'undefined') return null;
  try { return window.marked.parse(text || '', { breaks: true, gfm: true }); } catch (_) { return null; }
}

// Rewrite relative-path markdown links inside a chat message to point at
// the file-browser file endpoint, so references like
// [sick_day_v2.mp3](sick_day_v2.mp3) become clickable. Also auto-linkify
// bare backtick-quoted filename-like tokens (e.g. `sick_day_v2.mp3`).
// Plain left-click invokes `onNavFile(entry)`; middle/cmd-click falls
// through to the href and opens in a new tab.
export function rewriteFileLinks(root, onNavFile) {
  if (!state.groupId) return;
  const gid = encodeURIComponent(state.groupId);
  const isExternal = (h) => /^[a-z][a-z0-9+.-]*:/i.test(h) || h.startsWith('#') || h.startsWith('//') || h.startsWith('mailto:');
  const normalizeRel = (p) => String(p || '').replace(/^\.?\/+/, '').replace(/^workspace\/+/, '');
  const toFileUrl = (rel) => `api/groups/${gid}/file?path=${encodeURIComponent(rel)}`;
  const attachPreviewClick = (a, rel) => {
    a.addEventListener('click', (ev) => {
      if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      ev.preventDefault();
      const entry = { path: rel, name: rel.slice(rel.lastIndexOf('/') + 1) };
      onNavFile(entry).catch(console.error);
    });
  };
  root.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (!href || isExternal(href)) return;
    const rel = normalizeRel(href);
    if (!rel) return;
    a.setAttribute('href', toFileUrl(rel));
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener');
    attachPreviewClick(a, rel);
  });
  // Auto-linkify backtick-quoted filename-like tokens.
  const fileLikeRe = /^[\w.\-/ ]+\.[A-Za-z0-9]{1,8}$/;
  root.querySelectorAll('code').forEach((c) => {
    if (c.closest('pre')) return;
    const txt = c.textContent || '';
    if (!fileLikeRe.test(txt)) return;
    if (txt.length > 200) return;
    const rel = normalizeRel(txt);
    if (!rel) return;
    const a = document.createElement('a');
    a.href = toFileUrl(rel);
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = txt;
    attachPreviewClick(a, rel);
    c.replaceWith(a);
  });
}
