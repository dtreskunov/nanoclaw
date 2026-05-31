/**
 * Registry of per-channel deep-link builders. Channels that can't DM by
 * handle (Telegram, etc.) register a function that turns a challenge
 * token into a tap-to-open URL the UI surfaces to the user.
 *
 * The channel adapter typically registers itself at factory time once
 * it knows enough about its identity (e.g. Telegram needs the bot
 * username). The settings API consults the registry to decide whether
 * to offer the deep-link flow vs. the handle/DM flow, and to render
 * the URL.
 */
export type DeepLinkBuilder = (token: string) => Promise<string | null>;

const builders = new Map<string, DeepLinkBuilder>();

export function registerDeepLinkBuilder(channel: string, builder: DeepLinkBuilder): void {
  builders.set(channel, builder);
}

export function hasDeepLinkBuilder(channel: string): boolean {
  return builders.has(channel);
}

export async function buildDeepLink(channel: string, token: string): Promise<string | null> {
  const b = builders.get(channel);
  return b ? b(token) : null;
}
