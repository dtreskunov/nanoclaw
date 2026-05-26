---
name: add-email-bot
description: Scaffold a new email-bot alias under groups/<alias>@<domain>/. Creates the folder with CLAUDE.local.md (persona), allowed-senders.txt (regex allow-list), and bot.json (name + cli_scope). The Resend adapter lazy-provisions the agent group, container config, wiring, and destination on the first allowed inbound email. Use when the operator wants a new email persona at a fresh alias on their bot domain.
---

# Add Email Bot

Stand up a new per-alias email bot. Each alias maps to its own agent group with its own persona, model config, and sender allow-list. The filesystem is the source of truth — drop the folder and the alias is enabled; remove it and the alias is disabled (existing sessions keep working, but new senders are dropped).

## Prerequisites

- **Resend adapter installed and connected.** `.env` has `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `RESEND_FROM_NAME`, `RESEND_WEBHOOK_SECRET`. Confirm with: `grep RESEND_ .env`. If missing, run `/add-resend` first.
- **Service running.** A recent `Resend inbound` line in `logs/nanoclaw.log` is the cheapest sanity check.
- **Inbound webhook configured at Resend.** Emails to the bot domain reach the host. If unsure, ask the user to send a test email to their existing default address and grep the log.

## 1. Collect the bot details

Ask the user in plain text (free-form answers — do not use AskUserQuestion for these):

1. **Email alias** — the full email address the bot will receive on, e.g. `support@bot.example.com`. Must be on a domain Resend will deliver to your host. Record as `ALIAS`.
2. **Bot name** — display name used as the agent group name and assistant persona name. Default: the local-part of `ALIAS` (e.g. `support`). Record as `BOT_NAME`.
3. **Persona** — a paragraph or two describing how the bot should behave, what it knows, its tone. This becomes `CLAUDE.local.md`. Don't put rules about *who can email* here — that's the allow-list (step 2 below). Record as `PERSONA`.

Then ask via AskUserQuestion: **"What ncl scope should this bot have?"** with options:

- `disabled` (recommended) — bot has no `ncl` access. Pure persona-only. Cannot modify its own config; cannot manage destinations or members. Folder edits are the only way to evolve it. Best for untrusted inbound / prompt-injection-sensitive bots.
- `group` — bot can manage its own agent group via `ncl` (own config, destinations, members, sessions). Risky-action changes (`install_packages`, `add_mcp_server`) still go through approval. Choose when the bot needs to be conversationally evolvable.
- `global` — full admin. Reserved for owner bots — do not pick this for an email bot unless you fully trust every sender in the allow-list.

Record the choice as `CLI_SCOPE`.

## 2. Collect the allowed-senders list

Tell the user:

> Email bots without a sender allow-list will be silently dropped — no exceptions. List one regex per line; blank lines and `#` comments are ignored. Senders are matched case-insensitively against the bare email address (e.g. `alice@example.com`, not `Alice <alice@example.com>`).

AskUserQuestion: **"Start with which default?"** with options:

- `.*@.*` — permissive; any well-formed email passes. New senders still go through the `request_approval` flow (DM to owner) before their first reply lands.
- `.*@<their domain>` — domain-locked; only senders inside a specific domain. Ask the user for the domain string and substitute.
- `custom` — collect a multi-line list from the user in plain text.

Record as `ALLOWED_SENDERS` (the full text content of `allowed-senders.txt`).

## 3. Create the folder

Use the absolute workspace path. Replace `<ALIAS>`, `<BOT_NAME>`, `<CLI_SCOPE>`, `<PERSONA>`, `<ALLOWED_SENDERS>` literally.

```bash
mkdir -p "groups/<ALIAS>"
```

Then write three files inside:

**`groups/<ALIAS>/CLAUDE.local.md`** — the persona body:

```markdown
# <BOT_NAME>

<PERSONA>
```

**`groups/<ALIAS>/allowed-senders.txt`** — one regex per line:

```
<ALLOWED_SENDERS>
```

**`groups/<ALIAS>/bot.json`** — name + cli_scope:

```json
{
  "name": "<BOT_NAME>",
  "cli_scope": "<CLI_SCOPE>"
}
```

That is the entire scaffold. No DB rows, no service restart. The Resend adapter reads these files on the first inbound email to `<ALIAS>` and registers the agent group, container config, wiring, and destination atomically.

## 4. Verify

Tell the user to send a test email to `<ALIAS>` from an address that matches one of the regexes in `allowed-senders.txt`.

What you expect to see in `logs/nanoclaw.log` within a few seconds:

```
INFO Resend inbound from="<sender>" alias="<ALIAS>" to=["<ALIAS>"] subject="..."
INFO Provisioned email bot folder="<ALIAS>" agentGroupId="ag-..." messagingGroupId="mg-..." cliScope="<CLI_SCOPE>"
INFO Session created id="sess-..." agentGroupId="ag-..." sessionMode="per-thread" threadId="resend:<ALIAS>:<sender>:..."
INFO Spawning container sessionId="sess-..." agentGroup="<BOT_NAME>"
... (a few seconds later)
INFO Message delivered id="msg-..." channelType="resend" platformId="resend:<sender>" ...
```

Then the user receives the reply by email. The first reply may take longer if the owner approval flow fires (depends on `unknown_sender_policy='request_approval'` on the messaging group + whether the sender is already a known user).

## Troubleshooting

**"Resend dropped — alias not enabled" in the log.**
The folder doesn't exist or `CLAUDE.local.md` is missing. Check: `ls groups/<ALIAS>/`. The full email (with `@`) must be the folder name verbatim.

**"Resend dropped — sender not in allowed-senders.txt" in the log.**
The sender's address didn't match any regex. Check the regexes — remember they're matched against the bare email (case-insensitive). Add the sender's address (or a broader regex) and have them re-send.

**"Provisioned email bot" fires but no container spawn.**
Check `data/v2-sessions/<agentGroupId>/<sessionId>/inbound.db` for a `messages_in` row. If it's there but no spawn, host-sweep should pick it up within 60s. If still nothing, check `logs/nanoclaw.error.log` for container-runtime errors.

**Container spawns but no reply arrives.**
First-time senders may be held by the approval flow — check `ncl approvals list`. If the agent group is fresh and OneCLI is in use, also check `onecli agents secrets --id <agentGroupId>` — newly-created agents start in `selective` secret mode with no secrets assigned (the API call returns 401 silently). Fix: `onecli agents set-secret-mode --id <agentGroupId> --mode all`.

**Container name issues / docker error about invalid characters.**
The host sanitizes `@` → `_at_` in container names, so `groups/leet@bot.example.com/` becomes `nanoclaw-v2-leet_at_bot.example.com-<ts>`. If you see another character cause problems (rare — only `[a-zA-Z0-9_.-]` is allowed), report it.

## Lifecycle

- **Edit the persona** — change `CLAUDE.local.md`. Effective on the next session spawn (existing live containers keep the old persona until they idle out).
- **Edit the allow-list** — change `allowed-senders.txt`. Effective immediately for the next inbound email.
- **Change `cli_scope` or name** — edit `bot.json`, then run `ncl groups config update --id <agentGroupId> --cli-scope <new>` to push to the DB (the auto-provisioner only writes `bot.json` values on first registration). For name changes, also `ncl groups update --id <agentGroupId> --name <new>`.
- **Disable the alias** — `rm -rf groups/<ALIAS>`. New inbound emails will be dropped. Existing sessions keep working until they idle out, then any subsequent email also drops. To clean up the DB rows too: `ncl groups delete --id <agentGroupId>`.
- **List all email bots** — `ls -d groups/*@*/`.
