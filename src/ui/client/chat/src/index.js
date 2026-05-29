// Entry point: bootstrap data, mount Preact App.
import { render } from 'preact';
import { batch } from '@preact/signals';
import { html } from './html.js';
import { api } from './api.js';
import { me, groups } from './state.js';
import { App } from './components/App.js';
import { initNotif } from './notify.js';
import { restorePanelState, applyPanelClasses } from './panels.js';
import { applyHash, applyAdminFlag, parseHash } from './hash.js';
import { chatLoading } from './state.js';
import { router } from './router.js';

function sortGroups(list) {
  return list.slice().sort((a, b) => {
    const ta = a.lastActivityAt ? Date.parse(a.lastActivityAt.includes('T') ? a.lastActivityAt : a.lastActivityAt.replace(' ', 'T') + 'Z') : 0;
    const tb = b.lastActivityAt ? Date.parse(b.lastActivityAt.includes('T') ? b.lastActivityAt : b.lastActivityAt.replace(' ', 'T') + 'Z') : 0;
    if (tb !== ta) return tb - ta;
    return a.name.localeCompare(b.name);
  });
}

// Keep body height equal to the visualViewport so the chat composer isn't
// hidden behind the mobile virtual keyboard. Also scroll the textarea
// into view when it gains focus.
function setupViewportFit() {
  const vv = window.visualViewport;
  if (!vv) return;
  const apply = () => { document.documentElement.style.setProperty('--app-height', vv.height + 'px'); };
  apply();
  vv.addEventListener('resize', apply);
  vv.addEventListener('scroll', apply);
  document.addEventListener('focusin', (ev) => {
    if (ev.target?.id === 'chat-input') {
      setTimeout(() => { try { ev.target.scrollIntoView({ block: 'end', behavior: 'smooth' }); } catch {} }, 250);
    }
  });
}

async function init() {
  initNotif();
  setupViewportFit();
  // Restore pane state + mobile class BEFORE first paint so the layout
  // doesn't flash open-then-collapsed.
  restorePanelState();
  applyPanelClasses();
  try {
    const [meRes, groupsRes] = await Promise.all([api('api/me'), api('api/groups')]);
    batch(() => {
      me.value = meRes.userId;
      groups.value = sortGroups(groupsRes.groups);
    });
  } catch (_) {
    // api() already replaced the body with a "not logged in" message on 401.
    return;
  }
  if (groups.value.length === 0) {
    document.getElementById('app').innerHTML =
      '<div style="padding:24px;font:14px system-ui">No accessible groups.</div>';
    return;
  }
  // Resolve the URL hash synchronously into signals (groupId/threadId/
  // treePath) so the first render reflects the URL. Async fetches
  // triggered by selectGroup will still complete later, but the layout
  // itself is settled.
  applyAdminFlag();
  // If the URL points at a thread or a group with prior threads, suppress
  // the "Pick or start / No messages yet" empty states until history
  // arrives. applyHash will toggle chatLoading off when it does.
  const parsed = parseHash();
  if (parsed && parsed.groupId) chatLoading.value = true;
  applyHash(router).catch((err) => console.error('initial route failed', err));
  render(html`<${App} />`, document.getElementById('app'));
}

init().catch((err) => console.error(err));
