// Admin write operations (mkdir/touch/rename/delete) and upload UI.
import { state, chat, uploadState } from './state.js';
import { $, escapeHtml, escapeAttr } from './utils.js';
import { postJson } from './api.js';
import { loadTree } from './files.js';

function curDir() { return state.path || ''; }
function joinPath(dir, name) { return dir ? (dir + '/' + name) : name; }

export async function mkdirPrompt() {
  if (!state.groupId || !state.isAdmin) return;
  const name = prompt('New folder name:');
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  const target = joinPath(curDir(), trimmed);
  const r = await postJson(`api/groups/${state.groupId}/mkdir`, { path: target });
  if (!r.ok) { alert('mkdir failed: ' + (r.data.error || r.status)); return; }
  await loadTree(state.path);
}

export async function touchPrompt() {
  if (!state.groupId || !state.isAdmin) return;
  const name = prompt('New file name:');
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  const target = joinPath(curDir(), trimmed);
  const r = await postJson(`api/groups/${state.groupId}/touch`, { path: target });
  if (!r.ok) { alert('create file failed: ' + (r.data.error || r.status)); return; }
  await loadTree(state.path);
}

export async function renameEntry(entry) {
  if (!state.isAdmin) return;
  const next = prompt('Rename to:', entry.name);
  if (!next) return;
  const trimmed = next.trim();
  if (!trimmed || trimmed === entry.name) return;
  const dir = entry.path.includes('/') ? entry.path.slice(0, entry.path.lastIndexOf('/')) : '';
  const toPath = joinPath(dir, trimmed);
  const r = await postJson(`api/groups/${state.groupId}/rename`, { from: entry.path, to: toPath });
  if (!r.ok) { alert('rename failed: ' + (r.data.error || r.status)); return; }
  await loadTree(state.path);
}

export async function deleteEntry(entry) {
  if (!state.isAdmin) return;
  if (!confirm(`Delete ${entry.type === 'dir' ? 'folder' : 'file'} "${entry.name}"?`)) return;
  const r = await postJson(`api/groups/${state.groupId}/delete`, { path: entry.path });
  if (!r.ok) { alert('delete failed: ' + (r.data.error || r.status)); return; }
  await loadTree(state.path);
}

// ── upload + progress strip ──────────────────────────────────────────
export function clearUploadStrip() {
  uploadState.items = [];
  const strip = document.getElementById('upload-strip');
  if (strip) { strip.innerHTML = ''; strip.hidden = true; }
}

function ensureUploadStrip() {
  const strip = document.getElementById('upload-strip');
  strip.hidden = false;
  return strip;
}

function renderUploadStrip() {
  const strip = ensureUploadStrip();
  strip.innerHTML = '';
  for (const item of uploadState.items) {
    const row = document.createElement('div');
    row.className = 'row ' + item.status;
    const progress = item.status === 'uploading' ? `<div class="bar"><i style="width:${Math.round(item.pct || 0)}%"></i></div>` : '';
    let actions = '';
    if (item.status === 'conflict') {
      actions = '<div class="actions">'
        + '<button data-act="overwrite" title="Replace existing file">Overwrite</button>'
        + '<button data-act="rename" title="Save with a unique name">Rename</button>'
        + '<button data-act="skip" title="Cancel this upload">Skip</button>'
        + '</div>';
    }
    const status = item.statusText || item.status;
    row.innerHTML = `<div class="name">${escapeHtml(item.name)}</div>${progress}<div class="status">${escapeHtml(status)}</div>${actions}`;
    row.querySelectorAll('button[data-act]').forEach((b) => {
      b.addEventListener('click', () => resolveConflict(item, b.dataset.act));
    });
    strip.appendChild(row);
  }
  const anyDone = uploadState.items.length > 0 && uploadState.items.every((i) => i.status !== 'uploading');
  if (anyDone) {
    const footer = document.createElement('div');
    footer.className = 'footer';
    const okPaths = uploadState.items.filter((i) => i.status === 'ok' && i.path).map((i) => i.path);
    const wakeDisabled = okPaths.length === 0 || !chat.threadId ? 'disabled' : '';
    const wakeTitle = !chat.threadId ? 'Open a chat first' : `Send a message to the agent listing ${okPaths.length} updated file(s)`;
    footer.innerHTML = `<button data-act="wake" ${wakeDisabled} title="${escapeAttr(wakeTitle)}">Notify agent</button>`
      + `<button class="close" data-act="close" title="Dismiss">\u2715</button>`;
    footer.querySelector('[data-act="wake"]').addEventListener('click', () => notifyAgent(okPaths));
    footer.querySelector('[data-act="close"]').addEventListener('click', clearUploadStrip);
    strip.appendChild(footer);
  }
}

