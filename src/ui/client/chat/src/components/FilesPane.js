// Files pane: head + breadcrumb + upload strip + listing + drop hint +
// preview body.
import { useRef, useEffect } from 'preact/hooks';
import { html } from '../html.js';
import {
  treePath, treeEntries, treeError, filePath, isAdmin,
  previewBlock, uploadItems, groupId, threadId, pinnedContext,
} from '../state.js';
import { navTree, navFile, closePreview, togglePinnedFile } from '../actions.js';
import {
  uploadFiles, clearUploadStrip, resolveConflict, notifyAgent,
} from '../uploads.js';
import { fmtBytes, renderMarkdown, parentPath } from '../utils.js';
import { Pane } from './Pane.js';
import { RelativeTime } from './RelativeTime.js';
import { ActionsMenu } from './ActionsMenu.js';
import { MediaPlayer } from './MediaPlayer.js';

function Crumb() {
  const ref = useRef(null);
  const p = treePath.value;
  const fp = filePath.value;
  const segs = p ? p.split('/').filter(Boolean) : [];
  const fileName = fp ? fp.slice(fp.lastIndexOf('/') + 1) : '';
  useEffect(() => {
    if (ref.current) requestAnimationFrame(() => { ref.current.scrollLeft = ref.current.scrollWidth; });
  }, [p, fp]);
  let acc = '';
  return html`
    <div class="breadcrumb" id="crumb" ref=${ref}>
      <button type="button" class=${'crumb root' + (segs.length === 0 && !fileName ? ' current' : '')} data-path="" title="Root"
              onClick=${() => navTree('')}>/</button>
      ${segs.map((s, i) => {
        acc = acc ? acc + '/' + s : s;
        const path = acc;
        const last = i === segs.length - 1 && !fileName;
        return html`
          <span class="sep" aria-hidden="true">\u203a</span>
          <button type="button" class=${'crumb' + (last ? ' current' : '')} data-path=${path} title=${'/' + path}
                  onClick=${last ? null : () => navTree(path)}>${s}</button>
        `;
      })}
      ${fileName ? html`
        <span class="sep" aria-hidden="true">\u203a</span>
        <span class="crumb file current" title=${'/' + fp}>${fileName}</span>
      ` : null}
    </div>
  `;
}

function Row({ e }) {
  const active = e.path === filePath.value;
  const selected = pinnedContext.value.includes(e.path);
  const onClick = (ev) => {
    if (ev.target.closest('.row-sel') || ev.target.closest('.action-menu')) return;
    if (e.type === 'dir') navTree(e.path);
    else navFile(e).catch(console.error);
  };
  return html`
    <div class=${'row tier-' + e.tier + (active ? ' active' : '') + (selected ? ' selected' : '')} data-path=${e.path} onClick=${onClick}>
      <label class="row-sel" onClick=${(ev) => ev.stopPropagation()} title=${selected ? 'Detach from next message' : 'Attach to next message'}>
        <input type="checkbox" checked=${selected} onChange=${() => togglePinnedFile(e.path)} />
      </label>
      <div>${e.type === 'dir' ? '\uD83D\uDCC1' : '\uD83D\uDCC4'}</div>
      <div class="name">${e.name}</div>
      <div class="size">${fmtBytes(e.size)}</div>
      <div class="meta"><${RelativeTime} ts=${e.mtime} /></div>
      <div class="row-actions"><${ActionsMenu} mode="row" entry=${e} /></div>
    </div>
  `;
}

function Listing() {
  const p = treePath.value;
  const err = treeError.value;
  const entries = treeEntries.value;
  if (err) return html`<div class="listing" id="listing"><div class="empty">${err}</div></div>`;
  return html`
    <div class="listing" id="listing">
      ${p ? html`<div class="row" onClick=${() => navTree(parentPath(p))}><div class="name">..</div></div>` : null}
      ${entries.length === 0
        ? html`<div class="empty">Empty directory</div>`
        : entries.map((e) => html`<${Row} key=${e.path} e=${e} />`)}
    </div>
  `;
}

