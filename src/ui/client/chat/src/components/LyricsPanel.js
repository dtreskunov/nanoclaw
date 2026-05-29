// Lyrics panel. Renders plain lyrics in a <pre> when no LRC timestamps
// are present; renders an LRC-synced list with the active line
// highlighted (and auto-scrolled into view) when timestamps are found.
//
// Supported timestamp form: [mm:ss], [mm:ss.x], [mm:ss.xx], [mm:ss.xxx].
// A line may carry multiple timestamps — common in LRC files for
// repeated choruses. Click a synced line to seek the media element.
import { useMemo, useRef, useEffect } from 'preact/hooks';
import { html } from '../html.js';
import { mediaCurrentTime } from '../state.js';

const TS_RE = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

function parseLyrics(text) {
  const lines = [];
  let sawTimestamp = false;
  for (const raw of text.split(/\r?\n/)) {
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
  if (!sawTimestamp) return { synced: false, lines };
  // Drop untimed lines in synced mode (usually LRC header tags like
  // [ar:...], [ti:...] that already stripped to empty) and sort by time.
  const synced = lines.filter((l) => l.t != null).sort((a, b) => a.t - b.t);
  return { synced: true, lines: synced };
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
  const t = mediaCurrentTime.value;
  const activeIdx = parsed.synced ? findActiveIdx(parsed.lines, t) : -1;
  const scrollerRef = useRef(null);
  const activeRef = useRef(null);
  const lastIdxRef = useRef(-2);
  useEffect(() => {
    if (lastIdxRef.current === activeIdx) return;
    lastIdxRef.current = activeIdx;
    const el = activeRef.current;
    const c = scrollerRef.current;
    if (!el || !c) return;
    const top = el.offsetTop - c.clientHeight / 2 + el.clientHeight / 2;
    c.scrollTo({ top, behavior: 'smooth' });
  }, [activeIdx]);

  const seek = (sec) => {
    const media = document.querySelector('.media-player audio, .media-player video');
    if (media) { media.currentTime = sec; mediaCurrentTime.value = sec; }
  };

  return html`
    <div class="preview-lyrics" ref=${scrollerRef}>
      ${parsed.synced
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
