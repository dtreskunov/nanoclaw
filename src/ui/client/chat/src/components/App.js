// Top-level App component.
import { useEffect } from 'preact/hooks';
import { html } from '../html.js';
import { paneOpen, drawerOpen, MOBILE_MQ, refs } from '../state.js';
import { Header } from './Header.js';
import { ThreadsRail } from './ThreadsRail.js';
import { ChatMain } from './ChatMain.js';
import { FilesPane } from './FilesPane.js';
import { Settings } from './Settings.js';
import { ShareLinkModal } from './ShareLinkModal.js';
import { Toast } from './Toast.js';
import { persistPanelState, applyPanelClasses } from '../panels.js';
import { applyHash } from '../hash.js';
import { router } from '../router.js';

export function App() {
  // One-shot: register event listeners. Initial pane/mobile/hash state
  // is already applied synchronously in index.js before mount, so the
  // first paint reflects the URL and persisted layout.
  useEffect(() => {
    const onChange = () => applyPanelClasses();
    MOBILE_MQ.addEventListener('change', onChange);
    const onHashChange = () => {
      if (refs.suppressHashCount > 0) { refs.suppressHashCount--; return; }
      applyHash(router).catch(console.error);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => {
      MOBILE_MQ.removeEventListener('change', onChange);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  // Persist pane open/close (but skip the very first effect tick — the
  // initial values came from localStorage already).
  const threadsOpen = paneOpen.threads.value;
  const filesOpen = paneOpen.files.value;
  useEffect(() => { persistPanelState(); }, [threadsOpen, filesOpen]);

  const mainCls = ''
    + (threadsOpen ? '' : ' threads-collapsed')
    + (filesOpen ? '' : ' files-collapsed');
  const backdropShown = drawerOpen.threads.value || drawerOpen.files.value;
  const onBackdrop = () => { drawerOpen.threads.value = false; drawerOpen.files.value = false; };
  return html`
    <${Header} />
    <main id="main" class=${mainCls.trim()}>
      <${ThreadsRail} />
      <${ChatMain} />
      <${FilesPane} />
    </main>
    <div class=${'backdrop' + (backdropShown ? ' show' : '')} id="backdrop" onClick=${onBackdrop}></div>
    <${Settings} />
    <${ShareLinkModal} />
    <${Toast} />
  `;
}
