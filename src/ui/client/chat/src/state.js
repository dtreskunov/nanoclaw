// Reactive state (signals) + constants + non-reactive refs.
import { signal } from '@preact/signals';

// ── reactive state ──────────────────────────────────────────────────
export const groups = signal([]);
export const groupId = signal(null);
export const isAdmin = signal(false);

// File browser
export const treePath = signal('');     // current directory
export const filePath = signal(null);   // selected file (full path) or null
export const treeEntries = signal([]);
export const treeError = signal('');

// Current playback position of the preview media player (seconds). 0 when
// nothing is playing or on src change. Used by LyricsPanel to highlight
// the active LRC line.
export const mediaCurrentTime = signal(0);

// Chat thread
export const threads = signal([]);
export const threadId = signal(null);
export const channelType = signal('web');
export const messagingGroupId = signal(null);
export const canSend = signal(true);
export const chatMessages = signal([]);
export const chatStatus = signal('');
export const chatLoading = signal(false);
export const isTyping = signal(false);
export const typingHint = signal('');
export const pending = signal([]);

// Panels / drawers
export const paneOpen = {
  threads: signal(true),
  files: signal(true),
};
export const drawerOpen = {
  threads: signal(false),
  files: signal(false),
};
export const isMobile = signal(false);

// Uploads
export const uploadItems = signal([]);

// Misc
export const me = signal('');
export const notifMutedSig = signal(false);
export const settingsOpen = signal(false);
// When non-null, the share-link modal is shown for this entry.
// Shape: { groupId, entry: { path, name, type } }
export const shareModalRequest = signal(null);

// Transient feedback shown in a corner toast. Shape: { id, text, kind }
// where kind is 'ok' | 'err' | null. Cleared after a short delay.
export const toastMessage = signal(null);
export const previewBlock = signal(null);  // { kind, url?, html?, text?, mime?, ext?, name?, size?, mtime? } | null

// Global "now" tick — bumped on a timer + on visibility resume so
// <RelativeTime> components re-render and "5m" doesn't go stale.
export const nowTick = signal(Date.now());

// Explicit file-browser context pinned by the user via the clippy
// button in the preview toolbar. Each entry is a file path (string)
// relative to the group workspace. Sent as a markdown context block
// prefixed to the next outbound message, then cleared.
export const pinnedContext = signal([]);

// ── non-reactive refs (mutated outside render) ──────────────────────
export const refs = {
  ws: null,
  reconnectTimer: null,
  reconnectAttempt: 0,
  pollTimer: null,
  threadsPollTimer: null,
  // Set of `${direction}:${id}` for every row currently in chatMessages.
  // Used to dedup WS pushes against history refetches. Cleared on
  // openChat / clearChat. Initial-load and full-replace rebuild it
  // from scratch; append-only refetch and appendMsg add to it.
  seenIds: new Set(),
  suppressHashCount: 0,
  uploadDragDepth: 0,
};

// ── constants ───────────────────────────────────────────────────────
export const PANES = [
  { key: 'threads', mainClass: 'threads-collapsed' },
  { key: 'files', mainClass: 'files-collapsed' },
];
export const POLL_INTERVAL_MS = 10000;
export const THREADS_POLL_MS = 20000;
export const UPLOAD_MAX_FILE_SIZE = 25 * 1024 * 1024;
export const UPLOAD_MAX_TOTAL_SIZE = 50 * 1024 * 1024;
export const UPLOAD_MAX_FILES = 10;
export const MOBILE_MQ = window.matchMedia('(max-width: 720px)');
export const NOTIF_MUTE_KEY = 'nanoclaw:notif:muted';

export const CHANNEL_META = {
  web: { label: 'Web', icon: '\uD83D\uDCAC' },
  resend: { label: 'Email', icon: '\uD83D\uDCE7' },
  discord: { label: 'Discord', icon: '\uD83D\uDC7E' },
  telegram: { label: 'Telegram', icon: '\u2708\uFE0F' },
  whatsapp: { label: 'WhatsApp', icon: '\uD83D\uDCDE' },
  imessage: { label: 'iMessage', icon: '\uD83D\uDCAC' },
  signal: { label: 'Signal', icon: '\uD83D\uDD12' },
  slack: { label: 'Slack', icon: '#' },
  matrix: { label: 'Matrix', icon: 'M' },
  gchat: { label: 'Chat', icon: 'G' },
};
export function channelMeta(ct) { return CHANNEL_META[ct] || { label: ct || 'Channel', icon: '\u2022' }; }