async function notifyAgent(paths) {
  if (!chat.threadId || !state.groupId || paths.length === 0) return;
  const list = paths.slice(0, 20).map((p) => '`' + p + '`').join(', ');
  const more = paths.length > 20 ? ` (and ${paths.length - 20} more)` : '';
  const text = `Files updated via web UI: ${list}${more}`;
  const r = await postJson(`api/groups/${state.groupId}/chat/${chat.threadId}/send`, { text });
  if (!r.ok) { alert('notify failed: ' + (r.data.error || r.status)); return; }
  clearUploadStrip();
}

function resolveConflict(item, action) {
  if (action === 'skip') {
    item.status = 'error';
    item.statusText = 'skipped';
    renderUploadStrip();
    return;
  }
  item.status = 'uploading';
  item.pct = 0;
  item.statusText = 'uploading\u2026';
  renderUploadStrip();
  uploadOne(item, action).catch((err) => {
    item.status = 'error';
    item.statusText = String(err && err.message || err);
    renderUploadStrip();
  });
}

function uploadOne(item, mode) {
  return new Promise((resolve) => {
    const fd = new FormData();
    fd.append('file', item.file, item.name);
    const xhr = new XMLHttpRequest();
    const url = `api/groups/${state.groupId}/upload?path=${encodeURIComponent(curDir())}&mode=${encodeURIComponent(mode)}`;
    xhr.open('POST', url);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        item.pct = (ev.loaded / ev.total) * 100;
        renderUploadStrip();
      }
    };
    xhr.onload = () => {
      let body = {};
      try { body = JSON.parse(xhr.responseText || '{}'); } catch (_) {}
      const r = (body.results && body.results[0]) || {};
      if (xhr.status >= 200 && xhr.status < 300 && r.status === 'ok') {
        item.status = 'ok';
        item.statusText = 'uploaded';
        item.path = r.path;
      } else if (r.status === 'conflict') {
        item.status = 'conflict';
        item.statusText = 'file exists';
      } else {
        item.status = 'error';
        item.statusText = r.reason || r.status || ('http ' + xhr.status);
      }
      renderUploadStrip();
      resolve();
    };
    xhr.onerror = () => {
      item.status = 'error';
      item.statusText = 'network error';
      renderUploadStrip();
      resolve();
    };
    xhr.send(fd);
  });
}

export async function uploadFiles(fileList) {
  if (!state.groupId || !state.isAdmin || !fileList || fileList.length === 0) return;
  uploadState.items = Array.from(fileList).map((file) => ({
    file, name: file.name, size: file.size, status: 'uploading', pct: 0, statusText: 'uploading\u2026', path: null,
  }));
  renderUploadStrip();
  // Upload sequentially to keep progress + conflict UX simple.
  for (const item of uploadState.items) {
    await uploadOne(item, 'skip').catch((err) => {
      item.status = 'error';
      item.statusText = String(err && err.message || err);
    });
  }
  renderUploadStrip();
  await loadTree(state.path);
}

export function setupDragDrop() {
  const body = document.querySelector('.files-pane .files-body');
  const zone = document.getElementById('dropzone');
  if (!body || !zone) return;
  function highlight(on) { zone.classList.toggle('drag-over', !!on); }
  function hasFiles(ev) {
    return !!ev.dataTransfer && Array.from(ev.dataTransfer.types || []).includes('Files');
  }
  body.addEventListener('dragenter', (ev) => {
    if (!state.isAdmin || !hasFiles(ev)) return;
    ev.preventDefault();
    uploadState.dragDepth += 1;
    highlight(true);
  });
  body.addEventListener('dragover', (ev) => {
    if (!state.isAdmin || !hasFiles(ev)) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'copy';
  });
  body.addEventListener('dragleave', () => {
    if (!state.isAdmin) return;
    uploadState.dragDepth -= 1;
    if (uploadState.dragDepth <= 0) { uploadState.dragDepth = 0; highlight(false); }
  });
  body.addEventListener('drop', (ev) => {
    if (!state.isAdmin) return;
    ev.preventDefault();
    uploadState.dragDepth = 0;
    highlight(false);
    const files = ev.dataTransfer && ev.dataTransfer.files;
    if (files && files.length) uploadFiles(files);
  });
}
