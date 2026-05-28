/**
 * Bridge between the polling delivery layer (delivery.ts) and channel
 * adapters (channels/). Wraps `getChannelAdapter` lookup plus per-adapter
 * capability handling:
 *
 *   - Looks up the adapter by channelType; warns if missing.
 *   - Splits multi-file messages into N single-file calls for adapters
 *     that don't set `supportsMultiFile`. Text rides on the first call;
 *     later calls are files-only. Returns the first platform message id.
 *
 * Lives in its own module (not inline in index.ts) so the split logic is
 * unit-testable without booting the whole host.
 */
import type { ChannelAdapter, OutboundFile } from './channels/adapter.js';
import { log } from './log.js';

export interface DeliveryBridgeOptions {
  getChannelAdapter: (channelType: string) => ChannelAdapter | undefined;
}

export function createDeliveryBridge(opts: DeliveryBridgeOptions) {
  const { getChannelAdapter } = opts;
  return {
    async deliver(
      channelType: string,
      platformId: string,
      threadId: string | null,
      kind: string,
      content: string,
      files?: OutboundFile[],
    ): Promise<string | undefined> {
      const adapter = getChannelAdapter(channelType);
      if (!adapter) {
        log.warn('No adapter for channel type', { channelType });
        return;
      }
      if (files && files.length > 1 && !adapter.supportsMultiFile) {
        const parsed = JSON.parse(content) as Record<string, unknown>;
        let firstId: string | undefined;
        for (let i = 0; i < files.length; i++) {
          const isFirst = i === 0;
          const sub = isFirst ? parsed : ({ ...parsed, text: '', markdown: '' } as Record<string, unknown>);
          const id = await adapter.deliver(platformId, threadId, {
            kind,
            content: sub,
            files: [files[i]],
          });
          if (isFirst) firstId = id;
        }
        return firstId;
      }
      return adapter.deliver(platformId, threadId, { kind, content: JSON.parse(content), files });
    },
    async setTyping(channelType: string, platformId: string, threadId: string | null): Promise<void> {
      const adapter = getChannelAdapter(channelType);
      await adapter?.setTyping?.(platformId, threadId);
    },
  };
}
