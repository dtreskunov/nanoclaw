import { describe, it, expect } from 'bun:test';

import { formatProgressFromPart, ProgressThrottle } from './opencode.js';

describe('formatProgressFromPart', () => {
  const seen = () => new Set<string>();

  it('returns null for missing or unknown parts', () => {
    expect(formatProgressFromPart(undefined, 0, seen())).toBeNull();
    expect(formatProgressFromPart({}, 0, seen())).toBeNull();
    expect(formatProgressFromPart({ type: 'snapshot' }, 0, seen())).toBeNull();
    expect(formatProgressFromPart({ type: 'step-start' }, 0, seen())).toBeNull();
  });

  it('formats core tool calls with basenamed file args', () => {
    const cases: Array<[string, Record<string, unknown>, string]> = [
      ['read', { filePath: '/workspace/agent/foo/bar.html' }, 'Reading `bar.html`'],
      ['write', { filePath: '/workspace/agent/foo/bar.html' }, 'Writing `bar.html`'],
      ['edit', { filePath: '/workspace/agent/foo/bar.html' }, 'Editing `bar.html`'],
      ['grep', { pattern: 'foo.*bar' }, 'Searching for `foo.*bar`'],
      ['glob', { pattern: '**/*.ts' }, 'Globbing `**/*.ts`'],
      ['todowrite', {}, 'Updating todos'],
    ];
    for (const [tool, input, expected] of cases) {
      expect(formatProgressFromPart({ type: 'tool', tool, state: { input } }, 0, seen())).toBe(expected);
    }
  });

  it('clips long bash commands to a single line', () => {
    const long = 'pnpm exec tsx scripts/very-long-task.ts --flag value --other "with spaces"\nand newline';
    const out = formatProgressFromPart({ type: 'tool', tool: 'bash', state: { input: { command: long } } }, 0, seen());
    expect(out?.startsWith('Running `')).toBe(true);
    expect(out).not.toContain('\n');
    // 60-char cap + "Running `…`" wrapper.
    expect((out ?? '').length).toBeLessThanOrEqual('Running ``'.length + 60);
  });

  it('renders webfetch with the hostname only', () => {
    const out = formatProgressFromPart(
      { type: 'tool', tool: 'webfetch', state: { input: { url: 'https://example.com/path?q=1' } } },
      0,
      seen(),
    );
    expect(out).toBe('Fetching `example.com`');
  });

  it('renders MCP tool calls as server.name', () => {
    const out = formatProgressFromPart({ type: 'tool', tool: 'mcp__tavily__search', state: {} }, 0, seen());
    expect(out).toBe('Calling `tavily.search`');
  });

  it('falls back to generic running for unknown tools', () => {
    const out = formatProgressFromPart({ type: 'tool', tool: 'mystery', state: {} }, 0, seen());
    expect(out).toBe('Running `mystery`');
  });

  it('yields Thinking… once per reasoning part id', () => {
    const set = new Set<string>();
    expect(formatProgressFromPart({ type: 'reasoning', id: 'r1' }, 0, set)).toBe('Thinking…');
    expect(formatProgressFromPart({ type: 'reasoning', id: 'r1' }, 0, set)).toBeNull();
    expect(formatProgressFromPart({ type: 'reasoning', id: 'r2' }, 0, set)).toBe('Thinking…');
  });

  it('yields Writing reply… only once textLen >= 500', () => {
    expect(formatProgressFromPart({ type: 'text', messageID: 'm1', text: 'hi' }, 2, seen())).toBeNull();
    expect(formatProgressFromPart({ type: 'text', messageID: 'm1', text: 'x'.repeat(499) }, 499, seen())).toBeNull();
    expect(formatProgressFromPart({ type: 'text', messageID: 'm1', text: 'x'.repeat(500) }, 500, seen())).toBe('Writing reply…');
  });
});

describe('ProgressThrottle', () => {
  it('passes through the first message immediately', () => {
    let now = 1000;
    const t = new ProgressThrottle(1000, () => now);
    expect(t.next('Editing `a.ts`')).toBe('Editing `a.ts`');
  });

  it('suppresses identical messages within the interval', () => {
    let now = 1000;
    const t = new ProgressThrottle(1000, () => now);
    expect(t.next('Editing `a.ts`')).toBe('Editing `a.ts`');
    now = 1500;
    expect(t.next('Editing `a.ts`')).toBeNull();
    now = 2001;
    expect(t.next('Editing `a.ts`')).toBe('Editing `a.ts`');
  });

  it('passes a different message through immediately', () => {
    let now = 1000;
    const t = new ProgressThrottle(1000, () => now);
    expect(t.next('Editing `a.ts`')).toBe('Editing `a.ts`');
    now = 1100;
    expect(t.next('Reading `b.ts`')).toBe('Reading `b.ts`');
  });

  it('ignores null inputs', () => {
    const t = new ProgressThrottle(1000, () => 1000);
    expect(t.next(null)).toBeNull();
  });
});
