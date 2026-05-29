// Threads rail + chat thread (history, WebSocket, send, pending attachments).
import { state, chat, channelMeta, POLL_INTERVAL_MS, UPLOAD_MAX_FILE_SIZE, UPLOAD_MAX_TOTAL_SIZE, UPLOAD_MAX_FILES } from './state.js';
import { $, escapeHtml, escapeAttr, tsHTML, fmtBytes, fmtBytesShort, emptyDiv, renderMarkdown, rewriteFileLinks } from './utils.js';
import { api } from './api.js';
import { writeHash } from './hash.js';
import { closeMobileDrawers, maybeNotify } from './panels.js';
import { navFile } from './files.js';

// ── threads ──────────────────────────────────────────────────────────
export async function loadThreads(groupId) {
  try {
    const { threads } = await api(`api/groups/${encodeURIComponent(groupId)}/chat/threads`);
    chat.threads = threads || [];
  } catch (err) {
    console.error('threads load failed', err);
    chat.threads = [];
  }
  renderThreads();
}

export function threadCtx(t) {
  if (!t) return null;
  if (!t.channelType || t.channelType === 'web') return null;
  return { channelType: t.channelType, messagingGroupId: t.messagingGroupId, canSend: !!t.canSend };
}

export function renderThreads() {
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

export async function deleteThread(threadId) {
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
    const latest = chat.threads.length > 0 ? chat.threads[0] : null;
    if (latest) openChat(state.groupId, latest.threadId, threadCtx(latest)).catch(console.error);
    else { clearChat(); chat.threadId = null; writeHash(); }
  }
  renderThreads();
}

