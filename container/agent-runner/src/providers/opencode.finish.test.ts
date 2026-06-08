import { describe, it, expect } from 'bun:test';

import { describeFinishReason } from './opencode.js';

describe('describeFinishReason', () => {
  it('explains length cap (the silent-drop case)', () => {
    const msg = describeFinishReason('length');
    expect(msg).toMatch(/max output tokens/i);
  });

  it('handles content filter (dash and underscore)', () => {
    expect(describeFinishReason('content-filter')).toMatch(/content filter/i);
    expect(describeFinishReason('content_filter')).toMatch(/content filter/i);
  });

  it('handles tool-calls and error', () => {
    expect(describeFinishReason('tool-calls')).toMatch(/tool call/i);
    expect(describeFinishReason('error')).toMatch(/error/i);
  });

  it('falls back for unknown reasons', () => {
    expect(describeFinishReason('other')).toMatch(/"other"/);
  });
});
