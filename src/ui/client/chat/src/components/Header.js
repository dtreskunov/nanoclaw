// Header: brand, group select, user, notif button, mobile drawer buttons,
// logout form.
import { html } from '../html.js';
import { groups, groupId, me, notifMutedSig, drawerOpen } from '../state.js';
import { selectGroup } from '../actions.js';
import { toggleMute } from '../notify.js';

export function Header() {
  const onChange = (e) => { selectGroup(e.target.value).catch(console.error); };
  const muted = notifMutedSig.value;
  return html`
    <header>
      <button type="button" class="icon-btn mobile-only" aria-label="Threads"
              onClick=${() => { drawerOpen.threads.value = !drawerOpen.threads.value; drawerOpen.files.value = false; }}>\u2630</button>
      <span class="brand">NanoClaw</span>
      <select id="group-select" aria-label="Agent group" value=${groupId.value || ''} onChange=${onChange}>
        ${groups.value.map((g) => html`<option value=${g.id}>${g.name}${g.isAdmin ? ' [admin]' : ''}</option>`)}
      </select>
      <div class="spacer"></div>
      <span class="user" id="me">${me.value}</span>
      <button type="button" class="icon-btn" aria-label="Notifications" title=${muted ? 'Notifications muted (click to enable)' : 'Mute notifications'}
              onClick=${toggleMute}>${muted ? '\uD83D\uDD15' : '\uD83D\uDD14'}</button>
      <button type="button" class="icon-btn mobile-only" aria-label="Files"
              onClick=${() => { drawerOpen.files.value = !drawerOpen.files.value; drawerOpen.threads.value = false; }}>\uD83D\uDCC1</button>
      <a href="/ui/settings/identities" class="icon-btn" aria-label="Settings" title="Settings"
         style="display:inline-flex;align-items:center;justify-content:center;text-decoration:none">\u2699\uFE0F</a>
      <form method="POST" action="/ui/auth/logout" id="logout-form" style="margin:0">
        <button type="submit" aria-label="Log out" title="Log out">
          <svg class="mobile-only" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span id="logout-label" class="desktop-only">Log out</span>
        </button>
      </form>
    </header>
  `;
}
