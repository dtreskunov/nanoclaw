// Chat main: message log, status, context chip, pending tray, readonly
// banner, composer.
import type { JSX } from 'preact';
import { useRef, useEffect, useState } from 'preact/hooks';
import {
  chatMessages, chatStatus, chatLoading, isTyping, typingHint, threadId, channelType, canSend, pending,
  threads, groupId, channelMeta, pinnedContext,
  UPLOAD_MAX_FILE_SIZE, UPLOAD_MAX_TOTAL_SIZE, UPLOAD_MAX_FILES,
} from '../state';
import { renderMarkdown, rewriteFileLinks, fmtBytesShort } from '../utils';
import {
  sendChat, addPendingFiles, removePending, clearPending,
  navFile, removePinnedPath, clearPinnedContext,
} from '../actions';
import { RelativeTime } from './RelativeTime';
import type { ChatMessage } from '../types';

function Message({ m }: { m: ChatMessage }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const md = renderMarkdown(m.text);
  useEffect(() => {
    if (md != null && ref.current && groupId.value) {
      rewriteFileLinks(ref.current, groupId.value, (entry) => navFile(entry).catch(console.error));
    }
  }, [m.text, md != null]);
  const cls = 'msg ' + m.direction + (md != null ? ' markdown' : '');
  return (
    <div class={cls}>
      {m.direction === 'internal' ? <div class="internal-label">internal</div> : null}
      {md != null
        ? <div ref={ref} dangerouslySetInnerHTML={{ __html: md }} />
        : (m.text || '')}
      {m.files && m.files.length
        ? (
          <div class="files">
            {m.files.map((f) => f.path
              ? (
                <button
                  type="button"
                  class="file-chip"
                  title={'/' + f.path}
                  onClick={() => navFile({ path: f.path!, name: f.filename, size: f.size }).catch(console.error)}
                  key={f.path}
                >{'\uD83D\uDCCE '}{f.filename}</button>
              )
              : <span class="file-chip inert" title="Source not in workspace" key={f.filename}>{'\uD83D\uDCCE '}{f.filename}</span>)}
          </div>
        )
        : null}
      {m.ts ? <div class="meta"><RelativeTime ts={m.ts} /></div> : null}
    </div>
  );
}

interface ThoughtsGroup { kind: 'thoughts'; thoughts: ChatMessage[]; answer: ChatMessage }
interface SingleGroup { kind: 'single'; m: ChatMessage }
type MsgGroup = ThoughtsGroup | SingleGroup;

function groupMessages(list: ChatMessage[]): MsgGroup[] {
  const out: MsgGroup[] = [];
  let pendingMsgs: ChatMessage[] = [];
  for (const m of list) {
    if (m.direction === 'internal') {
      pendingMsgs.push(m);
    } else if (m.direction === 'out' && pendingMsgs.length > 0) {
      out.push({ kind: 'thoughts', thoughts: pendingMsgs, answer: m });
      pendingMsgs = [];
    } else {
      out.push({ kind: 'single', m });
    }
  }
  for (const t of pendingMsgs) out.push({ kind: 'single', m: t });
  return out;
}

function ThoughtGroup({ thoughts, answer }: { thoughts: ChatMessage[]; answer: ChatMessage }) {
  const [showThoughts, setShowThoughts] = useState(false);
  const n = thoughts.length;
  const label = showThoughts ? 'answer' : (n > 1 ? `thoughts (${n})` : 'thoughts');
  const title = showThoughts ? 'Show final answer' : 'Show agent thoughts leading to this answer';
  return (
    <div class="thought-group">
      <button
        type="button"
        class="thoughts-toggle"
        title={title}
        onClick={() => setShowThoughts((v) => !v)}
      >{label}</button>
      {showThoughts
        ? thoughts.map((t, i) => <Message key={'t' + i} m={t} />)
        : <Message m={answer} />}
    </div>
  );
}

function MessageLog() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  });
  const list = chatMessages.value;
  const groups = groupMessages(list);
  const typing = isTyping.value && threadId.value && !chatLoading.value;
  return (
    <div class="log" id="chat-log" ref={ref}>
      {chatLoading.value
        ? null
        : !threadId.value
          ? <div class="empty">Pick or start a chat.</div>
          : list.length === 0
            ? <div class="empty">No messages yet.</div>
            : groups.map((g, i) => g.kind === 'thoughts'
                ? <ThoughtGroup key={i} thoughts={g.thoughts} answer={g.answer} />
                : <Message key={i} m={g.m} />)}
      {typing
        ? (
          <div class="typing" aria-live="polite">
            <span></span><span></span><span></span>
            {typingHint.value ? <span class="hint">{typingHint.value}</span> : null}
          </div>
        )
        : null}
    </div>
  );
}

function ContextChip() {
  const pins = pinnedContext.value;
  if (pins.length === 0) return <div class="context" id="chat-context" hidden></div>;
  return (
    <div class="context" id="chat-context">
      {pins.map((p) => (
        <span class="chip" key={p}>
          <span>{'\uD83D\uDCCE'}</span>
          <span class="path" title={p}>{p}</span>
          <button type="button" title="Unpin" onClick={() => removePinnedPath(p)}>{'\u00d7'}</button>
        </span>
      ))}
    </div>
  );
}

