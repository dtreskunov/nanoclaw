/**
 * Canonical user-id (UUID) shape guard.
 *
 * Used by writers that take a user id from a caller and must reject the
 * legacy namespaced "channel:handle" form. The resolver (permissions
 * module) is supposed to convert those to a UUID before any DB write —
 * this is the last line of defense so a bug there fails loudly instead
 * of silently writing a malformed id.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUserUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Throws unless `value` is null/undefined or a UUID. `field` names the call site for the error. */
export function assertUserUuid(value: string | null | undefined, field: string): void {
  if (value === null || value === undefined) return;
  if (!UUID_RE.test(value)) {
    throw new Error(
      `${field} must be a users.id UUID (got: ${JSON.stringify(value)}). ` +
        `Resolve namespaced "channel:handle" ids via the permissions resolver first.`,
    );
  }
}
