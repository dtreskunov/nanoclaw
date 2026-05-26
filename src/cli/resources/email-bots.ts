/**
 * Email-bot resource — scaffold and list filesystem-driven email bots.
 *
 * Not backed by a DB table. `create` writes `groups/<alias>/{CLAUDE.local.md,
 * allowed-senders.txt, bot.json}` and returns; the Resend adapter
 * lazily registers the messaging_group / agent_group / wiring on the
 * first allowed inbound email. `list` enumerates folders on disk.
 *
 * Available only at global `cli_scope` — group-scoped agents can't see
 * or create email bots (would let a bot enumerate / spawn peers).
 */
import { listEmailBotFolders, scaffoldEmailBotFolder, type CliScope } from '../../auto-provision.js';
import { registerResource } from '../crud.js';

registerResource({
  name: 'email-bot',
  plural: 'email-bots',
  table: '', // no backing table — purely filesystem
  description:
    'Email bot — one folder per recipient alias under groups/<alias>/ enables a Resend email persona. Each bot has its own persona (CLAUDE.local.md), sender allow-list (allowed-senders.txt), and config (bot.json). The first allowed inbound email lazily registers the underlying agent group, container config, wiring, and destination. Create-only via CLI: edit/disable is done by hand on the filesystem (or via ncl groups delete to drop the DB rows).',
  idColumn: 'folder',
  columns: [],
  operations: {},
  customOperations: {
    create: {
      access: 'open',
      description:
        'Scaffold a new email-bot alias under groups/<alias>/. ' +
        'Use --alias <email> --persona <text> --allowed-senders <text> [--name <display>] [--cli-scope disabled|group|global]. ' +
        '--alias must be a full email like support@bot.example.com. ' +
        "--persona becomes CLAUDE.local.md (the bot's system prompt). " +
        '--allowed-senders is the literal content of allowed-senders.txt (one regex per line, # comments OK). ' +
        '--name defaults to the local-part of the alias. ' +
        '--cli-scope defaults to "disabled" (no ncl access). ' +
        'Refuses to overwrite an existing folder.',
      handler: async (args) => {
        const alias = args.alias as string | undefined;
        const persona = args.persona as string | undefined;
        const allowedSenders = (args.allowed_senders ?? args['allowed-senders']) as string | undefined;
        const name = args.name as string | undefined;
        const cliScope = (args.cli_scope ?? args['cli-scope']) as CliScope | undefined;

        if (!alias) throw new Error('--alias is required');
        if (!persona) throw new Error('--persona is required');
        if (!allowedSenders) throw new Error('--allowed-senders is required (fail-safe denies all when empty)');

        const { folder, absPath } = scaffoldEmailBotFolder({
          alias,
          persona,
          allowedSenders,
          name,
          cliScope,
        });

        return {
          folder,
          path: absPath,
          name: name ?? alias.split('@')[0],
          cli_scope: cliScope ?? 'disabled',
          next: 'Send an email to ' + alias + ' from an allowed sender to spawn the bot.',
        };
      },
    },
    list: {
      access: 'open',
      description:
        'List all email-bot folders under groups/ (folders that contain CLAUDE.local.md and have @ in the name).',
      handler: async () => {
        return listEmailBotFolders().map((b) => ({
          folder: b.folder,
          name: b.config.name ?? b.folder,
          cli_scope: b.config.cli_scope ?? 'disabled',
          allowed_senders_count: b.allowedSenderRegexes.length,
        }));
      },
    },
  },
});
