// Panel toggling, mobile drawers, notifications.
import { state, chat, PANES, MOBILE_MQ, NOTIF_MUTE_KEY } from './state.js';
import { $ } from './utils.js';

export function restorePanelState() {
  try {
    for (const p of PANES) {
      const v = localStorage.getItem(`nc:pane:${p.key}`);
      if (v !== null) state.paneOpen[p.key] = v === '1';
    }
  } catch (_) { /* private mode */ }
  applyPanelClasses();
}

export function persistPanelState() {
  try {
    for (const p of PANES) localStorage.setItem(`nc:pane:${p.key}`, state.paneOpen[p.key] ? '1' : '0');
  } catch (_) {}
}

export function applyPanelClasses() {
  const main = $('main');
  const mobile = MOBILE_MQ.matches;
  for (const p of PANES) {
    const open = state.paneOpen[p.key];
    main.classList.toggle(p.mainClass, !mobile && !open);
    $(p.id).classList.toggle('collapsed', !mobile && !open);
  }
}

export function stopPreviewMedia() {
  const pv = $('preview');
  if (!pv) return;
  for (const m of pv.querySelectorAll('audio, video')) {
    try { m.pause(); m.currentTime = 0; } catch (_) {}
  }
}

export function togglePane(key) {
  state.paneOpen[key] = !state.paneOpen[key];
  if (key === 'files' && !state.paneOpen.files) stopPreviewMedia();
  applyPanelClasses();
  persistPanelState();
}

export function openFilesDrawerIfMobile() {
  if (!MOBILE_MQ.matches) return;
  for (const p of PANES) $(p.id).classList.toggle('open', p.key === 'files');
  $('backdrop').classList.add('show');
}

export function closeMobileDrawers() {
  if ($('files-pane').classList.contains('open') && $('files-pane').classList.contains('previewing')) stopPreviewMedia();
  for (const p of PANES) $(p.id).classList.remove('open');
  $('backdrop').classList.remove('show');
}

export function toggleMobileDrawer(which) {
  const target = $(PANES.find((p) => p.key === which).id);
  const willOpen = !target.classList.contains('open');
  if ($('files-pane').classList.contains('open') && !(which === 'files' && willOpen)) stopPreviewMedia();
  for (const p of PANES) $(p.id).classList.toggle('open', p.key === which && willOpen);
  $('backdrop').classList.toggle('show', willOpen);
}

export function notifMuted() { try { return localStorage.getItem(NOTIF_MUTE_KEY) === '1'; } catch (_) { return false; } }
export function setNotifMuted(v) { try { localStorage.setItem(NOTIF_MUTE_KEY, v ? '1' : '0'); } catch (_) {} }

export function wireNotifButton() {
  const btn = document.getElementById('btn-notif');
  if (!btn) return;
  if (!('Notification' in window)) return; // unsupported → leave hidden
  btn.hidden = false;
  refreshNotifButton();
  btn.addEventListener('click', async () => {
    if (Notification.permission === 'denied') {
      alert('Notifications are blocked. Enable them in your browser/OS settings for this site.');
      return;
    }
    if (Notification.permission === 'granted') {
      setNotifMuted(!notifMuted());
      refreshNotifButton();
      return;
    }
    try { await Notification.requestPermission(); } catch (_) {}
    if (Notification.permission === 'granted') setNotifMuted(false);
    refreshNotifButton();
  });
}

export function refreshNotifButton() {
  const btn = document.getElementById('btn-notif');
  if (!btn) return;
  const p = Notification.permission;
  const muted = p === 'granted' && notifMuted();
  btn.textContent = p === 'denied' || muted ? '\uD83D\uDD15' : '\uD83D\uDD14';
  btn.title = p === 'denied'
    ? 'Notifications blocked'
    : p === 'granted'
      ? (muted ? 'Notifications muted — click to enable' : 'Notifications enabled — click to mute')
      : 'Enable notifications';
  btn.style.opacity = p === 'granted' && !muted ? '1' : '0.6';
}

export function maybeNotify(text, files) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (notifMuted()) return;
  if (!document.hidden) return; // tab visible → user already sees the message
  try {
    const groupId = chat.groupId || state.groupId || '';
    const g = state.groups.find((x) => x.id === groupId);
    const title = g && g.name ? g.name : 'NanoClaw';
    let body = (text || '').trim().slice(0, 200);
    if (!body && files && files.length) body = `\uD83D\uDCCE ${files.length} file${files.length > 1 ? 's' : ''}`;
    const n = new Notification(title, { body, icon: 'icon.svg', tag: `${groupId}:${chat.threadId || ''}` });
    n.onclick = () => { window.focus(); n.close(); };
  } catch (_) {}
}
