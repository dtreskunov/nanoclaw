// Generic tooltip — wraps any child, shows a styled bubble on hover/focus.
// Multi-line content supported (use '\n' in `text`, rendered as <br>).
import './Tooltip.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren, JSX } from 'preact';

interface TooltipProps {
  text: string;
  children: ComponentChildren;
  /** Preferred side; falls back to opposite if too close to the edge. */
  side?: 'top' | 'bottom';
}

export function Tooltip({ text, children, side = 'top' }: TooltipProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [actualSide, setActualSide] = useState<'top' | 'bottom'>(side);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    // Flip to bottom if the preferred top would clip above the viewport.
    if (side === 'top' && rect.top < 200) setActualSide('bottom');
    else if (side === 'bottom' && window.innerHeight - rect.bottom < 200) setActualSide('top');
    else setActualSide(side);
  }, [open, side]);

  return (
    <span
      ref={wrapRef}
      class="tooltip-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusIn={() => setOpen(true)}
      onFocusOut={() => setOpen(false)}
    >
      {children}
      {open ? (
        <span class={`tooltip-bubble tooltip-${actualSide}`} role="tooltip">
          {text.split('\n').map((line, i) => (
            <span key={i} class="tooltip-line">{line}</span>
          ))}
        </span>
      ) : null}
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
