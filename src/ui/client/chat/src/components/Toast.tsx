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

export function Toast() {
  const t = toastMessage.value;
  // Re-mount on each new id so the CSS animation re-plays.
  useEffect(() => undefined, [t?.id]);
  if (!t) return null;
  return (
    <div class={'toast toast-' + (t.kind || 'ok')} role="status" aria-live="polite" key={t.id}>{t.text}</div>
  );
}
