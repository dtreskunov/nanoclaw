import { describe, expect, it } from 'vitest';

import {
  buildTurn,
  extractDisplayQuery,
  extractOutboundText,
  renderAskQuestion,
  safeEqual,
  streamEnd,
  streamError,
  streamItem,
} from './homeassistant.js';

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

  it('ignores tool_result messages too — our adapter never emits tool_calls so HA never sends them back', () => {
    const { text } = buildTurn({
      query: 'and now?',
      messages: [
        { role: 'user', content: 'turn on fan' },
        { role: 'tool_result', tool_name: 'switch.turn_on', content: '{"success":true}' },
      ],
    });
    expect(text).toBe('and now?');
    expect(text).not.toContain('Tool Result');
    expect(text).not.toContain('success');
  });

  it('returns empty text when there is nothing to send', () => {
    expect(buildTurn({}).text).toBe('');
    expect(buildTurn({ query: '   ' }).text).toBe('');
  });

  it('never plumbs prior user/assistant turns into the prompt — the agent has them via session memory', () => {
    const { text } = buildTurn({
      query: 'the floor one',
      messages: [
        { role: 'user', content: 'turn off the lamp' },
        { role: 'assistant', content: 'Which lamp?' },
        { role: 'user', content: 'the floor one' },
      ],
    });
    expect(text).toBe('the floor one');
    expect(text).not.toContain('[Conversation so far]');
    expect(text).not.toContain('turn off the lamp');
    expect(text).not.toContain('Which lamp?');
  });
});

describe('extractDisplayQuery', () => {
  it('returns text unchanged when no markers are present', () => {
    expect(extractDisplayQuery('turn on the kitchen light')).toBe('turn on the kitchen light');
  });

  it('strips a [Conversation so far] block', () => {
    const text = '[Conversation so far]\nUser: Hi.\nAssistant: Hello.\n[End conversation so far]\n\nWhat time is it?';
    expect(extractDisplayQuery(text)).toBe('What time is it?');
  });

  it('strips [Tool Result] blocks', () => {
    const text = '[Tool Result: HassRespond]\n{"speech":"hi"}\n[End Tool Result]\n\nAh.';
    expect(extractDisplayQuery(text)).toBe('Ah.');
  });

  it('strips both blocks together', () => {
    const text =
      '[Conversation so far]\nUser: Hi.\nAssistant: Hello.\n[End conversation so far]\n\n[Tool Result: HassRespond]\n{"ok":true}\n[End Tool Result]\n\nWhat now?';
    expect(extractDisplayQuery(text)).toBe('What now?');
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

describe('streaming chunk encoders', () => {
  it('emits one NDJSON line per call, newline-terminated', () => {
    expect(streamItem('hi')).toBe('{"type":"item","content":"hi"}\n');
    expect(streamEnd()).toBe('{"type":"end"}\n');
    expect(streamError('boom')).toBe('{"type":"error","message":"boom"}\n');
  });

  it('escapes embedded newlines and quotes so the line stays parseable', () => {
    const line = streamItem('line1\nline2 with "quotes"');
    // Exactly one trailing newline — the rest must be JSON-escaped.
    expect(line.endsWith('\n')).toBe(true);
    expect(line.slice(0, -1).split('\n')).toHaveLength(1);
    expect(JSON.parse(line)).toEqual({ type: 'item', content: 'line1\nline2 with "quotes"' });
  });

  it('round-trips through JSON.parse the way HA s _send_payload_streaming reads it', () => {
    const chunks = [streamItem('thinking...'), streamItem('done'), streamEnd()];
    const parsed = chunks
      .join('')
      .split('\n')
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l));
    expect(parsed).toEqual([
      { type: 'item', content: 'thinking...' },
      { type: 'item', content: 'done' },
      { type: 'end' },
    ]);
  });
});
