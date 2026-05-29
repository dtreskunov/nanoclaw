// Format helpers + markdown rendering. Returns plain strings/HTML —
// components handle escaping via htm's prop interpolation when possible.
import { marked } from 'marked';

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

export function tsKey(s) {
  if (!s) return 0;
  const norm = s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
  const n = Date.parse(norm);
  return Number.isFinite(n) ? n : 0;
}

export function parentPath(p) { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }

export function renderMarkdown(text) {
  try { return marked.parse(text || '', { breaks: true, gfm: true }); } catch (_) { return null; }
}

// Rewrite relative-path markdown links inside a chat message bubble (post-
// render) so [foo.mp3](foo.mp3) and backtick-quoted `foo.mp3` open the file
// in the preview pane. Plain left-click invokes onNavFile(entry); middle/
// cmd-click falls through to the href and opens in a new tab.
export function rewriteFileLinks(root, groupId, onNavFile) {
  if (!groupId || !root) return;
  const gid = encodeURIComponent(groupId);
  const isExternal = (h) => /^[a-z][a-z0-9+.-]*:/i.test(h) || h.startsWith('#') || h.startsWith('//') || h.startsWith('mailto:');
  const normalizeRel = (p) => String(p || '').replace(/^\.?\/+/, '').replace(/^workspace\/+/, '');
  const toFileUrl = (rel) => `api/groups/${gid}/file?path=${encodeURIComponent(rel)}`;
  const attachPreviewClick = (a, rel) => {
    a.addEventListener('click', (ev) => {
      if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      ev.preventDefault();
      onNavFile({ path: rel, name: rel.slice(rel.lastIndexOf('/') + 1) });
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
