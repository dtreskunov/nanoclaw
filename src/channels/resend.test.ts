import { describe, expect, it } from 'vitest';

import { ensureBodyForAttachments } from './resend.js';

describe('ensureBodyForAttachments', () => {
  it('injects a filename list when markdown is empty and files are present', () => {
    const out = ensureBodyForAttachments({
      markdown: '',
      files: [
        { filename: 'a.mp3', data: Buffer.from('a') },
        { filename: 'b.mp3', data: Buffer.from('b') },
      ],
    });
    expect(out.markdown).toBe('Attached:\n\n- a.mp3\n- b.mp3');
    expect(out.files).toHaveLength(2);
  });

  it('treats whitespace-only markdown as empty', () => {
    const out = ensureBodyForAttachments({
      markdown: '   \n  ',
      files: [{ filename: 'x.pdf', data: Buffer.from('x') }],
    });
    expect(out.markdown).toBe('Attached:\n\n- x.pdf');
  });

  it('leaves non-empty markdown alone', () => {
    const original = {
      markdown: 'Here you go',
      files: [{ filename: 'x.pdf', data: Buffer.from('x') }],
    };
    const out = ensureBodyForAttachments(original);
    expect(out).toBe(original);
    expect(out.markdown).toBe('Here you go');
  });

  it('is a no-op when there are no files', () => {
    const original = { markdown: '', files: [] };
    expect(ensureBodyForAttachments(original)).toBe(original);
    const noFiles = { markdown: 'hi' };
    expect(ensureBodyForAttachments(noFiles)).toBe(noFiles);
  });

  it('is a no-op when files is undefined', () => {
    const original = { markdown: '' };
    expect(ensureBodyForAttachments(original)).toBe(original);
  });
});
