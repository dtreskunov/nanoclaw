/**
 * Shared HTML shell for server-rendered auth pages (login, OIDC pending /
 * denied / error, onboarding).
 *
 * Mirrors the chat client's design tokens (`src/ui/client/chat/src/styles/global.css`)
 * so /ui/login and /ui/onboarding feel like the same product as /ui/chat:
 * matching surface colors, the signature gradient accent, the same radius
 * + type scale.
 *
 * Mobile-friendly out of the box:
 *   - viewport meta with viewport-fit=cover + interactive-widget=resizes-content
 *   - env(safe-area-inset-*) padding around the card
 *   - 44px minimum touch targets on inputs / buttons
 *   - card collapses to full-width on narrow screens
 */
import { getBranding } from './branding.js';

export const PAGE_CSS = `
  :root {
    color-scheme: light dark;
    --surface: Canvas;
    --surface-fg: CanvasText;
    --border: rgba(127, 127, 127, 0.25);
    --border-strong: rgba(127, 127, 127, 0.40);
    --muted: rgba(127, 127, 127, 0.7);
    --wash-soft: rgba(127, 127, 127, 0.08);
    --wash: rgba(127, 127, 127, 0.12);
    --shadow: rgba(0, 0, 0, 0.28);
    --primary: #1a73e8;
    --primary-hover: #1664c1;
    --error: #c53030;
    --gradient-pop: linear-gradient(135deg, #8be4d4 0%, #3fbfae 40%, #b07cff 100%);
    --radius-md: 4px;
    --radius-lg: 6px;
    --radius-xl: 8px;
    --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; min-height: 100%; }
  body {
    font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
    background: var(--surface); color: var(--surface-fg);
    min-height: 100vh; min-height: 100dvh;
    display: flex; align-items: center; justify-content: center;
    padding:
      max(24px, env(safe-area-inset-top))
      max(16px, env(safe-area-inset-right))
      max(24px, env(safe-area-inset-bottom))
      max(16px, env(safe-area-inset-left));
  }
  .card {
    width: 100%; max-width: 440px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    box-shadow: 0 8px 28px var(--shadow);
    padding: 28px;
    position: relative;
    overflow: hidden;
  }
  .card::before {
    content: ''; position: absolute; left: 0; right: 0; top: 0;
    height: 3px; background: var(--gradient-pop);
  }
  .brand {
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--muted); margin-bottom: 10px;
  }
  h1 {
    font-size: 20px; line-height: 1.25;
    margin: 0 0 14px; font-weight: 600;
  }
  h2 { font-size: 13px; margin: 16px 0 8px; font-weight: 600; }
  p { margin: 8px 0; }
  p.lead { color: var(--muted); margin: 0 0 16px; font-size: 14px; }
  .muted { color: var(--muted); font-size: 13px; }
  code {
    background: var(--wash); padding: 1px 5px;
    border-radius: var(--radius-md);
    font-size: 12.5px; font-family: var(--font-mono);
  }
  form { margin-top: 14px; display: flex; flex-direction: column; gap: 12px; }
  .row { display: flex; flex-direction: column; gap: 4px; }
  .lbl { font-size: 13px; font-weight: 500; color: var(--surface-fg); }
  .hint { font-size: 12px; color: var(--muted); }
  input[type=text], input[type=email] {
    font: inherit; padding: 10px 12px;
    min-height: 44px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface); color: var(--surface-fg);
  }
  input:focus {
    outline: 2px solid var(--primary); outline-offset: -1px;
    border-color: transparent;
  }
  .btn {
    display: block; width: 100%; text-align: center;
    padding: 11px 16px; margin: 8px 0;
    min-height: 44px;
    background: var(--primary); color: #fff;
    border: 0; border-radius: var(--radius-lg);
    font: inherit; font-weight: 600;
    text-decoration: none; cursor: pointer;
  }
  .btn:hover { background: var(--primary-hover); }
  .btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
  ul.benefits { padding: 0; margin: 0 0 4px; list-style: none; }
  ul.benefits li {
    padding: 6px 0 6px 22px; position: relative; font-size: 13px;
  }
  ul.benefits li::before {
    content: "✓"; position: absolute; left: 0; top: 6px;
    color: var(--primary); font-weight: 700;
  }
  .error {
    color: var(--error); font-size: 13px;
    margin: 4px 0 -4px;
  }
  /* Narrow phones — drop the card chrome a touch so it doesn't feel cramped. */
  @media (max-width: 480px) {
    .card { padding: 22px 20px; }
    h1 { font-size: 18px; }
  }
`;

export interface PageShellOpts {
  title: string;
  /** Card body HTML — the brand strip is prepended automatically. */
  bodyHtml: string;
  /** When set, emits a meta http-equiv="refresh" so the page polls itself. */
  refreshSeconds?: number;
}

/**
 * Wrap inner card HTML in the full doctype/head/body shell. The brand strip
 * + card chrome are added here so callers only supply the page-specific
 * content.
 */
export function renderPageShell(opts: PageShellOpts): string {
  const brand = getBranding().name;
  const refresh = opts.refreshSeconds ? `<meta http-equiv="refresh" content="${opts.refreshSeconds}">` : '';
  return `<!doctype html><html lang="en"><head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">
    <meta name="theme-color" content="${getBranding().themeColor}">
    ${refresh}
    <title>${escapeHtml(opts.title)} — ${escapeHtml(brand)}</title>
    <style>${PAGE_CSS}</style>
  </head><body>
    <div class="card">
      <div class="brand">${escapeHtml(brand)}</div>
      ${opts.bodyHtml}
    </div>
  </body></html>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
