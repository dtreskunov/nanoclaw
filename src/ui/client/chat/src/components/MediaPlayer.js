// Floating media player widget. Shows an <audio> or <video> element
// with native controls in a sticky container so it stays visible while
// the user scrolls through metadata or transcript content beneath.
import { html } from '../html.js';

export function MediaPlayer({ kind, url, name }) {
  if (kind !== 'audio' && kind !== 'video') return null;
  const el = kind === 'audio'
    ? html`<audio controls preload="metadata" src=${url} aria-label=${name} />`
    : html`<video controls preload="metadata" src=${url} aria-label=${name} />`;
  return html`<div class=${'media-player media-player-' + kind}>${el}</div>`;
}
