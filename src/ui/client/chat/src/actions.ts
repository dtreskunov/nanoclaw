// Action orchestrators. Mutate signals + perform IO.
import { batch } from '@preact/signals';
import {
  groupId,
  threads,
  threadId,
  channelType,
  messagingGroupId,
  canSend,
  chatMessages,
  chatStatus,
  chatLoading,
  isTyping,
  typingHint,
  refs,
  treePath,
  filePath,
  treeEntries,
  treeError,
  pending,
  previewBlock,
  paneOpen,
  drawerOpen,
  isMobile,
  nowTick,
  pinnedContext,
  pendingApprovals,
  respondingApprovalIds,
  POLL_INTERVAL_MS,
  THREADS_POLL_MS,
  APPROVALS_POLL_MS,
} from './state';
import { api, postJson } from './api';
import { writeHash } from './hash';
import { maybeNotify } from './notify';
import { parentPath } from './utils';
import type {
  Thread,
  ThreadCtx,
  Direction,
  ChatMessage,
  ChatMessageFile,
  TreeEntry,
  PreviewBlock,
  PendingFile,
  PendingApprovalDto,
  WsPayload,
} from './types';

interface ServerMessage {
  id?: string;
  direction: string;
  text: string;
  files?: ChatMessageFile[] | null;
  timestamp: string;
}

// ── threads ─────────────────────────────────────────────────────────
export async function loadThreads(gid: string): Promise<void> {
  try {
    const { threads: t } = await api<{ threads: Thread[] }>(`api/groups/${encodeURIComponent(gid)}/chat/threads`);
    threads.value = t || [];
  } catch (err) {
    console.error('threads load failed', err);
    threads.value = [];
  }
}

