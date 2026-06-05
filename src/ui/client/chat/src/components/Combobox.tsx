// Custom combobox / typeahead. Renders a text input with a popup list of
// options that filters by substring as the user types. The list has a solid
// surface background (not transparent) and each item highlights on hover.
//
// Free-form input is allowed — pressing Enter commits whatever's in the box.
// Use the optional `detail` / `tooltip` per option to show a secondary line
// and an info icon next to each row.
import './Combobox.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';

export interface ComboboxOption {
  /** Wire value committed when the user picks this row. */
  value: string;
  /** Primary text shown in the row. */
  label: string;
  /** Optional secondary text shown right of the label. */
  detail?: string;
  /** Multi-line tooltip shown via an info icon on the row. */
  tooltip?: string;
}

interface ComboboxProps {
  value: string | null;
  options: ComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  /** If true (default), free-form input is allowed; the box stores raw text. */
  freeform?: boolean;
  onChange: (v: string | null) => void;
}

export function Combobox({
  value,
  options,
  placeholder,
  disabled,
  freeform = true,
  onChange,
}: ComboboxProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value ?? '');
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track external value changes (e.g. provider switch resets model).
  useEffect(() => { setText(value ?? ''); }, [value]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Filter: when the user has typed something *different from the selected
  // value*, narrow by substring; otherwise show everything. This makes
  // "click caret to browse" feel natural — opening the popup on a saved
  // selection shows the whole list, not just the one already-picked row.
  const trimmed = text.trim();
  const showAll = !trimmed || trimmed === (value ?? '').trim();
  const filterText = trimmed.toLowerCase();
  const matches = showAll
    ? options
    : options.filter((o) =>
        o.value.toLowerCase().includes(filterText) || o.label.toLowerCase().includes(filterText),
      );

  function commit(next: string): void {
    setText(next);
    onChange(freeform ? next || null : next || null);
    setOpen(false);
    setHighlight(-1);
  }

  function onKeyDown(e: JSX.TargetedKeyboardEvent<HTMLInputElement>): void {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && highlight >= 0 && matches[highlight]) {
        e.preventDefault();
        commit(matches[highlight]!.value);
      } else if (freeform) {
        commit(text);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlight(-1);
    }
  }

  return (
    <div ref={rootRef} class="combobox" data-open={open}>
      <input
        ref={inputRef}
        type="text"
        class="combobox-input"
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        autocomplete="off"
        spellcheck={false}
        onFocus={() => setOpen(true)}
        onInput={(e) => {
          const v = (e.currentTarget as HTMLInputElement).value;
          setText(v);
          if (freeform) onChange(v || null);
          setOpen(true);
          setHighlight(-1);
        }}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        class="combobox-caret"
        tabIndex={-1}
        aria-label="Show options"
        disabled={disabled}
        onMouseDown={(e) => {
          // Prevent input blur so the popup stays put.
          e.preventDefault();
          setOpen((o) => !o);
          inputRef.current?.focus();
        }}
      >▾</button>
      {open && matches.length > 0 ? (
        <ul class="combobox-list" role="listbox">
          {matches.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              class={'combobox-option' + (i === highlight ? ' highlight' : '') + (o.value === value ? ' selected' : '')}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus on input
                commit(o.value);
              }}
            >
              <span class="combobox-option-main">
                <span class="combobox-option-label">{o.label}</span>
                {o.detail ? <span class="combobox-option-detail">{o.detail}</span> : null}
              </span>
              {o.tooltip ? <OptionInfo text={o.tooltip} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// Inline info icon used inside option rows — separate so it doesn't pull in
// the full Tooltip wrapper (which would compete with the row's click).
function OptionInfo({ text }: { text: string }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <span
      class="combobox-option-info"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onMouseDown={(e) => e.preventDefault()}
    >
      <span class="info-icon" aria-label="More info">i</span>
      {open ? (
        <span class="tooltip-bubble tooltip-top" role="tooltip">
          {text.split('\n').map((line, i) => (
            <span key={i} class="tooltip-line">{line}</span>
          ))}
        </span>
      ) : null}
    </span>
  );
}
