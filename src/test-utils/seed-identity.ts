/**
 * Test helper: create a user + identity row and return the new user UUID.
 * Used by permissions / approvals tests after migration 018 separated
 * user UUIDs from `(channel, handle)` identity rows.
 *
 * Tests should call this once per logical user and reuse the returned UUID
 * everywhere they previously used a `'channel:handle'` literal.
 */
import { getOrCreateUserByIdentity } from '../modules/permissions/db/identities.js';

export function seedUserWithIdentity(channel: string, handle: string, displayName?: string | null): string {
  return getOrCreateUserByIdentity({ channel, handle, displayName: displayName ?? null });
}
