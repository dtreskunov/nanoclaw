// PWA install prompt (Chrome/Edge/Android Add-to-Home-Screen).
//
// Captures the `beforeinstallprompt` event so the user can trigger the
// browser's native install UI from inside Settings, instead of relying
// on the browser's own (often-hidden) menu item. iOS/Safari does not
// fire BIP — see `shouldShowIosInstallHint` in notify.ts for that path.
import { signal, type Signal } from '@preact/signals';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// True once we've captured a deferred prompt or the page is already running standalone.
export const installAvailable: Signal<boolean> = signal(false);
export const installCompleted: Signal<boolean> = signal(false);

let deferred: BeforeInstallPromptEvent | null = null;

export function initInstall(): void {
  if (isStandalone()) {
    installCompleted.value = true;
    return;
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    installAvailable.value = true;
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installAvailable.value = false;
    installCompleted.value = true;
  });
}

export async function triggerInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  try {
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    installAvailable.value = false;
    return outcome;
  } catch {
    return 'dismissed';
  }
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  // iOS Safari exposes the legacy flag instead of the display-mode media query.
  return (navigator as unknown as { standalone?: boolean }).standalone === true;
}
