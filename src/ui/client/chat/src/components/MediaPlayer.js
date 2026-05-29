// Floating media player widget. Shows an <audio> or <video> element
// with native controls in a sticky container so it stays visible while
// the user scrolls through metadata or transcript content beneath.
import { useRef, useEffect } from 'preact/hooks';
import { html } from '../html.js';
import { mediaCurrentTime } from '../state.js';

export function MediaPlayer({ kind, url, name }) {
  if (kind !== 'audio' && kind !== 'video') return null;
  const ref = useRef(null);
  // Attach via addEventListener so we don't depend on Preact's
  // handling of media event names — those are notoriously inconsistent
  // across frameworks and `timeupdate` simply not firing makes synced
  // lyrics silently break.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const push = () => { mediaCurrentTime.value = el.currentTime || 0; };
    el.addEventListener('timeupdate', push);
    el.addEventListener('seeked', push);
    el.addEventListener('loadedmetadata', push);
    push();
    return () => {
      el.removeEventListener('timeupdate', push);
      el.removeEventListener('seeked', push);
      el.removeEventListener('loadedmetadata', push);
    };
  }, [url]);
  const el = kind === 'audio'
    ? html`<audio controls preload="metadata" src=${url} aria-label=${name} ref=${ref} />`
    : html`<video controls preload="metadata" src=${url} aria-label=${name} ref=${ref} />`;
  return html`<div class=${'media-player media-player-' + kind}>${el}</div>`;
}
