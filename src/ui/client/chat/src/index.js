// Entry point: bootstrap data, mount Preact App.
import { render } from 'preact';
import { html } from './html.js';
import { api } from './api.js';
import { me, groups } from './state.js';
import { App } from './components/App.js';
import { initNotif } from './notify.js';

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
  try {
    const meRes = await api('api/me');
    me.value = meRes.userId;
    const { groups: gs } = await api('api/groups');
    groups.value = sortGroups(gs);
  } catch (_) {
    // api() already replaced the body with a "not logged in" message on 401.
    return;
  }
  if (groups.value.length === 0) {
    document.getElementById('app').innerHTML =
      '<div style="padding:24px;font:14px system-ui">No accessible groups.</div>';
    return;
  }
  render(html`<${App} />`, document.getElementById('app'));
}

init().catch((err) => console.error(err));
