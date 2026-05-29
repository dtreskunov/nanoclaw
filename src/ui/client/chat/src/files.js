// Group select, file tree, file preview, breadcrumb, context chip.
import { state, chat, MOBILE_MQ } from './state.js';
import { $, escapeHtml, escapeAttr, tsHTML, fmtBytes, parentPath, emptyDiv, renderMarkdown } from './utils.js';
import { api } from './api.js';
import { writeHash } from './hash.js';
import { loadThreads, openChat, threadCtx, clearChat } from './chat.js';
import { clearUploadStrip, renameEntry, deleteEntry } from './uploads.js';
import { openFilesDrawerIfMobile, togglePane, stopPreviewMedia } from './panels.js';

export function applyAdminFlag() {
  const g = state.groups.find((x) => x.id === state.groupId);
  state.isAdmin = !!(g && g.isAdmin);
  document.body.classList.toggle('is-admin', state.isAdmin);
}

export function sortGroups(groups) {
  return groups.slice().sort((a, b) => {
    const ta = a.lastActivityAt ? Date.parse(a.lastActivityAt.includes('T') ? a.lastActivityAt : a.lastActivityAt.replace(' ', 'T') + 'Z') : 0;
    const tb = b.lastActivityAt ? Date.parse(b.lastActivityAt.includes('T') ? b.lastActivityAt : b.lastActivityAt.replace(' ', 'T') + 'Z') : 0;
    if (tb !== ta) return tb - ta;
    return a.name.localeCompare(b.name);
  });
}

export function populateGroupSelect() {
  const sel = $('group-select');
  sel.innerHTML = '';
  for (const g of state.groups) {
    const o = document.createElement('option');
    o.value = g.id;
    const adminTag = g.isAdmin ? ' [admin]' : '';
    o.textContent = `${g.name}${adminTag}`;
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => selectGroup(sel.value));
}

export function syncGroupSelect() {
  const sel = $('group-select');
  if (sel.value !== state.groupId) sel.value = state.groupId || '';
}

export async function selectGroup(id) {
  state.groupId = id;
  state.path = '';
  state.file = null;
  applyAdminFlag();
  clearUploadStrip();
  syncGroupSelect();
  await loadThreads(id);
  // Periodically refresh the thread rail so newly-arrived inbound threads
  // (e.g. fresh email) appear without a manual reload.
  if (chat.threadsPollTimer) { clearInterval(chat.threadsPollTimer); chat.threadsPollTimer = null; }
  chat.threadsPollTimer = setInterval(() => {
    if (state.groupId === id) loadThreads(id).catch(() => {});
    else { clearInterval(chat.threadsPollTimer); chat.threadsPollTimer = null; }
  }, 20000);
  await loadTree('');
  onSelectionChanged();
  const latest = chat.threads.length > 0 ? chat.threads[0] : null;
  if (latest) {
    openChat(id, latest.threadId, threadCtx(latest)).catch((err) => console.error('chat open failed', err));
  } else {
    clearChat();
    chat.groupId = id;
    chat.threadId = null;
    writeHash();
  }
}

