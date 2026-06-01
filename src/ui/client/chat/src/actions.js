// Action orchestrators. Mutate signals + perform IO. Components dispatch
// these from event handlers; effects use them on dependency change.
import { batch } from '@preact/signals';
import {
  groupId, threads, threadId, channelType, messagingGroupId, canSend,
  chatMessages, chatStatus, chatLoading, isTyping, typingHint, refs, treePath, filePath, treeEntries,
  treeError, pending, previewBlock, paneOpen, drawerOpen,
  isMobile, nowTick, pinnedContext, POLL_INTERVAL_MS, THREADS_POLL_MS,
} from './state.js';
import { api } from './api.js';
import { writeHash } from './hash.js';
import { maybeNotify } from './notify.js';
import { parentPath } from './utils.js';

// ── threads ─────────────────────────────────────────────────────────
export async function loadThreads(gid) {
  try {
    const { threads: t } = await api(`api/groups/${encodeURIComponent(gid)}/chat/threads`);
    threads.value = t || [];
  } catch (err) {
    console.error('threads load failed', err);
    threads.value = [];
  }
}

export async function deleteThread(tid) {
  try {
    const r = await fetch(`api/groups/${encodeURIComponent(groupId.value)}/chat/${encodeURIComponent(tid)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    if (!r.ok) { chatStatus.value = 'delete failed (HTTP ' + r.status + ')'; return; }
  } catch (err) {
    console.error('delete failed', err);
    chatStatus.value = 'delete failed: ' + (err.message || 'network error');
    return;
  }
  threads.value = threads.value.filter((x) => x.threadId !== tid);
  if (threadId.value === tid) {
    const latest = threads.value.length > 0 ? threads.value[0] : null;
    if (latest) openChat(groupId.value, latest.threadId, threadCtxOf(latest)).catch(console.error);
    else clearChat();
  }
}

function threadCtxOf(t) {
  if (!t || !t.channelType || t.channelType === 'web') return null;
  return { channelType: t.channelType, messagingGroupId: t.messagingGroupId, canSend: !!t.canSend };
}

function bumpActiveThread(maxTs) {
  if (!threadId.value) return;
  const list = threads.value.slice();
  const idx = list.findIndex((x) => x.threadId === threadId.value);
  if (idx < 0) { loadThreads(groupId.value); return; }
  const t = { ...list[idx] };
  t.lastActivityAt = maxTs || new Date().toISOString();
  t.messageCount = (t.messageCount || 0) + 1;
  list.splice(idx, 1);
  list.unshift(t);
  threads.value = list;
}

function updateActiveThreadTitleFromFirstMessage(text) {
  if (!threadId.value) return;
  const list = threads.value.slice();
  const idx = list.findIndex((x) => x.threadId === threadId.value);
  if (idx < 0) return;
  const t = list[idx];
  if (t.title !== '(new chat)') return;
  const clean = String(text || '').replace(/^>\s*Context[^\n]*\n+/i, '').replace(/\s+/g, ' ').trim();
  if (!clean) return;
  list[idx] = { ...t, title: clean.slice(0, 60) };
  threads.value = list;
}

// ── chat ────────────────────────────────────────────────────────────
export function clearChat() {
  batch(() => {
    chatMessages.value = [];
    chatStatus.value = '';
    chatLoading.value = false;
    threadId.value = null;
    channelType.value = 'web';
    messagingGroupId.value = null;
    canSend.value = true;
  });
  stopChatPoll();
  if (refs.ws) { try { refs.ws.close(); } catch (_) {} refs.ws = null; }
  if (refs.reconnectTimer) { clearTimeout(refs.reconnectTimer); refs.reconnectTimer = null; }
  refs.seenIds.clear();
}

export function stopChatPoll() {
  if (refs.pollTimer) { clearInterval(refs.pollTimer); refs.pollTimer = null; }
}

export function startChatPoll() {
  stopChatPoll();
  refs.pollTimer = setInterval(async () => {
    if (!threadId.value || channelType.value === 'web') { stopChatPoll(); return; }
    try { await refetchThreadHistory(true); } catch (err) { console.error('poll failed', err); }
  }, POLL_INTERVAL_MS);
}

function historyUrl(gid, tid) {
  let u = `api/groups/${encodeURIComponent(gid)}/chat/${encodeURIComponent(tid)}/history`;
  if (channelType.value && channelType.value !== 'web' && messagingGroupId.value) {
    u += `?channel=${encodeURIComponent(channelType.value)}&mg=${encodeURIComponent(messagingGroupId.value)}`;
  }
  return u;
}

function appendMsg(direction, text, files, ts, id) {
  // Dedup against history refetch by stable per-row id. Live WS pushes
  // carry `id` (messages_in.id / messages_out.id); optimistic local
  // bubbles for non-web sends pass no id and rely on the post-send full
  // refetch (refetchThreadHistory(false)) to reconcile.
  const key = id ? `${direction}:${id}` : null;
  if (key && refs.seenIds.has(key)) return;
  if (key) refs.seenIds.add(key);
  chatMessages.value = chatMessages.value.concat({ direction, text, files: files || null, ts });
}

function normDirection(d) {
  return d === 'in' ? 'in' : d === 'internal' ? 'internal' : 'out';
}

async function refetchThreadHistory(appendNewOnly) {
  const gid = groupId.value, tid = threadId.value;
  const r = await fetch(historyUrl(gid, tid), { credentials: 'same-origin', cache: 'no-store' });
  if (!r.ok) return;
  const { messages } = await r.json();
  if (!Array.isArray(messages)) return;
  if (!appendNewOnly) {
    chatMessages.value = messages.map((m) => ({
      direction: normDirection(m.direction),
      text: m.text,
      files: m.files || null,
      ts: m.timestamp,
    }));
    refs.seenIds = new Set(messages.filter((m) => m.id).map((m) => `${normDirection(m.direction)}:${m.id}`));
    return;
  }
  let maxTs = '';
  const additions = [];
  for (const m of messages) {
    const direction = normDirection(m.direction);
    const key = m.id ? `${direction}:${m.id}` : null;
    if (key && refs.seenIds.has(key)) continue;
    const ts = m.timestamp || '';
    additions.push({ direction, text: m.text, files: m.files || null, ts });
    if (key) refs.seenIds.add(key);
    if (ts > maxTs) maxTs = ts;
    if (direction === 'out') maybeNotify(m.text, m.files || []);
  }
  if (additions.length) {
    chatMessages.value = chatMessages.value.concat(additions);
    bumpActiveThread(maxTs);
  }
}

export async function openChat(gid, resumeTid, opts) {
  // Idempotent: re-opening the same thread is a no-op.
  if (resumeTid && groupId.value === gid && threadId.value === resumeTid) return;
  if (refs.ws) { try { refs.ws.close(); } catch (_) {} refs.ws = null; }
  if (refs.reconnectTimer) { clearTimeout(refs.reconnectTimer); refs.reconnectTimer = null; }
  stopChatPoll();
  refs.reconnectAttempt = 0;

  let ct = 'web', mg = null, cs = true;
  if (opts && opts.channelType) {
    ct = opts.channelType; mg = opts.messagingGroupId || null; cs = !!opts.canSend;
  } else if (resumeTid) {
    const t = threads.value.find((x) => x.threadId === resumeTid);
    if (t && t.channelType && t.channelType !== 'web') { ct = t.channelType; mg = t.messagingGroupId || null; cs = !!t.canSend; }
  }

  batch(() => {
    groupId.value = gid;
    chatMessages.value = [];
    channelType.value = ct;
    messagingGroupId.value = mg;
    canSend.value = ct === 'web' ? true : cs;
    isTyping.value = false;
    typingHint.value = '';
    if (resumeTid) {
      threadId.value = resumeTid;
      chatLoading.value = true;
      chatStatus.value = 'loading history\u2026';
    }
  });

  if (resumeTid) {
    // threadId + loading flag landed in the batch above so MessageLog
    // doesn't paint "No messages yet" between threadId set and history.
    writeHash();
    try {
      const r = await fetch(historyUrl(gid, resumeTid), { credentials: 'same-origin', cache: 'no-store' });
      if (r.ok) {
        const { messages } = await r.json();
        batch(() => {
          chatMessages.value = (messages || []).map((m) => ({
            direction: normDirection(m.direction),
            text: m.text,
            files: m.files || null,
            ts: m.timestamp,
          }));
          chatLoading.value = false;
        });
        if (Array.isArray(messages)) {
          refs.seenIds = new Set(messages.filter((m) => m.id).map((m) => `${normDirection(m.direction)}:${m.id}`));
        }
      } else {
        chatLoading.value = false;
      }
    } catch (err) { console.error('history load failed', err); chatLoading.value = false; }
    if (ct === 'web') connectChatWs();
    else { chatStatus.value = ''; startChatPoll(); }
    return;
  }

  // New web chat.
  batch(() => { channelType.value = 'web'; messagingGroupId.value = null; canSend.value = true; });
  chatStatus.value = 'starting\u2026';
  let started;
  try {
    const r = await fetch(`api/groups/${encodeURIComponent(gid)}/chat/start`, { method: 'POST', credentials: 'same-origin' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    started = await r.json();
  } catch (err) { chatStatus.value = 'failed to start chat: ' + err.message; return; }
  threadId.value = started.threadId;
  threads.value = [{
    threadId: started.threadId,
    sessionId: started.sessionId || null,
    channelType: 'web',
    messagingGroupId: started.messagingGroupId || null,
    sessionMode: started.sessionMode || 'per-thread',
    title: '(new chat)',
    lastActivityAt: new Date().toISOString(),
    messageCount: 0,
  }, ...threads.value];
  writeHash();
  connectChatWs();
}

function connectChatWs() {
  if (!groupId.value || !threadId.value) return;
  const gid = groupId.value, tid = threadId.value;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${proto}//${location.host}/ui/chat/api/groups/${encodeURIComponent(gid)}/chat/${encodeURIComponent(tid)}/ws`;
  const ws = new WebSocket(wsUrl);
  refs.ws = ws;
  ws.onopen = () => {
    const wasReconnect = refs.reconnectAttempt > 0;
    refs.reconnectAttempt = 0;
    chatStatus.value = 'connected';
    // Catch up on any messages that arrived while we were disconnected
    // (phone asleep, network blip, server restart). Safe on initial
    // connect too — it's a no-op when no new rows exist.
    if (wasReconnect) {
      refetchThreadHistory(true).catch((err) => console.error('reconnect catchup failed', err));
    }
  };
  ws.onclose = () => {
    if (refs.ws !== ws) return;
    refs.ws = null;
    isTyping.value = false;
    typingHint.value = '';
    if (groupId.value !== gid || threadId.value !== tid) return;
    const attempt = ++refs.reconnectAttempt;
    const delay = Math.min(15000, 500 * Math.pow(2, attempt - 1));
    chatStatus.value = `disconnected \u00b7 reconnecting in ${Math.round(delay / 1000)}s\u2026`;
    refs.reconnectTimer = setTimeout(() => {
      refs.reconnectTimer = null;
      if (groupId.value === gid && threadId.value === tid) connectChatWs();
    }, delay);
  };
  ws.onerror = () => { chatStatus.value = 'connection error'; };
  ws.onmessage = (ev) => {
    let payload; try { payload = JSON.parse(ev.data); } catch (_) { return; }
    if (payload.kind === 'ready') return;
    if (payload.kind === 'typing') { isTyping.value = !!payload.on; typingHint.value = payload.hint || ''; return; }
    if (payload.kind === 'inbound') {
      appendMsg('in', payload.text, payload.files || null, payload.timestamp, payload.id);
      updateActiveThreadTitleFromFirstMessage(payload.text);
      bumpActiveThread();
      return;
    }
    if (payload.kind === 'outbound') {
      const c = payload.content || {};
      const text = typeof c === 'string' ? c : (c.text || c.markdown || '');
      const dir = payload.messageKind === 'internal' ? 'internal' : 'out';
      appendMsg(dir, text, payload.files || [], payload.timestamp, payload.id);
      bumpActiveThread();
      if (dir === 'out') maybeNotify(text, payload.files || []);
      return;
    }
  };
}

export async function sendChat(text, files) {
  if (!groupId.value || !threadId.value) return;
  const isWeb = !channelType.value || channelType.value === 'web';
  const hasFiles = Array.isArray(files) && files.length > 0;
  // Cross-channel sends have no live tail — paint the user's bubble
  // immediately, then reconcile via a full refetch after success.
  if (!isWeb) {
    const now = new Date().toISOString();
    const fileMetas = hasFiles ? files.map((f) => ({ filename: f.name, size: f.size })) : null;
    // 'in' = viewer's own bubble (see chat-main CSS); 'out' is the agent.
    // No id — the server-truth row arrives via the post-send full refetch
    // (refetchThreadHistory(false)) which wipes optimistic bubbles and
    // rebuilds seenIds from scratch.
    appendMsg('in', text || '', fileMetas, now);
  }
  let url = `api/groups/${encodeURIComponent(groupId.value)}/chat/${encodeURIComponent(threadId.value)}/send`;
  if (!isWeb && messagingGroupId.value) {
    url += `?channel=${encodeURIComponent(channelType.value)}&mg=${encodeURIComponent(messagingGroupId.value)}`;
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
      chatStatus.value = `send failed: ${detail}`;
    } else if (!isWeb) {
      // Reconcile the optimistic bubble against server truth: the server
      // logs the relayed message in inbound with its own clock. If server
      // ts > client ts (any skew), the next poll would append a duplicate.
      try { await refetchThreadHistory(false); } catch (_) {}
    }
  } catch (err) {
    console.error('send failed', err);
    chatStatus.value = `send failed: ${err && err.message ? err.message : 'network error'}`;
  }
}

// ── files ───────────────────────────────────────────────────────────
function startThreadsPoll(gid) {
  if (refs.threadsPollTimer) { clearInterval(refs.threadsPollTimer); refs.threadsPollTimer = null; }
  refs.threadsPollTimer = setInterval(() => {
    if (groupId.value === gid) loadThreads(gid).catch(() => {});
    else { clearInterval(refs.threadsPollTimer); refs.threadsPollTimer = null; }
  }, THREADS_POLL_MS);
}

export async function selectGroup(gid) {
  batch(() => {
    groupId.value = gid;
    treePath.value = '';
    filePath.value = null;
  });
  await loadThreads(gid);
  startThreadsPoll(gid);
  await loadTree('');
  const latest = threads.value.length > 0 ? threads.value[0] : null;
  if (latest) {
    openChat(gid, latest.threadId, threadCtxOf(latest)).catch((err) => console.error('chat open failed', err));
  } else {
    clearChat();
    writeHash();
  }
}

export async function loadTree(p) {
  batch(() => {
    treePath.value = p;
    filePath.value = null;
    previewBlock.value = null;
    treeError.value = '';
    treeEntries.value = [];
  });
  try {
    const { entries } = await api(`api/groups/${encodeURIComponent(groupId.value)}/tree?path=${encodeURIComponent(p)}`);
    treeEntries.value = entries || [];
  } catch (err) {
    const msg = /HTTP 404/.test(String(err && err.message)) ? 'Not found. It may have been renamed or deleted.' : String(err && err.message || err);
    treeError.value = msg;
  }
}

export async function navTree(p) { await loadTree(p); writeHash(); }

export async function navFile(entry) {
  // Make sure the files pane is visible so the preview is actually seen.
  if (isMobile.value) drawerOpen.files.value = true;
  else paneOpen.files.value = true;
  // Sync the tree to the file's directory so the breadcrumb reflects
  // where the previewed file lives (and the listing matches once the
  // user closes the preview). loadTree clears filePath/previewBlock, so
  // it has to run before selectFile.
  const parent = parentPath(entry.path);
  if (treePath.value !== parent) await loadTree(parent);
  await selectFile(entry);
  writeHash();
}

export async function selectFile(entry) {
  filePath.value = entry.path;
  const url = `api/groups/${encodeURIComponent(groupId.value)}/file?path=${encodeURIComponent(entry.path)}`;
  let size = entry.size, mtime = entry.mtime;
  try {
    const h = await fetch(url, { method: 'HEAD', credentials: 'same-origin' });
    if (h.status >= 400) {
      const msg = h.status === 404 ? 'File not found. It may have been renamed or deleted.' : `HTTP ${h.status}`;
      previewBlock.value = { kind: 'error', text: msg, name: entry.name, url };
      return;
    }
    if (size == null) { const cl = h.headers.get('content-length'); if (cl) size = Number(cl); }
    if (!mtime) {
      const lm = h.headers.get('last-modified');
      if (lm) { const t = Date.parse(lm); if (t) mtime = new Date(t).toISOString(); }
    }
  } catch (_) {}
  const ext = entry.name.toLowerCase().split('.').pop();
  const meta = { name: entry.name, size, mtime, url, path: entry.path };
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) previewBlock.value = { kind: 'image', ...meta };
  else if (['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac', 'weba'].includes(ext)) previewBlock.value = { kind: 'audio', ...meta };
  else if (['mp4', 'm4v', 'mov', 'webm', 'ogv'].includes(ext)) previewBlock.value = { kind: 'video', ...meta };
  else if (ext === 'pdf') previewBlock.value = { kind: 'pdf', ...meta };
  else {
    try {
      const r = await fetch(url, { credentials: 'same-origin' });
      if (!r.ok) { previewBlock.value = { kind: 'error', text: `HTTP ${r.status}`, ...meta }; return; }
      const ctType = r.headers.get('content-type') || '';
      if (ctType.startsWith('text/') || ctType.includes('json') || ctType.includes('xml')) {
        const txt = await r.text();
        const isMd = ext === 'md' || ext === 'markdown';
        previewBlock.value = { kind: isMd ? 'markdown' : 'text', text: txt, ...meta };
      } else {
        previewBlock.value = { kind: 'binary', mime: ctType, ...meta };
      }
    } catch (err) {
      previewBlock.value = { kind: 'error', text: String(err && err.message || err), ...meta };
    }
  }
  // Fire embedded-metadata fetch for every previewable kind. Cheap on
  // the server for non-media (readMediaTags exits immediately when the
  // ext isn't audio/video/image). Fills in authoritative size/mtime/mime
  // from the server so the file-meta panel is populated even when the
  // tree entry didn't carry them.
  fetchAndAttachMeta(entry.path).catch(() => {});
}

