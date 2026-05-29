// URL hash routing.
// Format: #<groupId>[/<path>[/]][?t=<threadId>&c=<channelType>&mg=<mgId>]
import { batch } from '@preact/signals';
import {
  groups, groupId, isAdmin, treePath, filePath, threads,
  threadId, channelType, messagingGroupId, canSend, refs,
} from './state.js';
import { parentPath } from './utils.js';

export function parseHash() {
  const raw = location.hash.replace(/^#/, '');
  if (!raw) return null;
  const qIdx = raw.indexOf('?');
  const pathPart = qIdx < 0 ? raw : raw.slice(0, qIdx);
  const params = new URLSearchParams(qIdx < 0 ? '' : raw.slice(qIdx + 1));
  const tid = params.get('t') || null;
  const ct = params.get('c') || null;
  const mg = params.get('mg') || null;
  const h = decodeURI(pathPart);
  const base = { threadId: tid, channelType: ct, messagingGroupId: mg };
  if (!h) return tid ? { groupId: '', path: '', isDir: true, ...base } : null;
  const slash = h.indexOf('/');
  if (slash < 0) return { groupId: h, path: '', isDir: true, ...base };
  const gid = h.slice(0, slash);
  const rest = h.slice(slash + 1);
  const isDir = rest === '' || rest.endsWith('/');
  const path = isDir ? rest.replace(/\/$/, '') : rest;
  return { groupId: gid, path, isDir, ...base };
}

// Build the hash string from current signals. Caller writes location.hash.
export function buildHash() {
  if (!groupId.value) return '';
  let h = '#' + encodeURI(groupId.value);
  if (filePath.value) h += '/' + encodeURI(filePath.value);
  else if (treePath.value) h += '/' + encodeURI(treePath.value) + '/';
  if (threadId.value) {
    h += '?t=' + encodeURIComponent(threadId.value);
    if (channelType.value && channelType.value !== 'web') {
      h += '&c=' + encodeURIComponent(channelType.value);
      if (messagingGroupId.value) h += '&mg=' + encodeURIComponent(messagingGroupId.value);
    }
  }
  return h;
}

// Sync hash → URL (incrementing suppress counter so the hashchange
// listener doesn't re-apply it).
export function writeHash() {
  const h = buildHash();
  if (!h) return;
  if (location.hash !== h) {
    refs.suppressHashCount++;
    location.hash = h;
  }
}

function applyAdminFlag() {
  const g = groups.value.find((x) => x.id === groupId.value);
  isAdmin.value = !!(g && g.isAdmin);
  document.body.classList.toggle('is-admin', isAdmin.value);
}

// Resolve a thread → channel routing tuple. Returns null for web threads.
export function threadCtx(t) {
  if (!t) return null;
  if (!t.channelType || t.channelType === 'web') return null;
  return { channelType: t.channelType, messagingGroupId: t.messagingGroupId, canSend: !!t.canSend };
}

// Resolve the URL hash against current state. Imports are deferred
// (passed in as a router object) to keep this module free of cycles
// against chat/files.
export async function applyHash(router) {
  const parsed = parseHash();
  if (!parsed) {
    if (groups.value.length) await router.selectGroup(groups.value[0].id);
    return;
  }
  if (!groups.value.find((g) => g.id === parsed.groupId)) {
    router.notFound('No access to group ' + parsed.groupId);
    return;
  }
  const groupChanged = groupId.value !== parsed.groupId;
  batch(() => {
    groupId.value = parsed.groupId;
    filePath.value = null;
  });
  applyAdminFlag();
  if (groupChanged) await router.loadThreads(parsed.groupId);

  if (parsed.threadId) {
    const ctx = parsed.channelType && parsed.channelType !== 'web' && parsed.messagingGroupId
      ? { channelType: parsed.channelType, messagingGroupId: parsed.messagingGroupId, canSend: true }
      : null;
    router.openChat(parsed.groupId, parsed.threadId, ctx).catch((err) => console.error('chat open failed', err));
  } else if (groupChanged) {
    const latest = threads.value.length > 0 ? threads.value[0] : null;
    if (latest) router.openChat(parsed.groupId, latest.threadId, threadCtx(latest)).catch((err) => console.error('chat open failed', err));
    else router.clearChat();
  }
  if (parsed.isDir) {
    await router.loadTree(parsed.path);
  } else {
    const parent = parentPath(parsed.path);
    await router.loadTree(parent);
    const name = parent ? parsed.path.slice(parent.length + 1) : parsed.path;
    await router.selectFile({ path: parsed.path, name });
  }
}

export { applyAdminFlag };
