// Files pane: head + breadcrumb + upload strip + listing + drop hint +
// preview body.
import { useRef, useEffect } from 'preact/hooks';
import { html } from '../html.js';
import {
  treePath, treeEntries, treeError, filePath, isAdmin, paneOpen,
  drawerOpen, previewBlock, MOBILE_MQ, uploadItems, groupId, threadId,
} from '../state.js';
import { navTree, navFile, closePreview } from '../actions.js';
import {
  mkdirPrompt, touchPrompt, uploadFiles, renameEntry, deleteEntry,
  clearUploadStrip, resolveConflict, notifyAgent,
} from '../uploads.js';
import { fmtBytes, fmtRelative, fmtAbsolute, renderMarkdown, parentPath } from '../utils.js';

function Crumb() {
  const ref = useRef(null);
  const p = treePath.value;
  const segs = p ? p.split('/').filter(Boolean) : [];
  useEffect(() => {
    if (ref.current) requestAnimationFrame(() => { ref.current.scrollLeft = ref.current.scrollWidth; });
  }, [p]);
  let acc = '';
  return html`
    <div class="breadcrumb" id="crumb" ref=${ref}>
      <button type="button" class=${'crumb root' + (segs.length === 0 ? ' current' : '')} data-path="" title="Root"
              onClick=${() => navTree('')}>/</button>
      ${segs.map((s, i) => {
        acc = acc ? acc + '/' + s : s;
        const path = acc;
        const last = i === segs.length - 1;
        return html`
          <span class="sep" aria-hidden="true">\u203a</span>
          <button type="button" class=${'crumb' + (last ? ' current' : '')} data-path=${path} title=${'/' + path}
                  onClick=${last ? null : () => navTree(path)}>${s}</button>
        `;
      })}
    </div>
  `;
}

function Row({ e }) {
  const active = e.path === filePath.value;
  const onClick = (ev) => {
    if (ev.target.closest('.row-actions')) return;
    if (e.type === 'dir') navTree(e.path);
    else navFile(e).then(() => { drawerOpen.files.value = true; }).catch(console.error);
  };
  return html`
    <div class=${'row tier-' + e.tier + (active ? ' active' : '')} data-path=${e.path} onClick=${onClick}>
      <div>${e.type === 'dir' ? '\uD83D\uDCC1' : '\uD83D\uDCC4'}</div>
      <div class="name">${e.name}</div>
      <div class="size">${fmtBytes(e.size)}</div>
      <div class="meta" title=${fmtAbsolute(e.mtime)}>${fmtRelative(e.mtime)}</div>
      <div class="row-actions admin-only">
        <button type="button" class="act-ren" title="Rename" onClick=${(ev) => { ev.stopPropagation(); renameEntry(e); }}>\u270e</button>
        <button type="button" class="act-del" title="Delete" onClick=${(ev) => { ev.stopPropagation(); deleteEntry(e); }}>\uD83D\uDDD1</button>
      </div>
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
  // Stop any audio/video when the preview changes.
  useEffect(() => () => {
    if (ref.current) {
      ref.current.querySelectorAll('audio, video').forEach((m) => { try { m.pause(); m.src = ''; m.load(); } catch (_) {} });
    }
  }, [p]);
  if (!p) return html`<div class="preview-body" id="preview" ref=${ref}></div>`;
  const toolbar = html`
    <div class="preview-toolbar">
      <a class="text-btn" href=${p.url} download=${p.name}>Download</a>
      ${p.size != null ? html`<span class="meta">${fmtBytes(p.size)}</span>` : null}
      ${p.mtime ? html`<span class="meta ts" title=${fmtAbsolute(p.mtime)}>${fmtRelative(p.mtime)}</span>` : null}
      <button class="text-btn" onClick=${closePreview} style="margin-left:auto" title="Close preview">\u00d7</button>
    </div>
  `;
  let body = null;
  if (p.kind === 'image') body = html`<img alt=${p.name} src=${p.url} />`;
  else if (p.kind === 'audio') body = html`<audio controls preload="metadata" src=${p.url} />`;
  else if (p.kind === 'video') body = html`<video controls preload="metadata" src=${p.url} style="max-width:100%;max-height:80vh" />`;
  else if (p.kind === 'pdf') body = html`<iframe src=${p.url} style="width:100%;height:90vh;border:0" />`;
  else if (p.kind === 'markdown') {
    const md = renderMarkdown(p.text);
    body = md != null
      ? html`<div class="markdown-preview" dangerouslySetInnerHTML=${{ __html: md }} />`
      : html`<pre>${p.text}</pre>`;
  } else if (p.kind === 'text') body = html`<pre>${p.text}</pre>`;
  else if (p.kind === 'binary') body = html`<div class="empty">Binary file (${p.mime}).</div>`;
  else if (p.kind === 'error') body = html`<div class="empty">${p.text}</div>`;
  return html`<div class="preview-body" id="preview" ref=${ref}>${toolbar}${body}</div>`;
}

export function FilesPane() {
  const collapsed = !paneOpen.files.value;
  const drawer = drawerOpen.files.value;
  const previewing = !!previewBlock.value;
  const cls = 'nc-pane files-pane no-animate'
    + (collapsed ? ' collapsed' : '')
    + (drawer ? ' open' : '')
    + (previewing ? ' previewing' : '');

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

  const onPaneClick = (ev) => {
    if (!collapsed) return;
    if (ev.target.closest('button, a')) return;
    if (MOBILE_MQ.matches) return;
    paneOpen.files.value = true;
  };
  const onHeadClick = (ev) => {
    if (ev.target.closest('button, a')) return;
    if (MOBILE_MQ.matches) return;
    ev.stopPropagation();
    paneOpen.files.value = !paneOpen.files.value;
  };
  const uploadInputRef = useRef(null);
  return html`
    <aside class=${cls} id="files-pane" onClick=${onPaneClick}>
      <div class="head" onClick=${onHeadClick}>
        <button type="button" class="icon-btn" id="btn-files-toggle" aria-label=${collapsed ? 'Expand files' : 'Collapse files'}
                onClick=${(e) => { e.stopPropagation(); paneOpen.files.value = !collapsed; }}></button>
        <span class="title">Files</span>
      </div>
      <div class="head-actions admin-only">
        <button type="button" class="text-btn" id="btn-touch" title="New empty file" aria-label="New empty file"
                onClick=${touchPrompt}>+F</button>
        <button type="button" class="text-btn" id="btn-mkdir" title="New folder" aria-label="New folder"
                onClick=${mkdirPrompt}>+D</button>
        <button type="button" class="text-btn" id="btn-upload" title="Upload files" aria-label="Upload files"
                onClick=${() => uploadInputRef.current?.click()}>UPL</button>
        <input type="file" id="upload-input" multiple hidden ref=${uploadInputRef}
               onChange=${(ev) => { if (ev.target.files?.length) uploadFiles(ev.target.files); ev.target.value = ''; }} />
      </div>
      <div class="files-body" ref=${bodyRef}>
        <${Crumb} />
        <${UploadStrip} />
        <${Listing} />
        <div class="drop-hint admin-only" id="dropzone">
          Drag &amp; drop files here to upload to <code id="dropzone-path">/${treePath.value}</code>
        </div>
        <${Preview} />
      </div>
    </aside>
  `;
}