export function bumpActiveThread(maxTs) {
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

export function updateActiveThreadTitleFromFirstMessage(text) {
  if (!chat.threadId) return;
  const t = chat.threads.find((x) => x.threadId === chat.threadId);
  if (t && t.title === '(new chat)') {
    const clean = String(text || '').replace(/^>\s*Context[^\n]*\n+/i, '').replace(/\s+/g, ' ').trim();
    if (clean) { t.title = clean.slice(0, 60); renderThreads(); }
  }
}

// ── chat ─────────────────────────────────────────────────────────────
export function clearChat() {
  $('chat-log').innerHTML = '<div class="empty">Pick or start a chat.</div>';
  setChatStatus('');
  stopChatPoll();
  if (chat.ws) { try { chat.ws.close(); } catch (_) {} chat.ws = null; }
  if (chat.reconnectTimer) { clearTimeout(chat.reconnectTimer); chat.reconnectTimer = null; }
  chat.channelType = 'web';
  chat.messagingGroupId = null;
  chat.canSend = true;
  chat.lastSeenTs = '';
  setComposerMode('web', true);
}

export function setComposerMode(channelType, canSend) {
  const form = $('chat-form');
  const banner = $('chat-readonly');
  const subnotice = $('chat-subnotice');
  const isWeb = !channelType || channelType === 'web';
  const showComposer = isWeb || canSend;
  if (form) form.style.display = showComposer ? '' : 'none';
  if (banner) {
    banner.hidden = showComposer;
    if (!showComposer) {
      const meta = channelMeta(channelType);
      banner.textContent = `Read-only view — reply on ${meta.label} to continue this thread.`;
    } else {
      banner.textContent = '';
    }
  }
  if (subnotice) {
    if (showComposer && !isWeb) {
      const meta = channelMeta(channelType);
      const t = chat.threads.find((x) => x.threadId === chat.threadId);
      const cp = t && t.counterparty ? ` · ${t.counterparty}` : '';
      subnotice.hidden = false;
      subnotice.textContent = `${meta.icon} Sending via ${meta.label}${cp}`;
    } else {
      subnotice.hidden = true;
      subnotice.textContent = '';
    }
  }
}

export function stopChatPoll() {
  if (chat.pollTimer) { clearInterval(chat.pollTimer); chat.pollTimer = null; }
}

export function startChatPoll() {
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
  // Compare timestamps numerically. Inbound rows are ISO 8601, outbound rows
  // come from the container as SQLite local `YYYY-MM-DD HH:MM:SS`. A raw
  // string compare would treat the 'T' (pos 10) as sorting after the space.
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

export function setChatStatus(text) { $('chat-status').textContent = text || ''; }

export function appendChatMsg(kind, text, files, ts) {
  const log = $('chat-log');
  const placeholder = log.querySelector('.empty');
  if (placeholder) log.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + kind;
  const md = renderMarkdown(text);
  if (md != null) { wrap.classList.add('markdown'); wrap.innerHTML = md; rewriteFileLinks(wrap, navFile); }
  else wrap.textContent = text || '';
  if (files && files.length) {
    const fl = document.createElement('div');
    fl.className = 'files';
    fl.textContent = files.map((f) => `\uD83D\uDCCE ${f.filename} (${fmtBytes(f.size)})`).join('  ');
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

export async function openChat(groupId, resumeThreadId, opts) {
  // Idempotent: re-opening the same thread is a no-op.
  if (resumeThreadId && chat.groupId === groupId && chat.threadId === resumeThreadId) return;
  if (chat.ws) { try { chat.ws.close(); } catch (_) {} chat.ws = null; }
  if (chat.reconnectTimer) { clearTimeout(chat.reconnectTimer); chat.reconnectTimer = null; }
  stopChatPoll();
  chat.groupId = groupId;
  chat.threadId = null;
  chat.reconnectAttempt = 0;
  chat.lastSeenTs = '';
  $('chat-log').innerHTML = '';

  let channelType = 'web', messagingGroupId = null, canSend = true;
  if (opts && opts.channelType) {
    channelType = opts.channelType;
    messagingGroupId = opts.messagingGroupId || null;
    canSend = !!opts.canSend;
  } else if (resumeThreadId) {
    const t = chat.threads.find((x) => x.threadId === resumeThreadId);
    if (t && t.channelType && t.channelType !== 'web') {
      channelType = t.channelType;
      messagingGroupId = t.messagingGroupId || null;
      canSend = !!t.canSend;
    }
  }
  chat.channelType = channelType;
  chat.messagingGroupId = messagingGroupId;
  chat.canSend = channelType === 'web' ? true : canSend;
  setComposerMode(channelType, chat.canSend);

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
  chat.canSend = true;
  setComposerMode('web', true);
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
  const wsUrl = `${proto}//${location.host}/ui/chat/api/groups/${encodeURIComponent(groupId)}/chat/${encodeURIComponent(threadId)}/ws`;
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

export async function sendChat(text, files) {
  if (!chat.groupId || !chat.threadId) return;
  const isWeb = !chat.channelType || chat.channelType === 'web';
  const hasFiles = Array.isArray(files) && files.length > 0;
  // Cross-channel sends have no live tail — paint the user's bubble
  // immediately. The 10s poll re-fetches the same row (logged with
  // _via:'web'); tsKey gate in refetchThreadHistory skips it.
  if (!isWeb) {
    const now = new Date().toISOString();
    const fileMetas = hasFiles ? files.map((f) => ({ filename: f.name, size: f.size })) : null;
    appendChatMsg('out', text || '', fileMetas, now);
    chat.lastSeenTs = now;
  }
  let url = `api/groups/${encodeURIComponent(chat.groupId)}/chat/${encodeURIComponent(chat.threadId)}/send`;
  if (!isWeb && chat.messagingGroupId) {
    url += `?channel=${encodeURIComponent(chat.channelType)}&mg=${encodeURIComponent(chat.messagingGroupId)}`;
  }
  try {
    let res;
    if (hasFiles) {
      const fd = new FormData();
      fd.append('text', text || '');
      for (const f of files) fd.append('file', f, f.name);
      res = await fetch(url, { method: 'POST', credentials: 'same-origin', body: fd });
    } else {
      res = await fetch(url, {
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
export function renderPending() {
  const tray = $('chat-pending');
  if (!tray) return;
  if (chat.pending.length === 0) { tray.hidden = true; tray.innerHTML = ''; return; }
  tray.hidden = false;
  tray.innerHTML = '';
  chat.pending.forEach((f, i) => {
    const item = document.createElement('span');
    item.className = 'item';
    item.textContent = `\uD83D\uDCCE ${f.name} (${fmtBytesShort(f.size)})`;
    const x = document.createElement('button');
    x.type = 'button'; x.textContent = '×'; x.title = 'Remove';
    x.addEventListener('click', () => { chat.pending.splice(i, 1); renderPending(); });
    item.appendChild(x);
    tray.appendChild(item);
  });
}

export function addPendingFiles(files) {
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
