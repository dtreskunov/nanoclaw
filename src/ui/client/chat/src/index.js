// Entry point: global event wiring + init.
import { state, chat, PANES, MOBILE_MQ } from './state.js';
import { $ } from './utils.js';
import { api } from './api.js';
import { applyHash } from './hash.js';
import { sortGroups, populateGroupSelect, currentContextPath, renderContextChip } from './files.js';
import { openChat, sendChat, addPendingFiles, renderPending } from './chat.js';
import {
  restorePanelState,
  togglePane,
  toggleMobileDrawer,
  closeMobileDrawers,
  applyPanelClasses,
  wireNotifButton,
} from './panels.js';
import { mkdirPrompt, touchPrompt, uploadFiles, setupDragDrop } from './uploads.js';

async function init() {
  const me = await api('api/me');
  $('me').textContent = me.userId;
  const { groups } = await api('api/groups');
  state.groups = sortGroups(groups);
  populateGroupSelect();
  if (!state.groups.length) {
    $('preview').innerHTML = '<div class="empty">No accessible groups.</div>';
    $('files-pane').classList.add('previewing');
    return;
  }
  restorePanelState();
  wireGlobalEvents();
  window.addEventListener('hashchange', () => {
    if (state.suppressHashCount > 0) { state.suppressHashCount--; return; }
    applyHash().catch(console.error);
  });
  await applyHash();
}

function wireGlobalEvents() {
  $('btn-new-chat').addEventListener('click', () => {
    if (!state.groupId) return;
    openChat(state.groupId, null).then(() => { $('chat-input').focus(); closeMobileDrawers(); }).catch(console.error);
  });
  const logoutForm = document.getElementById('logout-form');
  if (logoutForm) {
    logoutForm.addEventListener('submit', (e) => {
      if (MOBILE_MQ.matches && !window.confirm('Log out?')) e.preventDefault();
    });
  }
  wireNotifButton();
  const btnUpload = document.getElementById('btn-upload');
  const btnMkdir = document.getElementById('btn-mkdir');
  const uploadInput = document.getElementById('upload-input');
  if (btnUpload && uploadInput) {
    btnUpload.addEventListener('click', () => uploadInput.click());
    uploadInput.addEventListener('change', () => {
      if (uploadInput.files && uploadInput.files.length) uploadFiles(uploadInput.files);
      uploadInput.value = '';
    });
  }
  if (btnMkdir) btnMkdir.addEventListener('click', () => mkdirPrompt());
  const btnTouch = document.getElementById('btn-touch');
  if (btnTouch) btnTouch.addEventListener('click', () => touchPrompt());
  setupDragDrop();
  // .nc-pane component: bind expand/collapse click handlers on each pane.
  // Clicks on the head toggle in both states; clicks on the collapsed
  // body also toggle. Interactive children (button, a) are exempt. All
  // toggling is desktop-only — on mobile the same pane is a drawer.
  function registerPane(p) {
    const pane = $(p.id);
    if (!pane) return;
    const toggle = () => togglePane(p.key);
    const headEl = pane.querySelector(':scope > .head');
    if (headEl) headEl.addEventListener('click', (ev) => {
      if (ev.target.closest('button, a')) return;
      if (MOBILE_MQ.matches) return;
      ev.stopPropagation();
      toggle();
    });
    pane.addEventListener('click', (ev) => {
      if (state.paneOpen[p.key]) return;
      if (ev.target.closest('button, a')) return;
      if (MOBILE_MQ.matches) return;
      toggle();
    });
    if (p.toggleBtn) $(p.toggleBtn)?.addEventListener('click', toggle);
    if (p.mobileBtn) $(p.mobileBtn)?.addEventListener('click', () => toggleMobileDrawer(p.key));
  }
  for (const p of PANES) registerPane(p);
  MOBILE_MQ.addEventListener('change', applyPanelClasses);
  $('backdrop').addEventListener('click', closeMobileDrawers);

  $('chat-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const input = $('chat-input');
    const text = input.value.trim();
    const files = chat.pending.slice();
    if (!text && files.length === 0) return;
    const ctx = !chat.contextDismissed ? currentContextPath() : null;
    const fullText = ctx ? `> Context (file browser): \`${ctx.path}\`\n\n${text}` : text;
    input.value = '';
    chat.pending = [];
    renderPending();
    chat.contextDismissed = false;
    renderContextChip();
    sendChat(fullText, files).catch(console.error);
  });

  $('chat-input').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); $('chat-form').requestSubmit(); }
  });

  const attachBtn = $('chat-attach');
  const fileInput = $('chat-file');
  if (attachBtn && fileInput) {
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { addPendingFiles(Array.from(fileInput.files || [])); fileInput.value = ''; });
  }

  const chatEl = $('chat-main');
  if (chatEl) {
    let dragDepth = 0;
    chatEl.addEventListener('dragenter', (ev) => {
      if (!ev.dataTransfer || ev.dataTransfer.types.indexOf('Files') < 0) return;
      ev.preventDefault(); dragDepth++; chatEl.classList.add('drag-active');
    });
    chatEl.addEventListener('dragover', (ev) => {
      if (!ev.dataTransfer || ev.dataTransfer.types.indexOf('Files') < 0) return;
      ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy';
    });
    chatEl.addEventListener('dragleave', () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) chatEl.classList.remove('drag-active');
    });
    chatEl.addEventListener('drop', (ev) => {
      if (!ev.dataTransfer) return;
      ev.preventDefault();
      dragDepth = 0;
      chatEl.classList.remove('drag-active');
      const files = Array.from(ev.dataTransfer.files || []);
      if (files.length > 0) addPendingFiles(files);
    });
  }

  $('chat-input').addEventListener('paste', (ev) => {
    const items = ev.clipboardData && ev.clipboardData.files;
    if (!items || items.length === 0) return;
    ev.preventDefault();
    addPendingFiles(Array.from(items));
  });

  setupViewportFit();
}

// Keep body height equal to the visualViewport so the chat composer isn't
// hidden behind the mobile virtual keyboard. Also scroll the input into view
// when it gains focus.
function setupViewportFit() {
  const vv = window.visualViewport;
  if (!vv) return;
  const apply = () => {
    document.documentElement.style.setProperty('--app-height', vv.height + 'px');
  };
  apply();
  vv.addEventListener('resize', apply);
  vv.addEventListener('scroll', apply);
  const input = $('chat-input');
  if (input) {
    input.addEventListener('focus', () => {
      setTimeout(() => {
        try { input.scrollIntoView({ block: 'end', behavior: 'smooth' }); } catch {}
      }, 250);
    });
  }
}

init().catch((err) => console.error(err));
