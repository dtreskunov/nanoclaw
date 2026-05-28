// NanoClaw web UI — single-page app.
// URL hash format: #<groupId>[/<path>[/]][?t=<threadId>]
//   no hash               → most-recently-active accessible group, root
//   #ag-xyz               → group root (no thread)
//   #ag-xyz/sub/dir/      → directory (trailing slash)
//   #ag-xyz/sub/file.txt  → file (no trailing slash)
//   ?t=<threadId> suffix  → active chat thread
(() => {
  const PANES = [
    { key: 'threads', id: 'threads-rail', mainClass: 'threads-collapsed', toggleBtn: 'btn-threads-toggle', mobileBtn: 'btn-threads' },
    { key: 'files',   id: 'files-pane',   mainClass: 'files-collapsed',   toggleBtn: 'btn-files-toggle',   mobileBtn: 'btn-files'   },
  ];
  const state = { groupId: null, path: '', file: null, groups: [], isAdmin: false, paneOpen: { threads: true, files: true } };
  const uploadState = { items: [], dragDepth: 0 };
  const chat = {
    groupId: null,
    threadId: null,
    channelType: 'web',
    messagingGroupId: null,
    sessionMode: 'per-thread',
    sessionId: null,
    ws: null,
    reconnectTimer: null,
    reconnectAttempt: 0,
    pollTimer: null,
    threadsPollTimer: null,
    lastSeenTs: '',
    pending: [],
    contextDismissed: false,
    threads: [],
  };
  let suppressHashCount = 0;

  const UPLOAD_MAX_FILE_SIZE = 25 * 1024 * 1024;
  const UPLOAD_MAX_TOTAL_SIZE = 50 * 1024 * 1024;
  const UPLOAD_MAX_FILES = 10;
  const MOBILE_MQ = window.matchMedia('(max-width: 720px)');

  // Channel metadata for the thread rail + composer banner.
  const CHANNEL_META = {
    web:      { label: 'Web',      icon: '💬' },
    resend:   { label: 'Email',    icon: '📧' },
    discord:  { label: 'Discord',  icon: '👾' },
    telegram: { label: 'Telegram', icon: '✈️' },
    whatsapp: { label: 'WhatsApp', icon: '📞' },
    imessage: { label: 'iMessage', icon: '💬' },
    signal:   { label: 'Signal',   icon: '🔒' },
    slack:    { label: 'Slack',    icon: '#'  },
    matrix:   { label: 'Matrix',   icon: 'M'  },
    gchat:    { label: 'Chat',     icon: 'G'  },
  };
  const POLL_INTERVAL_MS = 10000;
  function channelMeta(ct) { return CHANNEL_META[ct] || { label: ct || 'Channel', icon: '•' }; }

  const $ = (id) => document.getElementById(id);

  // ── http ──────────────────────────────────────────────────────────────
  async function api(url, opts) {
    const r = await fetch(url, Object.assign({ credentials: 'same-origin' }, opts || {}));
    if (r.status === 401) {
      document.body.innerHTML =
        '<div style="padding:24px;font:14px system-ui">Not logged in. Visit the magic link your operator sent you.</div>';
      throw new Error('unauthorized');
    }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  function applyAdminFlag() {
    const g = state.groups.find((x) => x.id === state.groupId);
    state.isAdmin = !!(g && g.isAdmin);
    document.body.classList.toggle('is-admin', state.isAdmin);
  }

  // ── format helpers ───────────────────────────────────────────────────
  function fmtBytes(n) {
    if (n == null) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' K';
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' M';
    return (n / 1024 / 1024 / 1024).toFixed(1) + ' G';
  }
  function fmtBytesShort(n) {
    if (!n && n !== 0) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }
  function fmtRelative(ts) {
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
  function fmtAbsolute(ts) {
    if (!ts) return '';
    const norm = ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z';
    const t = Date.parse(norm);
    if (!t) return '';
    return new Date(t).toLocaleString();
  }
  function tsHTML(ts, cls) {
    const rel = fmtRelative(ts);
    if (!rel) return '';
    return `<span class="${cls || 'ts'}" title="${escapeAttr(fmtAbsolute(ts))}">${escapeHtml(rel)}</span>`;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }
  function parentPath(p) { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }
  function emptyDiv(text) { const d = document.createElement('div'); d.className = 'empty'; d.textContent = text; return d; }
  function renderMarkdown(text) {
    if (typeof window.marked === 'undefined') return null;
    try { return window.marked.parse(text || '', { breaks: true, gfm: true }); } catch (_) { return null; }
  }

  // Rewrite relative-path markdown links inside a chat message to point at
  // the file-browser file endpoint, so references like
  // [sick_day_v2.mp3](sick_day_v2.mp3) become clickable. Also auto-linkify
  // bare backtick-quoted filename-like tokens (e.g. `sick_day_v2.mp3`).
  // Plain left-click opens the file in the preview pane; middle/cmd-click
  // falls through to the href and opens in a new tab.
  function rewriteFileLinks(root) {
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
        navFile(entry).catch(console.error);
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

  // ── hash routing ──────────────────────────────────────────────────────
  function parseHash() {
    const raw = location.hash.replace(/^#/, '');
    if (!raw) return null;
    const qIdx = raw.indexOf('?');
    const pathPart = qIdx < 0 ? raw : raw.slice(0, qIdx);
    const params = new URLSearchParams(qIdx < 0 ? '' : raw.slice(qIdx + 1));
    const threadId = params.get('t') || null;
    const channelType = params.get('c') || null;
    const messagingGroupId = params.get('mg') || null;
    const h = decodeURI(pathPart);
    const base = { threadId, channelType, messagingGroupId };
    if (!h) return threadId ? { groupId: '', path: '', isDir: true, ...base } : null;
    const slash = h.indexOf('/');
    if (slash < 0) return { groupId: h, path: '', isDir: true, ...base };
    const groupId = h.slice(0, slash);
    const rest = h.slice(slash + 1);
    const isDir = rest === '' || rest.endsWith('/');
    const path = isDir ? rest.replace(/\/$/, '') : rest;
    return { groupId, path, isDir, ...base };
  }

  function writeHash() {
    if (!state.groupId) return;
    let h = '#' + encodeURI(state.groupId);
    if (state.file) h += '/' + encodeURI(state.file);
    else if (state.path) h += '/' + encodeURI(state.path) + '/';
    if (chat.threadId && chat.groupId === state.groupId) {
      h += '?t=' + encodeURIComponent(chat.threadId);
      if (chat.channelType && chat.channelType !== 'web') {
        h += '&c=' + encodeURIComponent(chat.channelType);
        if (chat.messagingGroupId) h += '&mg=' + encodeURIComponent(chat.messagingGroupId);
      }
    }
    if (location.hash !== h) { suppressHashCount++; location.hash = h; }
  }

  async function applyHash() {
    const parsed = parseHash();
    if (!parsed) {
      if (state.groups.length) await selectGroup(state.groups[0].id);
      return;
    }
    if (!state.groups.find((g) => g.id === parsed.groupId)) {
      setPreview('<div class="empty">No access to group ' + escapeHtml(parsed.groupId) + '</div>');
      return;
    }
    const groupChanged = state.groupId !== parsed.groupId;
    state.groupId = parsed.groupId;
    state.file = null;
    applyAdminFlag();
    syncGroupSelect();
    if (groupChanged) {
      await loadThreads(parsed.groupId);
    }
    if (parsed.threadId) {
      const ctx = parsed.channelType && parsed.channelType !== 'web' && parsed.messagingGroupId
        ? { channelType: parsed.channelType, messagingGroupId: parsed.messagingGroupId }
        : null;
      openChat(parsed.groupId, parsed.threadId, ctx).catch((err) => console.error('chat open failed', err));
    } else if (groupChanged) {
      // Brand new group selection without an explicit thread — auto-resume
      // the most recent one if any, else show empty chat.
      const latest = chat.threads.length > 0 ? chat.threads[0] : null;
      if (latest) openChat(parsed.groupId, latest.threadId, threadCtx(latest)).catch((err) => console.error('chat open failed', err));
      else clearChat();
    }
    if (parsed.isDir) {
      await loadTree(parsed.path);
    } else {
      const parent = parentPath(parsed.path);
      await loadTree(parent);
      const name = parent ? parsed.path.slice(parent.length + 1) : parsed.path;
      await selectFile({ path: parsed.path, name });
    }
  }

  // ── init ──────────────────────────────────────────────────────────────
  async function init() {
    const me = await api('api/me');
    $('me').textContent = me.userId;
    const { groups } = await api('api/groups');
    state.groups = sortGroups(groups);
    populateGroupSelect();
    if (!state.groups.length) {
      setPreview('<div class="empty">No accessible groups.</div>');
      return;
    }
    restorePanelState();
    wireGlobalEvents();
    window.addEventListener('hashchange', () => {
      if (suppressHashCount > 0) { suppressHashCount--; return; }
      applyHash().catch(console.error);
    });
    await applyHash();
  }

  function sortGroups(groups) {
    return groups.slice().sort((a, b) => {
      const ta = a.lastActivityAt ? Date.parse(a.lastActivityAt.includes('T') ? a.lastActivityAt : a.lastActivityAt.replace(' ', 'T') + 'Z') : 0;
      const tb = b.lastActivityAt ? Date.parse(b.lastActivityAt.includes('T') ? b.lastActivityAt : b.lastActivityAt.replace(' ', 'T') + 'Z') : 0;
      if (tb !== ta) return tb - ta;
      return a.name.localeCompare(b.name);
    });
  }

  function populateGroupSelect() {
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

  function syncGroupSelect() {
    const sel = $('group-select');
    if (sel.value !== state.groupId) sel.value = state.groupId || '';
  }

  // ── group / files ────────────────────────────────────────────────────
  async function selectGroup(id) {
    state.groupId = id;
    state.path = '';
    state.file = null;
    applyAdminFlag();
    clearUploadStrip();
    syncGroupSelect();
    await loadThreads(id);
    // Periodically refresh the thread rail so newly-arrived inbound
    // threads (e.g. fresh email) appear without a manual reload.
    if (chat.threadsPollTimer) { clearInterval(chat.threadsPollTimer); chat.threadsPollTimer = null; }
    chat.threadsPollTimer = setInterval(() => {
      if (state.groupId === id) loadThreads(id).catch(() => {});
      else { clearInterval(chat.threadsPollTimer); chat.threadsPollTimer = null; }
    }, 20000);
    await loadTree('');
    onSelectionChanged();
    // Auto-resume most recent thread on group switch.
    const latest = chat.threads.length > 0 ? chat.threads[0] : null;
    if (latest) {
      // openChat writes the hash with ?t=… included.
      openChat(id, latest.threadId, threadCtx(latest)).catch((err) => console.error('chat open failed', err));
    } else {
      clearChat();
      chat.groupId = id;
      chat.threadId = null;
      writeHash();
    }
  }

  async function loadTree(p) {
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
      const icon = e.type === 'dir' ? '📁' : '📄';
      row.innerHTML = `<div>${icon}</div><div class="name">${escapeHtml(e.name)}</div>`
        + `<div class="size">${fmtBytes(e.size)}</div>`
        + `<div class="meta">${tsHTML(e.mtime)}</div>`
        + `<div class="row-actions admin-only">`
        +   `<button type="button" class="act-ren" title="Rename">✎</button>`
        +   `<button type="button" class="act-del" title="Delete">🗑</button>`
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

  async function navTree(p) { await loadTree(p); writeHash(); }
  async function navFile(entry) {
    await selectFile(entry);
    writeHash();
    if (MOBILE_MQ.matches) openFilesDrawerIfMobile();
    else if (!state.paneOpen.files) togglePane('files');
  }

  async function selectFile(entry) {
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

  function setPreview(html) {
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
    // Keep current segment in view when path is long
    requestAnimationFrame(() => { c.scrollLeft = c.scrollWidth; });
  }

  // ── threads ──────────────────────────────────────────────────────────
  async function loadThreads(groupId) {
    try {
      const { threads } = await api(`api/groups/${encodeURIComponent(groupId)}/chat/threads`);
      chat.threads = threads || [];
    } catch (err) {
      console.error('threads load failed', err);
      chat.threads = [];
    }
    renderThreads();
  }

  function threadCtx(t) {
    if (!t) return null;
    if (!t.channelType || t.channelType === 'web') return null;
    return { channelType: t.channelType, messagingGroupId: t.messagingGroupId };
  }

  function renderThreads() {
    const list = $('threads-list');
    list.innerHTML = '';
    if (chat.threads.length === 0) { list.appendChild(emptyDiv('No chats yet')); return; }
    for (const t of chat.threads) {
      const ct = t.channelType || 'web';
      const meta = channelMeta(ct);
      const pill = ct !== 'web'
        ? `<span class="ch-pill" title="${escapeHtml(meta.label)}${t.counterparty ? ' · ' + escapeHtml(t.counterparty) : ''}">${meta.icon}</span>`
        : '';
      const row = document.createElement('div');
      row.className = 'thread' + (t.threadId === chat.threadId ? ' active' : '');
      row.dataset.id = t.threadId;
      const subMeta = `${tsHTML(t.lastActivityAt)}${t.messageCount ? ' · ' + t.messageCount + ' msg' : ''}${
        ct !== 'web' && t.counterparty ? ' · ' + escapeHtml(t.counterparty) : ''}`;
      const delBtn = ct === 'web' ? '<button type="button" class="del" title="Delete chat" aria-label="Delete chat">×</button>' : '';
      row.innerHTML = `
        <div class="title">${pill}${escapeHtml(t.title)}</div>
        <div class="meta">${subMeta}</div>
        ${delBtn}`;
      row.addEventListener('click', (ev) => {
        if (ev.target.classList.contains('del')) return;
        openChat(state.groupId, t.threadId, threadCtx(t)).catch((err) => console.error('chat open failed', err));
        closeMobileDrawers();
      });
      const del = row.querySelector('.del');
      if (del) del.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        if (!confirm(`Delete this chat?\n\n"${t.title}"`)) return;
        await deleteThread(t.threadId);
      });
      list.appendChild(row);
    }
  }

  async function deleteThread(threadId) {
    try {
      const r = await fetch(`api/groups/${encodeURIComponent(state.groupId)}/chat/${encodeURIComponent(threadId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!r.ok) { setChatStatus('delete failed (HTTP ' + r.status + ')'); return; }
    } catch (err) {
      console.error('delete failed', err);
      setChatStatus('delete failed: ' + (err.message || 'network error'));
      return;
    }
    chat.threads = chat.threads.filter((x) => x.threadId !== threadId);
    if (chat.threadId === threadId) {
      // Active thread was deleted — fall back to most recent, or empty.
      const latest = chat.threads.length > 0 ? chat.threads[0] : null;
      if (latest) openChat(state.groupId, latest.threadId, threadCtx(latest)).catch(console.error);
      else { clearChat(); chat.threadId = null; writeHash(); }
    }
    renderThreads();
  }

  function bumpActiveThread(maxTs) {
    if (!chat.threadId) return;
    const idx = chat.threads.findIndex((x) => x.threadId === chat.threadId);
    if (idx < 0) {
      // New thread the rail hasn't seen yet — refetch.
      loadThreads(state.groupId);
      return;
    }
    const t = chat.threads[idx];
    t.lastActivityAt = maxTs || new Date().toISOString();
    t.messageCount = (t.messageCount || 0) + 1;
    chat.threads.splice(idx, 1);
    chat.threads.unshift(t);
    renderThreads();
  }

  function updateActiveThreadTitleFromFirstMessage(text) {
    if (!chat.threadId) return;
    const t = chat.threads.find((x) => x.threadId === chat.threadId);
    if (t && t.title === '(new chat)') {
      const clean = String(text || '').replace(/^>\s*Context[^\n]*\n+/i, '').replace(/\s+/g, ' ').trim();
      if (clean) { t.title = clean.slice(0, 60); renderThreads(); }
    }
  }

  // ── chat ─────────────────────────────────────────────────────────────
  function clearChat() {
    $('chat-log').innerHTML = '<div class="empty">Pick or start a chat.</div>';
    setChatStatus('');
    stopChatPoll();
    if (chat.ws) { try { chat.ws.close(); } catch (_) {} chat.ws = null; }
    if (chat.reconnectTimer) { clearTimeout(chat.reconnectTimer); chat.reconnectTimer = null; }
    chat.channelType = 'web';
    chat.messagingGroupId = null;
    chat.lastSeenTs = '';
    setComposerMode('web');
  }

  function setComposerMode(channelType) {
    const form = $('chat-form');
    const banner = $('chat-readonly');
    const isReadOnly = channelType && channelType !== 'web';
    if (form) form.style.display = isReadOnly ? 'none' : '';
    if (banner) {
      banner.hidden = !isReadOnly;
      if (isReadOnly) {
        const meta = channelMeta(channelType);
        banner.textContent = `Read-only view — reply on ${meta.label} to continue this thread.`;
      } else {
        banner.textContent = '';
      }
    }
  }

  function stopChatPoll() {
    if (chat.pollTimer) { clearInterval(chat.pollTimer); chat.pollTimer = null; }
  }

  function startChatPoll() {
    stopChatPoll();
    chat.pollTimer = setInterval(async () => {
      if (!chat.threadId || chat.channelType === 'web') { stopChatPoll(); return; }
      try { await refetchThreadHistory(/*appendNewOnly*/ true); } catch (err) { console.error('poll failed', err); }
    }, POLL_INTERVAL_MS);
  }

  function historyUrl(groupId, threadId) {
    let u = `api/groups/${encodeURIComponent(groupId)}/chat/${encodeURIComponent(threadId)}/history`;
    if (chat.channelType && chat.channelType !== 'web' && chat.messagingGroupId) {
      u += `?channel=${encodeURIComponent(chat.channelType)}&mg=${encodeURIComponent(chat.messagingGroupId)}`;
    }
    return u;
  }

  async function refetchThreadHistory(appendNewOnly) {
    const groupId = chat.groupId, threadId = chat.threadId;
    const r = await fetch(historyUrl(groupId, threadId), { credentials: 'same-origin' });
    if (!r.ok) return;
    const { messages } = await r.json();
    if (!Array.isArray(messages)) return;
    // Compare timestamps numerically. Inbound rows are ISO 8601
    // (`...T...Z`), outbound rows come from the container as SQLite local
    // `YYYY-MM-DD HH:MM:SS`. A raw string compare is wrong (the 'T' at
    // pos 10 sorts after the space) and made every poll re-append every
    // inbound row — fmtRelative normalizes, but the > check didn't.
    const tsKey = (s) => {
      if (!s) return 0;
      const norm = s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
      const n = Date.parse(norm);
      return Number.isFinite(n) ? n : 0;
    };
    if (!appendNewOnly) {
      $('chat-log').innerHTML = '';
      for (const msg of messages) appendChatMsg(msg.direction === 'in' ? 'in' : 'out', msg.text, msg.files || null, msg.timestamp);
      if (messages.length > 0) chat.lastSeenTs = messages[messages.length - 1].timestamp || '';
      return;
    }
    const seenKey = tsKey(chat.lastSeenTs);
    let maxTs = chat.lastSeenTs;
    let maxKey = seenKey;
    let bumped = false;
    for (const msg of messages) {
      const ts = msg.timestamp || '';
      const k = tsKey(ts);
      if (!seenKey || k > seenKey) {
        appendChatMsg(msg.direction === 'in' ? 'in' : 'out', msg.text, msg.files || null, ts);
        if (k > maxKey) { maxKey = k; maxTs = ts; }
        bumped = true;
        if (msg.direction !== 'in') maybeNotify(msg.text, msg.files || []);
      }
    }
    if (bumped) {
      chat.lastSeenTs = maxTs || chat.lastSeenTs;
      bumpActiveThread(maxTs);
    }
  }

  function setChatStatus(text) { $('chat-status').textContent = text || ''; }

  function appendChatMsg(kind, text, files, ts) {
    const log = $('chat-log');
    // Clear the placeholder on first append.
    const placeholder = log.querySelector('.empty');
    if (placeholder) log.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + kind;
    const md = renderMarkdown(text);
    if (md != null) { wrap.classList.add('markdown'); wrap.innerHTML = md; rewriteFileLinks(wrap); }
    else wrap.textContent = text || '';
    if (files && files.length) {
      const fl = document.createElement('div');
      fl.className = 'files';
      fl.textContent = files.map((f) => `📎 ${f.filename} (${fmtBytes(f.size)})`).join('  ');
      wrap.appendChild(fl);
    }
    const metaHTML = tsHTML(ts || new Date().toISOString(), 'meta');
    if (metaHTML) {
      const meta = document.createElement('div');
      meta.innerHTML = metaHTML;
      wrap.appendChild(meta.firstChild);
    }
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
  }

  async function openChat(groupId, resumeThreadId, opts) {
    // Idempotent: re-opening the same thread is a no-op. Prevents races
    // where two hashchanges (or a hashchange + an explicit click) both try
    // to reload the same thread and double-render history.
    if (resumeThreadId && chat.groupId === groupId && chat.threadId === resumeThreadId) return;
    if (chat.ws) { try { chat.ws.close(); } catch (_) {} chat.ws = null; }
    if (chat.reconnectTimer) { clearTimeout(chat.reconnectTimer); chat.reconnectTimer = null; }
    stopChatPoll();
    chat.groupId = groupId;
    chat.threadId = null;
    chat.reconnectAttempt = 0;
    chat.lastSeenTs = '';
    $('chat-log').innerHTML = '';

    // Resolve channel context. Explicit opts win; else try the thread rail
    // entry; else default to web.
    let channelType = 'web', messagingGroupId = null;
    if (opts && opts.channelType) {
      channelType = opts.channelType;
      messagingGroupId = opts.messagingGroupId || null;
    } else if (resumeThreadId) {
      const t = chat.threads.find((x) => x.threadId === resumeThreadId);
      if (t && t.channelType && t.channelType !== 'web') {
        channelType = t.channelType;
        messagingGroupId = t.messagingGroupId || null;
      }
    }
    chat.channelType = channelType;
    chat.messagingGroupId = messagingGroupId;
    setComposerMode(channelType);

    if (resumeThreadId) {
      chat.threadId = resumeThreadId;
      renderThreads();
      writeHash();
      setChatStatus('loading history…');
      try {
        const r = await fetch(historyUrl(groupId, resumeThreadId), { credentials: 'same-origin' });
        if (r.ok) {
          const { messages } = await r.json();
          for (const msg of messages || []) appendChatMsg(msg.direction === 'in' ? 'in' : 'out', msg.text, msg.files || null, msg.timestamp);
          if (Array.isArray(messages) && messages.length > 0) chat.lastSeenTs = messages[messages.length - 1].timestamp || '';
        }
      } catch (err) { console.error('history load failed', err); }
      if (channelType === 'web') connectChatWs();
      else { setChatStatus(''); startChatPoll(); }
      return;
    }

    // New chat is web-only.
    chat.channelType = 'web';
    chat.messagingGroupId = null;
    setComposerMode('web');
    setChatStatus('starting…');
    let started;
    try {
      const r = await fetch(`api/groups/${encodeURIComponent(groupId)}/chat/start`, {
        method: 'POST', credentials: 'same-origin',
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      started = await r.json();
    } catch (err) { setChatStatus('failed to start chat: ' + err.message); return; }
    chat.threadId = started.threadId;
    // Optimistically add the new thread to the rail.
    chat.threads.unshift({
      threadId: started.threadId,
      sessionId: started.sessionId || null,
      channelType: 'web',
      messagingGroupId: started.messagingGroupId || null,
      sessionMode: started.sessionMode || 'per-thread',
      title: '(new chat)',
      lastActivityAt: new Date().toISOString(),
      messageCount: 0,
    });
    renderThreads();
    writeHash();
    connectChatWs();
  }

  function connectChatWs() {
    if (!chat.groupId || !chat.threadId) return;
    const groupId = chat.groupId;
    const threadId = chat.threadId;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${location.host}/ui/files/api/groups/${encodeURIComponent(groupId)}/chat/${encodeURIComponent(threadId)}/ws`;
    const ws = new WebSocket(wsUrl);
    chat.ws = ws;
    ws.onopen = () => { chat.reconnectAttempt = 0; setChatStatus('connected'); };
    ws.onclose = () => {
      if (chat.ws !== ws) return;
      chat.ws = null;
      if (chat.groupId !== groupId || chat.threadId !== threadId) return;
      const attempt = ++chat.reconnectAttempt;
      const delay = Math.min(15000, 500 * Math.pow(2, attempt - 1));
      setChatStatus(`disconnected · reconnecting in ${Math.round(delay / 1000)}s…`);
      chat.reconnectTimer = setTimeout(() => {
        chat.reconnectTimer = null;
        if (chat.groupId === groupId && chat.threadId === threadId) connectChatWs();
      }, delay);
    };
    ws.onerror = () => setChatStatus('connection error');
    ws.onmessage = (ev) => {
      let payload; try { payload = JSON.parse(ev.data); } catch (_) { return; }
      if (payload.kind === 'ready') return;
      if (payload.kind === 'inbound') {
        appendChatMsg('in', payload.text, payload.files || null, payload.timestamp);
        updateActiveThreadTitleFromFirstMessage(payload.text);
        bumpActiveThread();
        return;
      }
      if (payload.kind === 'outbound') {
        const c = payload.content || {};
        const text = typeof c === 'string' ? c : (c.text || c.markdown || '');
        appendChatMsg('out', text, payload.files || [], payload.timestamp);
        bumpActiveThread();
        maybeNotify(text, payload.files || []);
        return;
      }
    };
  }

  async function sendChat(text, files) {
    if (!chat.groupId || !chat.threadId) return;
    const hasFiles = Array.isArray(files) && files.length > 0;
    try {
      let res;
      if (hasFiles) {
        const fd = new FormData();
        fd.append('text', text || '');
        for (const f of files) fd.append('file', f, f.name);
        res = await fetch(`api/groups/${encodeURIComponent(chat.groupId)}/chat/${encodeURIComponent(chat.threadId)}/send`, {
          method: 'POST', credentials: 'same-origin', body: fd,
        });
      } else {
        res = await fetch(`api/groups/${encodeURIComponent(chat.groupId)}/chat/${encodeURIComponent(chat.threadId)}/send`, {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
      }
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try { const j = await res.json(); if (j && j.error) detail = j.error + (j.detail ? ` (${j.detail})` : ''); } catch (_) {}
        setChatStatus(`send failed: ${detail}`);
      }
    } catch (err) {
      console.error('send failed', err);
      setChatStatus(`send failed: ${err && err.message ? err.message : 'network error'}`);
    }
  }

  // ── pending uploads ──────────────────────────────────────────────────
  function renderPending() {
    const tray = $('chat-pending');
    if (!tray) return;
    if (chat.pending.length === 0) { tray.hidden = true; tray.innerHTML = ''; return; }
    tray.hidden = false;
    tray.innerHTML = '';
    chat.pending.forEach((f, i) => {
      const item = document.createElement('span');
      item.className = 'item';
      item.textContent = `📎 ${f.name} (${fmtBytesShort(f.size)})`;
      const x = document.createElement('button');
      x.type = 'button'; x.textContent = '×'; x.title = 'Remove';
      x.addEventListener('click', () => { chat.pending.splice(i, 1); renderPending(); });
      item.appendChild(x);
      tray.appendChild(item);
    });
  }

  function addPendingFiles(files) {
    if (!files || files.length === 0) return;
    let totalBytes = chat.pending.reduce((n, f) => n + f.size, 0);
    for (const f of files) {
      if (chat.pending.length >= UPLOAD_MAX_FILES) { setChatStatus(`max ${UPLOAD_MAX_FILES} files per message`); break; }
      if (f.size > UPLOAD_MAX_FILE_SIZE) { setChatStatus(`${f.name} too large (max ${fmtBytesShort(UPLOAD_MAX_FILE_SIZE)})`); continue; }
      if (totalBytes + f.size > UPLOAD_MAX_TOTAL_SIZE) { setChatStatus(`total upload too large (max ${fmtBytesShort(UPLOAD_MAX_TOTAL_SIZE)})`); break; }
      chat.pending.push(f);
      totalBytes += f.size;
    }
    renderPending();
  }

  // ── context chip ─────────────────────────────────────────────────────
  function currentContextPath() {
    if (!state.groupId) return null;
    if (state.file) return { path: state.file, kind: 'file' };
    if (state.path) return { path: state.path.replace(/\/?$/, '/'), kind: 'dir' };
    // Root folder isn't useful context — skip the chip entirely.
    return null;
  }

  function renderContextChip() {
    const el = $('chat-context');
    if (!el) return;
    const ctx = currentContextPath();
    if (!ctx || chat.contextDismissed) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = '';
    const chip = document.createElement('span');
    chip.className = 'chip';
    const icon = ctx.kind === 'dir' ? '📁' : '📄';
    chip.innerHTML = `<span>${icon}</span><span class="path" title="${escapeHtml(ctx.path)}">${escapeHtml(ctx.path)}</span>`;
    const x = document.createElement('button');
    x.type = 'button'; x.textContent = '×'; x.title = 'Don\u2019t include this in next message';
    x.addEventListener('click', () => { chat.contextDismissed = true; renderContextChip(); });
    chip.appendChild(x);
    el.appendChild(chip);
  }

  function onSelectionChanged() { chat.contextDismissed = false; renderContextChip(); }

  // ── panel toggle / mobile drawers ────────────────────────────────────
  function restorePanelState() {
    try {
      for (const p of PANES) {
        const v = localStorage.getItem(`nc:pane:${p.key}`);
        if (v !== null) state.paneOpen[p.key] = v === '1';
      }
    } catch (_) { /* private mode */ }
    applyPanelClasses();
  }

  function persistPanelState() {
    try {
      for (const p of PANES) localStorage.setItem(`nc:pane:${p.key}`, state.paneOpen[p.key] ? '1' : '0');
    } catch (_) {}
  }

  function applyPanelClasses() {
    const main = $('main');
    const mobile = MOBILE_MQ.matches;
    for (const p of PANES) {
      const open = state.paneOpen[p.key];
      // Desktop grid + .collapsed pane class only apply on desktop. On
      // mobile the panes are drawers driven by .open and the desktop
      // grid layout is replaced by a single-column flow.
      main.classList.toggle(p.mainClass, !mobile && !open);
      $(p.id).classList.toggle('collapsed', !mobile && !open);
    }
  }

  function stopPreviewMedia() {
    const pv = $('preview');
    if (!pv) return;
    for (const m of pv.querySelectorAll('audio, video')) {
      try { m.pause(); m.currentTime = 0; } catch (_) {}
    }
  }

  function togglePane(key) {
    state.paneOpen[key] = !state.paneOpen[key];
    if (key === 'files' && !state.paneOpen.files) stopPreviewMedia();
    applyPanelClasses();
    persistPanelState();
  }

  function openFilesDrawerIfMobile() {
    if (!MOBILE_MQ.matches) return;
    for (const p of PANES) $(p.id).classList.toggle('open', p.key === 'files');
    $('backdrop').classList.add('show');
  }

  function closeMobileDrawers() {
    if ($('files-pane').classList.contains('open') && $('files-pane').classList.contains('previewing')) stopPreviewMedia();
    for (const p of PANES) $(p.id).classList.remove('open');
    $('backdrop').classList.remove('show');
  }

  // ── notifications (tab-open / installed-PWA) ─────────────────────────
  const NOTIF_MUTE_KEY = 'nanoclaw:notif:muted';
  function notifMuted() { try { return localStorage.getItem(NOTIF_MUTE_KEY) === '1'; } catch (_) { return false; } }
  function setNotifMuted(v) { try { localStorage.setItem(NOTIF_MUTE_KEY, v ? '1' : '0'); } catch (_) {} }
  function wireNotifButton() {
    const btn = document.getElementById('btn-notif');
    if (!btn) return;
    if (!('Notification' in window)) return; // unsupported → leave hidden
    btn.hidden = false;
    refreshNotifButton();
    btn.addEventListener('click', async () => {
      if (Notification.permission === 'denied') {
        alert('Notifications are blocked. Enable them in your browser/OS settings for this site.');
        return;
      }
      if (Notification.permission === 'granted') {
        setNotifMuted(!notifMuted());
        refreshNotifButton();
        return;
      }
      try { await Notification.requestPermission(); } catch (_) {}
      if (Notification.permission === 'granted') setNotifMuted(false);
      refreshNotifButton();
    });
  }
  function refreshNotifButton() {
    const btn = document.getElementById('btn-notif');
    if (!btn) return;
    const p = Notification.permission;
    const muted = p === 'granted' && notifMuted();
    btn.textContent = p === 'denied' || muted ? '🔕' : '🔔';
    btn.title = p === 'denied'
      ? 'Notifications blocked'
      : p === 'granted'
        ? (muted ? 'Notifications muted — click to enable' : 'Notifications enabled — click to mute')
        : 'Enable notifications';
    btn.style.opacity = p === 'granted' && !muted ? '1' : '0.6';
  }
  function maybeNotify(text, files) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (notifMuted()) return;
    if (!document.hidden) return; // tab visible → user already sees the message
    try {
      const groupId = chat.groupId || state.groupId || '';
      const g = state.groups.find((x) => x.id === groupId);
      const title = g && g.name ? g.name : 'NanoClaw';
      let body = (text || '').trim().slice(0, 200);
      if (!body && files && files.length) body = `📎 ${files.length} file${files.length > 1 ? 's' : ''}`;
      const n = new Notification(title, { body, icon: 'ui/icon.svg', tag: `${groupId}:${chat.threadId || ''}` });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (_) {}
  }

  function toggleMobileDrawer(which) {
    const target = $(PANES.find((p) => p.key === which).id);
    const willOpen = !target.classList.contains('open');
    if ($('files-pane').classList.contains('open') && !(which === 'files' && willOpen)) stopPreviewMedia();
    for (const p of PANES) $(p.id).classList.toggle('open', p.key === which && willOpen);
    $('backdrop').classList.toggle('show', willOpen);
  }

  // ── write ops (admin-only) ───────────────────────────────────────────
  function curDir() { return state.path || ''; }
  function joinPath(dir, name) { return dir ? (dir + '/' + name) : name; }
  function baseName(p) { const i = p.lastIndexOf('/'); return i < 0 ? p : p.slice(i + 1); }

  async function postJson(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json().catch(() => ({})) : {};
    return { ok: res.ok, status: res.status, data };
  }

  async function mkdirPrompt() {
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

  async function touchPrompt() {
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

  async function renameEntry(entry) {
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

  async function deleteEntry(entry) {
    if (!state.isAdmin) return;
    if (!confirm(`Delete ${entry.type === 'dir' ? 'folder' : 'file'} "${entry.name}"?`)) return;
    const r = await postJson(`api/groups/${state.groupId}/delete`, { path: entry.path });
    if (!r.ok) { alert('delete failed: ' + (r.data.error || r.status)); return; }
    await loadTree(state.path);
  }

  // ── upload + progress strip ──────────────────────────────────────────
  function clearUploadStrip() {
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

  async function uploadFiles(fileList) {
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

  function setupDragDrop() {
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

  // ── wiring ───────────────────────────────────────────────────────────
  function wireGlobalEvents() {
    $('btn-new-chat').addEventListener('click', () => {
      if (!state.groupId) return;
      openChat(state.groupId, null).then(() => { $('chat-input').focus(); closeMobileDrawers(); }).catch(console.error);
    });
    const logoutForm = document.getElementById('logout-form');
    if (logoutForm) {
      logoutForm.addEventListener('submit', (e) => {
        if (MOBILE_MQ.matches && !window.confirm('Log out?')) e.preventDefault();
      });
    }
    wireNotifButton();
    const btnUpload = document.getElementById('btn-upload');
    const btnMkdir = document.getElementById('btn-mkdir');
    const uploadInput = document.getElementById('upload-input');
    if (btnUpload && uploadInput) {
      btnUpload.addEventListener('click', () => uploadInput.click());
      uploadInput.addEventListener('change', () => {
        if (uploadInput.files && uploadInput.files.length) uploadFiles(uploadInput.files);
        uploadInput.value = '';
      });
    }
    if (btnMkdir) btnMkdir.addEventListener('click', () => mkdirPrompt());
    const btnTouch = document.getElementById('btn-touch');
    if (btnTouch) btnTouch.addEventListener('click', () => touchPrompt());
    setupDragDrop();
    // .nc-pane component: bind expand/collapse click handlers on each pane.
    // Clicks on the head toggle in both states; clicks on the collapsed
    // body also toggle. Interactive children (button, a) are exempt. All
    // toggling is desktop-only — on mobile the same pane is a drawer.
    function registerPane(p) {
      const pane = $(p.id);
      if (!pane) return;
      const toggle = () => togglePane(p.key);
      const headEl = pane.querySelector(':scope > .head');
      if (headEl) headEl.addEventListener('click', (ev) => {
        if (ev.target.closest('button, a')) return;
        if (MOBILE_MQ.matches) return;
        ev.stopPropagation();
        toggle();
      });
      pane.addEventListener('click', (ev) => {
        if (state.paneOpen[p.key]) return;
        if (ev.target.closest('button, a')) return;
        if (MOBILE_MQ.matches) return;
        toggle();
      });
      if (p.toggleBtn) $(p.toggleBtn)?.addEventListener('click', toggle);
      if (p.mobileBtn) $(p.mobileBtn)?.addEventListener('click', () => toggleMobileDrawer(p.key));
    }
    for (const p of PANES) registerPane(p);
    MOBILE_MQ.addEventListener('change', applyPanelClasses);
    $('backdrop').addEventListener('click', closeMobileDrawers);

    $('chat-form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const input = $('chat-input');
      const text = input.value.trim();
      const files = chat.pending.slice();
      if (!text && files.length === 0) return;
      const ctx = !chat.contextDismissed ? currentContextPath() : null;
      const fullText = ctx ? `> Context (file browser): \`${ctx.path}\`\n\n${text}` : text;
      input.value = '';
      chat.pending = [];
      renderPending();
      chat.contextDismissed = false;
      renderContextChip();
      sendChat(fullText, files).catch(console.error);
    });

    $('chat-input').addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); $('chat-form').requestSubmit(); }
    });

    const attachBtn = $('chat-attach');
    const fileInput = $('chat-file');
    if (attachBtn && fileInput) {
      attachBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => { addPendingFiles(Array.from(fileInput.files || [])); fileInput.value = ''; });
    }

    const chatEl = $('chat-main');
    if (chatEl) {
      let dragDepth = 0;
      chatEl.addEventListener('dragenter', (ev) => {
        if (!ev.dataTransfer || ev.dataTransfer.types.indexOf('Files') < 0) return;
        ev.preventDefault(); dragDepth++; chatEl.classList.add('drag-active');
      });
      chatEl.addEventListener('dragover', (ev) => {
        if (!ev.dataTransfer || ev.dataTransfer.types.indexOf('Files') < 0) return;
        ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy';
      });
      chatEl.addEventListener('dragleave', () => {
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) chatEl.classList.remove('drag-active');
      });
      chatEl.addEventListener('drop', (ev) => {
        if (!ev.dataTransfer) return;
        ev.preventDefault();
        dragDepth = 0;
        chatEl.classList.remove('drag-active');
        const files = Array.from(ev.dataTransfer.files || []);
        if (files.length > 0) addPendingFiles(files);
      });
    }

    $('chat-input').addEventListener('paste', (ev) => {
      const items = ev.clipboardData && ev.clipboardData.files;
      if (!items || items.length === 0) return;
      ev.preventDefault();
      addPendingFiles(Array.from(items));
    });

    setupViewportFit();
  }

  // Keep body height equal to the visualViewport so the chat composer is not
  // hidden behind the mobile virtual keyboard. Also scroll the input into view
  // when it gains focus.
  function setupViewportFit() {
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () => {
      document.documentElement.style.setProperty('--app-height', vv.height + 'px');
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    const input = $('chat-input');
    if (input) {
      input.addEventListener('focus', () => {
        setTimeout(() => {
          try { input.scrollIntoView({ block: 'end', behavior: 'smooth' }); } catch {}
        }, 250);
      });
    }
  }

  init().catch((err) => console.error(err));
})();
