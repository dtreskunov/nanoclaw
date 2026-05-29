// Self-refreshing relative timestamp. Reads the global `nowTick` signal
// so every instance re-renders together when the tick advances (timer
// + visibility resume), instead of going stale at "5m" forever.
import { html } from '../html.js';
import { nowTick } from '../state.js';
import { fmtRelative, fmtAbsolute } from '../utils.js';

export function RelativeTime({ ts, className }) {
  // Subscribe to the tick so signals re-renders us.
  nowTick.value;
  if (!ts) return null;
  return html`<span class=${className || 'ts'} title=${fmtAbsolute(ts)}>${fmtRelative(ts)}</span>`;
}