export async function deleteThread(tid: string): Promise<void> {
  if (!groupId.value) return;
  try {
    const r = await fetch(`api/groups/${encodeURIComponent(groupId.value)}/chat/${encodeURIComponent(tid)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    if (!r.ok) {
      chatStatus.value = 'delete failed (HTTP ' + r.status + ')';
      return;
    }
  } catch (err) {
    console.error('delete failed', err);
    const m = err instanceof Error ? err.message : 'network error';
    chatStatus.value = 'delete failed: ' + m;
    return;
  }
  threads.value = threads.value.filter((x) => x.threadId !== tid);
  if (threadId.value === tid) {
    const latest = threads.value.length > 0 ? threads.value[0]! : null;
    if (latest) openChat(groupId.value, latest.threadId, threadCtxOf(latest)).catch(console.error);
    else clearChat();
  }
}

function threadCtxOf(t: Thread | null | undefined): ThreadCtx | null {
  if (!t || !t.channelType || t.channelType === 'web') return null;
  return { channelType: t.channelType, messagingGroupId: t.messagingGroupId ?? null, canSend: !!t.canSend };
}

function bumpActiveThread(maxTs?: string): void {
  if (!threadId.value) return;
  const list = threads.value.slice();
  const idx = list.findIndex((x) => x.threadId === threadId.value);
  if (idx < 0) {
    if (groupId.value) loadThreads(groupId.value);
    return;
  }
  const t: Thread = { ...list[idx]! };
  t.lastActivityAt = maxTs || new Date().toISOString();
  t.messageCount = (t.messageCount || 0) + 1;
  list.splice(idx, 1);
  list.unshift(t);
  threads.value = list;
}

function updateActiveThreadTitleFromFirstMessage(text: string): void {
  if (!threadId.value) return;
  const list = threads.value.slice();
  const idx = list.findIndex((x) => x.threadId === threadId.value);
  if (idx < 0) return;
  const t = list[idx]!;
  if (t.title !== '(new thread)') return;
  const clean = String(text || '')
    .replace(/^>\s*Context[^\n]*\n+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return;
  list[idx] = { ...t, title: clean.slice(0, 60) };
  threads.value = list;
}

// ── chat ────────────────────────────────────────────────────────────
export function clearChat(): void {
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
  if (refs.ws) {
    try {
      refs.ws.close();
    } catch {
      /* ignore */
    }
    refs.ws = null;
  }
  if (refs.reconnectTimer) {
    clearTimeout(refs.reconnectTimer);
    refs.reconnectTimer = null;
  }
  refs.seenIds.clear();
}

export function stopChatPoll(): void {
  if (refs.pollTimer) {
    clearInterval(refs.pollTimer);
    refs.pollTimer = null;
  }
}

export function startChatPoll(): void {
  stopChatPoll();
  refs.pollTimer = setInterval(async () => {
    if (!threadId.value || channelType.value === 'web') {
      stopChatPoll();
      return;
    }
    try {
      await refetchThreadHistory(true);
    } catch (err) {
      console.error('poll failed', err);
    }
  }, POLL_INTERVAL_MS);
}

function historyUrl(gid: string, tid: string): string {
  let u = `api/groups/${encodeURIComponent(gid)}/chat/${encodeURIComponent(tid)}/history`;
  if (channelType.value && channelType.value !== 'web' && messagingGroupId.value) {
    u += `?channel=${encodeURIComponent(channelType.value)}&mg=${encodeURIComponent(messagingGroupId.value)}`;
  }
  return u;
}

function appendMsg(
  direction: Direction,
  text: string,
  files: ChatMessageFile[] | null | undefined,
  ts: string,
  id?: string,
): void {
  const key = id ? `${direction}:${id}` : null;
  if (key && refs.seenIds.has(key)) return;
  if (key) refs.seenIds.add(key);
  chatMessages.value = chatMessages.value.concat({ direction, text, files: files || null, ts });
}

function normDirection(d: string): Direction {
  return d === 'in' ? 'in' : d === 'internal' ? 'internal' : 'out';
}

async function refetchThreadHistory(appendNewOnly: boolean): Promise<void> {
  const gid = groupId.value,
    tid = threadId.value;
  if (!gid || !tid) return;
  const r = await fetch(historyUrl(gid, tid), { credentials: 'same-origin', cache: 'no-store' });
  if (!r.ok) return;
  const { messages } = (await r.json()) as { messages: ServerMessage[] };
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
  const additions: ChatMessage[] = [];
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

interface ChatStartResponse {
  threadId: string;
  sessionId?: string | null;
  messagingGroupId?: string | null;
  sessionMode?: string;
}

export async function openChat(gid: string, resumeTid: string | null, opts: ThreadCtx | null): Promise<void> {
  if (resumeTid && groupId.value === gid && threadId.value === resumeTid) return;
  if (refs.ws) {
    try {
      refs.ws.close();
    } catch {
      /* ignore */
    }
    refs.ws = null;
  }
  if (refs.reconnectTimer) {
    clearTimeout(refs.reconnectTimer);
    refs.reconnectTimer = null;
  }
  stopChatPoll();
  refs.reconnectAttempt = 0;

  let ct: string = 'web';
  let mg: string | null = null;
  let cs = true;
  if (opts && opts.channelType) {
    ct = opts.channelType;
    mg = opts.messagingGroupId || null;
    cs = !!opts.canSend;
  } else if (resumeTid) {
    const t = threads.value.find((x) => x.threadId === resumeTid);
    if (t && t.channelType && t.channelType !== 'web') {
      ct = t.channelType;
      mg = t.messagingGroupId || null;
      cs = !!t.canSend;
    }
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
    writeHash();
    try {
      const r = await fetch(historyUrl(gid, resumeTid), { credentials: 'same-origin', cache: 'no-store' });
      if (r.ok) {
        const { messages } = (await r.json()) as { messages: ServerMessage[] };
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
    } catch (err) {
      console.error('history load failed', err);
      chatLoading.value = false;
    }
    if (ct === 'web') connectChatWs();
    else {
      chatStatus.value = '';
      startChatPoll();
    }
    return;
  }

  // New web chat.
  batch(() => {
    channelType.value = 'web';
    messagingGroupId.value = null;
    canSend.value = true;
  });
  chatStatus.value = 'starting\u2026';
  let started: ChatStartResponse;
  try {
    const r = await fetch(`api/groups/${encodeURIComponent(gid)}/chat/start`, {
      method: 'POST',
      credentials: 'same-origin',
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    started = (await r.json()) as ChatStartResponse;
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    chatStatus.value = 'failed to start chat: ' + m;
    return;
  }
  threadId.value = started.threadId;
  threads.value = [
    {
      threadId: started.threadId,
      sessionId: started.sessionId || null,
      channelType: 'web',
      messagingGroupId: started.messagingGroupId || null,
      sessionMode: started.sessionMode || 'per-thread',
      title: '(new thread)',
      lastActivityAt: new Date().toISOString(),
      messageCount: 0,
    },
    ...threads.value,
  ];
  writeHash();
  connectChatWs();
}

function connectChatWs(): void {
  if (!groupId.value || !threadId.value) return;
  const gid = groupId.value,
    tid = threadId.value;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${proto}//${location.host}/ui/chat/api/groups/${encodeURIComponent(gid)}/chat/${encodeURIComponent(tid)}/ws`;
  const ws = new WebSocket(wsUrl);
  refs.ws = ws;
  ws.onopen = () => {
    const wasReconnect = refs.reconnectAttempt > 0;
    refs.reconnectAttempt = 0;
    chatStatus.value = 'connected';
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
  ws.onerror = () => {
    chatStatus.value = 'connection error';
  };
  ws.onmessage = (ev: MessageEvent) => {
    let payload: WsPayload;
    try {
      payload = JSON.parse(ev.data) as WsPayload;
    } catch {
      return;
    }
    if (payload.kind === 'ready') return;
    if (payload.kind === 'typing') {
      isTyping.value = !!payload.on;
      typingHint.value = payload.hint || '';
      return;
    }
    if (payload.kind === 'inbound') {
      appendMsg('in', payload.text || '', payload.files || null, payload.timestamp || '', payload.id);
      updateActiveThreadTitleFromFirstMessage(payload.text || '');
      bumpActiveThread();
      return;
    }
    if (payload.kind === 'outbound') {
      const c = payload.content || {};
      const text = typeof c === 'string' ? c : c.text || c.markdown || '';
      const dir: Direction = payload.messageKind === 'internal' ? 'internal' : 'out';
      appendMsg(dir, text, payload.files || [], payload.timestamp || '', payload.id);
      bumpActiveThread();
      if (dir === 'out') maybeNotify(text, payload.files || []);
      return;
    }
  };
}

export async function sendChat(text: string, files: PendingFile[] | null | undefined): Promise<void> {
  if (!groupId.value || !threadId.value) return;
  const isWeb = !channelType.value || channelType.value === 'web';
  const hasFiles = Array.isArray(files) && files.length > 0;
  if (!isWeb) {
    const now = new Date().toISOString();
    const fileMetas: ChatMessageFile[] | null = hasFiles
      ? files!.map((f) => ({ filename: f.name, size: f.size }))
      : null;
    appendMsg('in', text || '', fileMetas, now);
  }
  let url = `api/groups/${encodeURIComponent(groupId.value)}/chat/${encodeURIComponent(threadId.value)}/send`;
  if (!isWeb && messagingGroupId.value) {
    url += `?channel=${encodeURIComponent(channelType.value)}&mg=${encodeURIComponent(messagingGroupId.value)}`;
  }
  try {
    let res: Response;
    if (hasFiles) {
      const fd = new FormData();
      fd.append('text', text || '');
      for (const f of files!) {
        if (f.file) fd.append('file', f.file, f.name);
      }
      res = await fetch(url, { method: 'POST', credentials: 'same-origin', body: fd });
    } else {
      res = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    }
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const j = (await res.json()) as { error?: string; detail?: string };
        if (j && j.error) detail = j.error + (j.detail ? ` (${j.detail})` : '');
      } catch {
        /* ignore */
      }
      chatStatus.value = `send failed: ${detail}`;
    } else if (!isWeb) {
      try {
        await refetchThreadHistory(false);
      } catch {
        /* ignore */
      }
    }
  } catch (err) {
    console.error('send failed', err);
    const m = err instanceof Error ? err.message : 'network error';
    chatStatus.value = `send failed: ${m}`;
  }
}

// ── files ───────────────────────────────────────────────────────────
function startThreadsPoll(gid: string): void {
  if (refs.threadsPollTimer) {
    clearInterval(refs.threadsPollTimer);
    refs.threadsPollTimer = null;
  }
  refs.threadsPollTimer = setInterval(() => {
    if (groupId.value === gid)
      loadThreads(gid).catch(() => {
        /* ignore */
      });
    else if (refs.threadsPollTimer) {
      clearInterval(refs.threadsPollTimer);
      refs.threadsPollTimer = null;
    }
  }, THREADS_POLL_MS);
}

export async function selectGroup(gid: string): Promise<void> {
  batch(() => {
    groupId.value = gid;
    treePath.value = '';
    filePath.value = null;
  });
  await loadThreads(gid);
  startThreadsPoll(gid);
  await loadTree('');
  const latest = threads.value.length > 0 ? threads.value[0]! : null;
  if (latest) {
    openChat(gid, latest.threadId, threadCtxOf(latest)).catch((err) => console.error('chat open failed', err));
  } else {
    clearChat();
    writeHash();
  }
}

export async function loadTree(p: string): Promise<void> {
  batch(() => {
    treePath.value = p;
    filePath.value = null;
    previewBlock.value = null;
    treeError.value = '';
    treeEntries.value = [];
  });
  try {
    if (!groupId.value) return;
    const segs = String(p || '')
      .split('/')
      .filter(Boolean)
      .map(encodeURIComponent);
    const url = `api/groups/${encodeURIComponent(groupId.value)}/dirs/${segs.length ? segs.join('/') + '/' : ''}`;
    const { entries } = await api<{ entries: TreeEntry[] }>(url);
    treeEntries.value = entries || [];
  } catch (err) {
    const msg = /HTTP 404/.test(String(err && (err as Error).message))
      ? 'Not found. It may have been renamed or deleted.'
      : String((err as Error)?.message || err);
    treeError.value = msg;
  }
}

export async function navTree(p: string): Promise<void> {
  await loadTree(p);
  writeHash();
}

export async function navFile(entry: Pick<TreeEntry, 'path' | 'name'> & Partial<TreeEntry>): Promise<void> {
  if (isMobile.value) drawerOpen.files.value = true;
  else paneOpen.files.value = true;
  const parent = parentPath(entry.path);
  if (treePath.value !== parent) await loadTree(parent);
  await selectFile(entry);
  writeHash();
}

export async function selectFile(entry: Pick<TreeEntry, 'path' | 'name'> & Partial<TreeEntry>): Promise<void> {
  filePath.value = entry.path;
  if (!groupId.value) return;
  const segs = String(entry.path || '')
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent);
  const url = `api/groups/${encodeURIComponent(groupId.value)}/files/${segs.join('/')}`;
  let size = entry.size;
  let mtime = entry.mtime;
  try {
    const h = await fetch(url, { method: 'HEAD', credentials: 'same-origin' });
    if (h.status >= 400) {
      const msg = h.status === 404 ? 'File not found. It may have been renamed or deleted.' : `HTTP ${h.status}`;
      previewBlock.value = { kind: 'error', text: msg, name: entry.name, url };
      return;
    }
    if (size == null) {
      const cl = h.headers.get('content-length');
      if (cl) size = Number(cl);
    }
    if (!mtime) {
      const lm = h.headers.get('last-modified');
      if (lm) {
        const t = Date.parse(lm);
        if (t) mtime = new Date(t).toISOString();
      }
    }
  } catch {
    /* ignore */
  }
  const ext = entry.name.toLowerCase().split('.').pop() || '';
  const meta = { name: entry.name, size: size ?? null, mtime: mtime ?? null, url, path: entry.path };
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) previewBlock.value = { kind: 'image', ...meta };
  else if (['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac', 'weba'].includes(ext))
    previewBlock.value = { kind: 'audio', ...meta };
  else if (['mp4', 'm4v', 'mov', 'webm', 'ogv'].includes(ext)) previewBlock.value = { kind: 'video', ...meta };
  else if (ext === 'pdf') previewBlock.value = { kind: 'pdf', ...meta };
  else {
    try {
      const r = await fetch(url, { credentials: 'same-origin' });
      if (!r.ok) {
        previewBlock.value = { kind: 'error', text: `HTTP ${r.status}`, ...meta };
        return;
      }
      const ctType = r.headers.get('content-type') || '';
      if (ctType.startsWith('text/') || ctType.includes('json') || ctType.includes('xml')) {
        const txt = await r.text();
        const isMd = ext === 'md' || ext === 'markdown';
        previewBlock.value = { kind: isMd ? 'markdown' : 'text', text: txt, ...meta };
      } else {
        previewBlock.value = { kind: 'binary', mime: ctType, ...meta };
      }
    } catch (err) {
      previewBlock.value = { kind: 'error', text: String((err as Error)?.message || err), ...meta };
    }
  }
  fetchAndAttachMeta(entry.path).catch(() => {
    /* ignore */
  });
}

