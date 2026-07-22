import { describe, expect, it } from 'vitest';
import { splitForFastPlayback } from '../src/tts/sentenceChunks';

describe('splitForFastPlayback', () => {
  it('keeps short text as one utterance', () => {
    expect(splitForFastPlayback('A short sentence.', 80)).toEqual(['A short sentence.']);
  });

  it('prefers sentence boundaries while preserving every word', () => {
    const text = 'First sentence is ready. Second sentence takes a little longer! Last one?';
    const chunks = splitForFastPlayback(text, 34);
    expect(chunks).toEqual([
      'First sentence is ready.',
      'Second sentence takes a little',
      'longer! Last one?',
    ]);
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(text);
  });

  it('hard-wraps a long sentence without losing text', () => {
    const text = 'one two three four five six seven eight nine ten';
    const chunks = splitForFastPlayback(text, 14);
    expect(chunks.every((chunk) => chunk.length <= 14)).toBe(true);
    expect(chunks.join(' ')).toBe(text);
  });

  it('does not create empty chunks for whitespace', () => {
    expect(splitForFastPlayback('   ', 20)).toEqual([]);
  });
});
