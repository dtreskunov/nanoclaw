/**
 * Resend (email) channel adapter (v2) — uses Chat SDK bridge.
 * Self-registers on import.
 *
 * Per-alias routing: the upstream @resend/chat-sdk-adapter keys threads on
 * the SENDER (one inbox per remote correspondent). We override that so the
 * messaging_group key is the RECIPIENT alias instead — `support@…`,
 * `tutor@…`, etc. each become their own messaging_group that can be wired
 * to a distinct agent group. Sender stays as the user identity.
 *
 * New threadId format: `resend:<alias>:<sender>:<rootMessageIdHash>`
 * Legacy 3-part format `resend:<sender>:<hash>` is still decoded (treated
 * as alias = RESEND_FROM_ADDRESS) for in-flight threads after the upgrade.
 *
 * Concurrency: `postMessage` temporarily swaps `config.fromAddress` to
 * send from the alias. Safe only because we ask the bridge for
 * `concurrency: 'queue'` (host serializes deliveries per channel).
 */
import { createHash } from 'node:crypto';

import { createResendAdapter } from '@resend/chat-sdk-adapter';
import { Message, parseMarkdown } from 'chat';

import { readEnvFile } from '../env.js';
import { log } from '../log.js';
import { createChatSdkBridge } from './chat-sdk-bridge.js';
import { registerChannelAdapter } from './channel-registry.js';

// CommonMark treats a single `\n` inside a paragraph as a soft break, which
// HTML renders as a space. That swallows intra-verse line breaks in poems,
// addresses, signatures, etc. Convert single newlines into hard breaks
// (two trailing spaces + `\n`) but skip fenced code blocks so their content
// stays byte-exact.
function hardenSoftBreaks(text: string): string {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => (i % 2 === 1 ? part : part.replace(/([^\n])\n(?!\n)/g, '$1  \n'))).join('');
}

// Pull the bare email out of "Name <e@m>" or "e@m".
function parseEmailAddress(field: string): string {
  const m = field.match(/<([^>]+)>/);
  return (m ? m[1] : field).trim().toLowerCase();
}

