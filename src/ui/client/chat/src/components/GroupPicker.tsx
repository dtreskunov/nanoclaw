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
  groupPickerMode,
} from '../state';
import { selectGroup } from '../actions';
import { fmtRelative, fmtAbsolute } from '../utils';
import type { Group } from '../types';
import { createGroupOpen } from './CreateGroupModal';

function isNonMember(g: Group): boolean {
  return g.hasContent === false;
}

interface ChipParts {
  parts: string[];
  isAdminOnly: boolean;
}

function chipParts(g: Group, elevated: boolean): ChipParts {
  const isAdminOnly = elevated && isNonMember(g);
  const parts: string[] = [];
  if (!g.isAdmin) parts.push('\uD83D\uDD12');
  if (isAdminOnly) parts.push('\uD83D\uDC41');
  if (g.lastActivityAt) parts.push(fmtRelative(g.lastActivityAt));
  return { parts, isAdminOnly };
}

function tipFor(g: Group, isAdminOnly: boolean): string {
  const parts: string[] = [g.name];
  if (isAdminOnly) parts.push('Visible to you as admin');
  if (g.lastActivityAt) parts.push(fmtAbsolute(g.lastActivityAt));
  return parts.join(' \u00B7 ');
}

function openModal(mode: 'all' | 'non-members'): void {
  groupPickerMode.value = mode;
  groupPickerOpen.value = true;
}

export function GroupStrip() {
  const elevated = isElevatedUser.value;
  // Subscribe so relative times refresh.
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  nowTick.value;
  const all = groups.value;
  // Strip = member groups, plus the active group if it happens to be
  // non-member (so it's clear what's currently selected).
  const memberGroups = all.filter((g) => !isNonMember(g));
  const active = all.find((g) => g.id === groupId.value);
  const hasActiveNonMember = active && isNonMember(active);
  const stripGroups: Group[] = hasActiveNonMember
    ? [...memberGroups, active]
    : memberGroups;
  const nonMemberCount = elevated ? all.filter(isNonMember).length : 0;
  const showMore = nonMemberCount > 0;

  const pick = (gid: string): void => {
    if (gid !== groupId.value) selectGroup(gid).catch(console.error);
  };

  return (
    <nav class="group-strip desktop-only" role="tablist" aria-label="Agent groups">
      {stripGroups.map((g) => {
        const isActive = g.id === groupId.value;
        const isAdminOnly = elevated && isNonMember(g);
        const sub = g.lastActivityAt ? fmtRelative(g.lastActivityAt) : '';
        return (
          <button
            type="button"
            key={g.id}
            role="tab"
            aria-selected={isActive}
            class={`group-chip${isActive ? ' active' : ''}`}
            title={tipFor(g, isAdminOnly)}
            onClick={() => pick(g.id)}
          >
            <span class="chip-name">{g.name}</span>
            {sub ? <span class="chip-sub">{sub}</span> : null}
          </button>
        );
      })}
      {showMore ? (
        <button
          type="button"
          class="group-chip group-chip-more"
          title={`Show ${nonMemberCount} more agent group${nonMemberCount === 1 ? '' : 's'} you can administer`}
          aria-haspopup="dialog"
          onClick={() => openModal('non-members')}
        >
          <span class="chip-name">More agents{'\u2026'}</span>
        </button>
      ) : null}
      {elevated ? (
        <button
          type="button"
          class="group-chip group-chip-new"
          title="Create a new agent group"
          aria-haspopup="dialog"
          onClick={() => { createGroupOpen.value = true; }}
        >
          <span class="chip-name">{'\u002B New agent'}</span>
        </button>
      ) : null}
    </nav>
  );
}

export function ActiveGroupButton() {
  // Subscribe so the label refreshes with activity time.
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  nowTick.value;
  const elevated = isElevatedUser.value;
  const all = groups.value;
  const visible = elevated ? all : all.filter((g) => !isNonMember(g));
  const active = all.find((g) => g.id === groupId.value) ?? visible[0];
  if (!active) return null;
  const { parts, isAdminOnly } = chipParts(active, elevated);
  const subtitle = parts.join(' \u00B7 ');
  return (
    <button
      type="button"
      class={`active-group-btn mobile-only${isAdminOnly ? ' is-admin-visible' : ''}`}
      aria-label="Switch agent group"
      aria-haspopup="dialog"
      onClick={() => openModal('all')}
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
  const mode = groupPickerMode.value;
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
  const all = groups.value;
  const visible = (() => {
    if (mode === 'non-members') return all.filter(isNonMember);
    return elevated ? all : all.filter((g) => !isNonMember(g));
  })();
  const title = mode === 'non-members' ? 'More agents' : 'Agent groups';

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
        aria-label={title}
        style="max-width:480px"
      >
        <header class="settings-head">
          <span class="title">{title}</span>
          <button type="button" class="icon-btn" aria-label="Close" onClick={close}>{'\u2715'}</button>
        </header>
        <div class="settings-body group-picker-list">
          {visible.map((g) => {
            const isActive = g.id === groupId.value;
            const { parts, isAdminOnly } = chipParts(g, elevated);
            const subtitle = parts.join(' \u00B7 ');
            return (
              <button
                type="button"
                key={g.id}
                class={`group-row${isActive ? ' active' : ''}${isAdminOnly ? ' is-admin-visible' : ''}`}
                aria-current={isActive ? 'true' : undefined}
                title={tipFor(g, isAdminOnly)}
                onClick={() => pick(g.id)}
              >
                <span class="row-name">{g.name}</span>
                {subtitle ? <span class="row-sub">{subtitle}</span> : null}
              </button>
            );
          })}
        </div>
        {elevated ? (
          <footer
            class="settings-foot"
            style="display:flex;justify-content:flex-end;gap:8px;padding:8px 12px;border-top:1px solid var(--border)"
          >
            <button
              type="button"
              class="primary"
              onClick={() => {
                close();
                createGroupOpen.value = true;
              }}
            >
              {'\u002B New agent group'}
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