function PendingTray() {
  const list = pending.value;
  if (list.length === 0) return <div class="pending" id="chat-pending" hidden></div>;
  return (
    <div class="pending" id="chat-pending">
      {list.map((f, i) => (
        <span class="item" key={i}>
          {'\uD83D\uDCCE '}{f.name} ({fmtBytesShort(f.size)})
          <button type="button" title="Remove" onClick={() => removePending(i)}>{'\u00d7'}</button>
        </span>
      ))}
    </div>
  );
}

function Composer() {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const showComposer = (!channelType.value || channelType.value === 'web' || canSend.value);
  const onSubmit = (ev: JSX.TargetedEvent<HTMLFormElement>): void => {
    ev.preventDefault();
    const text = (inputRef.current?.value || '').trim();
    const files = pending.value.slice();
    if (!text && files.length === 0) return;
    const pins = pinnedContext.value;
    const prefix = pins.length > 0
      ? '> Context (file browser):\n' + pins.map((p) => `> - \`${p}\``).join('\n') + '\n\n'
      : '';
    const fullText = prefix + text;
    if (inputRef.current) inputRef.current.value = '';
    clearPending();
    clearPinnedContext();
    sendChat(fullText, files).catch(console.error);
  };
  const onKey = (ev: JSX.TargetedKeyboardEvent<HTMLTextAreaElement>): void => {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      ev.currentTarget.form?.requestSubmit();
    }
  };
  const onAttachClick = (): void => fileRef.current?.click();
  const onFileChange = (ev: JSX.TargetedEvent<HTMLInputElement>): void => {
    addPendingFiles(Array.from(ev.currentTarget.files || []), UPLOAD_MAX_FILES, UPLOAD_MAX_FILE_SIZE, UPLOAD_MAX_TOTAL_SIZE);
    ev.currentTarget.value = '';
  };
  const onPaste = (ev: ClipboardEvent): void => {
    const items = ev.clipboardData && ev.clipboardData.files;
    if (!items || items.length === 0) return;
    ev.preventDefault();
    addPendingFiles(Array.from(items), UPLOAD_MAX_FILES, UPLOAD_MAX_FILE_SIZE, UPLOAD_MAX_TOTAL_SIZE);
  };
  return (
    <form id="chat-form" onSubmit={onSubmit} style={showComposer ? '' : 'display:none'}>
      <input type="file" id="chat-file" multiple hidden ref={fileRef} onChange={onFileChange} />
      <button type="button" id="chat-attach" title="Attach files" aria-label="Attach files" onClick={onAttachClick}>{'\uD83D\uDCCE'}</button>
      <textarea
        id="chat-input"
        rows={1}
        placeholder={'Message the agent\u2026'}
        ref={inputRef}
        onKeyDown={onKey}
        onPaste={onPaste as unknown as JSX.ClipboardEventHandler<HTMLTextAreaElement>}
      ></textarea>
      <button type="submit" id="chat-send">Send</button>
    </form>
  );
}

function ReadonlyBanner() {
  const isWeb = !channelType.value || channelType.value === 'web';
  const showComposer = isWeb || canSend.value;
  if (showComposer) return <div class="readonly-banner" hidden></div>;
  const meta = channelMeta(channelType.value);
  return <div class="readonly-banner">Read-only view — reply on {meta.label} to continue this thread.</div>;
}

function Subnotice() {
  const isWeb = !channelType.value || channelType.value === 'web';
  const showComposer = isWeb || canSend.value;
  if (!(showComposer && !isWeb)) return <div class="chat-subnotice" hidden></div>;
  const meta = channelMeta(channelType.value);
  const t = threads.value.find((x) => x.threadId === threadId.value);
  const cp = t && t.counterparty ? ` \u00b7 ${t.counterparty}` : '';
  return <div class="chat-subnotice">{meta.icon} Sending via {meta.label}{cp}</div>;
}

export function ChatMain() {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let depth = 0;
    const hasFiles = (ev: DragEvent): boolean => !!ev.dataTransfer && Array.from(ev.dataTransfer.types || []).includes('Files');
    const onEnter = (ev: DragEvent): void => { if (!hasFiles(ev)) return; ev.preventDefault(); depth++; el.classList.add('drag-active'); };
    const onOver = (ev: DragEvent): void => { if (!hasFiles(ev)) return; ev.preventDefault(); if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy'; };
    const onLeave = (): void => { depth = Math.max(0, depth - 1); if (depth === 0) el.classList.remove('drag-active'); };
    const onDrop = (ev: DragEvent): void => {
      if (!ev.dataTransfer) return;
      ev.preventDefault();
      depth = 0;
      el.classList.remove('drag-active');
      const files = Array.from(ev.dataTransfer.files || []);
      if (files.length > 0) addPendingFiles(files, UPLOAD_MAX_FILES, UPLOAD_MAX_FILE_SIZE, UPLOAD_MAX_TOTAL_SIZE);
    };
    el.addEventListener('dragenter', onEnter);
    el.addEventListener('dragover', onOver);
    el.addEventListener('dragleave', onLeave);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragenter', onEnter);
      el.removeEventListener('dragover', onOver);
      el.removeEventListener('dragleave', onLeave);
      el.removeEventListener('drop', onDrop);
    };
  }, []);
  return (
    <section class="chat-main" id="chat-main" ref={ref}>
      <MessageLog />
      <div class="status" id="chat-status">{chatStatus.value}</div>
      <ContextChip />
      <PendingTray />
      <ReadonlyBanner />
      <Subnotice />
      <Composer />
    </section>
  );
}
