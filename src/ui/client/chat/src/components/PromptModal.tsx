// Generic in-app text prompt — replaces window.prompt() which isn't
// available in some browsing contexts.
import './Settings.css';
import type { JSX } from 'preact';
import { signal, type Signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';

interface PromptRequest {
  title: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  okLabel?: string;
  resolve: (value: string | null) => void;
}

const promptRequest: Signal<PromptRequest | null> = signal<PromptRequest | null>(null);

export function requestInput(opts: Omit<PromptRequest, 'resolve'>): Promise<string | null> {
  return new Promise((resolve) => {
    promptRequest.value = { ...opts, resolve };
  });
}

export function PromptModal() {
  const req = promptRequest.value;
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!req) return;
    setValue(req.initialValue || '');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [req]);

  if (!req) return null;

  function close(result: string | null): void {
    const r = promptRequest.value;
    promptRequest.value = null;
    r?.resolve(result);
  }
  function onSubmit(e: JSX.TargetedEvent<HTMLFormElement>): void {
    e.preventDefault();
    const trimmed = value.trim();
    close(trimmed ? trimmed : null);
  }
  function onBackdrop(e: JSX.TargetedMouseEvent<HTMLDivElement>): void {
    if ((e.target as HTMLElement).classList.contains('settings-backdrop')) close(null);
  }
  function onKey(e: JSX.TargetedKeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Escape') close(null);
  }

  return (
    <div class="settings-backdrop" onClick={onBackdrop}>
      <form
        class="settings-modal"
        role="dialog"
        aria-label={req.title}
        style="max-width:420px"
        onSubmit={onSubmit}
      >
        <header class="settings-head">
          <span class="title">{req.title}</span>
          <button type="button" class="icon-btn" aria-label="Close" onClick={() => close(null)}>{'\u2715'}</button>
        </header>
        <div class="settings-body">
          {req.label ? <label style="display:block;margin-bottom:6px;font-size:12px;color:var(--muted)">{req.label}</label> : null}
          <input
            ref={inputRef}
            type="text"
            value={value}
            placeholder={req.placeholder || ''}
            onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => setValue(e.currentTarget.value)}
            onKeyDown={onKey}
            style="width:100%"
          />
        </div>
        <footer class="settings-foot" style="display:flex;justify-content:flex-end;gap:8px;padding:8px 12px;border-top:1px solid var(--border)">
          <button type="button" onClick={() => close(null)}>Cancel</button>
          <button type="submit" class="primary">{req.okLabel || 'OK'}</button>
        </footer>
      </form>
    </div>
  );
}
