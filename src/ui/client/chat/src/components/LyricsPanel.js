// Lyrics panel. Renders plain lyrics in a <pre> when no LRC timestamps
// are present; renders an LRC-synced list with the active line
// highlighted (and auto-scrolled into view) when timestamps are found.
//
// Supported timestamp form: [mm:ss], [mm:ss.x], [mm:ss.xx], [mm:ss.xxx].
// A line may carry multiple timestamps — common in LRC files for
// repeated choruses. Click a synced line to seek the media element.
import { useMemo, useRef, useEffect, useState } from 'preact/hooks';
import { html } from '../html.js';
import { mediaCurrentTime } from '../state.js';

const TS_RE = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
// LRC `[offset:NNN]` header tag. Milliseconds, sign optional; positive
// shifts lyrics later, negative shifts earlier.
const OFFSET_RE = /^\s*\[offset:\s*([+-]?\d+)\s*\]\s*$/i;

function parseLyrics(text) {
  const lines = [];
  let sawTimestamp = false;
  let offset = 0; // seconds
  for (const raw of text.split(/\r?\n/)) {
    const om = OFFSET_RE.exec(raw);
    if (om) { offset = Number(om[1]) / 1000; continue; }
    const times = [];
    let m;
    TS_RE.lastIndex = 0;
    while ((m = TS_RE.exec(raw)) !== null) {
      const mm = +m[1];
      const ss = +m[2];
      const frac = m[3] ? +(`0.${m[3]}`) : 0;
      times.push(mm * 60 + ss + frac);
    }
    const content = raw.replace(TS_RE, '').trim();
    if (times.length === 0) {
      lines.push({ t: null, text: raw });
      continue;
    }
    sawTimestamp = true;
    for (const t of times) lines.push({ t, text: content });
  }
  if (!sawTimestamp) return { synced: false, lines, offset: 0 };
  // Drop untimed lines in synced mode (usually LRC header tags like
  // [ar:...], [ti:...] that already stripped to empty) and sort by time.
  const synced = lines.filter((l) => l.t != null).sort((a, b) => a.t - b.t);
  return { synced: true, lines: synced, offset };
}

function findActiveIdx(lines, t) {
  // Largest index i such that lines[i].t <= t. Lines are time-sorted.
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= t) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return ans;
}

export function LyricsPanel({ text }) {
  const parsed = useMemo(() => parseLyrics(text || ''), [text]);
  const [showSynced, setShowSynced] = useState(true);
  const synced = parsed.synced && showSynced;
  const t = mediaCurrentTime.value;
  // LRC `[offset]` is milliseconds added to displayed time: positive =
  // lyrics appear later, negative = earlier. Equivalent to comparing
  // playback time minus offset against the raw line timestamps.
  const effective = t - parsed.offset;
  const activeIdx = synced ? findActiveIdx(parsed.lines, effective) : -1;
  const scrollerRef = useRef(null);
  const activeRef = useRef(null);
  const lastIdxRef = useRef(-2);
  useEffect(() => {
    if (lastIdxRef.current === activeIdx) return;
    lastIdxRef.current = activeIdx;
    const el = activeRef.current;
    const c = scrollerRef.current;
    if (!el || !c) return;
    // Use bounding-rect delta so we don't depend on the scroller being
    // positioned (offsetTop is otherwise relative to the wrong ancestor).
    const elRect = el.getBoundingClientRect();
    const cRect = c.getBoundingClientRect();
    const delta = elRect.top - cRect.top - (c.clientHeight - el.clientHeight) / 2;
    c.scrollBy({ top: delta, behavior: 'smooth' });
  }, [activeIdx]);

  const seek = (sec) => {
    const media = document.querySelector('.media-player audio, .media-player video');
    if (!media) return;
    // Overshoot by a small epsilon: the browser quantizes `currentTime`
    // on seek (often slightly downward) and a subsequent `seeked` event
    // overwrites mediaCurrentTime — without the cushion, findActiveIdx
    // then picks the previous line.
    const target = Math.max(0, sec + parsed.offset + 0.03);
    media.currentTime = target;
    mediaCurrentTime.value = target;
    const p = media.play();
    if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay blocked — ignore */ });
  };

  return html`
    <div class="preview-lyrics" ref=${scrollerRef}>
      ${parsed.synced ? html`
        <div class="lyrics-toggle" title=${synced ? 'Show plain text' : 'Show synced highlighting'}>
          <button type="button" onClick=${() => setShowSynced((v) => !v)}>${synced ? 'synced' : 'plain'}</button>
        </div>
      ` : null}
      ${synced
        ? html`<ol class="lyrics-synced">
            ${parsed.lines.map((l, i) => html`
              <li key=${i}
                  ref=${i === activeIdx ? activeRef : null}
                  class=${i === activeIdx ? 'active' : ''}
                  onClick=${() => seek(l.t)}
                  title=${`Jump to ${formatTime(l.t)}`}>${l.text || '\u00A0'}</li>
            `)}
          </ol>`
        : html`<pre>${text}</pre>`}
    </div>
  `;
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
