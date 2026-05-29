// Notification permission + maybeNotify. Owned mute state is in
// state.notifMutedSig; helpers below read/write localStorage.
import { effect } from '@preact/signals';
import { notifMutedSig, NOTIF_MUTE_KEY } from './state.js';

export function loadMuted() {
  try { return localStorage.getItem(NOTIF_MUTE_KEY) === '1'; } catch (_) { return false; }
}

export function initNotif() {
  notifMutedSig.value = loadMuted();
  effect(() => {
    try { localStorage.setItem(NOTIF_MUTE_KEY, notifMutedSig.value ? '1' : '0'); } catch (_) {}
  });
}

export function toggleMute() {
  notifMutedSig.value = !notifMutedSig.value;
  if (!notifMutedSig.value && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

export function maybeNotify(text, files) {
  if (notifMutedSig.value) return;
  if (document.visibilityState === 'visible' && document.hasFocus()) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const body = (text || '').slice(0, 200) + (files && files.length ? ` · ${files.length} file${files.length > 1 ? 's' : ''}` : '');
    const n = new Notification('NanoClaw', { body, icon: 'icon.svg', tag: 'nanoclaw-chat' });
    n.onclick = () => { window.focus(); n.close(); };
  } catch (_) {}
}