interface FileMetaResponse {
  tags?: Record<string, unknown> | null;
  lyrics?: string | null;
  mime?: string;
  size?: number;
  mtime?: string;
}

async function fetchAndAttachMeta(p: string): Promise<void> {
  const gid = groupId.value;
  if (!gid) return;
  const segs = String(p || '')
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent);
  const u = `api/groups/${encodeURIComponent(gid)}/files/${segs.join('/')}?meta=1`;
  const r = await fetch(u, { credentials: 'same-origin', cache: 'no-store' });
  if (!r.ok) return;
  const data = (await r.json()) as FileMetaResponse;
  const cur = previewBlock.value;
  if (!cur || cur.path !== p) return;
  const next: PreviewBlock = {
    ...cur,
    tags: data.tags || null,
    lyrics: data.lyrics || null,
    mime: data.mime || cur.mime,
    size: data.size ?? cur.size,
    mtime: data.mtime || cur.mtime,
  };
  previewBlock.value = next;
}

export function closePreview(): void {
  batch(() => {
    filePath.value = null;
    previewBlock.value = null;
  });
  writeHash();
}

// ── pinned file-browser context ────────────────────────────────────
export function togglePinnedFile(path: string | null | undefined): void {
  if (!path) return;
  const cur = pinnedContext.value;
  pinnedContext.value = cur.includes(path) ? cur.filter((p) => p !== path) : cur.concat(path);
}

