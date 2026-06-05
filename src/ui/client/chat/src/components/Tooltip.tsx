// Generic tooltip — wraps any child, shows a styled bubble on hover/focus.
// Renders the bubble to <body> with position:fixed so it escapes any
// overflow:hidden / overflow:auto ancestor (e.g. modal bodies, dropdown
// popups). Multi-line content supported via '\n'.
import './Tooltip.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import type { ComponentChildren, JSX } from 'preact';

interface TooltipProps {
  text: string;
  children: ComponentChildren;
  /** Preferred side; falls back to opposite if too close to the edge. */
  side?: 'top' | 'bottom';
}

interface Pos {
  /** Top of the bubble in viewport (px). */
  top: number;
  /** Left of the bubble in viewport (px). */
  left: number;
  side: 'top' | 'bottom';
}

const BUBBLE_MARGIN = 6; // gap between trigger and bubble
const BUBBLE_MAX_WIDTH = 320;
const VIEWPORT_PADDING = 8;

export function Tooltip({ text, children, side = 'top' }: TooltipProps): JSX.Element {
  const [pos, setPos] = useState<Pos | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  function computePos(): void {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const wrapRect = wrap.getBoundingClientRect();

    // Bubble dimensions — measured if mounted, otherwise reasonable fallback.
    const bubble = bubbleRef.current;
    const bubbleWidth = bubble?.offsetWidth ?? Math.min(BUBBLE_MAX_WIDTH, window.innerWidth - 2 * VIEWPORT_PADDING);
    const bubbleHeight = bubble?.offsetHeight ?? 120;

    // Pick whichever side has more room. Preferred side wins ties.
    const roomAbove = wrapRect.top - VIEWPORT_PADDING - BUBBLE_MARGIN;
    const roomBelow = window.innerHeight - wrapRect.bottom - VIEWPORT_PADDING - BUBBLE_MARGIN;
    const topFits = roomAbove >= bubbleHeight;
    const bottomFits = roomBelow >= bubbleHeight;
    let actualSide: 'top' | 'bottom';
    if (side === 'top') {
      actualSide = topFits || roomAbove >= roomBelow ? 'top' : 'bottom';
    } else {
      actualSide = bottomFits || roomBelow >= roomAbove ? 'bottom' : 'top';
    }

    // Horizontal: centered on the trigger, clamped to viewport.
    const centerX = wrapRect.left + wrapRect.width / 2;
    let left = centerX - bubbleWidth / 2;
    left = Math.max(VIEWPORT_PADDING, Math.min(window.innerWidth - bubbleWidth - VIEWPORT_PADDING, left));

    // Vertical: anchor on the chosen side, then clamp so the bubble stays
    // in the viewport even if neither side has full room.
    let top = actualSide === 'top'
      ? wrapRect.top - BUBBLE_MARGIN - bubbleHeight
      : wrapRect.bottom + BUBBLE_MARGIN;
    top = Math.max(VIEWPORT_PADDING, Math.min(window.innerHeight - bubbleHeight - VIEWPORT_PADDING, top));

    setPos({ top, left, side: actualSide });
  }

  function open(): void { computePos(); }
  function close(): void { setPos(null); }

  // Re-measure once mounted (bubbleRef now has dimensions).
  useEffect(() => {
    if (pos) {
      const t = setTimeout(() => computePos(), 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [pos !== null]);

  // Close on scroll / resize so the bubble doesn't drift.
  useEffect(() => {
    if (!pos) return undefined;
    const onChange = (): void => close();
    window.addEventListener('scroll', onChange, true);
    window.addEventListener('resize', onChange);
    return () => {
      window.removeEventListener('scroll', onChange, true);
      window.removeEventListener('resize', onChange);
    };
  }, [pos !== null]);

  return (
    <span
      ref={wrapRef}
      class="tooltip-wrap"
      onMouseEnter={open}
      onMouseLeave={close}
      onFocusIn={open}
      onFocusOut={close}
    >
      {children}
      {pos
        ? createPortal(
            <div
              ref={bubbleRef}
              class={`tooltip-bubble tooltip-${pos.side}`}
              role="tooltip"
              style={{ top: pos.top + 'px', left: pos.left + 'px' }}
            >
              {text.split('\n').map((line, i) => (
                <span key={i} class="tooltip-line">{line}</span>
              ))}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}

/** Convenience: a small "i" icon button that shows the tooltip on hover. */
export function InfoIcon({ text }: { text: string }): JSX.Element {
  return (
    <Tooltip text={text}>
      <span class="info-icon" tabindex={0} aria-label="More info">i</span>
    </Tooltip>
  );
}
