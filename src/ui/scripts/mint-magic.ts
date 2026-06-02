/**
 * mint-magic — issue a UI magic-link login URL for a user.
 *
 * Usage:
 *   pnpm exec tsx src/ui/scripts/mint-magic.ts             # interactive picker
 *   pnpm exec tsx src/ui/scripts/mint-magic.ts <user-id>   # one-shot
 *   pnpm exec tsx src/ui/scripts/mint-magic.ts --help
 *
 * Base URL comes from UI_BASE_URL in .env (via `uiBaseUrl()`); there is no
 * CLI override. Imports the same APIs the running host uses so the result
 * matches what /ui would produce.
 */
import path from 'path';

import * as p from '@clack/prompts';

import { initDb } from '../../db/connection.js';
import { getAllUsers } from '../../modules/permissions/db/users.js';
import { issueMagicLink } from '../server/auth.js';
import { uiBaseUrl } from '../server/server.js';

const HELP = `mint-magic — issue a UI magic-link login URL.

Usage:
  mint-magic                interactive picker (lists users from the DB)
  mint-magic <user-id>      non-interactive
  mint-magic -h | --help    show this help

Base URL is read from UI_BASE_URL in .env.
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) {
    process.stdout.write(HELP);
    return;
  }

  initDb(path.resolve(process.cwd(), 'data', 'v2.db'));

  let userId = args[0];

  if (!userId) {
    const users = getAllUsers();
    if (users.length === 0) {
      console.error('No users found in data/v2.db.');
      process.exit(1);
    }

    p.intro('mint-magic');
    const picked = await p.select({
      message: 'Pick a user',
      options: users.map((u) => ({
        value: u.id,
        label: u.display_name ? `${u.display_name} (${u.id})` : u.id,
        hint: u.kind,
      })),
    });
    if (p.isCancel(picked)) {
      p.cancel('Cancelled.');
      process.exit(130);
    }
    userId = picked as string;
    p.outro('Minted.');
  }

  const { token } = issueMagicLink(userId);
  console.log(`${uiBaseUrl()}/auth/redeem?t=${token}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
