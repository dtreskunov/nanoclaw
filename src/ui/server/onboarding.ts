/**
 * First-login onboarding for OIDC users.
 *
 * Flow:
 *   1. The OIDC callback / pending-approval poll calls `completeLogin`,
 *      which checks `users.onboarded_at`. If NULL, the redirect target
 *      becomes `/ui/onboarding` instead of `/ui/chat/`.
 *   2. GET /ui/onboarding renders a splash + a short form (display name
 *      only if the OIDC claims didn't carry one; agent name; assistant
 *      name with sensible defaults).
 *   3. POST /ui/onboarding applies the answers — display_name on the
 *      user, name on the per-user agent group, assistant_name on its
 *      container_config — then stamps `onboarded_at` and redirects to
 *      `/ui/chat/`.
 *
 * Already-onboarded users (or anyone hitting the page without a session)
 * are bounced straight to `/ui/chat/` so refresh / back-button on the
 * onboarding URL never traps them.
 */
import http from 'http';

import { log } from '../../log.js';
import { updateAgentGroup } from '../../db/agent-groups.js';
import { updateContainerConfigScalars } from '../../db/container-configs.js';
import { ensurePerUserAgentGroup } from '../../modules/permissions/user-approval.js';
import { getUser, isUserOnboarded, markUserOnboarded, updateDisplayName } from '../../modules/permissions/db/users.js';

import { authenticate } from './auth.js';
import { getBranding } from './branding.js';

const LANDING = '/ui/chat/';
const DEFAULT_GROUP_NAME = 'My Agent';
const DEFAULT_ASSISTANT_NAME = 'Your Agent';
const MAX_NAME_LEN = 80;

