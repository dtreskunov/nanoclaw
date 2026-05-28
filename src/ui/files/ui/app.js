// NanoClaw web UI — single-page app.
// URL hash format: #<groupId>[/<path>[/]][?t=<threadId>]
//   no hash               → most-recently-active accessible group, root
//   #ag-xyz               → group root (no thread)
//   #ag-xyz/sub/dir/      → directory (trailing slash)
//   #ag-xyz/sub/file.txt  → file (no trailing slash)
//   ?t=<threadId> suffix  → active chat thread
(() => {
  const state = { groupId: null, path: '', file: null, groups: [], filesOpen: true, previewOpen: true };
  const chat = {
    groupId: null,
    threadId: null,
    ws: null,
    reconnectTimer: null,
    reconnectAttempt: 0,
    pending: [],
    contextDismissed: false,
    threads: [],
  };
  let suppressHashCount = 0;

  const UPLOAD_MAX_FILE_SIZE = 25 * 1024 * 1024;
  const UPLOAD_MAX_TOTAL_SIZE = 50 * 1024 * 1024;
  const UPLOAD_MAX_FILES = 10;
  const MOBILE_MQ = window.matchMedia('(max-width: 720px)');

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

  // ── hash routing ──────────────────────────────────────────────────────
  function parseHash() {
    const raw = location.hash.replace(/^#/, '');
    if (!raw) return null;
    const qIdx = raw.indexOf('?');
    const pathPart = qIdx < 0 ? raw : raw.slice(0, qIdx);
    const params = new URLSearchParams(qIdx < 0 ? '' : raw.slice(qIdx + 1));
    const threadId = params.get('t') || null;
    const h = decodeURI(pathPart);
    if (!h) return threadId ? { groupId: '', path: '', isDir: true, threadId } : null;
    const slash = h.indexOf('/');
    if (slash < 0) return { groupId: h, path: '', isDir: true, threadId };
    const groupId = h.slice(0, slash);
    const rest = h.slice(slash + 1);
    const isDir = rest === '' || rest.endsWith('/');
    const path = isDir ? rest.replace(/\/$/, '') : rest;
    return { groupId, path, isDir, threadId };
  }

  function writeHash() {
    if (!state.groupId) return;
    let h = '#' + encodeURI(state.groupId);
    if (state.file) h += '/' + encodeURI(state.file);
    else if (state.path) h += '/' + encodeURI(state.path) + '/';
    if (chat.threadId && chat.groupId === state.groupId) {
      h += '?t=' + encodeURIComponent(chat.threadId);
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
    syncGroupSelect();
    if (groupChanged) {
      await loadThreads(parsed.groupId);
    }
    if (parsed.threadId) {
      openChat(parsed.groupId, parsed.threadId).catch((err) => console.error('chat open failed', err));
    } else if (groupChanged) {
      // Brand new group selection without an explicit thread — auto-resume
      // the most recent one if any, else show empty chat.
      const latest = chat.threads.length > 0 ? chat.threads[0].threadId : null;
      if (latest) openChat(parsed.groupId, latest).catch((err) => console.error('chat open failed', err));
      else clearChat();
    }
    if (parsed.isDir) {
      await loadTree(parsed.path);
      setPreview('<div class="empty">No file selected</div>', 'Preview');
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
    syncGroupSelect();
    await loadThreads(id);
    await loadTree('');
    setPreview('<div class="empty">No file selected</div>', 'Preview');
    onSelectionChanged();
    // Auto-resume most recent thread on group switch.
    const latest = chat.threads.length > 0 ? chat.threads[0].threadId : null;
    if (latest) {
      // openChat writes the hash with ?t=… included.
      openChat(id, latest).catch((err) => console.error('chat open failed', err));
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
    renderCrumb(p);
    onSelectionChanged();
    const { entries } = await api(`api/groups/${encodeURIComponent(state.groupId)}/tree?path=${encodeURIComponent(p)}`);
    const list = $('listing');
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
      row.innerHTML = `<div>${icon}</div><div class="name">${escapeHtml(e.name)}</div><div class="size">${fmtBytes(e.size)}</div>`;
      row.onclick = () => { if (e.type === 'dir') navTree(e.path); else navFile(e); };
      list.appendChild(row);
    }
  }

  async function navTree(p) { await loadTree(p); writeHash(); }
  async function navFile(entry) { await selectFile(entry); writeHash(); openPreviewDrawerIfMobile(); }

  async function selectFile(entry) {
    state.file = entry.path;
    for (const el of document.querySelectorAll('.files-pane .row')) {
      el.classList.toggle('active', el.dataset.path === entry.path);
    }
    onSelectionChanged();
    const url = `api/groups/${encodeURIComponent(state.groupId)}/file?path=${encodeURIComponent(entry.path)}`;
    $('preview-title').textContent = entry.name;
    const pv = $('preview');
    const ext = entry.name.toLowerCase().split('.').pop();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
      pv.innerHTML = `<img alt="${escapeHtml(entry.name)}" src="${url}"/>`;
      return;
    }
    if (['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac', 'weba'].includes(ext)) {
      pv.innerHTML = `<audio controls preload="metadata" src="${url}"></audio><div style="margin-top:8px"><a href="${url}" download="${escapeHtml(entry.name)}">Download</a></div>`;
      return;
    }
    if (['mp4', 'm4v', 'mov', 'webm', 'ogv'].includes(ext)) {
      pv.innerHTML = `<video controls preload="metadata" src="${url}" style="max-width:100%;max-height:80vh"></video><div style="margin-top:8px"><a href="${url}" download="${escapeHtml(entry.name)}">Download</a></div>`;
      return;
    }
    if (ext === 'pdf') {
      pv.innerHTML = `<iframe src="${url}" style="width:100%;height:90vh;border:0"></iframe>`;
      return;
    }
    const r = await fetch(url, { credentials: 'same-origin' });
    if (!r.ok) { pv.innerHTML = `<div class="empty">HTTP ${r.status}</div>`; return; }
    const ct = r.headers.get('content-type') || '';
    if (ct.startsWith('text/') || ct.includes('json') || ct.includes('xml')) {
      const t = await r.text();
      if (ext === 'md' || ext === 'markdown') {
        const html = renderMarkdown(t);
        if (html != null) {
          pv.innerHTML = `<div class="markdown-preview"></div><div style="margin:8px 0"><a href="${url}" download="${escapeHtml(entry.name)}">Download</a></div>`;
          pv.querySelector('.markdown-preview').innerHTML = html;
          return;
        }
      }
      pv.innerHTML = `<pre></pre><div style="margin-top:8px"><a href="${url}" download="${escapeHtml(entry.name)}">Download</a></div>`;
      pv.querySelector('pre').textContent = t;
    } else {
      pv.innerHTML = `<div class="empty">Binary file (${escapeHtml(ct)}). <a href="${url}" download="${escapeHtml(entry.name)}">Download</a></div>`;
    }
  }

  function setPreview(html, title) {
    if (title) $('preview-title').textContent = title;
    $('preview').innerHTML = html;
  }

  function renderCrumb(p) {
    const segs = p ? p.split('/') : [];
    const parts = [`<a data-path="">/</a>`];
    let acc = '';
    for (const s of segs) {
      acc = acc ? acc + '/' + s : s;
      parts.push(`<a data-path="${escapeAttr(acc)}">${escapeHtml(s)}</a>`);
    }
    const c = $('crumb');
    c.innerHTML = parts.join(' / ');
    for (const a of c.querySelectorAll('a')) a.onclick = () => navTree(a.dataset.path);
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

  function renderThreads() {
    const list = $('threads-list');
    list.innerHTML = '';
    if (chat.threads.length === 0) { list.appendChild(emptyDiv('No chats yet')); return; }
    for (const t of chat.threads) {
      const row = document.createElement('div');
      row.className = 'thread' + (t.threadId === chat.threadId ? ' active' : '');
      row.dataset.id = t.threadId;
      row.innerHTML = `
        <div class="title">${escapeHtml(t.title)}</div>
        <div class="meta">${fmtRelative(t.lastActivityAt)}${t.messageCount ? ' · ' + t.messageCount + ' msg' : ''}</div>
        <button type="button" class="del" title="Delete chat" aria-label="Delete chat">×</button>`;
      row.addEventListener('click', (ev) => {
        if (ev.target.classList.contains('del')) return;
        openChat(state.groupId, t.threadId).catch((err) => console.error('chat open failed', err));
        closeMobileDrawers();
      });
      row.querySelector('.del').addEventListener('click', async (ev) => {
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
      const latest = chat.threads.length > 0 ? chat.threads[0].threadId : null;
      if (latest) openChat(state.groupId, latest).catch(console.error);
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
    if (chat.ws) { try { chat.ws.close(); } catch (_) {} chat.ws = null; }
    if (chat.reconnectTimer) { clearTimeout(chat.reconnectTimer); chat.reconnectTimer = null; }
  }

  function setChatStatus(text) { $('chat-status').textContent = text || ''; }

  function appendChatMsg(kind, text, files) {
    const log = $('chat-log');
    // Clear the placeholder on first append.
    const placeholder = log.querySelector('.empty');
    if (placeholder) log.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + kind;
    const md = renderMarkdown(text);
    if (md != null) { wrap.classList.add('markdown'); wrap.innerHTML = md; }
    else wrap.textContent = text || '';
    if (files && files.length) {
      const fl = document.createElement('div');
      fl.className = 'files';
      fl.textContent = files.map((f) => `📎 ${f.filename} (${fmtBytes(f.size)})`).join('  ');
      wrap.appendChild(fl);
    }
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
  }

  async function openChat(groupId, resumeThreadId) {
    // Idempotent: re-opening the same thread is a no-op. Prevents races
    // where two hashchanges (or a hashchange + an explicit click) both try
    // to reload the same thread and double-render history.
    if (resumeThreadId && chat.groupId === groupId && chat.threadId === resumeThreadId) return;
    if (chat.ws) { try { chat.ws.close(); } catch (_) {} chat.ws = null; }
    if (chat.reconnectTimer) { clearTimeout(chat.reconnectTimer); chat.reconnectTimer = null; }
    chat.groupId = groupId;
    chat.threadId = null;
    chat.reconnectAttempt = 0;
    $('chat-log').innerHTML = '';

    if (resumeThreadId) {
      chat.threadId = resumeThreadId;
      renderThreads();
      writeHash();
      setChatStatus('loading history…');
      try {
        const r = await fetch(
          `api/groups/${encodeURIComponent(groupId)}/chat/${encodeURIComponent(resumeThreadId)}/history`,
          { credentials: 'same-origin' },
        );
        if (r.ok) {
          const { messages } = await r.json();
          for (const msg of messages || []) appendChatMsg(msg.direction === 'in' ? 'in' : 'out', msg.text, msg.files || null);
        }
      } catch (err) { console.error('history load failed', err); }
      connectChatWs();
      return;
    }

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
        appendChatMsg('in', payload.text, payload.files || null);
        updateActiveThreadTitleFromFirstMessage(payload.text);
        bumpActiveThread();
        return;
      }
      if (payload.kind === 'outbound') {
        const c = payload.content || {};
        const text = typeof c === 'string' ? c : (c.text || c.markdown || '');
        appendChatMsg('out', text, payload.files || []);
        bumpActiveThread();
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
      const f = localStorage.getItem('nc:filesOpen');
      const p = localStorage.getItem('nc:previewOpen');
      state.filesOpen = f === null ? true : f === '1';
      state.previewOpen = p === null ? true : p === '1';
    } catch (_) { /* private mode */ }
    applyPanelClasses();
  }

  function persistPanelState() {
    try {
      localStorage.setItem('nc:filesOpen', state.filesOpen ? '1' : '0');
      localStorage.setItem('nc:previewOpen', state.previewOpen ? '1' : '0');
    } catch (_) {}
  }

  function applyPanelClasses() {
    const main = $('main');
    main.classList.toggle('files-collapsed', !state.filesOpen);
    main.classList.toggle('preview-collapsed', !state.previewOpen);
    $('btn-files-toggle').textContent = state.filesOpen ? '›' : '‹';
    $('btn-preview-toggle').textContent = state.previewOpen ? '›' : '‹';
  }

  function toggleFiles() { state.filesOpen = !state.filesOpen; applyPanelClasses(); persistPanelState(); }
  function togglePreview() { state.previewOpen = !state.previewOpen; applyPanelClasses(); persistPanelState(); }

  function openPreviewDrawerIfMobile() {
    if (!MOBILE_MQ.matches) return;
    // On mobile, picking a file should slide in the preview drawer.
    $('preview-pane').classList.add('open');
    $('files-pane').classList.remove('open');
    $('threads-rail').classList.remove('open');
    $('backdrop').classList.add('show');
  }

  function closeMobileDrawers() {
    $('threads-rail').classList.remove('open');
    $('files-pane').classList.remove('open');
    $('preview-pane').classList.remove('open');
    $('backdrop').classList.remove('show');
  }

  function toggleMobileDrawer(which) {
    const el = which === 'threads' ? $('threads-rail') : $('files-pane');
    const other = which === 'threads' ? $('files-pane') : $('threads-rail');
    other.classList.remove('open');
    $('preview-pane').classList.remove('open');
    const willOpen = !el.classList.contains('open');
    el.classList.toggle('open', willOpen);
    $('backdrop').classList.toggle('show', willOpen);
  }

  // ── wiring ───────────────────────────────────────────────────────────
  function wireGlobalEvents() {
    $('btn-new-chat').addEventListener('click', () => {
      if (!state.groupId) return;
      openChat(state.groupId, null).then(() => { $('chat-input').focus(); closeMobileDrawers(); }).catch(console.error);
    });
    $('btn-files-toggle').addEventListener('click', toggleFiles);
    $('btn-preview-toggle').addEventListener('click', togglePreview);
    $('btn-threads').addEventListener('click', () => toggleMobileDrawer('threads'));
    $('btn-files').addEventListener('click', () => toggleMobileDrawer('files'));
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
  }

  init().catch((err) => console.error(err));
})();