export function removePinnedPath(path: string): void {
  pinnedContext.value = pinnedContext.value.filter((p) => p !== path);
}

export function clearPinnedContext(): void {
  pinnedContext.value = [];
}

// ── pending uploads in composer ─────────────────────────────────────
export function addPendingFiles(
  fileList: File[] | FileList | null | undefined,
  max: number,
  maxSize: number,
  maxTotal: number,
): void {
  if (!fileList || fileList.length === 0) return;
  const next: PendingFile[] = pending.value.slice();
  let totalBytes = next.reduce((n, f) => n + f.size, 0);
  for (const f of Array.from(fileList)) {
    if (next.length >= max) {
      chatStatus.value = `max ${max} files per message`;
      break;
    }
    if (f.size > maxSize) {
      chatStatus.value = `${f.name} too large (max ${(maxSize / 1024 / 1024).toFixed(0)} MB)`;
      continue;
    }
    if (totalBytes + f.size > maxTotal) {
      chatStatus.value = `total upload too large (max ${(maxTotal / 1024 / 1024).toFixed(0)} MB)`;
      break;
    }
    next.push({ name: f.name, size: f.size, file: f });
    totalBytes += f.size;
  }
  pending.value = next;
}

export function removePending(i: number): void {
  const next = pending.value.slice();
  next.splice(i, 1);
  pending.value = next;
}

