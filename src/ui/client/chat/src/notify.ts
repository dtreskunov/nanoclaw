// Notification permission + maybeNotify.
import { effect } from '@preact/signals';
import { notifMutedSig, NOTIF_MUTE_KEY } from './state';
import type { ChatMessageFile } from './types';

export function loadMuted(): boolean {
  try {
    return localStorage.getItem(NOTIF_MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function initNotif(): void {
  notifMutedSig.value = loadMuted();
  effect(() => {
    try {
      localStorage.setItem(NOTIF_MUTE_KEY, notifMutedSig.value ? '1' : '0');
    } catch {
      /* ignore */
    }
  });
}

export function toggleMute(): void {
  notifMutedSig.value = !notifMutedSig.value;
  if (!notifMutedSig.value && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {
      /* ignore */
    });
  }
}

export function maybeNotify(text: string, files: ChatMessageFile[] | null | undefined): void {
  if (notifMutedSig.value) return;
  if (document.visibilityState === 'visible' && document.hasFocus()) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const body =
      (text || '').slice(0, 200) +
      (files && files.length ? ` · ${files.length} file${files.length > 1 ? 's' : ''}` : '');
    const n = new Notification('NanoClaw', { body, icon: 'icon.svg', tag: 'nanoclaw-chat' });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* ignore */
  }
}
