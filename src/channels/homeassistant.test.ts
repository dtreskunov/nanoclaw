import { describe, expect, it } from 'vitest';

import { buildTurn, extractOutboundText, renderAskQuestion, safeEqual } from './homeassistant.js';

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

  it('plumbs prior user/assistant turns into the prompt', () => {
    const { text } = buildTurn({
      query: 'the floor one',
      messages: [
        { role: 'user', content: 'turn off the lamp' },
        { role: 'assistant', content: 'Which lamp?' },
        { role: 'user', content: 'the floor one' },
      ],
    });
    expect(text).toContain('[Conversation so far]');
    expect(text).toContain('User: turn off the lamp');
    expect(text).toContain('Assistant: Which lamp?');
    expect(text).toContain('[End conversation so far]');
    // The current query is rendered once, after the history, not replayed in it.
    expect(text.trim().endsWith('the floor one')).toBe(true);
    expect(text.match(/the floor one/g)).toHaveLength(1);
  });

  it('does not replay the current query as part of the prior history', () => {
    const { text } = buildTurn({
      query: 'hello',
      messages: [{ role: 'user', content: 'hello' }],
    });
    expect(text).toBe('hello');
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

  it('renders an ask_question payload as an inline prompt + options so the HA request settles', () => {
    const text = extractOutboundText({
      kind: 'chat-sdk',
      content: {
        type: 'ask_question',
        questionId: 'q1',
        title: 'Which office lamp?',
        question: 'Which office lamp did you want to turn on?',
        options: [
          { label: 'Office Desk Lamp', value: 'Office Desk Lamp' },
          { label: 'Office Floor Lamp', value: 'Office Floor Lamp' },
        ],
      },
    });
    expect(text).toBe('Which office lamp did you want to turn on? Office Desk Lamp or Office Floor Lamp?');
  });
});

describe('renderAskQuestion', () => {
  it('renders the prompt first with options as a natural inline list', () => {
    expect(
      renderAskQuestion({
        type: 'ask_question',
        title: 'Pick one',
        question: 'Which lamp?',
        options: [{ label: 'Desk' }, { label: 'Floor' }, { label: 'Corner' }],
      }),
    ).toBe('Which lamp? Desk, Floor, or Corner?');
  });

  it('joins two options with "or"', () => {
    expect(
      renderAskQuestion({ type: 'ask_question', question: 'Which one?', options: [{ label: 'A' }, { label: 'B' }] }),
    ).toBe('Which one? A or B?');
  });

  it('falls back to title when question is missing and gives the prompt a question mark', () => {
    expect(
      renderAskQuestion({
        type: 'ask_question',
        title: 'Pick one',
        options: [{ label: 'A' }, { label: 'B' }],
      }),
    ).toBe('Pick one? A or B?');
  });

  it('renders the prompt alone when there are no usable option labels', () => {
    expect(renderAskQuestion({ type: 'ask_question', question: 'Free form?', options: [] })).toBe('Free form?');
    expect(renderAskQuestion({ type: 'ask_question', question: 'Free form?' })).toBe('Free form?');
  });

  it('appends a question mark when the prompt does not already end with one', () => {
    expect(renderAskQuestion({ type: 'ask_question', question: 'Pick a lamp' })).toBe('Pick a lamp?');
  });

  it('renders options alone when there is no prompt', () => {
    expect(renderAskQuestion({ type: 'ask_question', options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }] })).toBe(
      'A, B, or C?',
    );
  });

  it('returns null for non ask_question payloads', () => {
    expect(renderAskQuestion({ type: 'send_card', text: 'x' })).toBeNull();
    expect(renderAskQuestion({ title: 'no type' })).toBeNull();
  });

  it('returns null when an ask_question has neither prompt nor options', () => {
    expect(renderAskQuestion({ type: 'ask_question' })).toBeNull();
    expect(renderAskQuestion({ type: 'ask_question', options: [{ value: 'x' }] })).toBeNull();
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
