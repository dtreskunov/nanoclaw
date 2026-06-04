// Header: brand, group select, settings button, mobile drawer buttons.
import './Header.css';
import type { JSX } from 'preact';
import {
  groups,
  groupId,
  drawerOpen,
  settingsOpen,
  isAdmin,
  showAllGroups,
  hasAnyAdminGroup,
} from '../state';
import { selectGroup } from '../actions';
import { BRAND } from '../brand';

export function Header() {
  const onChange = (e: JSX.TargetedEvent<HTMLSelectElement>): void => {
    selectGroup(e.currentTarget.value).catch(console.error);
  };
  const readOnlyHint = '\uD83D\uDD12 Read-only \u2014 you don\u2019t have admin rights in this group, so you can\u2019t upload, rename or delete files.';
  // Default filter: hide groups the viewer has no content in. Always
  // keep the currently-selected group visible so a deep link or stale
  // hash doesn't strand the user with an empty dropdown.
  const showAll = showAllGroups.value;
  const visibleGroups = groups.value.filter((g) => {
    if (showAll) return true;
    if (g.hasContent !== false) return true;
    if (g.id === groupId.value) return true;
    return false;
  });
  const hiddenCount = groups.value.length - visibleGroups.length;
  return (
    <header>
      <button
        type="button"
        class="icon-btn mobile-only"
        aria-label="Threads"
        onClick={() => { drawerOpen.threads.value = !drawerOpen.threads.value; drawerOpen.files.value = false; }}
      >{'\u2630'}</button>
      <span class="brand">{BRAND.name}</span>
      <select id="group-select" aria-label="Agent group" value={groupId.value || ''} onChange={onChange}>
        {visibleGroups.map((g) => (
          <option value={g.id} key={g.id}>{g.isAdmin ? '' : '\uD83D\uDD12 '}{g.name}</option>
        ))}
      </select>
      {hasAnyAdminGroup.value
        ? (
          <label
            class="show-all-toggle desktop-only"
            title={showAll
              ? 'Showing every accessible group. Toggle off to hide groups you have no threads in.'
              : `Show every accessible group${hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ''}.`}
          >
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => { showAllGroups.value = e.currentTarget.checked; }}
            />
            <span class="label">Show all</span>
          </label>
        )
        : null}
      {!isAdmin.value && groupId.value
        ? (
          <span class="readonly-badge" title={readOnlyHint} aria-label={readOnlyHint}>
            <span aria-hidden="true">{'\uD83D\uDD12'}</span>
            <span class="desktop-only">Read-only</span>
          </span>
        )
        : null}
      <div class="spacer"></div>
      <button
        type="button"
        class="icon-btn"
        aria-label="Settings"
        title="Settings"
        onClick={() => { settingsOpen.value = !settingsOpen.value; }}
      >{'\u2699\uFE0F'}</button>
      <button
        type="button"
        class="icon-btn mobile-only"
        aria-label="Files"
        onClick={() => { drawerOpen.files.value = !drawerOpen.files.value; drawerOpen.threads.value = false; }}
      >{'\uD83D\uDCC1'}</button>
    </header>
  );
}
