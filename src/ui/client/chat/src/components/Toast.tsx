// Tiny corner-toast for transient feedback (e.g. "Copied").
import './Toast.css';
import { useEffect } from 'preact/hooks';
import { toastMessage } from '../state';

let nextId = 1;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(text: string, kind: 'ok' | 'err' = 'ok', ms = 1800): void {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  const id = nextId++;
  toastMessage.value = { id, text, kind };
  hideTimer = setTimeout(() => {
    if (toastMessage.value && toastMessage.value.id === id) toastMessage.value = null;
    hideTimer = null;
  }, ms);
}

// Sticky toast with an action button — does not auto-hide. Caller's
// onClick is responsible for dismissing (by calling dismissToast or
// reloading the page).
export function showStickyToast(
  text: string,
  action: { label: string; onClick: () => void },
  kind: 'ok' | 'err' = 'ok',
): void {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  const id = nextId++;
  toastMessage.value = { id, text, kind, action };
}

export function dismissToast(): void {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  toastMessage.value = null;
}

export function Toast() {
  const t = toastMessage.value;
  // Re-mount on each new id so the CSS animation re-plays.
  useEffect(() => undefined, [t?.id]);
  if (!t) return null;
  const sticky = !!t.action;
  return (
    <div
      class={'toast toast-' + (t.kind || 'ok') + (sticky ? ' toast-sticky' : '')}
      role="status"
      aria-live="polite"
      key={t.id}
    >
      <span class="toast-text">{t.text}</span>
      {t.action ? (
        <button type="button" class="toast-action" onClick={t.action.onClick}>
          {t.action.label}
        </button>
      ) : null}
    </div>
  );
}
