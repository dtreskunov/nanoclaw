---
name: add-email-bot
description: Stand up a new email persona at a specific address on the host's bot domain. Use whenever the operator says things like "set up <email>", "create an email bot at <alias>", "add a bot for <email>", "new bot at <alias>", "I want a bot that answers <alias>", or otherwise asks to create/register/onboard an email-receiving persona. Writes groups/<alias>/{CLAUDE.local.md, allowed-senders.txt, bot.json} via `ncl email-bots create`. Requires global ncl scope (other scopes will get a forbidden error).
---

# Add Email Bot

You can create a new email-bot alias on the same Resend domain that delivers your own messages. Each bot is its own agent group with its own persona, model config, and sender allow-list. Use this only when the user is asking you to create a new bot — never volunteer it.

## Prereqs

- Your `cli_scope` must be `global` (only global-scoped admin bots can call `ncl email-bots create`). If you're at `group` or `disabled`, tell the user and stop.
- The Resend channel must already be live on this host — the user will know if it is. If unsure, mention that emails to the new alias only route if Resend is wired to the bot domain.

## Conversation

Ask the user for these, one at a time, plainly. Don't dump the whole questionnaire at once — wait for each answer.

1. **Email alias** — full address, e.g. `support@bot.example.com`. Must be on the same domain Resend already delivers to this host.
2. **Display name** — used as the bot's persona name. Default: the local-part of the alias.
3. **Persona** — describe how the bot should behave, what it knows, its tone. This becomes its `CLAUDE.local.md` (system prompt). Don't ask the user to include rules about who can email — that's the allow-list (next step).
4. **`cli_scope`** — present these three options and ask which:
   - `disabled` (recommended for most bots) — no `ncl` access. Pure persona only.
   - `group` — can manage its own agent group via `ncl` (own config, destinations, members, sessions). Risky actions still gated by approval.
   - `global` — full admin. **Only pick if the user fully trusts every allowed sender.** Don't recommend this — only honor it if explicitly requested.
5. **Allowed senders** — explain inline: *"This is a regex allow-list. One regex per line, matched case-insensitively against the bare email address. Empty list = deny all (fail-safe)."* Then offer four shapes and pick one:
   - **me-only** — just the operator's own email. Ask them for the address. Write `^<escaped-email>$`.
   - **domain** — anyone at a specific domain. Ask for the domain. Write `.*@<escaped-domain>$`.
   - **open** — `.*@.*` (any well-formed email). Unknown senders still hit the `request_approval` flow.
   - **custom** — ask them to paste the regex lines.

   When building regexes from concrete emails or domains, escape `.` as `\.` and `@` as `\@`, and anchor with `^`/`$` so substrings can't slip through (e.g. `evil-denis@…` against `denis@…`).

## Create the bot

Call `ncl email-bots create` with the collected fields. Wrap multi-line values in single quotes — the dispatcher passes them through verbatim.

```bash
ncl email-bots create \
  --alias <ALIAS> \
  --name <BOT_NAME> \
  --cli-scope <CLI_SCOPE> \
  --persona '<PERSONA>' \
  --allowed-senders '<ALLOWED_SENDERS>'
```

If the call returns `forbidden`, your `cli_scope` is too narrow — stop and tell the user. If it returns `Folder already exists`, the alias is taken — confirm with the user before suggesting a different one.

## After it succeeds

Tell the user, in plain prose:

- The folder was created at `groups/<alias>/` and contains `CLAUDE.local.md`, `allowed-senders.txt`, `bot.json`.
- They should send a test email from one of the allowed addresses to `<alias>`. The bot's agent group, container, and wiring are created lazily on the first allowed email — there's nothing else to do.
- They can edit the persona later by changing `groups/<alias>/CLAUDE.local.md`, the allow-list by editing `allowed-senders.txt`. Effective on the next session spawn / next inbound email respectively.
- To disable the alias: `rm -rf groups/<alias>` and then `ncl groups delete --id <ag-id>` (after the first email — before that, there's no agent group to delete).

Do not start a long verification ritual or tail logs — leave that to the user.