async function fetchAndAttachMeta(p) {
  const gid = groupId.value;
  const u = `api/groups/${encodeURIComponent(gid)}/meta?path=${encodeURIComponent(p)}`;
  const r = await fetch(u, { credentials: 'same-origin', cache: 'no-store' });
  if (!r.ok) return;
  const data = await r.json();
  // Race guard: user may have navigated to a different file in the meantime.
  const cur = previewBlock.value;
  if (!cur || cur.path !== p) return;
  previewBlock.value = {
    ...cur,
    tags: data.tags || null,
    lyrics: data.lyrics || null,
    mime: data.mime || cur.mime,
    size: data.size ?? cur.size,
    mtime: data.mtime || cur.mtime,
  };
}

export function closePreview() {
  batch(() => { filePath.value = null; previewBlock.value = null; });
  writeHash();
}

// ── pinned file-browser context ────────────────────────────────────
export function togglePinnedFile(path) {
  if (!path) return;
  const cur = pinnedContext.value;
  pinnedContext.value = cur.includes(path) ? cur.filter((p) => p !== path) : cur.concat(path);
}
export function removePinnedPath(path) {
  pinnedContext.value = pinnedContext.value.filter((p) => p !== path);
}
export function clearPinnedContext() { pinnedContext.value = []; }

