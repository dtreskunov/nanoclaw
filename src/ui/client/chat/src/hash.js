// URL-hash routing.
//   no hash               → most-recently-active accessible group, root
//   #ag-xyz               → group root (no thread)
//   #ag-xyz/sub/dir/      → directory (trailing slash)
//   #ag-xyz/sub/file.txt  → file (no trailing slash)
//   ?t=<threadId> suffix  → active chat thread
import { state, chat } from './state.js';
import { escapeHtml, parentPath } from './utils.js';
import { selectGroup, applyAdminFlag, syncGroupSelect, loadTree, selectFile, setPreview } from './files.js';
import { loadThreads, openChat, threadCtx, clearChat } from './chat.js';

export function parseHash() {
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

export function writeHash() {
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
  if (location.hash !== h) { state.suppressHashCount++; location.hash = h; }
}

export async function applyHash() {
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
