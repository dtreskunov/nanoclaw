import { describe, expect, it } from 'vitest';

import { resolveProviderName } from './container-runner.js';

describe('resolveProviderName', () => {
  it('prefers session over container config', () => {
    expect(resolveProviderName('codex', 'claude')).toBe('codex');
  });

  it('falls back to container config when session is null', () => {
    expect(resolveProviderName(null, 'opencode')).toBe('opencode');
  });

  it('defaults to claude when nothing is set', () => {
    expect(resolveProviderName(null, undefined)).toBe('claude');
  });

  it('lowercases the resolved name', () => {
    expect(resolveProviderName('CODEX', null)).toBe('codex');
    expect(resolveProviderName(null, 'Claude')).toBe('claude');
  });

  it('treats empty string as unset (falls through)', () => {
    expect(resolveProviderName('', 'opencode')).toBe('opencode');
    expect(resolveProviderName(null, '')).toBe('claude');
  });

  it('uses env default when session and config are both unset', () => {
    expect(resolveProviderName(null, null, 'codex')).toBe('codex');
    expect(resolveProviderName(null, undefined, 'OPENCODE')).toBe('opencode');
  });

  it('row provider still wins over env default', () => {
    expect(resolveProviderName(null, 'claude', 'codex')).toBe('claude');
  });

  it('falls through env empty/null to claude', () => {
    expect(resolveProviderName(null, null, '')).toBe('claude');
    expect(resolveProviderName(null, null, null)).toBe('claude');
  });
});
