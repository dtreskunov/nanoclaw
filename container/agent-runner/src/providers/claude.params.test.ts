import { describe, it, expect } from 'bun:test';

import { paramsToClaudeEnv, paramsToClaudeThinking } from './claude.js';

describe('paramsToClaudeEnv', () => {
  it('returns empty object for undefined', () => {
    expect(paramsToClaudeEnv(undefined)).toEqual({});
  });

  it('returns empty object for empty input', () => {
    expect(paramsToClaudeEnv({})).toEqual({});
  });

  it('maps max_tokens to ANTHROPIC_MAX_TOKENS', () => {
    expect(paramsToClaudeEnv({ max_tokens: 8192 })).toEqual({ ANTHROPIC_MAX_TOKENS: '8192' });
  });

  it('floors fractional max_tokens', () => {
    expect(paramsToClaudeEnv({ max_tokens: 1024.7 })).toEqual({ ANTHROPIC_MAX_TOKENS: '1024' });
  });

  it('ignores non-positive max_tokens', () => {
    expect(paramsToClaudeEnv({ max_tokens: 0 })).toEqual({});
    expect(paramsToClaudeEnv({ max_tokens: -5 })).toEqual({});
  });

  it('ignores non-number max_tokens', () => {
    expect(paramsToClaudeEnv({ max_tokens: '8192' })).toEqual({});
    expect(paramsToClaudeEnv({ max_tokens: true })).toEqual({});
    expect(paramsToClaudeEnv({ max_tokens: null })).toEqual({});
  });

  it('ignores NaN / Infinity', () => {
    expect(paramsToClaudeEnv({ max_tokens: Number.NaN })).toEqual({});
    expect(paramsToClaudeEnv({ max_tokens: Number.POSITIVE_INFINITY })).toEqual({});
  });

  it('ignores unrelated keys', () => {
    expect(paramsToClaudeEnv({ temperature: 0.7, top_p: 0.9 })).toEqual({});
  });
});

describe('paramsToClaudeThinking', () => {
  it('returns undefined for undefined', () => {
    expect(paramsToClaudeThinking(undefined)).toBeUndefined();
  });

  it('returns undefined when budget is absent', () => {
    expect(paramsToClaudeThinking({})).toBeUndefined();
    expect(paramsToClaudeThinking({ max_tokens: 1024 })).toBeUndefined();
  });

  it('maps thinking_budget_tokens to enabled with budgetTokens', () => {
    expect(paramsToClaudeThinking({ thinking_budget_tokens: 2048 })).toEqual({
      type: 'enabled',
      budgetTokens: 2048,
    });
  });

  it('floors fractional budget', () => {
    expect(paramsToClaudeThinking({ thinking_budget_tokens: 1024.9 })).toEqual({
      type: 'enabled',
      budgetTokens: 1024,
    });
  });

  it('returns undefined for non-positive budget', () => {
    expect(paramsToClaudeThinking({ thinking_budget_tokens: 0 })).toBeUndefined();
    expect(paramsToClaudeThinking({ thinking_budget_tokens: -100 })).toBeUndefined();
  });

  it('returns undefined for non-number budget', () => {
    expect(paramsToClaudeThinking({ thinking_budget_tokens: '2048' })).toBeUndefined();
    expect(paramsToClaudeThinking({ thinking_budget_tokens: null })).toBeUndefined();
  });
});
