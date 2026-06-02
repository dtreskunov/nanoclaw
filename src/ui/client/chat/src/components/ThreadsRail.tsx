// Threads rail.
import './ThreadsRail.css';
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import {
  threads, threadId, groupId, drawerOpen, channelMeta,
} from '../state';
import { openChat, deleteThread } from '../actions';
import { tsKey } from '../utils';
import { Pane } from './Pane';
import { RelativeTime } from './RelativeTime';
import type { Thread, ThreadCtx } from '../types';

function threadCtxOf(t: Thread | null | undefined): ThreadCtx | null {
  if (!t || !t.channelType || t.channelType === 'web') return null;
  return { channelType: t.channelType, messagingGroupId: t.messagingGroupId ?? null, canSend: !!t.canSend };
}

function ThreadRow({ t }: { t: Thread }) {
  const ct = t.channelType || 'web';
  const meta = channelMeta(ct);
  const active = t.threadId === threadId.value;
  const pillTitle = `${meta.label}${t.counterparty ? ' · ' + t.counterparty : ''}`;
  const subTrailer = t.messageCount ? ' · ' + t.messageCount + ' msg' : '';
  const onOpen = (ev: JSX.TargetedMouseEvent<HTMLDivElement>): void => {
    if ((ev.target as HTMLElement).classList.contains('del')) return;
    if (groupId.value) openChat(groupId.value, t.threadId, threadCtxOf(t)).catch(console.error);
    drawerOpen.threads.value = false;
  };
  const onDel = async (ev: JSX.TargetedMouseEvent<HTMLButtonElement>): Promise<void> => {
    ev.stopPropagation();
    if (!confirm(`Delete this thread?\n\n"${t.title}"`)) return;
    await deleteThread(t.threadId);
  };
  return (
    <div class={'thread' + (active ? ' active' : '')} data-id={t.threadId} onClick={onOpen}>
      <div class="title">
        {ct !== 'web' ? <span class="ch-pill" title={pillTitle}>{meta.icon}</span> : null}
        {t.title}
      </div>
      <div class="meta"><RelativeTime ts={t.lastActivityAt} />{subTrailer}</div>
      {ct === 'web'
        ? <button type="button" class="del" title="Delete thread" aria-label="Delete thread" onClick={onDel}>{'\u00d7'}</button>
        : null}
    </div>
  );
}

function DmRow({ t }: { t: Thread }) {
  const ct = t.channelType || 'web';
  const meta = channelMeta(ct);
  const active = t.threadId === threadId.value;
  const onOpen = (): void => {
    if (groupId.value) openChat(groupId.value, t.threadId, threadCtxOf(t)).catch(console.error);
    drawerOpen.threads.value = false;
  };
  return (
    <div class={'thread dm' + (active ? ' active' : '')} data-id={t.threadId} onClick={onOpen}>
      <div class="title">
        <span class="ch-pill dm" title={meta.label}>{meta.icon}</span>
        {meta.label}
      </div>
      <div class="meta">
        <RelativeTime ts={t.lastActivityAt} />
        {t.counterparty ? ' \u00b7 ' + t.counterparty : ''}
        {t.messageCount ? ' \u00b7 ' + t.messageCount + ' msg' : ''}
      </div>
    </div>
  );
}

function renderRow(t: Thread) {
  return t.kind === 'dm'
    ? <DmRow key={t.threadId} t={t} />
    : <ThreadRow key={t.threadId} t={t} />;
}

function ChannelSection({ ct, items, defaultOpen }: { ct: string; items: Thread[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = channelMeta(ct);
  const totalMsgs = items.reduce((sum, t) => sum + (t.messageCount || 0), 0);
  const handles = Array.from(new Set(items.map((t) => t.counterparty).filter((h): h is string => !!h)));
  const handleStr = handles.length === 0
    ? ''
    : handles.length === 1 ? handles[0]
      : `${handles[0]} +${handles.length - 1}`;
  return (
    <div class={'thread-section' + (open ? ' open' : ' collapsed')}>
      <button
        type="button"
        class="thread-section-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span class="row">
          <span class="chev" aria-hidden="true">{open ? '\u25BE' : '\u25B8'}</span>
          <span class="ch-pill" aria-hidden="true">{meta.icon}</span>
          <span class="label">{meta.label}</span>
          <span class="count">{items.length} {'\u00b7'} {totalMsgs} msg</span>
        </span>
        {handleStr
          ? <span class="handle" title={handles.join(', ')}>{handleStr}</span>
          : null}
      </button>
      {open ? <div class="thread-section-body">{items.map(renderRow)}</div> : null}
    </div>
  );
}

export function ThreadsRail() {
  const list = threads.value;
  const onNewChat = (): void => {
    if (!groupId.value) return;
    openChat(groupId.value, null, null).then(() => {
      const el = document.getElementById('chat-input') as HTMLTextAreaElement | null;
      if (el) el.focus();
      drawerOpen.threads.value = false;
      drawerOpen.files.value = false;
    }).catch(console.error);
  };

  const buckets = new Map<string, Thread[]>();
  for (const t of list) {
    const ct = t.channelType || 'web';
    if (!buckets.has(ct)) buckets.set(ct, []);
    buckets.get(ct)!.push(t);
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

  return (
    <Pane paneKey="threads" name="threads-rail" label="Threads">
      <div class="threads-actions">
        <button type="button" id="btn-new-chat" onClick={onNewChat}>
          <span class="plus">+</span> <span class="label">New thread</span>
        </button>
      </div>
      <div class="list" id="threads-list">
        {list.length === 0
          ? <div class="empty">No threads yet</div>
          : sections.map((s) => (
            <ChannelSection key={s.ct} ct={s.ct} items={s.items} defaultOpen={s.ct === 'web'} />
          ))}
      </div>
    </Pane>
  );
}
