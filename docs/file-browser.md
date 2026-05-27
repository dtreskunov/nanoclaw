# File browser

Optional read-only web UI for browsing the per-agent-group filesystem at `groups/<folder>/`. Mounts on the existing webhook HTTP server under `/files`. Authentication is bearer cookie minted from a single-use magic link.

## Enable

Set in `.env`:

```bash
FILE_BROWSER_ENABLED=true
```

Restart the host. The route is mounted on the webhook listener (default `0.0.0.0:3000`).

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `FILE_BROWSER_ENABLED` | `false` | Mount the routes. |
| `FILE_BROWSER_SECURE` | `false` | Mark session cookies `Secure`. Set when fronted by HTTPS (reverse proxy, ngrok, etc.). |
| `FILE_BROWSER_BASE_URL` | `http://localhost:${WEBHOOK_PORT}/files` | External base URL embedded in magic-link URLs. Override when the host is behind a reverse proxy or tunnel (e.g. `https://bot.example.com/files`). |

## Getting a login link

**From chat (self-service)** — any user wired to the bot can DM:

```
/web-login
```

The host intercepts the command (before it reaches the container) and replies with a one-time link. The link expires in 10 minutes and is consumed on first redeem. The resulting session cookie is valid for 30 days.

**From the host (operator)**:

```bash
ncl users issue-link --user <userId>
# optionally --base-url <url> to override FILE_BROWSER_BASE_URL for this call
```

`<userId>` is the namespaced channel identity (e.g. `tg:6037840640`, `resend:alice@example.com`).

## Access model

A user sees an agent group in the browser if either:

- the user has an `owner` or `admin` role for the group (or globally), or
- the user is listed in `agent_group_members` for the group.

Admin-tier files (`container.json`, `bot.json`, `allowed-senders.txt`) are visible only to admins. `.git`, `node_modules`, `.claude-fragments`, dotfiles, and the composed `CLAUDE.md` are always hidden. `CLAUDE.local.md` is visible read-only.

## File preview

Inline preview in-browser:

- Images (`png`, `jpg`, `jpeg`, `gif`, `webp`)
- Audio (`mp3`, `m4a`, `aac`, `wav`, `ogg`, `opus`, `flac`)
- Video (`mp4`, `mov`, `webm`, `ogv`)
- PDFs
- Text (`.txt`, `.md`, `.json`, `.yaml`, `.log`, `.csv`, source code, etc.)

Everything else falls back to a download link.

## Security posture

- Magic-link tokens and session tokens are 256-bit random; only their sha256 hashes are stored.
- Cookie is HttpOnly, `SameSite=Lax`, `Path=/files`, optionally `Secure`.
- Path traversal and symlink escapes are blocked (`resolveSafe` runs `realpath` + containment).
- Read-only: no upload, rename, delete, or edit endpoints.
- Access is logged to the `file_browser_access_log` table.

The mount is reachable on whatever interface the webhook server binds (default `0.0.0.0`). If your webhook port is exposed to the public internet, the file browser is too — auth is strong, but treat the URL as sensitive. Put it behind a reverse proxy with TLS for non-LAN use, and set `FILE_BROWSER_SECURE=true`.

## Tables

Migration `016-file-browser` creates:

- `file_browser_sessions` (cookie sessions)
- `file_browser_magic_links` (single-use login tokens)
- `file_browser_access_log` (audit trail)

All three are pruned hourly by the in-process purge timer.