export async function loadTree(p) {
  state.path = p;
  state.file = null;
  stopPreviewMedia();
  $('files-pane').classList.remove('previewing');
  $('preview').innerHTML = '';
  renderCrumb(p);
  onSelectionChanged();
  const dz = document.getElementById('dropzone-path');
  if (dz) dz.textContent = '/' + p;
  const list = $('listing');
  list.innerHTML = '';
  list.appendChild(emptyDiv('Loading…'));
  let entries;
  try {
    ({ entries } = await api(`api/groups/${encodeURIComponent(state.groupId)}/tree?path=${encodeURIComponent(p)}`));
  } catch (err) {
    list.innerHTML = '';
    const msg = /HTTP 404/.test(String(err && err.message)) ? 'Not found. It may have been renamed or deleted.' : String(err && err.message || err);
    list.appendChild(emptyDiv(msg));
    return;
  }
  list.innerHTML = '';
  if (p) {
    const up = document.createElement('div');
    up.className = 'row';
    up.innerHTML = '<div class="name">..</div>';
    up.onclick = () => navTree(parentPath(p));
    list.appendChild(up);
  }
  if (!entries.length) { list.appendChild(emptyDiv('Empty directory')); return; }
  for (const e of entries) {
    const row = document.createElement('div');
    row.className = 'row tier-' + e.tier;
    row.dataset.path = e.path;
    const icon = e.type === 'dir' ? '\uD83D\uDCC1' : '\uD83D\uDCC4';
    row.innerHTML = `<div>${icon}</div><div class="name">${escapeHtml(e.name)}</div>`
      + `<div class="size">${fmtBytes(e.size)}</div>`
      + `<div class="meta">${tsHTML(e.mtime)}</div>`
      + `<div class="row-actions admin-only">`
      +   `<button type="button" class="act-ren" title="Rename">\u270E</button>`
      +   `<button type="button" class="act-del" title="Delete">\uD83D\uDDD1</button>`
      + `</div>`;
    row.onclick = (ev) => {
      if (ev.target.closest('.row-actions')) return;
      if (e.type === 'dir') navTree(e.path); else navFile(e);
    };
    const ren = row.querySelector('.act-ren');
    const del = row.querySelector('.act-del');
    if (ren) ren.addEventListener('click', (ev) => { ev.stopPropagation(); renameEntry(e); });
    if (del) del.addEventListener('click', (ev) => { ev.stopPropagation(); deleteEntry(e); });
    list.appendChild(row);
  }
}

export async function navTree(p) { await loadTree(p); writeHash(); }

export async function navFile(entry) {
  await selectFile(entry);
  writeHash();
  if (MOBILE_MQ.matches) openFilesDrawerIfMobile();
  else if (!state.paneOpen.files) togglePane('files');
}

export async function selectFile(entry) {
  state.file = entry.path;
  stopPreviewMedia();
  for (const el of document.querySelectorAll('.files-pane .row')) {
    el.classList.toggle('active', el.dataset.path === entry.path);
  }
  renderCrumb(entry.path);
  $('files-pane').classList.add('previewing');
  onSelectionChanged();
  const url = `api/groups/${encodeURIComponent(state.groupId)}/file?path=${encodeURIComponent(entry.path)}`;
  const pv = $('preview');
  let headStatus = 0;
  try {
    const h = await fetch(url, { method: 'HEAD', credentials: 'same-origin' });
    headStatus = h.status;
    if (h.ok) {
      if (entry.size == null) {
        const cl = h.headers.get('content-length');
        if (cl) entry.size = Number(cl);
      }
      if (!entry.mtime) {
        const lm = h.headers.get('last-modified');
        if (lm) { const t = Date.parse(lm); if (t) entry.mtime = new Date(t).toISOString(); }
      }
    }
  } catch (_) {}
  if (headStatus && headStatus >= 400) {
    const msg = headStatus === 404 ? 'File not found. It may have been renamed or deleted.' : `HTTP ${headStatus}`;
    pv.innerHTML = `<div class="preview-toolbar"></div><div class="empty">${escapeHtml(msg)}</div>`;
    return;
  }
  const toolbar = previewToolbar(entry, url);
  const ext = entry.name.toLowerCase().split('.').pop();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
    pv.innerHTML = `${toolbar}<img alt="${escapeHtml(entry.name)}" src="${url}"/>`;
    return;
  }
  if (['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac', 'weba'].includes(ext)) {
    pv.innerHTML = `${toolbar}<audio controls preload="metadata" src="${url}"></audio>`;
    return;
  }
  if (['mp4', 'm4v', 'mov', 'webm', 'ogv'].includes(ext)) {
    pv.innerHTML = `${toolbar}<video controls preload="metadata" src="${url}" style="max-width:100%;max-height:80vh"></video>`;
    return;
  }
  if (ext === 'pdf') {
    pv.innerHTML = `${toolbar}<iframe src="${url}" style="width:100%;height:90vh;border:0"></iframe>`;
    return;
  }
  const r = await fetch(url, { credentials: 'same-origin' });
  if (!r.ok) { pv.innerHTML = `${toolbar}<div class="empty">HTTP ${r.status}</div>`; return; }
  const ct = r.headers.get('content-type') || '';
  if (ct.startsWith('text/') || ct.includes('json') || ct.includes('xml')) {
    const t = await r.text();
    if (ext === 'md' || ext === 'markdown') {
      const html = renderMarkdown(t);
      if (html != null) {
        pv.innerHTML = `${toolbar}<div class="markdown-preview"></div>`;
        pv.querySelector('.markdown-preview').innerHTML = html;
        return;
      }
    }
    pv.innerHTML = `${toolbar}<pre></pre>`;
    pv.querySelector('pre').textContent = t;
  } else {
    pv.innerHTML = `${toolbar}<div class="empty">Binary file (${escapeHtml(ct)}).</div>`;
  }
}

