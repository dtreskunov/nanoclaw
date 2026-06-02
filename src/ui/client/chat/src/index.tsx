// Entry point: bootstrap data, mount Preact App.
import { render } from 'preact';
import { batch } from '@preact/signals';
import { api } from './api';
import { me, groups, settingsOpen, chatLoading } from './state';
import { App } from './components/App';
import { initNotif } from './notify';
import { restorePanelState, applyPanelClasses } from './panels';
import { applyHash, applyAdminFlag, parseHash } from './hash';
import { router } from './router';
import { installLivenessHandlers } from './actions';
import type { Group } from './types';

interface MeResponse { displayName?: string; userId: string }
interface GroupsResponse { groups: Group[] }

function sortGroups(list: Group[]): Group[] {
  return list.slice().sort((a, b) => {
    const parseTs = (s: string | undefined): number => {
      if (!s) return 0;
      const norm = s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
      return Date.parse(norm) || 0;
    };
    const ta = parseTs(a.lastActivityAt);
    const tb = parseTs(b.lastActivityAt);
    if (tb !== ta) return tb - ta;
    return a.name.localeCompare(b.name);
  });
}

function setupViewportFit(): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const apply = (): void => { document.documentElement.style.setProperty('--app-height', vv.height + 'px'); };
  apply();
  vv.addEventListener('resize', apply);
  vv.addEventListener('scroll', apply);
  document.addEventListener('focusin', (ev: FocusEvent) => {
    const t = ev.target as HTMLElement | null;
    if (t?.id === 'chat-input') {
      setTimeout(() => {
        try { (t as HTMLElement).scrollIntoView({ block: 'end', behavior: 'smooth' }); } catch { /* ignore */ }
      }, 250);
    }
  });
}

async function init(): Promise<void> {
  initNotif();
  setupViewportFit();
  installLivenessHandlers();
  restorePanelState();
  applyPanelClasses();
  try {
    const [meRes, groupsRes] = await Promise.all([
      api<MeResponse>('api/me'),
      api<GroupsResponse>('api/groups'),
    ]);
    batch(() => {
      me.value = meRes.displayName || meRes.userId;
      groups.value = sortGroups(groupsRes.groups);
    });
  } catch {
    return;
  }
  if (groups.value.length === 0) {
    const app = document.getElementById('app');
    if (app) app.innerHTML = '<div style="padding:24px;font:14px system-ui">No accessible groups.</div>';
    return;
  }
  applyAdminFlag();
  const parsed = parseHash();
  if (parsed && parsed.groupId) chatLoading.value = true;
  applyHash(router).catch((err) => console.error('initial route failed', err));
  const app = document.getElementById('app');
  if (app) render(<App />, app);
  try {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('settings') === '1') {
      settingsOpen.value = true;
      sp.delete('settings');
      const q = sp.toString();
      const url = window.location.pathname + (q ? '?' + q : '') + window.location.hash;
      window.history.replaceState(null, '', url);
    }
  } catch { /* ignore */ }
}

init().catch((err) => console.error(err));
