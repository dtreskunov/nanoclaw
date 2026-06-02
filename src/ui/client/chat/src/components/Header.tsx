// Header: brand, group select, settings button, mobile drawer buttons.
import './Header.css';
import type { JSX } from 'preact';
import { groups, groupId, drawerOpen, settingsOpen, isAdmin } from '../state';
import { selectGroup } from '../actions';

export function Header() {
  const onChange = (e: JSX.TargetedEvent<HTMLSelectElement>): void => {
    selectGroup(e.currentTarget.value).catch(console.error);
  };
  const readOnlyHint = '\uD83D\uDD12 Read-only \u2014 you don\u2019t have admin rights in this group, so you can\u2019t upload, rename or delete files.';
  return (
    <header>
      <button
        type="button"
        class="icon-btn mobile-only"
        aria-label="Threads"
        onClick={() => { drawerOpen.threads.value = !drawerOpen.threads.value; drawerOpen.files.value = false; }}
      >{'\u2630'}</button>
      <span class="brand">NanoClaw</span>
      <select id="group-select" aria-label="Agent group" value={groupId.value || ''} onChange={onChange}>
        {groups.value.map((g) => (
          <option value={g.id} key={g.id}>{g.isAdmin ? '' : '\uD83D\uDD12 '}{g.name}</option>
        ))}
      </select>
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
