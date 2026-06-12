import { describe, expect, it } from 'vitest';

import { buildTurn, extractOutboundText, safeEqual } from './homeassistant.js';

describe('buildTurn', () => {
  it('returns just the query as visible text', () => {
    const { text } = buildTurn({ query: 'Turn on the lights' });
    expect(text).toBe('Turn on the lights');
  });

  it('ignores system_prompt and exposed_entities — the agent reads live state via HA MCP', () => {
    const result = buildTurn({
      query: 'Is the kitchen light on?',
      system_prompt: 'Be concise.',
      exposed_entities: [{ entity_id: 'light.kitchen', name: 'Kitchen', state: 'on' }],
    });
    // Visible text is only the user's words — no state blob, no context field.
    expect(result.text).toBe('Is the kitchen light on?');
    expect(result.text).not.toContain('light.kitchen');
    expect(result).not.toHaveProperty('context');
  });

  it('ignores exposed_entities passed as a pre-serialized JSON string', () => {
    const { text } = buildTurn({
      query: 'status?',
      exposed_entities: '[{"entity_id":"switch.fan"}]',
    });
    expect(text).toBe('status?');
    expect(text).not.toContain('switch.fan');
  });

  it('includes tool_result messages as labeled blocks in the visible text', () => {
    const { text } = buildTurn({
      query: 'and now?',
      messages: [
        { role: 'user', content: 'turn on fan' },
        { role: 'tool_result', tool_name: 'switch.turn_on', content: '{"success":true}' },
      ],
    });
    expect(text).toContain('[Tool Result: switch.turn_on]');
    expect(text).toContain('{"success":true}');
    expect(text).toContain('[End Tool Result]');
    expect(text.trim().endsWith('and now?')).toBe(true);
  });

  it('returns empty text when there is nothing to send', () => {
    expect(buildTurn({}).text).toBe('');
    expect(buildTurn({ query: '   ' }).text).toBe('');
  });
});

describe('extractOutboundText', () => {
  it('reads markdown then text from object content', () => {
    expect(extractOutboundText({ kind: 'chat', content: { markdown: 'hello' } })).toBe('hello');
    expect(extractOutboundText({ kind: 'chat', content: { text: 'plain' } })).toBe('plain');
  });

  it('prefers markdown over text', () => {
    expect(extractOutboundText({ kind: 'chat', content: { markdown: 'm', text: 't' } })).toBe('m');
  });

  it('handles string content', () => {
    expect(extractOutboundText({ kind: 'chat', content: 'raw' })).toBe('raw');
  });

  it('returns null for non-text payloads', () => {
    expect(extractOutboundText({ kind: 'chat', content: { type: 'card' } })).toBeNull();
    expect(extractOutboundText({ kind: 'chat', content: null })).toBeNull();
  });
});

describe('safeEqual', () => {
  it('returns true for identical strings', () => {
    expect(safeEqual('secret', 'secret')).toBe(true);
  });

  it('returns false for different strings of equal length', () => {
    expect(safeEqual('secret', 'secryt')).toBe(false);
  });

  it('returns false for different-length strings', () => {
    expect(safeEqual('short', 'longervalue')).toBe(false);
  });
});
