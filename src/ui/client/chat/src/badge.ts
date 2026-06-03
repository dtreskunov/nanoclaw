// PWA app badge — surfaces unread message count on the installed-app icon
// (taskbar / dock / home-screen). Gated on Badging API support, which is
// limited to Chromium-based browsers running as an installed PWA.
//
// The count tracks messages received while the tab is hidden; it resets
// to zero as soon as the user looks at the app again.

interface NavigatorWithBadge {
  setAppBadge?(count?: number): Promise<void>;
  clearAppBadge?(): Promise<void>;
}

let unread = 0;
let initialized = false;

function nav(): NavigatorWithBadge | null {
  if (typeof navigator === 'undefined') return null;
  const n = navigator as unknown as NavigatorWithBadge;
  return typeof n.setAppBadge === 'function' ? n : null;
}

function apply(): void {
  const n = nav();
  if (!n) return;
  if (unread <= 0) {
    void n.clearAppBadge?.();
  } else {
    void n.setAppBadge?.(unread);
  }
}

export function initBadge(): void {
  if (initialized) return;
  initialized = true;
  if (!nav()) return;
  const clear = (): void => {
    if (document.visibilityState === 'visible') {
      unread = 0;
      apply();
    }
  };
  document.addEventListener('visibilitychange', clear);
  window.addEventListener('focus', clear);
  clear();
}

export function bumpUnread(): void {
  if (!nav()) return;
  if (document.visibilityState === 'visible') return;
  unread += 1;
  apply();
}
