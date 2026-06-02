// Unified actions menu. Three modes:
//   - 'header'  bulk on pinnedContext + create file/folder in current dir
//   - 'row'     single entry (replaces per-row hover edit/delete)
//   - 'preview' acts on the currently-previewed file (replaces Download + ×)
import { html } from '../html.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  pinnedContext, isAdmin, treeEntries, filePath, previewBlock, groupId,
} from '../state.js';
import { clearPinnedContext, closePreview } from '../actions.js';
import {
  mkdirPrompt, touchPrompt, renameEntry, deleteEntry,
  deletePaths, downloadPaths,
} from '../uploads.js';

// URL to fetch a single file with its path encoded into the URL path
// (not a query string). This is what makes relative asset URLs inside
// an HTML document resolve to siblings in the same directory — the
// browser uses the document URL as the base for `./img.png`, `style.css`,
// etc., and each resolves to another /files/<sibling> on the same route.
function fileUrl(groupId, relPath) {
  const segs = String(relPath || '').split('/').filter(Boolean).map(encodeURIComponent);
  return `api/groups/${encodeURIComponent(groupId)}/files/${segs.join('/')}`;
}

function openInNewTab(groupId, relPath) {
  if (!groupId || !relPath) return;
  window.open(fileUrl(groupId, relPath), '_blank', 'noopener');
}

async function shareFile(groupId, entry) {
  if (!groupId || !entry?.path) return;
  const url = new URL(fileUrl(groupId, entry.path), window.location.href).toString();
  const title = entry.name || entry.path.slice(entry.path.lastIndexOf('/') + 1);
  // Prefer the Web Share API when available (Android, iOS, some desktops).
  // Fall back to copying the URL to the clipboard.
  if (navigator.share) {
    try { await navigator.share({ title, url }); return; } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
}

function entriesByPath(paths) {
  const set = new Set(paths);
  return treeEntries.value.filter((e) => set.has(e.path));
}

export function ActionsMenu({ mode, entry, onUpload }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (ev) => {
      if (wrapRef.current && !wrapRef.current.contains(ev.target)) setOpen(false);
    };
    const onKey = (ev) => { if (ev.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items = buildItems(mode, entry, onUpload);
  if (items.length === 0) return null;

  return html`
    <div class=${'action-menu' + (open ? ' open' : '')} ref=${wrapRef}>
      <button type="button" class="text-btn action-trigger" aria-haspopup="menu" aria-expanded=${open}
              title="Actions" onClick=${(ev) => { ev.stopPropagation(); setOpen((o) => !o); }}>\u22EF</button>
      ${open ? html`
        <div class="action-panel" role="menu">
          ${items.map((it, i) => it === '---'
            ? html`<div class="action-sep" key=${'s' + i}></div>`
            : html`
                <button type="button" class=${'action-item' + (it.danger ? ' danger' : '')}
                        role="menuitem" key=${it.label} disabled=${it.disabled}
                        onClick=${(ev) => { ev.stopPropagation(); setOpen(false); it.onClick(); }}>
                  <span class="ico">${it.ico}</span>
                  <span class="lbl">${it.label}</span>
                </button>
              `)}
        </div>
      ` : null}
    </div>
  `;
}

function buildItems(mode, entry, onUpload) {
  const admin = isAdmin.value;
  const gid = groupId.value;
  if (mode === 'row' && entry) {
    const items = [];
    items.push({ ico: '\u2B07', label: 'Download', onClick: () => downloadPaths([entry.path], [entry]) });
    if (entry.type !== 'dir') {
      items.push({ ico: '\u2197', label: 'Open in new tab', onClick: () => openInNewTab(gid, entry.path) });
      items.push({ ico: '\u21AA', label: 'Share', onClick: () => shareFile(gid, entry) });
    }
    if (admin) {
      items.push('---');
      items.push({ ico: '\u270E', label: 'Rename', onClick: () => renameEntry(entry) });
      items.push({ ico: '\uD83D\uDDD1', label: 'Delete', danger: true, onClick: () => deleteEntry(entry) });
    }
    return items;
  }

  if (mode === 'preview') {
    const p = previewBlock.value;
    const fp = filePath.value;
    if (!p) return [];
    const entryForPath = treeEntries.value.find((e) => e.path === fp) || (fp ? { path: fp, name: p.name, type: 'file' } : null);
    const items = [];
    items.push({ ico: '\u2B07', label: 'Download', onClick: () => fp ? downloadPaths([fp], [entryForPath]) : null, disabled: !fp });
    items.push({ ico: '\u2197', label: 'Open in new tab', onClick: () => openInNewTab(gid, fp), disabled: !fp });
    items.push({ ico: '\u21AA', label: 'Share', onClick: () => shareFile(gid, entryForPath), disabled: !fp });
    if (admin && entryForPath) {
      items.push('---');
      items.push({ ico: '\u270E', label: 'Rename', onClick: () => renameEntry(entryForPath) });
      items.push({ ico: '\uD83D\uDDD1', label: 'Delete', danger: true, onClick: () => deleteEntry(entryForPath) });
    }
    items.push('---');
    items.push({ ico: '\u00D7', label: 'Close preview', onClick: closePreview });
    return items;
  }

  // header
  const sel = pinnedContext.value;
  const selEntries = entriesByPath(sel);
  const items = [];
  if (admin) {
    items.push({ ico: '\uFF0B', label: 'New file', onClick: touchPrompt });
    items.push({ ico: '\uD83D\uDCC1', label: 'New folder', onClick: mkdirPrompt });
    if (onUpload) items.push({ ico: '\u2B06', label: 'Upload files\u2026', onClick: onUpload });
  }
  if (sel.length > 0) {
    if (items.length) items.push('---');
    items.push({ ico: '\u2B07', label: sel.length > 1 ? `Download ${sel.length} (zip)` : 'Download', onClick: () => downloadPaths(sel, selEntries) });
    if (admin) {
      if (sel.length === 1 && selEntries.length === 1) {
        items.push({ ico: '\u270E', label: 'Rename', onClick: () => renameEntry(selEntries[0]) });
      }
      items.push({ ico: '\uD83D\uDDD1', label: sel.length > 1 ? `Delete ${sel.length}` : 'Delete', danger: true, onClick: () => deletePaths(sel) });
    }
    items.push('---');
    items.push({ ico: '\u2715', label: 'Clear selection', onClick: clearPinnedContext });
  }
  return items;
}
