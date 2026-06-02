// Pane state persistence + body/main class side-effects.
import { paneOpen, drawerOpen, isMobile, MOBILE_MQ } from './state';

const KEYS = { threads: 'nc:pane:threads', files: 'nc:pane:files' } as const;

export function restorePanelState(): void {
  try {
    const t = localStorage.getItem(KEYS.threads);
    const f = localStorage.getItem(KEYS.files);
    if (t === '0') paneOpen.threads.value = false;
    if (t === '1') paneOpen.threads.value = true;
    if (f === '0') paneOpen.files.value = false;
    if (f === '1') paneOpen.files.value = true;
  } catch {
    /* ignore */
  }
}

export function persistPanelState(): void {
  try {
    localStorage.setItem(KEYS.threads, paneOpen.threads.value ? '1' : '0');
    localStorage.setItem(KEYS.files, paneOpen.files.value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function applyPanelClasses(): void {
  const mobile = MOBILE_MQ.matches;
  isMobile.value = mobile;
  if (mobile) {
    document.body.classList.add('mobile');
  } else {
    document.body.classList.remove('mobile');
    drawerOpen.threads.value = false;
    drawerOpen.files.value = false;
  }
}
