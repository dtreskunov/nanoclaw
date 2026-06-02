// Format helpers + markdown rendering. Returns plain strings/HTML —
// components handle escaping via JSX prop interpolation when possible.
import { marked } from 'marked';

export function fmtBytes(n: number | null | undefined): string {
  if (n == null) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' K';
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' M';
  return (n / 1024 / 1024 / 1024).toFixed(1) + ' G';
}

export function fmtBytesShort(n: number | null | undefined): string {
  if (n == null) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

export function fmtRelative(ts: string | null | undefined): string {
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

export function fmtAbsolute(ts: string | null | undefined): string {
  if (!ts) return '';
  const norm = ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z';
  const t = Date.parse(norm);
  if (!t) return '';
  return new Date(t).toLocaleString();
}

export function tsKey(s: string | null | undefined): number {
  if (!s) return 0;
  const norm = s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
  const n = Date.parse(norm);
  return Number.isFinite(n) ? n : 0;
}

export function parentPath(p: string): string {
  const i = p.lastIndexOf('/');
  return i < 0 ? '' : p.slice(0, i);
}

// Pre-process raw markdown to make file-link destinations parseable when the
// model emits unescaped spaces or parens in the URL — e.g.
// [`Foo (v2).mp3`](music/Foo (v2).mp3). CommonMark allows wrapping the
// destination in <...> to permit those characters; we add the wrap when the
// destination looks like a relative path (no URL scheme, not already wrapped).
function normalizeFileLinks(text: string): string {
  const re = /\[([^\]\n]+)\]\(([^<>\n()]*(?:\([^()\n]*\)[^<>\n()]*)*)\)/g;
  return text.replace(re, (match, label: string, dest: string) => {
    const d = dest.trim();
    if (!d) return match;
    if (/^[a-z][a-z0-9+.-]*:/i.test(d)) return match;
    if (d.startsWith('#') || d.startsWith('//') || d.startsWith('mailto:')) return match;
    if (!/[ ()]/.test(d)) return match;
    return `[${label}](<${d}>)`;
  });
}

export function renderMarkdown(text: string | null | undefined): string | null {
  try {
    return marked.parse(normalizeFileLinks(text || ''), { breaks: true, gfm: true }) as string;
  } catch {
    return null;
  }
}

export function rewriteFileLinks(
  root: HTMLElement,
  groupId: string,
  onNavFile: (entry: { path: string; name: string }) => void,
): void {
  if (!groupId || !root) return;
  const gid = encodeURIComponent(groupId);
  const isExternal = (h: string): boolean =>
    /^[a-z][a-z0-9+.-]*:/i.test(h) || h.startsWith('#') || h.startsWith('//') || h.startsWith('mailto:');
  const decodeHref = (h: string): string => {
    try {
      return decodeURIComponent(h);
    } catch {
      return h;
    }
  };
  const normalizeRel = (p: string): string =>
    String(p || '')
      .replace(/^\.?\/+/, '')
      .replace(/^workspace\/+/, '');
  const toFileUrl = (rel: string): string => {
    const segs = rel.split('/').filter(Boolean).map(encodeURIComponent);
    return `api/groups/${gid}/files/${segs.join('/')}`;
  };
  const attachPreviewClick = (a: HTMLAnchorElement, rel: string): void => {
    a.addEventListener('click', (ev: MouseEvent) => {
      if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      ev.preventDefault();
      onNavFile({ path: rel, name: rel.slice(rel.lastIndexOf('/') + 1) });
    });
  };
  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (!href || isExternal(href)) return;
    const rel = normalizeRel(decodeHref(href));
    if (!rel) return;
    a.setAttribute('href', toFileUrl(rel));
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener');
    attachPreviewClick(a, rel);
  });
  const fileLikeRe = /^[\w.\-/ ]+\.[A-Za-z0-9]{1,8}$/;
  root.querySelectorAll<HTMLElement>('code').forEach((c) => {
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
