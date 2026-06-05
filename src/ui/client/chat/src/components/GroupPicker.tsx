// Group picker — desktop strip + mobile single-button + modal.
import { useEffect } from 'preact/hooks';
import type { JSX } from 'preact';

import './GroupPicker.css';
import {
  groups,
  groupId,
  isElevatedUser,
  nowTick,
  groupPickerOpen,
} from '../state';
import { selectGroup } from '../actions';
import { fmtRelative, fmtAbsolute } from '../utils';
import type { Group } from '../types';

function visibleGroups(): Group[] {
  const elevated = isElevatedUser.value;
  return elevated
    ? groups.value
    : groups.value.filter((g) => g.hasContent !== false);
}

interface ChipParts {
  parts: string[];
  isAdminOnly: boolean;
}

function chipParts(g: Group, elevated: boolean): ChipParts {
  const isAdminOnly = elevated && g.hasContent === false;
  const parts: string[] = [];
  if (!g.isAdmin) parts.push('\uD83D\uDD12');
  if (isAdminOnly) parts.push('\uD83D\uDC41');
  if (g.lastActivityAt) parts.push(fmtRelative(g.lastActivityAt));
  return { parts, isAdminOnly };
}

export function GroupStrip() {
  const elevated = isElevatedUser.value;
  const visible = visibleGroups();
  // Subscribe to tick so relative times refresh.
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  nowTick.value;

  const pick = (gid: string): void => {
    if (gid !== groupId.value) selectGroup(gid).catch(console.error);
  };

  return (
    <nav class="group-strip desktop-only" role="tablist" aria-label="Agent groups">
      {visible.map((g) => {
        const active = g.id === groupId.value;
        const { parts, isAdminOnly } = chipParts(g, elevated);
        const subtitle = parts.join(' \u00B7 ');
        return (
          <button
            type="button"
            key={g.id}
            role="tab"
            aria-selected={active}
            class={`group-chip${active ? ' active' : ''}${isAdminOnly ? ' is-admin-visible' : ''}`}
            title={isAdminOnly
              ? `Visible to you as admin${g.lastActivityAt ? ' \u00B7 ' + fmtAbsolute(g.lastActivityAt) : ''}`
              : g.lastActivityAt ? fmtAbsolute(g.lastActivityAt) : ''}
            onClick={() => pick(g.id)}
          >
            <span class="chip-name">{g.name}</span>
            {subtitle ? <span class="chip-sub">{subtitle}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}

export function ActiveGroupButton() {
  // Subscribe so the label refreshes with activity time.
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  nowTick.value;
  const elevated = isElevatedUser.value;
  const visible = visibleGroups();
  const active = visible.find((g) => g.id === groupId.value) ?? visible[0];
  if (!active) return null;
  const { parts, isAdminOnly } = chipParts(active, elevated);
  const subtitle = parts.join(' \u00B7 ');
  return (
    <button
      type="button"
      class={`active-group-btn mobile-only${isAdminOnly ? ' is-admin-visible' : ''}`}
      aria-label="Switch agent group"
      aria-haspopup="dialog"
      onClick={() => { groupPickerOpen.value = true; }}
    >
      <span class="agb-stack">
        <span class="agb-name">{active.name}</span>
        {subtitle ? <span class="agb-sub">{subtitle}</span> : null}
      </span>
      <span class="agb-caret" aria-hidden="true">{'\u25BE'}</span>
    </button>
  );
}

export function GroupPickerModal() {
  const open = groupPickerOpen.value;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  nowTick.value;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') groupPickerOpen.value = false;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const elevated = isElevatedUser.value;
  const visible = visibleGroups();
  const close = (): void => { groupPickerOpen.value = false; };
  const onBackdrop = (e: JSX.TargetedMouseEvent<HTMLDivElement>): void => {
    if ((e.target as HTMLElement).classList.contains('settings-backdrop')) close();
  };
  const pick = (gid: string): void => {
    close();
    if (gid !== groupId.value) selectGroup(gid).catch(console.error);
  };

  return (
    <div class="settings-backdrop" onClick={onBackdrop}>
      <div
        class="settings-modal group-picker-modal"
        role="dialog"
        aria-label="Switch agent group"
        style="max-width:480px"
      >
        <header class="settings-head">
          <span class="title">Agent groups</span>
          <button type="button" class="icon-btn" aria-label="Close" onClick={close}>{'\u2715'}</button>
        </header>
        <div class="settings-body group-picker-list">
          {visible.map((g) => {
            const active = g.id === groupId.value;
            const { parts, isAdminOnly } = chipParts(g, elevated);
            const subtitle = parts.join(' \u00B7 ');
            return (
              <button
                type="button"
                key={g.id}
                class={`group-row${active ? ' active' : ''}${isAdminOnly ? ' is-admin-visible' : ''}`}
                aria-current={active ? 'true' : undefined}
                onClick={() => pick(g.id)}
              >
                <span class="row-name">{g.name}</span>
                {subtitle ? <span class="row-sub">{subtitle}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
