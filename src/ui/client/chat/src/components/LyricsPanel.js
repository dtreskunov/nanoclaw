// Lyrics panel. Renders plain lyrics in a <pre> when no LRC timestamps
// are present; renders an LRC-synced list with the active line
// highlighted (and auto-scrolled into view) when timestamps are found.
//
// Supported timestamp form: [mm:ss], [mm:ss.x], [mm:ss.xx], [mm:ss.xxx].
// A line may carry multiple timestamps — common in LRC files for
// repeated choruses. Click a synced line to seek the media element.
//
// Sync offset: honors the LRC `[offset:NNN]` header (milliseconds,
// positive = lyrics late in the file, shift earlier) and lets the user
// nudge a per-file offset via the floating control. The user offset is
// persisted in localStorage keyed by file path.
import { useMemo, useRef, useEffect, useState } from 'preact/hooks';
import { html } from '../html.js';
import { mediaCurrentTime } from '../state.js';

const TS_RE = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const OFFSET_RE = /^\s*\[offset:\s*([+-]?\d+)\s*\]\s*$/i;

function parseLyrics(text) {
  const lines = [];
  let sawTimestamp = false;
  let lrcOffset = 0; // seconds
  for (const raw of text.split(/\r?\n/)) {
    const om = OFFSET_RE.exec(raw);
    if (om) { lrcOffset = Number(om[1]) / 1000; continue; }
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
  if (!sawTimestamp) return { synced: false, lines, lrcOffset: 0 };
  const synced = lines.filter((l) => l.t != null).sort((a, b) => a.t - b.t);
  return { synced: true, lines: synced, lrcOffset };
}

function findActiveIdx(lines, t) {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= t) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return ans;
}

const OFFSET_KEY_PREFIX = 'nanoclaw.lyricsOffset.';

function loadUserOffset(path) {
  if (!path) return 0;
  try { return Number(localStorage.getItem(OFFSET_KEY_PREFIX + path)) || 0; } catch { return 0; }
}

function saveUserOffset(path, sec) {
  if (!path) return;
  try {
    if (sec === 0) localStorage.removeItem(OFFSET_KEY_PREFIX + path);
    else localStorage.setItem(OFFSET_KEY_PREFIX + path, String(sec));
  } catch { /* quota or disabled — ignore */ }
}

export function LyricsPanel({ text, path }) {
  const parsed = useMemo(() => parseLyrics(text || ''), [text]);
  const [userOffset, setUserOffset] = useState(() => loadUserOffset(path));
  useEffect(() => { setUserOffset(loadUserOffset(path)); }, [path]);

  const currentTime = mediaCurrentTime.value;
  // Effective time used to match the active line. Subtract the LRC
  // file's own offset (positive in the tag = lyrics late, shift
  // earlier), then add the user's per-file nudge.
  const effective = currentTime - parsed.lrcOffset + userOffset;
  const activeIdx = parsed.synced ? findActiveIdx(parsed.lines, effective) : -1;

  const scrollerRef = useRef(null);
  const activeRef = useRef(null);
  const lastIdxRef = useRef(-2);
  useEffect(() => {
    if (lastIdxRef.current === activeIdx) return;
    lastIdxRef.current = activeIdx;
    const el = activeRef.current;
    const c = scrollerRef.current;
    if (!el || !c) return;
    const elRect = el.getBoundingClientRect();
    const cRect = c.getBoundingClientRect();
    const delta = elRect.top - cRect.top - (c.clientHeight - el.clientHeight) / 2;
    c.scrollBy({ top: delta, behavior: 'smooth' });
  }, [activeIdx]);

  const seek = (lineT) => {
    // Audio time that should make `lineT` the active line.
    const audioT = lineT + parsed.lrcOffset - userOffset;
    const media = document.querySelector('.media-player audio, .media-player video');
    if (media) { media.currentTime = Math.max(0, audioT); mediaCurrentTime.value = media.currentTime; }
  };

  const nudge = (delta) => {
    const next = Math.round((userOffset + delta) * 10) / 10;
    setUserOffset(next);
    saveUserOffset(path, next);
  };
  // "Sync here": treat the currently-highlighted line as the one that
  // should be playing right now and compute the offset to match.
  const syncHere = () => {
    if (activeIdx < 0) return;
    const lineT = parsed.lines[activeIdx].t;
    const next = Math.round((lineT - (currentTime - parsed.lrcOffset)) * 10) / 10;
    setUserOffset(next);
    saveUserOffset(path, next);
  };
  const reset = () => { setUserOffset(0); saveUserOffset(path, 0); };

  return html`
    <div class="preview-lyrics" ref=${scrollerRef}>
      ${parsed.synced ? html`
        <div class="lyrics-offset" title="Lyrics sync offset (saved per file). Negative = lyrics earlier, positive = lyrics later.">
          <button type="button" onClick=${() => nudge(-0.5)} title="Lyrics 0.5s earlier">\u2212</button>
          <button type="button" class="lyrics-offset-val" onClick=${reset} title="Reset to 0">${formatOffset(userOffset)}</button>
          <button type="button" onClick=${() => nudge(0.5)} title="Lyrics 0.5s later">+</button>
          <button type="button" class="lyrics-offset-sync" onClick=${syncHere} title="Sync the highlighted line to the current playback time">sync</button>
        </div>
      ` : null}
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

function formatOffset(s) {
  if (s === 0) return '0.0s';
  return `${s > 0 ? '+' : ''}${s.toFixed(1)}s`;
}
