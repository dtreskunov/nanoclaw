// Pane state persistence + body/main class side-effects. The actual UI
// rendering of panes lives in their components; this module handles
// localStorage + the body/main classes used by global CSS.
import { paneOpen, drawerOpen, isMobile, MOBILE_MQ } from './state.js';

const KEYS = { threads: 'nc:pane:threads', files: 'nc:pane:files' };

export function restorePanelState() {
  try {
    const t = localStorage.getItem(KEYS.threads);
    const f = localStorage.getItem(KEYS.files);
    if (t === '0') paneOpen.threads.value = false;
    if (t === '1') paneOpen.threads.value = true;
    if (f === '0') paneOpen.files.value = false;
    if (f === '1') paneOpen.files.value = true;
  } catch (_) {}
}

export function persistPanelState() {
  try {
    localStorage.setItem(KEYS.threads, paneOpen.threads.value ? '1' : '0');
    localStorage.setItem(KEYS.files, paneOpen.files.value ? '1' : '0');
  } catch (_) {}
}

// Toggle the `no-animate` class off after the first frame so the initial
// page paint doesn't animate the panes sliding in. On mobile, also ensure
// the drawers are closed by default.
export function applyPanelClasses() {
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