function previewToolbar(entry, url) {
  const parts = [`<a class="text-btn" href="${url}" download="${escapeAttr(entry.name)}">Download</a>`];
  if (entry.size != null) parts.push(`<span class="meta">${escapeHtml(fmtBytes(entry.size))}</span>`);
  if (entry.mtime) parts.push(tsHTML(entry.mtime, 'meta'));
  return `<div class="preview-toolbar">${parts.join('')}</div>`;
}

export function setPreview(html) {
  $('preview').innerHTML = html;
  $('files-pane').classList.add('previewing');
}

function renderCrumb(p) {
  const segs = p ? p.split('/').filter(Boolean) : [];
  const c = $('crumb');
  const parts = [];
  const rootCurrent = segs.length === 0 ? ' current' : '';
  parts.push(`<button type="button" class="crumb root${rootCurrent}" data-path="" title="Root">/</button>`);
  let acc = '';
  segs.forEach((s, i) => {
    acc = acc ? acc + '/' + s : s;
    const isLast = i === segs.length - 1;
    parts.push(`<span class="sep" aria-hidden="true">\u203a</span>`);
    parts.push(`<button type="button" class="crumb${isLast ? ' current' : ''}" data-path="${escapeAttr(acc)}" title="${escapeAttr('/' + acc)}">${escapeHtml(s)}</button>`);
  });
  c.innerHTML = parts.join('');
  for (const a of c.querySelectorAll('.crumb:not(.current)')) {
    a.onclick = () => navTree(a.dataset.path);
  }
  requestAnimationFrame(() => { c.scrollLeft = c.scrollWidth; });
}

// ── context chip ─────────────────────────────────────────────────────
export function currentContextPath() {
  if (!state.groupId) return null;
  if (state.file) return { path: state.file, kind: 'file' };
  if (state.path) return { path: state.path.replace(/\/?$/, '/'), kind: 'dir' };
  // Root folder isn't useful context — skip the chip entirely.
  return null;
}

export function renderContextChip() {
  const el = $('chat-context');
  if (!el) return;
  const ctx = currentContextPath();
  if (!ctx || chat.contextDismissed) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = '';
  const chip = document.createElement('span');
  chip.className = 'chip';
  const icon = ctx.kind === 'dir' ? '\uD83D\uDCC1' : '\uD83D\uDCC4';
  chip.innerHTML = `<span>${icon}</span><span class="path" title="${escapeHtml(ctx.path)}">${escapeHtml(ctx.path)}</span>`;
  const x = document.createElement('button');
  x.type = 'button'; x.textContent = '×'; x.title = 'Don\u2019t include this in next message';
  x.addEventListener('click', () => { chat.contextDismissed = true; renderContextChip(); });
  chip.appendChild(x);
  el.appendChild(chip);
}

export function onSelectionChanged() { chat.contextDismissed = false; renderContextChip(); }