function UploadStrip() {
  const items = uploadItems.value;
  if (items.length === 0) return html`<div class="upload-strip" id="upload-strip" hidden></div>`;
  const allDone = items.every((i) => i.status !== 'uploading');
  const okPaths = items.filter((i) => i.status === 'ok' && i.path).map((i) => i.path);
  const wakeTitle = !threadId.value ? 'Open a chat first' : `Send a message to the agent listing ${okPaths.length} updated file(s)`;
  return html`
    <div class="upload-strip" id="upload-strip">
      ${items.map((item, i) => html`
        <div class=${'row ' + item.status} key=${i}>
          <div class="name">${item.name}</div>
          ${item.status === 'uploading'
            ? html`<div class="bar"><i style=${`width:${Math.round(item.pct || 0)}%`}></i></div>`
            : null}
          <div class="status">${item.statusText || item.status}</div>
          ${item.status === 'conflict' ? html`
            <div class="actions">
              <button onClick=${() => resolveConflict(i, 'overwrite')} title="Replace existing file">Overwrite</button>
              <button onClick=${() => resolveConflict(i, 'rename')} title="Save with a unique name">Rename</button>
              <button onClick=${() => resolveConflict(i, 'skip')} title="Cancel this upload">Skip</button>
            </div>
          ` : null}
        </div>
      `)}
      ${allDone ? html`
        <div class="footer">
          <button onClick=${() => notifyAgent(okPaths)}
                  disabled=${okPaths.length === 0 || !threadId.value}
                  title=${wakeTitle}>Notify agent</button>
          <button class="close" onClick=${clearUploadStrip} title="Dismiss">\u2715</button>
        </div>
      ` : null}
    </div>
  `;
}

function Preview() {
  const ref = useRef(null);
  const p = previewBlock.value;
  if (!p) return html`<div class="preview-body" id="preview" ref=${ref}></div>`;
  const fp = filePath.value;
  const pinned = !!fp && pinnedContext.value.includes(fp);
  const clippyTitle = pinned
    ? 'Detach from next message'
    : 'Attach to next message';
  const toolbar = html`
    <div class="preview-toolbar">
      <button class=${'text-btn clippy' + (pinned ? ' active' : '')}
              onClick=${() => togglePinnedFile(fp)}
              disabled=${!fp}
              title=${clippyTitle}
              aria-pressed=${pinned}>\uD83D\uDCCE</button>
      ${p.size != null ? html`<span class="meta">${fmtBytes(p.size)}</span>` : null}
      ${p.mtime ? html`<${RelativeTime} ts=${p.mtime} className="meta ts" />` : null}
      <span style="margin-left:auto"><${ActionsMenu} mode="preview" /></span>
    </div>
  `;
  // Metadata panels above the body. File panel (size/type/modified) is
  // always shown for media kinds; tags panel only when embedded tags are
  // present; lyrics get their own scrollable panel below tags.
  const fileRows = [];
  if (p.mime) fileRows.push(['Type', p.mime]);
  if (p.size != null) fileRows.push(['Size', fmtBytes(p.size)]);
  if (p.mtime) fileRows.push(['Modified', new Date(p.mtime).toLocaleString()]);
  const tagRows = p.tags ? Object.entries(p.tags).map(([k, v]) => [k, String(v)]) : [];
  const isMedia = p.kind === 'image' || p.kind === 'audio' || p.kind === 'video' || p.kind === 'pdf';
  const player = (p.kind === 'audio' || p.kind === 'video')
    ? html`<${MediaPlayer} kind=${p.kind} url=${p.url} name=${p.name} />`
    : null;
  const renderMetaPanel = (rows, cls) => html`
    <dl class=${'preview-meta ' + cls}>
      ${rows.map(([k, v]) => html`<div class="row" key=${k}><dt>${k}</dt><dd>${v}</dd></div>`)}
    </dl>
  `;
  const fileMeta = (isMedia && fileRows.length > 0) ? renderMetaPanel(fileRows, 'preview-meta-file') : null;
  const tagMeta = (isMedia && tagRows.length > 0) ? renderMetaPanel(tagRows, 'preview-meta-tags') : null;
  const lyrics = p.lyrics ? html`
    <div class="preview-lyrics">
      <div class="preview-lyrics-head">Lyrics</div>
      <pre>${p.lyrics}</pre>
    </div>
  ` : null;
  let body = null;
  if (p.kind === 'image') body = html`<img alt=${p.name} src=${p.url} />`;
  else if (p.kind === 'pdf') body = html`<iframe src=${p.url} style="width:100%;height:90vh;border:0" />`;
  else if (p.kind === 'markdown') {
    const md = renderMarkdown(p.text);
    body = md != null
      ? html`<div class="markdown-preview" dangerouslySetInnerHTML=${{ __html: md }} />`
      : html`<pre>${p.text}</pre>`;
  } else if (p.kind === 'text') body = html`<pre>${p.text}</pre>`;
  else if (p.kind === 'binary') body = html`<div class="empty">Binary file (${p.mime}).</div>`;
  else if (p.kind === 'error') body = html`<div class="empty">${p.text}</div>`;
  return html`<div class="preview-body" id="preview" ref=${ref}>${toolbar}${player}${fileMeta}${tagMeta}${lyrics}${body}</div>`;
}

