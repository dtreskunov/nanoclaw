// Threads rail: head + new-chat button + scrollable list.
import { html } from '../html.js';
import {
  threads, threadId, groupId, paneOpen, drawerOpen, MOBILE_MQ, channelMeta,
} from '../state.js';
import { openChat, clearChat, deleteThread } from '../actions.js';
import { tsKey, fmtRelative, fmtAbsolute } from '../utils.js';

function ChevronToggle({ open, onClick, ariaLabel }) {
  return html`<button type="button" class="icon-btn desktop-only" aria-label=${ariaLabel} onClick=${onClick}>${open ? '\u2039' : '\u203A'}</button>`;
}

function threadCtxOf(t) {
  if (!t || !t.channelType || t.channelType === 'web') return null;
  return { channelType: t.channelType, messagingGroupId: t.messagingGroupId, canSend: !!t.canSend };
}

function ThreadRow({ t }) {
  const ct = t.channelType || 'web';
  const meta = channelMeta(ct);
  const active = t.threadId === threadId.value;
  const pillTitle = `${meta.label}${t.counterparty ? ' · ' + t.counterparty : ''}`;
  const subMeta = `${fmtRelative(t.lastActivityAt)}${t.messageCount ? ' · ' + t.messageCount + ' msg' : ''}${ct !== 'web' && t.counterparty ? ' · ' + t.counterparty : ''}`;
  const onOpen = (ev) => {
    if (ev.target.classList.contains('del')) return;
    openChat(groupId.value, t.threadId, threadCtxOf(t)).catch(console.error);
    drawerOpen.threads.value = false;
  };
  const onDel = async (ev) => {
    ev.stopPropagation();
    if (!confirm(`Delete this chat?\n\n"${t.title}"`)) return;
    await deleteThread(t.threadId);
  };
  return html`
    <div class=${'thread' + (active ? ' active' : '')} data-id=${t.threadId} onClick=${onOpen}>
      <div class="title">
        ${ct !== 'web' ? html`<span class="ch-pill" title=${pillTitle}>${meta.icon}</span>` : null}
        ${t.title}
      </div>
      <div class="meta" title=${fmtAbsolute(t.lastActivityAt)}>${subMeta}</div>
      ${ct === 'web' ? html`<button type="button" class="del" title="Delete chat" aria-label="Delete chat" onClick=${onDel}>\u00d7</button>` : null}
    </div>
  `;
}

export function ThreadsRail() {
  const collapsed = !paneOpen.threads.value;
  const drawer = drawerOpen.threads.value;
  const cls = 'nc-pane threads-rail' + (collapsed ? ' collapsed' : '') + (drawer ? ' open' : '');
  const list = threads.value;
  const onNewChat = () => {
    if (!groupId.value) return;
    openChat(groupId.value, null).then(() => {
      const el = document.getElementById('chat-input');
      if (el) el.focus();
      drawerOpen.threads.value = false;
      drawerOpen.files.value = false;
    }).catch(console.error);
  };
  const onPaneClick = (ev) => {
    if (!collapsed) return;
    if (ev.target.closest('button, a')) return;
    if (MOBILE_MQ.matches) return;
    paneOpen.threads.value = true;
  };
  const onHeadClick = (ev) => {
    if (ev.target.closest('button, a')) return;
    if (MOBILE_MQ.matches) return;
    ev.stopPropagation();
    paneOpen.threads.value = !paneOpen.threads.value;
  };
  return html`
    <aside class=${cls} id="threads-rail" onClick=${onPaneClick}>
      <div class="head" onClick=${onHeadClick}>
        <${ChevronToggle} open=${!collapsed} ariaLabel=${collapsed ? 'Expand threads' : 'Collapse threads'}
                          onClick=${(e) => { e.stopPropagation(); paneOpen.threads.value = !collapsed; }} />
        <span class="title">Chats</span>
      </div>
      <div class="threads-actions">
        <button type="button" id="btn-new-chat" onClick=${onNewChat}>
          <span class="plus">+</span> <span class="label">New chat</span>
        </button>
      </div>
      <div class="list" id="threads-list">
        ${list.length === 0
          ? html`<div class="empty">No chats yet</div>`
          : list.slice().sort((a, b) => tsKey(b.lastActivityAt) - tsKey(a.lastActivityAt)).map((t) => html`<${ThreadRow} key=${t.threadId} t=${t} />`)}
      </div>
    </aside>
  `;
}
