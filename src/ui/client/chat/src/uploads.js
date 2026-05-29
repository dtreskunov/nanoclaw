// Admin write operations + upload progress strip.
import { groupId, isAdmin, uploadItems, threadId, treePath } from './state.js';
import { postJson } from './api.js';
import { loadTree } from './actions.js';

function curDir() { return treePath.value || ''; }
function joinPath(dir, name) { return dir ? (dir + '/' + name) : name; }

export async function mkdirPrompt() {
  if (!groupId.value || !isAdmin.value) return;
  const name = prompt('New folder name:');
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  const target = joinPath(curDir(), trimmed);
  const r = await postJson(`api/groups/${groupId.value}/mkdir`, { path: target });
  if (!r.ok) { alert('mkdir failed: ' + (r.data.error || r.status)); return; }
  await loadTree(treePath.value);
}

export async function touchPrompt() {
  if (!groupId.value || !isAdmin.value) return;
  const name = prompt('New file name:');
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  const target = joinPath(curDir(), trimmed);
  const r = await postJson(`api/groups/${groupId.value}/touch`, { path: target });
  if (!r.ok) { alert('create file failed: ' + (r.data.error || r.status)); return; }
  await loadTree(treePath.value);
}

export async function renameEntry(entry) {
  if (!isAdmin.value) return;
  const next = prompt('Rename to:', entry.name);
  if (!next) return;
  const trimmed = next.trim();
  if (!trimmed || trimmed === entry.name) return;
  const dir = entry.path.includes('/') ? entry.path.slice(0, entry.path.lastIndexOf('/')) : '';
  const toPath = joinPath(dir, trimmed);
  const r = await postJson(`api/groups/${groupId.value}/rename`, { from: entry.path, to: toPath });
  if (!r.ok) { alert('rename failed: ' + (r.data.error || r.status)); return; }
  await loadTree(treePath.value);
}

export async function deleteEntry(entry) {
  if (!isAdmin.value) return;
  if (!confirm(`Delete ${entry.type === 'dir' ? 'folder' : 'file'} "${entry.name}"?`)) return;
  const r = await postJson(`api/groups/${groupId.value}/delete`, { path: entry.path });
  if (!r.ok) { alert('delete failed: ' + (r.data.error || r.status)); return; }
  await loadTree(treePath.value);
}

export async function deletePaths(paths) {
  if (!isAdmin.value || paths.length === 0) return;
  if (!confirm(`Delete ${paths.length} item${paths.length === 1 ? '' : 's'}?`)) return;
  const errors = [];
  for (const p of paths) {
    const r = await postJson(`api/groups/${groupId.value}/delete`, { path: p });
    if (!r.ok) errors.push(`${p}: ${r.data.error || r.status}`);
  }
  if (errors.length) alert('Some deletes failed:\n' + errors.join('\n'));
  await loadTree(treePath.value);
}

// Trigger a download for one or more paths. A single regular file downloads
// directly; folders and multi-selections stream via the server's zip endpoint.
export function downloadPaths(paths, entries) {
  if (!groupId.value || paths.length === 0) return;
  if (paths.length === 1) {
    const single = paths[0];
    const entry = entries?.find((e) => e.path === single);
    if (entry && entry.type !== 'dir') {
      const url = `api/groups/${groupId.value}/file?path=${encodeURIComponent(single)}`;
      triggerDownload(url, entry.name);
      return;
    }
  }
  const qs = paths.map((p) => `path=${encodeURIComponent(p)}`).join('&');
  triggerDownload(`api/groups/${groupId.value}/zip?${qs}`);
}

function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  if (filename) a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ── upload + progress strip ─────────────────────────────────────────
function updateItem(idx, patch) {
  const next = uploadItems.value.slice();
  next[idx] = { ...next[idx], ...patch };
  uploadItems.value = next;
}

export function clearUploadStrip() { uploadItems.value = []; }

export function resolveConflict(idx, action) {
  if (action === 'skip') { updateItem(idx, { status: 'error', statusText: 'skipped' }); return; }
  updateItem(idx, { status: 'uploading', pct: 0, statusText: 'uploading\u2026' });
  uploadOne(idx, action).catch((err) => updateItem(idx, { status: 'error', statusText: String(err && err.message || err) }));
}

function uploadOne(idx, mode) {
  return new Promise((resolve) => {
    const item = uploadItems.value[idx];
    if (!item) return resolve();
    const fd = new FormData();
    fd.append('file', item.file, item.name);
    const xhr = new XMLHttpRequest();
    const url = `api/groups/${groupId.value}/upload?path=${encodeURIComponent(curDir())}&mode=${encodeURIComponent(mode)}`;
    xhr.open('POST', url);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) updateItem(idx, { pct: (ev.loaded / ev.total) * 100 });
    };
    xhr.onload = () => {
      let body = {};
      try { body = JSON.parse(xhr.responseText || '{}'); } catch (_) {}
      const r = (body.results && body.results[0]) || {};
      if (xhr.status >= 200 && xhr.status < 300 && r.status === 'ok') {
        updateItem(idx, { status: 'ok', statusText: 'uploaded', path: r.path });
      } else if (r.status === 'conflict') {
        updateItem(idx, { status: 'conflict', statusText: 'file exists' });
      } else {
        updateItem(idx, { status: 'error', statusText: r.reason || r.status || ('http ' + xhr.status) });
      }
      resolve();
    };
    xhr.onerror = () => { updateItem(idx, { status: 'error', statusText: 'network error' }); resolve(); };
    xhr.send(fd);
  });
}

export async function uploadFiles(fileList) {
  if (!groupId.value || !isAdmin.value || !fileList || fileList.length === 0) return;
  uploadItems.value = Array.from(fileList).map((file) => ({
    file, name: file.name, size: file.size, status: 'uploading', pct: 0, statusText: 'uploading\u2026', path: null,
  }));
  for (let i = 0; i < uploadItems.value.length; i++) {
    await uploadOne(i, 'skip').catch((err) => updateItem(i, { status: 'error', statusText: String(err && err.message || err) }));
  }
  await loadTree(treePath.value);
}

export async function notifyAgent(paths) {
  if (!threadId.value || !groupId.value || paths.length === 0) return;
  const list = paths.slice(0, 20).map((p) => '`' + p + '`').join(', ');
  const more = paths.length > 20 ? ` (and ${paths.length - 20} more)` : '';
  const text = `Files updated via web UI: ${list}${more}`;
  const r = await postJson(`api/groups/${groupId.value}/chat/${threadId.value}/send`, { text });
  if (!r.ok) { alert('notify failed: ' + (r.data.error || r.status)); return; }
  clearUploadStrip();
}
