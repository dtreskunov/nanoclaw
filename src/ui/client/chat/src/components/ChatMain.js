// Chat main: message log, status, context chip, pending tray, readonly
// banner, composer.
import { useRef, useEffect, useState } from 'preact/hooks';
import { html } from '../html.js';
import {
  chatMessages, chatStatus, chatLoading, isTyping, typingHint, threadId, channelType, canSend, pending,
  threads, groupId, channelMeta, pinnedContext,
  UPLOAD_MAX_FILE_SIZE, UPLOAD_MAX_TOTAL_SIZE, UPLOAD_MAX_FILES,
} from '../state.js';
import { renderMarkdown, rewriteFileLinks, fmtBytes, fmtBytesShort } from '../utils.js';
import {
  sendChat, addPendingFiles, removePending, clearPending,
  navFile, removePinnedPath, clearPinnedContext,
} from '../actions.js';
import { RelativeTime } from './RelativeTime.js';

function Message({ m }) {
  const ref = useRef(null);
  const md = renderMarkdown(m.text);
  useEffect(() => {
    if (md != null && ref.current) {
      rewriteFileLinks(ref.current, groupId.value, (entry) => navFile(entry).catch(console.error));
    }
  }, [m.text, md != null]);
  const cls = 'msg ' + m.direction + (md != null ? ' markdown' : '');
  return html`
    <div class=${cls}>
      ${m.direction === 'internal' ? html`<div class="internal-label">internal</div>` : null}
      ${md != null
        ? html`<div ref=${ref} dangerouslySetInnerHTML=${{ __html: md }} />`
        : (m.text || '')}
      ${m.files && m.files.length
        ? html`<div class="files">${m.files.map((f) => f.path
            ? html`<button
                type="button"
                class="file-chip"
                title=${'/' + f.path}
                onClick=${() => navFile({ path: f.path, name: f.filename, size: f.size }).catch(console.error)}
              >\uD83D\uDCCE ${f.filename}</button>`
            : html`<span class="file-chip inert" title="Source not in workspace">\uD83D\uDCCE ${f.filename}</span>`
          )}</div>`
        : null}
      ${m.ts ? html`<div class="meta"><${RelativeTime} ts=${m.ts} /></div>` : null}
    </div>
  `;
}

// Group consecutive 'internal' messages with the trailing 'out' answer
// into a single visual unit. Trailing internals with no answer yet
// (still streaming) render standalone so the user sees progress.
function groupMessages(list) {
  const groups = [];
  let pending = [];
  for (const m of list) {
    if (m.direction === 'internal') {
      pending.push(m);
    } else if (m.direction === 'out' && pending.length > 0) {
      groups.push({ kind: 'thoughts', thoughts: pending, answer: m });
      pending = [];
    } else {
      groups.push({ kind: 'single', m });
    }
  }
  for (const t of pending) groups.push({ kind: 'single', m: t });
  return groups;
}

function ThoughtGroup({ thoughts, answer }) {
  const [showThoughts, setShowThoughts] = useState(false);
  const n = thoughts.length;
  const label = showThoughts ? 'answer' : (n > 1 ? `thoughts (${n})` : 'thoughts');
  const title = showThoughts ? 'Show final answer' : 'Show agent thoughts leading to this answer';
  return html`
    <div class="thought-group">
      <button
        type="button"
        class="thoughts-toggle"
        title=${title}
        onClick=${() => setShowThoughts((v) => !v)}
      >${label}</button>
      ${showThoughts
        ? thoughts.map((t, i) => html`<${Message} key=${'t' + i} m=${t} />`)
        : html`<${Message} m=${answer} />`}
    </div>
  `;
}

function MessageLog() {
  const ref = useRef(null);
  // Autoscroll on each new message.
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  });
  const list = chatMessages.value;
  const groups = groupMessages(list);
  const typing = isTyping.value && threadId.value && !chatLoading.value;
  return html`
    <div class="log" id="chat-log" ref=${ref}>
      ${chatLoading.value
        ? null
        : !threadId.value
          ? html`<div class="empty">Pick or start a chat.</div>`
          : list.length === 0
            ? html`<div class="empty">No messages yet.</div>`
            : groups.map((g, i) => g.kind === 'thoughts'
                ? html`<${ThoughtGroup} key=${i} thoughts=${g.thoughts} answer=${g.answer} />`
                : html`<${Message} key=${i} m=${g.m} />`)}
      ${typing
        ? html`<div class="typing" aria-live="polite">
            <span></span><span></span><span></span>
            ${typingHint.value ? html`<span class="hint">${typingHint.value}</span>` : null}
          </div>`
        : null}
    </div>
  `;
}