// ── pending uploads in composer ─────────────────────────────────────
export function addPendingFiles(fileList, max, maxSize, maxTotal) {
  if (!fileList || fileList.length === 0) return;
  const next = pending.value.slice();
  let totalBytes = next.reduce((n, f) => n + f.size, 0);
  for (const f of fileList) {
    if (next.length >= max) { chatStatus.value = `max ${max} files per message`; break; }
    if (f.size > maxSize) { chatStatus.value = `${f.name} too large (max ${(maxSize / 1024 / 1024).toFixed(0)} MB)`; continue; }
    if (totalBytes + f.size > maxTotal) { chatStatus.value = `total upload too large (max ${(maxTotal / 1024 / 1024).toFixed(0)} MB)`; break; }
    next.push(f);
    totalBytes += f.size;
  }
  pending.value = next;
}

export function removePending(i) {
  const next = pending.value.slice();
  next.splice(i, 1);
  pending.value = next;
}

export function clearPending() { pending.value = []; }

// ── liveness / catchup ──────────────────────────────────────────────
// Keep relative-time labels fresh and recover messages missed while the
// tab/phone was asleep. Two triggers:
//   - 30s interval bumps nowTick so <RelativeTime> re-renders.
//   - visibilitychange → visible: bump nowTick immediately, refetch
//     any new messages (dedup'd by row id against refs.seenIds), and
//     force the WS to reconnect if it's not currently open (mobile
//     OSes routinely silently kill sockets on resume without firing
//     onclose).
const NOW_TICK_MS = 30000;
export function installLivenessHandlers() {
  setInterval(() => { if (!document.hidden) nowTick.value = Date.now(); }, NOW_TICK_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    nowTick.value = Date.now();
    if (!threadId.value) return;
    refetchThreadHistory(true).catch((err) => console.error('resume catchup failed', err));
    const ws = refs.ws;
    const open = ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING);
    if (channelType.value === 'web' && !open) {
      if (refs.reconnectTimer) { clearTimeout(refs.reconnectTimer); refs.reconnectTimer = null; }
      connectChatWs();
    }
  });
}

