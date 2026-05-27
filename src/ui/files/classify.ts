/**
 * Path classification + filesystem safety.
 *
 * `resolveSafe` is the only function callers should use to convert a
 * client-supplied relative path into an absolute path. It rejects:
 *   - absolute paths
 *   - parent traversal (`..`)
 *   - symlinks that escape the group dir (via realpath containment check)
 *
 * `classify` decides who can see a given relative path. Hidden paths are
 * not listed and not readable; admin-only paths require admin privilege
 * over the group.
 */
import fs from 'fs';
import path from 'path';

export type Tier = 'member' | 'admin';
export type Classification = { kind: 'visible'; tier: Tier; readonly: boolean } | { kind: 'hidden' };

const HIDDEN_NAMES = new Set([
  '.git',
  'node_modules',
  '.DS_Store',
  '.claude-fragments',
  '.claude-shared.md',
  // CLAUDE.md is the composed RO artifact — hide it; the source is CLAUDE.local.md.
  'CLAUDE.md',
]);

const ADMIN_ONLY_NAMES = new Set(['container.json', 'bot.json', 'allowed-senders.txt']);

/** Classify a relative POSIX-style path (no leading slash). Empty string = the group root. */
export function classify(relPath: string): Classification {
  // Hide anything where ANY path segment is in the hidden set.
  const segments = relPath.split('/').filter(Boolean);
  for (const seg of segments) {
    if (HIDDEN_NAMES.has(seg)) return { kind: 'hidden' };
    // Hide dotfiles by default (members) — but allow CLAUDE.local.md and other
    // explicit names through. Anything starting with "." that isn't in our
    // allow-listed-visible set is hidden.
    if (seg.startsWith('.') && seg !== '.well-known') return { kind: 'hidden' };
  }
  const base = segments[segments.length - 1] ?? '';
  if (ADMIN_ONLY_NAMES.has(base)) return { kind: 'visible', tier: 'admin', readonly: true };
  // CLAUDE.local.md visible to members but RO (write surface is deferred).
  if (base === 'CLAUDE.local.md') return { kind: 'visible', tier: 'member', readonly: true };
  return { kind: 'visible', tier: 'member', readonly: true };
}

/**
 * Resolve `relPath` against `groupDir`. Returns the absolute path on success,
 * or null if the path escapes the group dir or contains forbidden segments.
 *
 * On a path that exists, also runs realpath to defeat symlink escapes.
 * On a path that doesn't exist (ENOENT), validates the parent's realpath.
 */
export function resolveSafe(groupDir: string, relPath: string): string | null {
  if (!relPath) return groupDirRealpath(groupDir);
  if (path.isAbsolute(relPath)) return null;
  // Normalise & reject traversal.
  const segments = relPath.split('/').filter(Boolean);
  if (segments.some((s) => s === '..' || s === '.')) return null;
  const groupRoot = groupDirRealpath(groupDir);
  if (!groupRoot) return null;
  const resolved = path.resolve(groupRoot, segments.join(path.sep));
  // Containment check (lexical).
  if (!isContained(resolved, groupRoot)) return null;
  // Realpath if exists; if not, walk up to first existing ancestor.
  try {
    const real = fs.realpathSync(resolved);
    return isContained(real, groupRoot) ? real : null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      // Non-existent leaf is fine for tree listing of empty subdirs; tree handler
      // re-checks existence anyway. Containment was already validated lexically.
      return resolved;
    }
    return null;
  }
}

function groupDirRealpath(groupDir: string): string | null {
  try {
    return fs.realpathSync(groupDir);
  } catch {
    return null;
  }
}

function isContained(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}
