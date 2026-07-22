import { describe, it, expect } from 'vitest';
import { lowerAllCapsRuns } from '../src/tts/deCaps';

// The primitive shared by gTTS (deCapsForGoogle) and applied in Kokoro/Neural,
// so an ALL-CAPS "shout" is not SPELLED OUT. The gTTS-specific tests are
// in gtts.test.ts (deCapsForGoogle delegates here).
describe('lowerAllCapsRuns — lowercases runs of 2+ CAPITALS', () => {
  it('lowercases runs (2+), including accented ones', () => {
    expect(lowerAllCapsRuns('AJUDA')).toBe('ajuda');
    expect(lowerAllCapsRuns('olá AJUDA aqui')).toBe('olá ajuda aqui');
    expect(lowerAllCapsRuns('ÁGUA')).toBe('água');
  });

  it('leaves a SINGLE capital intact (sentence start, "I", "A")', () => {
    expect(lowerAllCapsRuns('Ola pessoal')).toBe('Ola pessoal');
    expect(lowerAllCapsRuns('I am a Robot')).toBe('I am a Robot');
  });

  it('punctuation, digits and lowercase stay intact', () => {
    expect(lowerAllCapsRuns('grita!!!')).toBe('grita!!!');
    expect(lowerAllCapsRuns('COVID19')).toBe('covid19');
    expect(lowerAllCapsRuns('')).toBe('');
  });
});
