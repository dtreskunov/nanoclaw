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
directory you see in the container) through a read-only web UI hosted by the
host on `/ui/files`. They authenticate with a single-use magic link.

## How to respond

**You cannot mint the link yourself.** The login command is intercepted by the
host *before* it reaches you. When a user asks to see their files, tell them
to send this message exactly:

> `/web-login`

The host will reply with a one-time URL that expires in 10 minutes. Opening it
sets a 30-day session cookie scoped to `/ui`. After login they land on
`/ui/files/`.

A reasonable reply when someone asks "show me my files":

> Send me `/web-login` (just that command, on its own line) and I'll have the
> host mint you a one-time link to the web file browser. The link expires in
> 10 minutes and gives you a 30-day browser session to view files in this
> agent group.

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
- The web UI is disabled on this host. (If they send `/web-login` and get
  "Web UI is not enabled on this server.", that's the signal.)
