// Shared mutable state + constants. Exported objects are mutated in place;
// ES module live bindings make those mutations visible everywhere.

export const PANES = [
  { key: 'threads', id: 'threads-rail', mainClass: 'threads-collapsed', toggleBtn: 'btn-threads-toggle', mobileBtn: 'btn-threads' },
  { key: 'files',   id: 'files-pane',   mainClass: 'files-collapsed',   toggleBtn: 'btn-files-toggle',   mobileBtn: 'btn-files'   },
];

export const state = {
  groupId: null,
  path: '',
  file: null,
  groups: [],
  isAdmin: false,
  paneOpen: { threads: true, files: true },
  suppressHashCount: 0,
};

export const uploadState = { items: [], dragDepth: 0 };

export const chat = {
  groupId: null,
  threadId: null,
  channelType: 'web',
  messagingGroupId: null,
  sessionMode: 'per-thread',
  sessionId: null,
  ws: null,
  reconnectTimer: null,
  reconnectAttempt: 0,
  pollTimer: null,
  threadsPollTimer: null,
  lastSeenTs: '',
  pending: [],
  contextDismissed: false,
  threads: [],
  canSend: true,
};

export const UPLOAD_MAX_FILE_SIZE = 25 * 1024 * 1024;
export const UPLOAD_MAX_TOTAL_SIZE = 50 * 1024 * 1024;
export const UPLOAD_MAX_FILES = 10;
export const MOBILE_MQ = window.matchMedia('(max-width: 720px)');
export const POLL_INTERVAL_MS = 10000;
export const NOTIF_MUTE_KEY = 'nanoclaw:notif:muted';

// Channel metadata for the thread rail + composer banner.
export const CHANNEL_META = {
  web:      { label: 'Web',      icon: '\uD83D\uDCAC' },
  resend:   { label: 'Email',    icon: '\uD83D\uDCE7' },
  discord:  { label: 'Discord',  icon: '\uD83D\uDC7E' },
  telegram: { label: 'Telegram', icon: '\u2708\uFE0F' },
  whatsapp: { label: 'WhatsApp', icon: '\uD83D\uDCDE' },
  imessage: { label: 'iMessage', icon: '\uD83D\uDCAC' },
  signal:   { label: 'Signal',   icon: '\uD83D\uDD12' },
  slack:    { label: 'Slack',    icon: '#'  },
  matrix:   { label: 'Matrix',   icon: 'M'  },
  gchat:    { label: 'Chat',     icon: 'G'  },
};

export function channelMeta(ct) {
  return CHANNEL_META[ct] || { label: ct || 'Channel', icon: '\u2022' };
}
