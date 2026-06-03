/**
 * Generates VAPID keys at first boot if missing and persists them to
 * `.env` so the chat web app can subscribe to Web Push (PWA tier-2
 * notifications). Idempotent — a second run does nothing.
 *
 * Lives in modules/push to keep the web-push dep contained.
 */
import fs from 'fs';
import path from 'path';

import webpush from 'web-push';

import { log } from '../../log.js';

export function ensureVapidKeys(): void {
  const envFile = path.join(process.cwd(), '.env');
  let content = '';
  try {
    content = fs.readFileSync(envFile, 'utf-8');
  } catch {
    /* .env may not exist on first run */
  }
  const has = (key: string): boolean => new RegExp(`^${key}=.+$`, 'm').test(content);
  if (has('VAPID_PUBLIC_KEY') && has('VAPID_PRIVATE_KEY')) return;

  const keys = webpush.generateVAPIDKeys();
  const lines: string[] = [];
  if (!has('VAPID_PUBLIC_KEY')) lines.push(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
  if (!has('VAPID_PRIVATE_KEY')) lines.push(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
  if (!has('VAPID_SUBJECT')) lines.push('VAPID_SUBJECT=mailto:admin@example.invalid');
  const sep = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(envFile, content + sep + lines.join('\n') + '\n');
  log.info('VAPID keys generated', { envFile });
}