function ContextChip() {
  const pins = pinnedContext.value;
  if (pins.length === 0) return html`<div class="context" id="chat-context" hidden></div>`;
  return html`
    <div class="context" id="chat-context">
      ${pins.map((p) => html`
        <span class="chip" key=${p}>
          <span>\uD83D\uDCCE</span>
          <span class="path" title=${p}>${p}</span>
          <button type="button" title="Unpin" onClick=${() => removePinnedPath(p)}>\u00d7</button>
        </span>
      `)}
    </div>
  `;
}

function PendingTray() {
  const list = pending.value;
  if (list.length === 0) return html`<div class="pending" id="chat-pending" hidden></div>`;
  return html`
    <div class="pending" id="chat-pending">
      ${list.map((f, i) => html`
        <span class="item" key=${i}>
          \uD83D\uDCCE ${f.name} (${fmtBytesShort(f.size)})
          <button type="button" title="Remove" onClick=${() => removePending(i)}>\u00d7</button>
        </span>
      `)}
    </div>
  `;
}

function Composer() {
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const showComposer = (!channelType.value || channelType.value === 'web' || canSend.value);
  const onSubmit = (ev) => {
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
  const onKey = (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); ev.currentTarget.form?.requestSubmit(); }
  };
  const onAttachClick = () => fileRef.current?.click();
  const onFileChange = (ev) => {
    addPendingFiles(Array.from(ev.target.files || []), UPLOAD_MAX_FILES, UPLOAD_MAX_FILE_SIZE, UPLOAD_MAX_TOTAL_SIZE);
    ev.target.value = '';
  };
  const onPaste = (ev) => {
    const items = ev.clipboardData && ev.clipboardData.files;
    if (!items || items.length === 0) return;
    ev.preventDefault();
    addPendingFiles(Array.from(items), UPLOAD_MAX_FILES, UPLOAD_MAX_FILE_SIZE, UPLOAD_MAX_TOTAL_SIZE);
  };
  return html`
    <form id="chat-form" onSubmit=${onSubmit} style=${showComposer ? '' : 'display:none'}>
      <input type="file" id="chat-file" multiple hidden ref=${fileRef} onChange=${onFileChange} />
      <button type="button" id="chat-attach" title="Attach files" aria-label="Attach files" onClick=${onAttachClick}>\uD83D\uDCCE</button>
      <textarea id="chat-input" rows="1" placeholder="Message the agent\u2026" ref=${inputRef} onKeyDown=${onKey} onPaste=${onPaste}></textarea>
      <button type="submit" id="chat-send">Send</button>
    </form>
  `;
}

function ReadonlyBanner() {
  const isWeb = !channelType.value || channelType.value === 'web';
  const showComposer = isWeb || canSend.value;
  if (showComposer) return html`<div class="readonly-banner" hidden></div>`;
  const meta = channelMeta(channelType.value);
  return html`<div class="readonly-banner">Read-only view \u2014 reply on ${meta.label} to continue this thread.</div>`;
}

function Subnotice() {
  const isWeb = !channelType.value || channelType.value === 'web';
  const showComposer = isWeb || canSend.value;
  if (!(showComposer && !isWeb)) return html`<div class="chat-subnotice" hidden></div>`;
  const meta = channelMeta(channelType.value);
  const t = threads.value.find((x) => x.threadId === threadId.value);
  const cp = t && t.counterparty ? ` \u00b7 ${t.counterparty}` : '';
  return html`<div class="chat-subnotice">${meta.icon} Sending via ${meta.label}${cp}</div>`;
}

export function ChatMain() {
  // Composer-zone drag/drop for chat attachments.
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let depth = 0;
    const hasFiles = (ev) => ev.dataTransfer && Array.from(ev.dataTransfer.types || []).includes('Files');
    const onEnter = (ev) => { if (!hasFiles(ev)) return; ev.preventDefault(); depth++; el.classList.add('drag-active'); };
    const onOver = (ev) => { if (!hasFiles(ev)) return; ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; };
    const onLeave = () => { depth = Math.max(0, depth - 1); if (depth === 0) el.classList.remove('drag-active'); };
    const onDrop = (ev) => {
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
  return html`
    <section class="chat-main" id="chat-main" ref=${ref}>
      <${MessageLog} />
      <div class="status" id="chat-status">${chatStatus.value}</div>
      <${ContextChip} />
      <${PendingTray} />
      <${ReadonlyBanner} />
      <${Subnotice} />
      <${Composer} />
    </section>
  `;
}
