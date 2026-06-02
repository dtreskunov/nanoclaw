// Threads rail: head + new-chat button + scrollable list. Pane shell
// (collapse / drawer / chevron toggle) lives in <Pane>.
import { html } from '../html.js';
import {
  threads, threadId, groupId, drawerOpen, channelMeta,
} from '../state.js';
import { openChat, deleteThread } from '../actions.js';
import { tsKey } from '../utils.js';
import { Pane } from './Pane.js';
import { RelativeTime } from './RelativeTime.js';

function threadCtxOf(t) {
  if (!t || !t.channelType || t.channelType === 'web') return null;
  return { channelType: t.channelType, messagingGroupId: t.messagingGroupId, canSend: !!t.canSend };
}

function ThreadRow({ t }) {
  const ct = t.channelType || 'web';
  const meta = channelMeta(ct);
  const active = t.threadId === threadId.value;
  const pillTitle = `${meta.label}${t.counterparty ? ' · ' + t.counterparty : ''}`;
  const subTrailer = `${t.messageCount ? ' · ' + t.messageCount + ' msg' : ''}${ct !== 'web' && t.counterparty ? ' · ' + t.counterparty : ''}`;
  const onOpen = (ev) => {
    if (ev.target.classList.contains('del')) return;
    openChat(groupId.value, t.threadId, threadCtxOf(t)).catch(console.error);
    drawerOpen.threads.value = false;
  };
  const onDel = async (ev) => {
    ev.stopPropagation();
    if (!confirm(`Delete this thread?\n\n"${t.title}"`)) return;
    await deleteThread(t.threadId);
  };
  return html`
    <div class=${'thread' + (active ? ' active' : '')} data-id=${t.threadId} onClick=${onOpen}>
      <div class="title">
        ${ct !== 'web' ? html`<span class="ch-pill" title=${pillTitle}>${meta.icon}</span>` : null}
        ${t.title}
      </div>
      <div class="meta"><${RelativeTime} ts=${t.lastActivityAt} />${subTrailer}</div>
      ${ct === 'web' ? html`<button type="button" class="del" title="Delete thread" aria-label="Delete thread" onClick=${onDel}>\u00d7</button>` : null}
    </div>
  `;
}

function DmRow({ t }) {
  const ct = t.channelType || 'web';
  const meta = channelMeta(ct);
  const active = t.threadId === threadId.value;
  const onOpen = () => {
    openChat(groupId.value, t.threadId, threadCtxOf(t)).catch(console.error);
    drawerOpen.threads.value = false;
  };
  return html`
    <div class=${'thread dm' + (active ? ' active' : '')} data-id=${t.threadId} onClick=${onOpen}>
      <div class="title">
        <span class="ch-pill dm" title=${meta.label}>${meta.icon}</span>
        ${meta.label}
      </div>
      <div class="meta">
        <${RelativeTime} ts=${t.lastActivityAt} />
        ${t.counterparty ? ' \u00b7 ' + t.counterparty : ''}
        ${t.messageCount ? ' \u00b7 ' + t.messageCount + ' msg' : ''}
      </div>
    </div>
  `;
}

export function ThreadsRail() {
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

  // Group by channel. DMs render as DmRow, other threads as ThreadRow,
  // mixed within each channel's section and ordered by recency. The
  // 'web' bucket is pinned to the top; other channels follow,
  // alphabetized by their display label.
  const buckets = new Map();
  for (const t of list) {
    const ct = t.channelType || 'web';
    if (!buckets.has(ct)) buckets.set(ct, []);
    buckets.get(ct).push(t);
  }
  const sections = Array.from(buckets.entries())
    .map(([ct, items]) => ({ ct, label: channelMeta(ct).label, items }))
    .sort((a, b) => {
      if (a.ct === 'web' && b.ct !== 'web') return -1;
      if (b.ct === 'web' && a.ct !== 'web') return 1;
      return a.label.localeCompare(b.label);
    });
  for (const s of sections) {
    s.items.sort((a, b) => tsKey(b.lastActivityAt) - tsKey(a.lastActivityAt));
  }

  return html`
    <${Pane} paneKey="threads" name="threads-rail" label="Threads">
      <div class="threads-actions">
        <button type="button" id="btn-new-chat" onClick=${onNewChat}>
          <span class="plus">+</span> <span class="label">New thread</span>
        </button>
      </div>
      <div class="list" id="threads-list">
        ${list.length === 0
          ? html`<div class="empty">No threads yet</div>`
          : sections.map((s) => html`
            <div class="thread-section">${s.label}</div>
            ${s.items.map((t) => t.kind === 'dm'
              ? html`<${DmRow} key=${t.threadId} t=${t} />`
              : html`<${ThreadRow} key=${t.threadId} t=${t} />`)}
          `)}
      </div>
    <//>
  `;
}
