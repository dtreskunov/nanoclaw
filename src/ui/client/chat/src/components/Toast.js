// Tiny corner-toast for transient feedback (e.g. "Copied"). Driven by
// the toastMessage signal — call showToast(text, kind?) from anywhere.
import { useEffect } from 'preact/hooks';
import { html } from '../html.js';
import { toastMessage } from '../state.js';

let nextId = 1;
let hideTimer = null;

export function showToast(text, kind = 'ok', ms = 1800) {
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
  return html`
    <div class=${'toast toast-' + (t.kind || 'ok')} role="status" aria-live="polite" key=${t.id}>${t.text}</div>
  `;
}
