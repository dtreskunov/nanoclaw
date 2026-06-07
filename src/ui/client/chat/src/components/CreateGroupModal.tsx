// "Create new agent group" modal — owner / global admin only.
// Posts to POST /api/groups, then prepends the new group to the picker
// and selects it so the user lands in an immediately-usable state.
import './Settings.css';
import type { JSX } from 'preact';
import { signal, type Signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';

import { postJson } from '../api';
import { selectGroup } from '../actions';
import { groups } from '../state';
import type { Group } from '../types';
import { showToast } from './Toast';

export const createGroupOpen: Signal<boolean> = signal(false);

interface NewGroupResponse {
  id: string;
  name: string;
  folder: string;
  createdAt: string;
}

function errMsg(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const obj = data as { message?: unknown; error?: unknown };
    if (typeof obj.message === 'string' && obj.message) return obj.message;
    if (typeof obj.error === 'string' && obj.error) return obj.error;
  }
  return fallback;
}

export function CreateGroupModal() {
  const open = createGroupOpen.value;
  const [name, setName] = useState('');
  const [folder, setFolder] = useState('');
  const [instructions, setInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setFolder('');
    setInstructions('');
    setSubmitting(false);
    requestAnimationFrame(() => nameRef.current?.focus());
  }, [open]);

  if (!open) return null;

  function close(): void {
    createGroupOpen.value = false;
  }

  async function onSubmit(e: JSX.TargetedEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    const r = await postJson<NewGroupResponse>('api/groups', {
      name: trimmed,
      folder: folder.trim() || undefined,
      instructions: instructions || undefined,
    });
    if (!r.ok) {
      showToast(errMsg(r.data, `HTTP ${r.status}`), 'err');
      setSubmitting(false);
      return;
    }
    // Prepend the new group so it shows up in the picker right away.
    const created: Group = {
      id: r.data.id,
      name: r.data.name,
      isAdmin: true,
      hasContent: true,
      lastActivityAt: r.data.createdAt,
    };
    groups.value = [created, ...groups.value.filter((g) => g.id !== created.id)];
    close();
    showToast(`Created "${created.name}"`);
    selectGroup(created.id).catch((err) => console.error('selectGroup after create', err));
  }

  function onBackdrop(e: JSX.TargetedMouseEvent<HTMLDivElement>): void {
    if ((e.target as HTMLElement).classList.contains('settings-backdrop')) close();
  }
  function onKey(e: JSX.TargetedKeyboardEvent<HTMLElement>): void {
    if (e.key === 'Escape') close();
  }

  return (
    <div class="settings-backdrop" onClick={onBackdrop}>
      <form
        class="settings-modal"
        role="dialog"
        aria-label="Create agent group"
        style="max-width:480px"
        onSubmit={onSubmit}
        onKeyDown={onKey}
      >
        <header class="settings-head">
          <span class="title">New agent group</span>
          <button type="button" class="icon-btn" aria-label="Close" onClick={close}>{'\u2715'}</button>
        </header>
        <div class="settings-body" style="display:flex;flex-direction:column;gap:12px">
          <label style="display:block">
            <span style="display:block;margin-bottom:4px;font-size:12px;color:var(--muted)">Name</span>
            <input
              ref={nameRef}
              type="text"
              value={name}
              required
              placeholder="e.g. Research Helper"
              onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => setName(e.currentTarget.value)}
              style="width:100%"
            />
          </label>
          <label style="display:block">
            <span style="display:block;margin-bottom:4px;font-size:12px;color:var(--muted)">
              Folder <span style="opacity:0.6">(optional — derived from name)</span>
            </span>
            <input
              type="text"
              value={folder}
              placeholder="research-helper"
              onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => setFolder(e.currentTarget.value)}
              style="width:100%"
            />
          </label>
          <label style="display:block">
            <span style="display:block;margin-bottom:4px;font-size:12px;color:var(--muted)">
              Initial instructions <span style="opacity:0.6">(optional)</span>
            </span>
            <textarea
              value={instructions}
              rows={5}
              placeholder="What should this agent know or do?"
              onInput={(e: JSX.TargetedEvent<HTMLTextAreaElement>) => setInstructions(e.currentTarget.value)}
              style="width:100%;resize:vertical;min-height:96px"
            />
          </label>
        </div>
        <footer
          class="settings-foot"
          style="display:flex;justify-content:flex-end;gap:8px;padding:8px 12px;border-top:1px solid var(--border)"
        >
          <button type="button" onClick={close} disabled={submitting}>Cancel</button>
          <button type="submit" class="primary" disabled={submitting || !name.trim()}>
            {submitting ? 'Creating\u2026' : 'Create'}
          </button>
        </footer>
      </form>
    </div>
  );
}
