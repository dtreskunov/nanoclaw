// Chat main: message log, status, context chip, pending tray, readonly
// banner, composer.
import { useRef, useEffect } from 'preact/hooks';
import { html } from '../html.js';
import {
  chatMessages, chatStatus, chatLoading, threadId, channelType, canSend, pending,
  contextDismissed, threads, groupId, channelMeta, pinnedContext,
  UPLOAD_MAX_FILE_SIZE, UPLOAD_MAX_TOTAL_SIZE, UPLOAD_MAX_FILES,
} from '../state.js';
import { renderMarkdown, rewriteFileLinks, fmtBytes, fmtBytesShort } from '../utils.js';
import {
  sendChat, addPendingFiles, removePending, clearPending, currentContextPath,
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
      ${md != null
        ? html`<div ref=${ref} dangerouslySetInnerHTML=${{ __html: md }} />`
        : (m.text || '')}
      ${m.files && m.files.length
        ? html`<div class="files">${m.files.map((f) => `\uD83D\uDCCE ${f.filename} (${fmtBytes(f.size)})`).join('  ')}</div>`
        : null}
      ${m.ts ? html`<div class="meta"><${RelativeTime} ts=${m.ts} /></div>` : null}
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
  return html`
    <div class="log" id="chat-log" ref=${ref}>
      ${chatLoading.value
        ? null
        : !threadId.value
          ? html`<div class="empty">Pick or start a chat.</div>`
          : list.length === 0
            ? html`<div class="empty">No messages yet.</div>`
            : list.map((m, i) => html`<${Message} key=${i} m=${m} />`)}
    </div>
  `;
}

function ContextChip() {
  const pins = pinnedContext.value;
  // Implicit selection chip (auto-derived from current dir / file) still
  // shown when nothing is explicitly pinned, dismissible.
  const auto = (pins.length === 0 && !contextDismissed.value) ? currentContextPath() : null;
  if (pins.length === 0 && !auto) return html`<div class="context" id="chat-context" hidden></div>`;
  return html`
    <div class="context" id="chat-context">
      ${pins.map((p) => html`
        <span class="chip" key=${p}>
          <span>\uD83D\uDCCE</span>
          <span class="path" title=${p}>${p}</span>
          <button type="button" title="Unpin" onClick=${() => removePinnedPath(p)}>\u00d7</button>
        </span>
      `)}
      ${auto ? html`
        <span class="chip auto">
          <span>${auto.kind === 'dir' ? '\uD83D\uDCC1' : '\uD83D\uDCC4'}</span>
          <span class="path" title=${auto.path}>${auto.path}</span>
          <button type="button" title="Don\u2019t include this in next message" onClick=${() => { contextDismissed.value = true; }}>\u00d7</button>
        </span>
      ` : null}
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
    let prefix = '';
    if (pins.length > 0) {
      prefix = '> Context (file browser):\n' + pins.map((p) => `> - \`${p}\``).join('\n') + '\n\n';
    } else if (!contextDismissed.value) {
      const ctx = currentContextPath();
      if (ctx) prefix = `> Context (file browser): \`${ctx.path}\`\n\n`;
    }
    const fullText = prefix + text;
    if (inputRef.current) inputRef.current.value = '';
    clearPending();
    clearPinnedContext();
    contextDismissed.value = false;
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