export function clearPending(): void {
  pending.value = [];
}

// ── liveness / catchup ──────────────────────────────────────────────
const NOW_TICK_MS = 30000;
export function installLivenessHandlers(): void {
  setInterval(() => {
    if (!document.hidden) nowTick.value = Date.now();
  }, NOW_TICK_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    nowTick.value = Date.now();
    loadApprovals().catch(() => {
      /* ignore */
    });
    if (!threadId.value) return;
    refetchThreadHistory(true).catch((err) => console.error('resume catchup failed', err));
    const ws = refs.ws;
    const open = !!ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING);
    if (channelType.value === 'web' && !open) {
      if (refs.reconnectTimer) {
        clearTimeout(refs.reconnectTimer);
        refs.reconnectTimer = null;
      }
      connectChatWs();
    }
  });
}

// ── pending approvals (banner inbox) ────────────────────────────────
export async function loadApprovals(): Promise<void> {
  try {
    const res = await api<{ approvals: PendingApprovalDto[] }>('api/approvals');
    pendingApprovals.value = Array.isArray(res.approvals) ? res.approvals : [];
  } catch {
    // network/auth blip — leave the previous list visible
  }
}

export function startApprovalsPoll(): void {
  if (refs.approvalsPollTimer) return;
  loadApprovals().catch(() => {
    /* ignore */
  });
  refs.approvalsPollTimer = setInterval(() => {
    if (document.hidden) return;
    loadApprovals().catch(() => {
      /* ignore */
    });
  }, APPROVALS_POLL_MS);
}

export async function respondApproval(approvalId: string, value: string): Promise<void> {
  if (respondingApprovalIds.value.has(approvalId)) return;
  const next = new Set(respondingApprovalIds.value);
  next.add(approvalId);
  respondingApprovalIds.value = next;
  try {
    const res = await postJson<{ ok?: boolean; error?: string }>(
      `api/approvals/${encodeURIComponent(approvalId)}/respond`,
      { value },
    );
    if (!res.ok) throw new Error(res.data?.error || 'HTTP ' + res.status);
    pendingApprovals.value = pendingApprovals.value.filter((a) => a.approvalId !== approvalId);
  } catch (err) {
    console.error('approval respond failed', err);
    chatStatus.value = 'approval failed: ' + (err instanceof Error ? err.message : String(err));
  } finally {
    const cleared = new Set(respondingApprovalIds.value);
    cleared.delete(approvalId);
    respondingApprovalIds.value = cleared;
  }
}