interface OnboardingPrefill {
  displayName: string | null;
  groupName: string;
  assistantName: string;
  needsDisplayName: boolean;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPage(prefill: OnboardingPrefill, errorMessage: string | null): string {
  const brand = getBranding().name;
  const displayField = prefill.needsDisplayName
    ? `
      <label class="row">
        <span class="lbl">Your name</span>
        <input type="text" name="displayName" required maxlength="${MAX_NAME_LEN}"
               autocomplete="name" autofocus
               value="${escapeHtml(prefill.displayName ?? '')}"
               placeholder="How should we address you?" />
      </label>
    `
    : '';
  const error = errorMessage ? `<p class="error" role="alert">${escapeHtml(errorMessage)}</p>` : '';
  return `<!doctype html><html><head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>Welcome to ${escapeHtml(brand)}</title>
    <style>
      :root {
        color-scheme: light dark;
        --surface: Canvas; --surface-fg: CanvasText;
        --border: rgba(127,127,127,0.25);
        --muted: rgba(127,127,127,0.7);
        --wash: rgba(127,127,127,0.12);
        --shadow: rgba(0,0,0,0.28);
        --accent: #1a73e8; --accent-hover: #1664c1;
        --error: #c53030;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; min-height: 100%; }
      body {
        font: 15px/1.5 system-ui, -apple-system, sans-serif;
        background: var(--surface); color: var(--surface-fg);
        min-height: 100vh; min-height: 100dvh;
        display: flex; align-items: center; justify-content: center;
        padding: 24px 16px;
      }
      .card {
        width: 100%; max-width: 520px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 8px 28px var(--shadow);
        padding: 28px 28px 24px;
      }
      .brand {
        font-size: 12px; font-weight: 600;
        letter-spacing: 0.06em; text-transform: uppercase;
        color: var(--muted); margin-bottom: 8px;
      }
      h1 { font-size: 22px; margin: 0 0 6px; font-weight: 600; }
      .lead { color: var(--muted); margin: 0 0 18px; font-size: 14px; }
      h2 { font-size: 14px; margin: 18px 0 8px; font-weight: 600; }
      ul.benefits { padding: 0; margin: 0 0 4px; list-style: none; }
      ul.benefits li {
        padding: 6px 0 6px 22px; position: relative;
        font-size: 14px;
      }
      ul.benefits li::before {
        content: "✓"; position: absolute; left: 0; top: 6px;
        color: var(--accent); font-weight: 700;
      }
      form { margin-top: 18px; display: flex; flex-direction: column; gap: 12px; }
      .row { display: flex; flex-direction: column; gap: 4px; }
      .lbl { font-size: 13px; font-weight: 500; color: var(--surface-fg); }
      .hint { font-size: 12px; color: var(--muted); }
      input[type=text] {
        font: inherit; padding: 9px 11px;
        border: 1px solid var(--border); border-radius: 6px;
        background: var(--surface); color: var(--surface-fg);
      }
      input[type=text]:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: transparent; }
      .btn {
        display: block; width: 100%; text-align: center;
        padding: 10px 16px; margin-top: 4px;
        background: var(--accent); color: #fff;
        border: 0; border-radius: 6px;
        font: inherit; font-weight: 600;
        cursor: pointer;
      }
      .btn:hover { background: var(--accent-hover); }
      .error { color: var(--error); font-size: 13px; margin: 0 0 -4px; }
    </style>
  </head><body>
    <div class="card">
      <div class="brand">${escapeHtml(brand)}</div>
      <h1>Welcome — let's set up your agent</h1>
      <p class="lead">A few quick choices and you're in.</p>

      <h2>Why ${escapeHtml(brand)} beats Gemini for daily work</h2>
      <ul class="benefits">
        <li><strong>Yours, end to end.</strong> Runs in your account on your hardware — your data never feeds someone else's model.</li>
        <li><strong>Reaches you anywhere.</strong> Slack, Discord, email, iMessage, web — one agent, every channel you use.</li>
        <li><strong>Remembers and learns.</strong> Persistent memory and per-group instructions, so it gets sharper the more you use it.</li>
        <li><strong>Takes real action.</strong> Runs code, edits files, calls APIs, schedules tasks — not just chat replies.</li>
        <li><strong>Any model, any time.</strong> Switch between Claude, GPT, Gemini, or local models per group.</li>
      </ul>

      ${error}
      <form method="POST" action="/ui/onboarding" autocomplete="on" novalidate>
        ${displayField}
        <label class="row">
          <span class="lbl">What do you want to call your agent?</span>
          <input type="text" name="groupName" required maxlength="${MAX_NAME_LEN}"
                 value="${escapeHtml(prefill.groupName)}" />
          <span class="hint">Shows up in your sidebar — e.g. "${escapeHtml(DEFAULT_GROUP_NAME)}".</span>
        </label>
        <label class="row">
          <span class="lbl">What should the agent call itself?</span>
          <input type="text" name="assistantName" required maxlength="${MAX_NAME_LEN}"
                 value="${escapeHtml(prefill.assistantName)}" />
          <span class="hint">How the agent introduces itself — e.g. "${escapeHtml(DEFAULT_ASSISTANT_NAME)}".</span>
        </label>
        <button class="btn" type="submit">Get started</button>
      </form>
    </div>
  </body></html>`;
}

/**
 * Locate (or lazy-create) the per-user agent group provisioned by
 * `approvePendingUser`. We delegate to `ensurePerUserAgentGroup` so that
 * users whose group was never created (predate auto-provisioning) or was
 * archived get one minted on the spot — otherwise the onboarding wizard
 * would silently complete and the user would land in chat with zero
 * accessible groups.
 */
function findPerUserAgentGroupId(userId: string): string | null {
  return ensurePerUserAgentGroup(userId);
}

async function readUrlEncodedBody(req: http.IncomingMessage, max = 16 * 1024): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const c of req) {
    const buf = c as Buffer;
    total += buf.length;
    if (total > max) throw new Error('body_too_large');
    chunks.push(buf);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

function trimToMax(s: string): string {
  return s.trim().slice(0, MAX_NAME_LEN);
}

function renderHtml(res: http.ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function redirect(res: http.ServerResponse, location: string): void {
  res.writeHead(303, { Location: location, 'Cache-Control': 'no-store' });
  res.end();
}

export async function handleOnboarding(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const session = authenticate(req);
  if (!session) {
    redirect(res, '/ui/login?next=' + encodeURIComponent('/ui/onboarding'));
    return;
  }

  if (isUserOnboarded(session.userId)) {
    redirect(res, LANDING);
    return;
  }

  const user = getUser(session.userId);
  const hasName = !!user?.display_name?.trim();
  const prefill: OnboardingPrefill = {
    displayName: user?.display_name ?? null,
    groupName: DEFAULT_GROUP_NAME,
    assistantName: DEFAULT_ASSISTANT_NAME,
    needsDisplayName: !hasName,
  };

  if (req.method === 'GET') {
    renderHtml(res, 200, renderPage(prefill, null));
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  let form: URLSearchParams;
  try {
    form = await readUrlEncodedBody(req);
  } catch {
    renderHtml(res, 400, renderPage(prefill, 'Form submission was too large. Try again.'));
    return;
  }

  const submittedName = trimToMax(form.get('displayName') ?? prefill.displayName ?? '');
  const groupName = trimToMax(form.get('groupName') ?? '') || DEFAULT_GROUP_NAME;
  const assistantName = trimToMax(form.get('assistantName') ?? '') || DEFAULT_ASSISTANT_NAME;

  if (prefill.needsDisplayName && !submittedName) {
    prefill.groupName = groupName;
    prefill.assistantName = assistantName;
    renderHtml(res, 400, renderPage(prefill, 'Please tell us your name.'));
    return;
  }

  if (submittedName && submittedName !== user?.display_name) {
    updateDisplayName(session.userId, submittedName);
  }

  const agentGroupId = findPerUserAgentGroupId(session.userId);
  if (agentGroupId) {
    try {
      updateAgentGroup(agentGroupId, { name: groupName });
      updateContainerConfigScalars(agentGroupId, { assistant_name: assistantName });
    } catch (err) {
      log.warn('onboarding: failed to apply group/assistant names', { userId: session.userId, agentGroupId, err });
    }
  } else {
    log.info('onboarding: user has no per-user agent group to rename', { userId: session.userId });
  }

  markUserOnboarded(session.userId);
  log.info('onboarding completed', {
    userId: session.userId,
    renamedGroup: agentGroupId,
    setDisplayName: !!submittedName && submittedName !== user?.display_name,
  });

  redirect(res, LANDING);
}

// Stand-alone path matcher: server.ts mounts at /ui/onboarding and delegates.
export const ONBOARDING_PATH = '/ui/onboarding';

/** Test-only: exposed defaults so the test suite can assert UI copy. */
export const _DEFAULTS = {
  groupName: DEFAULT_GROUP_NAME,
  assistantName: DEFAULT_ASSISTANT_NAME,
};

/** Used by `completeLogin` to choose between LANDING and ONBOARDING_PATH. */
export function postLoginRedirect(userId: string, requestedNext: string): string {
  if (!isUserOnboarded(userId)) return ONBOARDING_PATH;
  return requestedNext;
}