export function FilesPane() {
  const previewing = !!previewBlock.value;

  // Drop zone for uploads — bind handlers in an effect.
  const bodyRef = useRef(null);
  useEffect(() => {
    const body = bodyRef.current;
    const zone = document.getElementById('dropzone');
    if (!body || !zone) return undefined;
    let depth = 0;
    const hasFiles = (ev) => ev.dataTransfer && Array.from(ev.dataTransfer.types || []).includes('Files');
    const highlight = (on) => zone.classList.toggle('drag-over', !!on);
    const onEnter = (ev) => { if (!isAdmin.value || !hasFiles(ev)) return; ev.preventDefault(); depth++; highlight(true); };
    const onOver = (ev) => { if (!isAdmin.value || !hasFiles(ev)) return; ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; };
    const onLeave = () => { if (!isAdmin.value) return; depth--; if (depth <= 0) { depth = 0; highlight(false); } };
    const onDrop = (ev) => {
      if (!isAdmin.value) return;
      ev.preventDefault();
      depth = 0;
      highlight(false);
      const files = ev.dataTransfer && ev.dataTransfer.files;
      if (files && files.length) uploadFiles(files);
    };
    body.addEventListener('dragenter', onEnter);
    body.addEventListener('dragover', onOver);
    body.addEventListener('dragleave', onLeave);
    body.addEventListener('drop', onDrop);
    return () => {
      body.removeEventListener('dragenter', onEnter);
      body.removeEventListener('dragover', onOver);
      body.removeEventListener('dragleave', onLeave);
      body.removeEventListener('drop', onDrop);
    };
  }, []);

  const uploadInputRef = useRef(null);
  const headActions = html`
    <div class="head-actions">
      <input type="file" id="upload-input" multiple hidden ref=${uploadInputRef}
             onChange=${(ev) => { if (ev.target.files?.length) uploadFiles(ev.target.files); ev.target.value = ''; }} />
      <${ActionsMenu} mode="header" onUpload=${() => uploadInputRef.current?.click()} />
    </div>
  `;
  return html`
    <${Pane} paneKey="files" name="files-pane" label="Files"
             extraClass=${previewing ? 'previewing' : ''}
             headActions=${headActions}>
      <div class="files-body" ref=${bodyRef}>
        <${Crumb} />
        <${UploadStrip} />
        <${Listing} />
        <div class="drop-hint admin-only" id="dropzone">
          Drag & drop files here to upload to <code id="dropzone-path">/${treePath.value}</code>
        </div>
        <${Preview} />
      </div>
    <//>
  `;
}
