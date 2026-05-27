---
name: web-ui
requires_env: UI_ENABLED
description: >-
  Web UI access: how the user opens a browser to see their files. Use this
  skill when the user asks to "show me my files", "browse my files",
  "open the file browser", "see my files in a browser", "download a file",
  "give me a link to my files", or any similar request to view the
  agent-group filesystem visually. Also use when the user asks how to log
  into the web UI or get a magic link.
---

# Web UI — File Browser

Users can browse their per-agent-group filesystem (the same `groups/<folder>/`
directory you see in the container) through a read-only web UI at `/ui/files`.
They authenticate with a single-use magic link.

## How to respond

Call the `request_login_link` MCP tool with the requesting user's namespaced
id (e.g. `resend:user@example.com`, `telegram:12345`, `slack:U01ABCD`). The
**host** mints the link and DMs it to that user privately — never to the
current thread. This is important in group chats: even though the user asked
in the group, the link is sensitive and lands in their DM. Your own reply
should *not* try to include a URL (you don't have one) and should *not* ask
the user to send `/web-login`.

A reasonable reply when someone asks "show me my files" (in a group or DM):

> I've sent you a one-time login link in a direct message. It's valid for 10
> minutes and gives you a 30-day browser session to the read-only file
> browser for this agent group.

## What they can do once logged in

Read-only:

- Browse the filesystem of every agent group they have access to
  (membership, admin role, or ownership)
- Preview images, audio, video, PDFs, and text files inline in the browser
- Download anything else

They cannot upload, rename, delete, or edit anything from the web UI — only
through chat with you.

## Visibility rules (so you can answer "why don't I see X?")

- `.git`, `node_modules`, `.claude-fragments`, dotfiles, and the composed
  `CLAUDE.md` are always hidden.
- `CLAUDE.local.md` is visible read-only.
- Admin-tier files (`container.json`, `bot.json`, `allowed-senders.txt`) are
  visible only to users with the admin role on that group.

## When NOT to use this skill

- The user wants you to read, summarize, or modify a file — just do that
  yourself using your filesystem tools.
- The user wants you to send them a specific file — attach it directly in
  your reply if the channel supports attachments, rather than pointing them
  at the file browser.
