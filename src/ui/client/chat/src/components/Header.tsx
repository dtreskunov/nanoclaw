// Header: brand, group strip, settings button, mobile drawer buttons.
import './Header.css';
import {
  drawerOpen,
  groupAdminOpen,
  isAdmin,
  settingsOpen,
} from '../state';
import { BRAND } from '../brand';
import { GroupStrip, ActiveGroupButton } from './GroupPicker';

export function Header() {
  const admin = isAdmin.value;
  return (
    <header>
      <button
        type="button"
        class="icon-btn mobile-only"
        aria-label="Threads"
        onClick={() => { drawerOpen.threads.value = !drawerOpen.threads.value; drawerOpen.files.value = false; }}
      >{'\u2630'}</button>
      <span class="brand">{BRAND.name}</span>
      <GroupStrip />
      <ActiveGroupButton />
      {admin ? (
        <button
          type="button"
          class="icon-btn"
          aria-label="Group admin"
          title="Group admin"
          onClick={() => { groupAdminOpen.value = !groupAdminOpen.value; }}
        >{'\uD83D\uDEE0\uFE0F'}</button>
      ) : null}
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
