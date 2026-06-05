// Pane state persistence + body/main class side-effects.
import { drawerOpen, isMobile, MOBILE_MQ } from './state';

export function restorePanelState(): void {
  // Desktop panes intentionally always start collapsed — see paneOpen
  // defaults in state.ts. No restore from localStorage.
}

export function persistPanelState(): void {
  // No-op: pane open/closed state is not persisted across loads.
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
