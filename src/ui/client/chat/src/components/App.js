// Top-level App component.
import { useEffect } from 'preact/hooks';
import { html } from '../html.js';
import { paneOpen, drawerOpen, MOBILE_MQ, refs } from '../state.js';
import { Header } from './Header.js';
import { ThreadsRail } from './ThreadsRail.js';
import { ChatMain } from './ChatMain.js';
import { FilesPane } from './FilesPane.js';
import { restorePanelState, persistPanelState, applyPanelClasses } from '../panels.js';
import { applyHash } from '../hash.js';
import { loadThreads, openChat, clearChat, selectGroup, loadTree, selectFile } from '../actions.js';

const router = {
  selectGroup, loadThreads, openChat, clearChat, loadTree, selectFile,
  notFound: (msg) => { console.warn(msg); },
};

export function App() {
  // One-shot init: restore pane state + register listeners.
  useEffect(() => {
    restorePanelState();
    applyPanelClasses();
    const onChange = () => applyPanelClasses();
    MOBILE_MQ.addEventListener('change', onChange);
    const onHashChange = () => {
      if (refs.suppressHashCount > 0) { refs.suppressHashCount--; return; }
      applyHash(router).catch(console.error);
    };
    window.addEventListener('hashchange', onHashChange);
    // Initial route application — must happen after the App is mounted so
    // openChat's WS reconnect can find the DOM if it needs it.
    applyHash(router).catch(console.error);
    return () => {
      MOBILE_MQ.removeEventListener('change', onChange);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  // Persist pane open/close and reflect on <main>'s grid-template class.
  const threadsOpen = paneOpen.threads.value;
  const filesOpen = paneOpen.files.value;
  useEffect(() => {
    persistPanelState();
    applyPanelClasses();
  }, [threadsOpen, filesOpen]);

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
  `;
}
