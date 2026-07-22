import { describe, it, expect } from 'vitest';
import {
  cleanTranscriptText,
  isTranscribable,
  formatTranscript,
} from '../src/voice/transcriptRouting';

// PURE STT routing: from Whisper's raw text to the channel message. No IO.
// - cleanTranscriptText: trims and collapses spaces.
// - isTranscribable: decides whether it is worth posting (Whisper returns "" on noise/silence).
// - formatTranscript: "**Name:** text", neutralizing mass pings in the name/text.

describe('cleanTranscriptText', () => {
  it('trims and collapses inner whitespace', () => {
    expect(cleanTranscriptText('  olá    mundo  ')).toBe('olá mundo');
    expect(cleanTranscriptText('\n\ttexto\n')).toBe('texto');
  });
});

describe('isTranscribable', () => {
  it('empty/whitespace -> does not post (Whisper noise)', () => {
    expect(isTranscribable('')).toBe(false);
    expect(isTranscribable('   ')).toBe(false);
    expect(isTranscribable('\n')).toBe(false);
  });
  it('real text -> posts', () => {
    expect(isTranscribable('hello there')).toBe(true);
  });
});

describe('formatTranscript', () => {
  it('formats "**Name:** text"', () => {
    expect(formatTranscript('Rita', 'good game')).toBe('**Rita:** good game');
  });
  it('neutralizes @everyone/@here coming from speech or the name (defense in depth)', () => {
    expect(formatTranscript('Rita', 'ping @everyone now')).not.toContain('@everyone');
    expect(formatTranscript('@here', 'oi')).not.toContain('@here');
  });
  it('trims the text when formatting', () => {
    expect(formatTranscript('Rita', '  hi  ')).toBe('**Rita:** hi');
  });
});
