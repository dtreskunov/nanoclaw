import { describe, it, expect } from 'bun:test';

import { pickModelOptionsForOpenCode } from './opencode.js';

describe('pickModelOptionsForOpenCode', () => {
  it('returns empty object for undefined input', () => {
    expect(pickModelOptionsForOpenCode(undefined)).toEqual({});
  });

  it('returns empty object for empty input', () => {
    expect(pickModelOptionsForOpenCode({})).toEqual({});
  });

  it('passes through recognized scalar keys', () => {
    expect(
      pickModelOptionsForOpenCode({
        max_tokens: 8192,
        temperature: 0.7,
        top_p: 0.9,
      }),
    ).toEqual({ max_tokens: 8192, temperature: 0.7, top_p: 0.9 });
  });

  it('passes through extended sampling keys', () => {
    expect(
      pickModelOptionsForOpenCode({
        top_k: 50,
        frequency_penalty: 0.1,
        presence_penalty: 0.2,
        seed: 42,
        stop: ['END', 'STOP'],
      }),
    ).toEqual({
      top_k: 50,
      frequency_penalty: 0.1,
      presence_penalty: 0.2,
      seed: 42,
      stop: ['END', 'STOP'],
    });
  });

  it('drops unknown keys', () => {
    expect(
      pickModelOptionsForOpenCode({
        max_tokens: 1024,
        reasoning_effort: 'high', // not in MODEL_LEVEL_PARAM_KEYS
        random_unknown_key: 'whatever',
      }),
    ).toEqual({ max_tokens: 1024 });
  });

  it('drops every key when none are recognized', () => {
    expect(
      pickModelOptionsForOpenCode({
        unknown_a: 1,
        unknown_b: 'x',
      }),
    ).toEqual({});
  });
});
