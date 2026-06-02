// Lyrics panel: plain or LRC-synced.
import { useMemo, useRef, useEffect, useState } from 'preact/hooks';
import { mediaCurrentTime } from '../state';

const TS_RE = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const OFFSET_RE = /^\s*\[offset:\s*([+-]?\d+)\s*\]\s*$/i;

interface Line { t: number | null; text: string }
interface Parsed { synced: boolean; lines: Line[]; offset: number }

function parseLyrics(text: string): Parsed {
  const lines: Line[] = [];
  let sawTimestamp = false;
  let offset = 0;
  for (const raw of text.split(/\r?\n/)) {
    const om = OFFSET_RE.exec(raw);
    if (om) { offset = Number(om[1]) / 1000; continue; }
    const times: number[] = [];
    let m: RegExpExecArray | null;
    TS_RE.lastIndex = 0;
    while ((m = TS_RE.exec(raw)) !== null) {
      const mm = +m[1]!;
      const ss = +m[2]!;
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
  const synced = lines.filter((l) => l.t != null).sort((a, b) => (a.t! - b.t!));
  return { synced: true, lines: synced, offset };
}

function findActiveIdx(lines: Line[], t: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((lines[mid]!.t ?? 0) <= t) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return ans;
}

interface Props { text: string }

export function LyricsPanel({ text }: Props) {
  const parsed = useMemo<Parsed>(() => parseLyrics(text || ''), [text]);
  const [showSynced, setShowSynced] = useState(true);
  const synced = parsed.synced && showSynced;
  const t = mediaCurrentTime.value;
  const effective = t - parsed.offset;
  const activeIdx = synced ? findActiveIdx(parsed.lines, effective) : -1;
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLLIElement | null>(null);
  const lastIdxRef = useRef<number>(-2);
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

  const seek = (sec: number): void => {
    const media = document.querySelector<HTMLMediaElement>('.media-player audio, .media-player video');
    if (!media) return;
    const target = Math.max(0, sec + parsed.offset + 0.03);
    media.currentTime = target;
    mediaCurrentTime.value = target;
    const p = media.play();
    if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay blocked */ });
  };

  return (
    <div class="preview-lyrics" ref={scrollerRef}>
      {parsed.synced ? (
        <div class="lyrics-toggle" title={synced ? 'Show plain text' : 'Show synced highlighting'}>
          <button type="button" onClick={() => setShowSynced((v) => !v)}>{synced ? 'synced' : 'plain'}</button>
        </div>
      ) : null}
      {synced
        ? (
          <ol class="lyrics-synced">
            {parsed.lines.map((l, i) => (
              <li
                key={i}
                ref={i === activeIdx ? activeRef : null}
                class={i === activeIdx ? 'active' : ''}
                onClick={() => seek(l.t!)}
                title={`Jump to ${formatTime(l.t!)}`}
              >{l.text || '\u00A0'}</li>
            ))}
          </ol>
        )
        : <pre>{text}</pre>}
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