registerChannelAdapter('resend', {
  factory: () => {
    const env = readEnvFile(['RESEND_API_KEY', 'RESEND_FROM_ADDRESS', 'RESEND_FROM_NAME', 'RESEND_WEBHOOK_SECRET']);
    if (!env.RESEND_API_KEY) return null;
    const FROM = env.RESEND_FROM_ADDRESS;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter: any = createResendAdapter({
      apiKey: env.RESEND_API_KEY,
      fromAddress: FROM,
      fromName: env.RESEND_FROM_NAME,
      webhookSecret: env.RESEND_WEBHOOK_SECRET,
    });

    // ── Alias-aware threadId encoding ────────────────────────────────
    const tr = adapter.threadResolver;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tr.encodeThreadId = (id: any): string => {
      const alias = id.alias ?? FROM;
      return `resend:${alias}:${id.toAddress}:${id.rootMessageIdHash}`;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tr.decodeThreadId = (threadId: string): any => {
      const parts = threadId.split(':');
      if (parts[0] !== 'resend') throw new Error(`Invalid thread ID format: ${threadId}`);
      if (parts.length === 4) {
        return { alias: parts[1], toAddress: parts[2], rootMessageIdHash: parts[3] };
      }
      // Back-compat: pre-alias 3-part ids — assume default mailbox.
      if (parts.length === 3) {
        return { alias: FROM, toAddress: parts[1], rootMessageIdHash: parts[2] };
      }
      throw new Error(`Invalid thread ID format: ${threadId}`);
    };

    adapter.channelIdFromThreadId = (threadId: string): string => {
      const { alias } = tr.decodeThreadId(threadId);
      return `resend:${alias}`;
    };

    // Override resolveThreadId so the alias is actually propagated into
    // encodeThreadId. Upstream destructures only {toAddress, messageId,
    // inReplyTo, references} from input and drops alias on the floor.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tr.resolveThreadId = async function (input: any): Promise<string> {
      const { toAddress, alias, messageId, inReplyTo, references } = input;
      if (inReplyTo || references) {
        const candidateIds = this.extractMessageIds(inReplyTo, references);
        for (const candidate of candidateIds) {
          const existingThread = this.messageToThread.get(candidate);
          if (existingThread) {
            this.trackMessage(existingThread, messageId);
            return existingThread;
          }
        }
      }
      const hash = createHash('sha256').update(messageId).digest('hex').slice(0, 16);
      const threadId = this.encodeThreadId({ alias, toAddress, rootMessageIdHash: hash });
      this.trackMessage(threadId, messageId);
      return threadId;
    };

    // ── Inbound: key messaging_group on recipient alias ──────────────
    // Replaces upstream handleWebhook to extract the alias from email.to[0]
    // and pass it through to the resolver. The rest mirrors upstream.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapter.handleWebhook = async function (request: Request, options?: any): Promise<Response> {
      if (!(this.webhookHandler && this.chat)) {
        throw new Error('Adapter not initialized. Call initialize() first.');
      }
      const result = await this.webhookHandler.parseWebhookRequest(request);
      if (!result.event) return new Response(null, { status: result.status });
      const email = await this.webhookHandler.fetchEmailContent(result.event.data.email_id);
      if (result.event.data.attachments?.length && !email.attachments?.length) {
        email.attachments = result.event.data.attachments;
      }
      const senderAddress = parseEmailAddress(email.from);
      const alias = email.to?.[0] ? parseEmailAddress(email.to[0]) : FROM;
      log.info('Resend inbound', { from: senderAddress, alias, to: email.to, subject: email.subject });
      const headers = email.headers || {};
      const inReplyTo = headers['In-Reply-To'] || headers['in-reply-to'] || undefined;
      const references = headers.References || headers.references || undefined;
      const threadId = await tr.resolveThreadId({
        toAddress: senderAddress,
        alias,
        messageId: email.message_id,
        inReplyTo,
        references,
      });
      tr.trackSubject(threadId, email.subject);

      // Inline of upstream parseInboundEmail — not exported from the
      // package, so re-create the Message here.
      // Prepend the subject line so the agent sees it (raw fields are
      // dropped by the bridge before reaching the session DB).
      const body = email.text || '';
      const text = email.subject ? `Subject: ${email.subject}\n\n${body}` : body;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const attachments = (email.attachments || []) as any[];
      const parsed = new Message({
        id: email.id,
        threadId,
        text,
        formatted: parseMarkdown(text),
        raw: {
          id: email.id,
          messageId: email.message_id,
          from: email.from,
          to: email.to,
          cc: email.cc,
          subject: email.subject,
          text: email.text,
          html: email.html,
          headers: email.headers,
          createdAt: email.created_at,
          attachments: attachments.map((a) => ({ filename: a.filename, contentType: a.content_type })),
        },
        author: {
          userId: senderAddress,
          userName: senderAddress,
          fullName: senderAddress,
          isBot: false,
          isMe: senderAddress === FROM,
        },
        metadata: { dateSent: new Date(email.created_at), edited: false },
        attachments: attachments.map((a) => ({ type: 'file', name: a.filename, mimeType: a.content_type })),
        isMention: true,
      });
      this.chat.processMessage(this, threadId, parsed, options);
      return new Response(null, { status: 200 });
    };

    // ── Outbound: send from the alias encoded in the threadId ────────
    const origPostMessage = adapter.postMessage.bind(adapter);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapter.postMessage = async function (threadId: string, message: any) {
      const { alias } = tr.decodeThreadId(threadId);
      const saved = this.config.fromAddress;
      this.config.fromAddress = alias;
      try {
        return await origPostMessage(threadId, message);
      } finally {
        this.config.fromAddress = saved;
      }
    };

    return createChatSdkBridge({
      adapter,
      concurrency: 'queue',
      supportsThreads: true,
      transformOutboundText: hardenSoftBreaks,
    });
  },
});
