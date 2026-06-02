// URL hash routing.
//
// Format (path-segmented; per-segment percent-encoded):
//   #g/<gid>
//   #g/<gid>/t/<tid>
//   #g/<gid>/d/<dir>/
//   #g/<gid>/f/<file/path>
//   #g/<gid>/t/<tid>/{d/<dir>/|f/<file/path>}
//
// Channel + messaging-group context for non-web threads is resolved from
// the thread record by openChat — not carried in the URL.
import { batch } from '@preact/signals';
import {
  groups, groupId, isAdmin, treePath, filePath, threads,
  threadId, refs,
} from './state.js';
import { parentPath } from './utils.js';

function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

export function parseHash() {
  const raw = location.hash.replace(/^#/, '');
  if (!raw) return null;
  const segs = raw.split('/');
  if (segs[0] !== 'g' || !segs[1]) return null;
  const gid = safeDecode(segs[1]);
  let i = 2;
  let tid = null;
  if (segs[i] === 't' && segs[i + 1]) {
    tid = safeDecode(segs[i + 1]);
    i += 2;
  }
  let isDir = true;
  let path = '';
  if (segs[i] === 'f' || segs[i] === 'd') {
    const kind = segs[i];
    const rest = segs.slice(i + 1).map(safeDecode).filter((s) => s !== '');
    path = rest.join('/');
    isDir = kind === 'd';
  }
  return { groupId: gid, path, isDir, threadId: tid };
}

// Build the hash string from current signals. Caller writes location.hash.
export function buildHash() {
  if (!groupId.value) return '';
  const encSeg = (s) =>
    String(s).split('/').filter(Boolean).map(encodeURIComponent).join('/');
  let h = '#g/' + encodeURIComponent(groupId.value);
  if (threadId.value) h += '/t/' + encodeURIComponent(threadId.value);
  if (filePath.value) h += '/f/' + encSeg(filePath.value);
  else if (treePath.value) h += '/d/' + encSeg(treePath.value) + '/';
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
    router.openChat(parsed.groupId, parsed.threadId, null).catch((err) => console.error('chat open failed', err));
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
