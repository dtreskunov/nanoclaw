// Header: brand, group select, user, settings button, mobile drawer
// buttons, logout form.
import './Header.css';
import type { JSX } from 'preact';
import { groups, groupId, me, drawerOpen, settingsOpen, isAdmin } from '../state';
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
      <span class="user" id="me">{me.value}</span>
      <button
        type="button"
        class="icon-btn"
        aria-label="Settings"
        title="Settings"
        onClick={() => { settingsOpen.value = !settingsOpen.value; }}
      >{'\u2699\uFE0F'}</button>
      <form method="POST" action="/ui/auth/logout" id="logout-form" style="margin:0">
        <button type="submit" aria-label="Log out" title="Log out">
          <svg
            class="mobile-only"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span id="logout-label" class="desktop-only">Log out</span>
        </button>
      </form>
      <button
        type="button"
        class="icon-btn mobile-only"
        aria-label="Files"
        onClick={() => { drawerOpen.files.value = !drawerOpen.files.value; drawerOpen.threads.value = false; }}
      >{'\uD83D\uDCC1'}</button>
    </header>
  );
}
