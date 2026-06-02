// URL hash routing.
//
// Patterns (matched in order, longest-first; per-segment percent-encoded):
//   #g/<gid>/t/<tid>/{f|d}/<path>
//   #g/<gid>/t/<tid>
//   #g/<gid>/{f|d}/<path>
//   #g/<gid>
//
// Dir hashes carry a trailing `/`. File hashes do not.
// Channel + messaging-group context for non-web threads is resolved from
// the thread record by openChat — not carried in the URL.
import { batch } from '@preact/signals';
import { match, compile } from 'path-to-regexp';
import {
  groups, groupId, isAdmin, treePath, filePath, threads,
  threadId, refs,
} from './state.js';
import { parentPath } from './utils.js';

const PATTERNS = [
  '/g/:gid/t/:tid/:kind/*filepath',
  '/g/:gid/t/:tid',
  '/g/:gid/:kind/*filepath',
  '/g/:gid',
];
const matchers = PATTERNS.map((p) => match(p));
const builders = Object.fromEntries(PATTERNS.map((p) => [p, compile(p)]));

export function parseHash() {
  const raw = location.hash.replace(/^#/, '').replace(/\/$/, '');
  if (!raw) return null;
  const test = '/' + raw;
  for (const m of matchers) {
    const r = m(test);
    if (!r) continue;
    const { gid, tid, kind, filepath } = r.params;
    if (kind && kind !== 'f' && kind !== 'd') continue;
    return {
      groupId: gid,
      threadId: tid || null,
      path: Array.isArray(filepath) ? filepath.join('/') : (filepath || ''),
      isDir: !kind || kind === 'd',
    };
  }
  return null;
}

// Build the hash string from current signals. Caller writes location.hash.
export function buildHash() {
  if (!groupId.value) return '';
  const hasThread = !!threadId.value;
  const path = filePath.value || treePath.value;
  const hasPath = !!path;
  let pattern;
  if (hasThread && hasPath) pattern = '/g/:gid/t/:tid/:kind/*filepath';
  else if (hasThread) pattern = '/g/:gid/t/:tid';
  else if (hasPath) pattern = '/g/:gid/:kind/*filepath';
  else pattern = '/g/:gid';
  const params = { gid: groupId.value };
  if (hasThread) params.tid = threadId.value;
  if (hasPath) {
    params.kind = filePath.value ? 'f' : 'd';
    params.filepath = String(path).split('/').filter(Boolean);
  }
  let s = builders[pattern](params);
  if (hasPath && !filePath.value) s += '/';
  return '#' + s.slice(1);
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
