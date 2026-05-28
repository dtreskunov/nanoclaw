// Minimal vanilla file browser client.
// URL hash format: #<groupId>/<path>[/]
//   no hash               → first accessible group, root
//   #ag-xyz               → group root
//   #ag-xyz/sub/dir/      → directory (trailing slash)
//   #ag-xyz/sub/file.txt  → file (no trailing slash)
(() => {
  const state = { groupId: null, path: '', file: null, groups: [] };
  let suppressHash = false;

  const $ = (id) => document.getElementById(id);

  async function api(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (r.status === 401) {
      document.body.innerHTML =
        '<div style="padding:24px;font:14px system-ui">Not logged in. Visit the magic link your operator sent you.</div>';
      throw new Error('unauthorized');
    }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  function fmtBytes(n) {
    if (n == null) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' K';
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' M';
    return (n / 1024 / 1024 / 1024).toFixed(1) + ' G';
  }

  // ── hash routing ──────────────────────────────────────────────────────
  // Hash format: #<groupId>/<path>[/]?t=<threadId>
  // The ?t= suffix preserves the active chat thread across page reloads.
  function parseHash() {
    const raw = location.hash.replace(/^#/, '');
    if (!raw) return null;
    const qIdx = raw.indexOf('?');
    const pathPart = qIdx < 0 ? raw : raw.slice(0, qIdx);
    const queryPart = qIdx < 0 ? '' : raw.slice(qIdx + 1);
    const params = new URLSearchParams(queryPart);
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
    if (state.file) {
      h += '/' + encodeURI(state.file);
    } else if (state.path) {
      h += '/' + encodeURI(state.path) + '/';
    }
    if (chat.threadId && chat.groupId === state.groupId) {
      h += '?t=' + encodeURIComponent(chat.threadId);
    }
    if (location.hash !== h) {
      suppressHash = true;
      location.hash = h;
    }
  }

  async function applyHash() {
    const parsed = parseHash();
    if (!parsed) {
      if (state.groups.length) await selectGroup(state.groups[0].id);
      return;
    }
    if (!state.groups.find((g) => g.id === parsed.groupId)) {
      $('preview').innerHTML = '<div class="empty">No access to group ' + escapeHtml(parsed.groupId) + '</div>';
      return;
    }
    const groupChanged = state.groupId !== parsed.groupId;
    state.groupId = parsed.groupId;
    state.file = null;
    highlightGroup();
    if (groupChanged) {
      openChat(parsed.groupId, parsed.threadId).catch((err) => console.error('chat open failed', err));
    }
    if (parsed.isDir) {
      await loadTree(parsed.path);
      $('preview').innerHTML = '<div class="empty">Select a file</div>';
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
    state.groups = groups;
    const nav = $('groups');
    nav.innerHTML = '';
    if (!groups.length) {
      nav.innerHTML = '<div class="empty">No accessible groups.</div>';
      return;
    }
    for (const g of groups) {
      const row = document.createElement('div');
      row.className = 'group';
      row.dataset.id = g.id;
      row.innerHTML = `<div>${escapeHtml(g.name)}${g.isAdmin ? ' <span class="meta">admin</span>' : ''}</div><div class="meta">${escapeHtml(g.folder)}</div>`;
      row.onclick = () => selectGroup(g.id);
      nav.appendChild(row);
    }
    window.addEventListener('hashchange', () => {
      if (suppressHash) {
        suppressHash = false;
        return;
      }
      applyHash().catch(console.error);
    });
    await applyHash();
  }

  function highlightGroup() {
    for (const el of document.querySelectorAll('nav .group')) {
      el.classList.toggle('active', el.dataset.id === state.groupId);
    }
  }

  async function selectGroup(id) {
    state.groupId = id;
    state.path = '';
    state.file = null;
    highlightGroup();
    await loadTree('');
    $('preview').innerHTML = '<div class="empty">Select a file</div>';
    writeHash();
    openChat(id).catch((err) => console.error('chat open failed', err));
  }

  async function loadTree(p) {
    state.path = p;
    state.file = null;
    renderCrumb(p);
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
    if (!entries.length) {
      list.appendChild(emptyDiv('Empty directory'));
      return;
    }
    for (const e of entries) {
      const row = document.createElement('div');
      row.className = 'row tier-' + e.tier;
      row.dataset.path = e.path;
      const icon = e.type === 'dir' ? '📁' : '📄';
      row.innerHTML = `<div>${icon}</div><div class="name">${escapeHtml(e.name)}</div><div class="size">${fmtBytes(e.size)}</div>`;
      row.onclick = () => {
        if (e.type === 'dir') navTree(e.path);
        else navFile(e);
      };
      list.appendChild(row);
    }
  }

  async function navTree(p) {
    await loadTree(p);
    writeHash();
  }

  async function navFile(entry) {
    await selectFile(entry);
    writeHash();
  }

  async function selectFile(entry) {
    state.file = entry.path;
    for (const el of document.querySelectorAll('.listing .row')) {
      el.classList.toggle('active', el.dataset.path === entry.path);
    }
    const url = `api/groups/${encodeURIComponent(state.groupId)}/file?path=${encodeURIComponent(entry.path)}`;
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
    // Default: try text.
    const r = await fetch(url, { credentials: 'same-origin' });
    if (!r.ok) {
      pv.innerHTML = `<div class="empty">HTTP ${r.status}</div>`;
      return;
    }
    const ct = r.headers.get('content-type') || '';
    if (ct.startsWith('text/') || ct.includes('json') || ct.includes('xml')) {
      const t = await r.text();
      if (ext === 'md' || ext === 'markdown') {
        const html = renderMarkdown(t);
        if (html != null) {
          pv.innerHTML = `<div class="markdown-preview"></div><div style="margin:8px 16px"><a href="${url}" download="${escapeHtml(entry.name)}">Download</a></div>`;
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
    for (const a of c.querySelectorAll('a')) {
      a.onclick = () => navTree(a.dataset.path);
    }
  }

  function parentPath(p) {
    const i = p.lastIndexOf('/');
    return i < 0 ? '' : p.slice(0, i);
  }

  function emptyDiv(text) {
    const d = document.createElement('div');
    d.className = 'empty';
    d.textContent = text;
    return d;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(s) {
    return escapeHtml(s);
  }

  init().catch((err) => console.error(err));

  // ── chat side panel ───────────────────────────────────────────────────
  const chat = { groupId: null, threadId: null, ws: null, reconnectTimer: null, reconnectAttempt: 0 };

  function setChatStatus(text) {
    $('chat-status').textContent = text;
  }

  function renderMarkdown(text) {
    if (typeof window.marked === 'undefined') return null;
    try {
      return window.marked.parse(text || '', { breaks: true, gfm: true });
    } catch (_) {
      return null;
    }
  }

  function appendChatMsg(kind, text, files) {
    const log = $('chat-log');
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + kind;
    // Render both inbound (user echo) and outbound (agent) as markdown.
    const md = renderMarkdown(text);
    if (md != null) {
      wrap.classList.add('markdown');
      wrap.innerHTML = md;
    } else {
      wrap.textContent = text || '';
    }
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
    // Tear down any prior session for the previously-selected group.
    if (chat.ws) {
      try { chat.ws.close(); } catch (_) { /* swallow */ }
      chat.ws = null;
    }
    if (chat.reconnectTimer) {
      clearTimeout(chat.reconnectTimer);
      chat.reconnectTimer = null;
    }
    chat.groupId = groupId;
    chat.threadId = null;
    chat.reconnectAttempt = 0;
    $('chat').hidden = false;
    $('chat-log').innerHTML = '';

    if (resumeThreadId) {
      // Resume existing thread — skip /start, load history, then connect WS.
      chat.threadId = resumeThreadId;
      setChatStatus('loading history…');
      try {
        const r = await fetch(
          `api/groups/${encodeURIComponent(groupId)}/chat/${encodeURIComponent(resumeThreadId)}/history`,
          { credentials: 'same-origin' },
        );
        if (r.ok) {
          const { messages } = await r.json();
          for (const msg of messages || []) {
            appendChatMsg(msg.direction === 'in' ? 'in' : 'out', msg.text, msg.files || null);
          }
        }
      } catch (err) {
        console.error('history load failed', err);
      }
      connectChatWs();
      return;
    }

    setChatStatus('connecting…');
    let started;
    try {
      const r = await fetch(`api/groups/${encodeURIComponent(groupId)}/chat/start`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      started = await r.json();
    } catch (err) {
      setChatStatus('failed to start chat: ' + err.message);
      return;
    }
    chat.threadId = started.threadId;
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
    ws.onopen = () => {
      chat.reconnectAttempt = 0;
      setChatStatus('connected');
    };
    ws.onclose = () => {
      if (chat.ws !== ws) return;
      chat.ws = null;
      // Only reconnect if the user hasn't switched groups.
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
      let payload;
      try { payload = JSON.parse(ev.data); } catch (_) { return; }
      if (payload.kind === 'ready') return;
      if (payload.kind === 'inbound') {
        appendChatMsg('in', payload.text, null);
        return;
      }
      if (payload.kind === 'outbound') {
        const c = payload.content || {};
        const text = typeof c === 'string' ? c : (c.text || c.markdown || '');
        appendChatMsg('out', text, payload.files || []);
        return;
      }
    };
  }

  async function sendChat(text) {
    if (!chat.groupId || !chat.threadId) return;
    try {
      await fetch(`api/groups/${encodeURIComponent(chat.groupId)}/chat/${encodeURIComponent(chat.threadId)}/send`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    } catch (err) {
      console.error('send failed', err);
    }
  }

  $('chat-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const input = $('chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    sendChat(text).catch(console.error);
  });

  $('chat-input').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      $('chat-form').requestSubmit();
    }
  });
})();
