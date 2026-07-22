import { describe, it, expect } from 'vitest';
import { applyPronunciation } from '../src/textCleaning/pronunciation';
import type { PronunciationEntry } from '../src/textCleaning/pronunciation';

describe('applyPronunciation', () => {
  it('empty dict = no-op', () => {
    expect(applyPronunciation('ola mundo', [])).toBe('ola mundo');
  });

  it('replaces a term by whole word', () => {
    const dict: PronunciationEntry[] = [{ term: 'gg', replacement: 'good game' }];
    expect(applyPronunciation('gg a todos', dict)).toBe('good game a todos');
  });

  it('replacement is case-insensitive', () => {
    const dict: PronunciationEntry[] = [{ term: 'gg', replacement: 'good game' }];
    expect(applyPronunciation('GG malta', dict)).toBe('good game malta');
    expect(applyPronunciation('Gg malta', dict)).toBe('good game malta');
  });

  it('does not affect substrings (whole word only)', () => {
    const dict: PronunciationEntry[] = [{ term: 'gg', replacement: 'good game' }];
    // "eggs" contains "gg" but must not be touched
    expect(applyPronunciation('eggs e ovos', dict)).toBe('eggs e ovos');
  });

  // Bug-hunt 2026-07: the replacement (controlled by the admin via /server-pronunciation)
  // was passed RAW as the 2nd arg of String.replace, which interprets $&, $1, $`, $', $$
  // as directives. A replacement with '$' produced wrong audio (e.g. "R$" -> inserts
  // the matched term). It must be LITERAL (the siblings restoreAccents/expandAbbreviations
  // use function-replacers for this reason). The cases below cover the $ patterns.
  it('treats the replacement as LITERAL (does not interpret $&, $1, $$ as directives)', () => {
    // $& = matched term; if it were interpreted, "gg" -> "[gg]" would become "[gg]"->"[[gg]]"? No.
    expect(applyPronunciation('preco gg', [{ term: 'gg', replacement: '$&' }])).toBe('preco $&');
    // literal currency symbol — the real-world case.
    expect(applyPronunciation('paga dollars agora', [{ term: 'dollars', replacement: 'R$' }])).toBe(
      'paga R$ agora',
    );
    // $$ must stay $$ (not collapse to $), $1 literal (there is no group 1).
    expect(applyPronunciation('a x b', [{ term: 'x', replacement: '$$$1' }])).toBe('a $$$1 b');
  });

  it('replaces multiple different terms', () => {
    const dict: PronunciationEntry[] = [
      { term: 'gg', replacement: 'good game' },
      { term: 'btw', replacement: 'by the way' },
    ];
    expect(applyPronunciation('gg e btw acabou', dict)).toBe('good game e by the way acabou');
  });

  it('replaces repeated occurrences of the same term', () => {
    const dict: PronunciationEntry[] = [{ term: 'gg', replacement: 'good game' }];
    expect(applyPronunciation('gg gg gg', dict)).toBe('good game good game good game');
  });

  it('replaces two different adjacent terms (zero-width boundary)', () => {
    // Boundary chars are zero-width: both adjacent terms are replaced.
    const dict: PronunciationEntry[] = [
      { term: 'aa', replacement: 'X' },
      { term: 'bb', replacement: 'Y' },
    ];
    expect(applyPronunciation('aa bb', dict)).toBe('X Y');
  });

  it('respects unicode boundaries (accents count as letters)', () => {
    const dict: PronunciationEntry[] = [{ term: 'ca', replacement: 'KA' }];
    // "café" must not be touched: the "é" is part of the word (unicode boundary)
    expect(applyPronunciation('café quente', dict)).toBe('café quente');
  });

  it('replaces an accented term', () => {
    const dict: PronunciationEntry[] = [{ term: 'salázar', replacement: 'ditador' }];
    expect(applyPronunciation('o salázar fez', dict)).toBe('o ditador fez');
  });

  it('escapes regex metacharacters in the term', () => {
    const dict: PronunciationEntry[] = [{ term: 'c++', replacement: 'cplusplus' }];
    expect(applyPronunciation('amo c++', dict)).toBe('amo cplusplus');
  });

  it('empty replacement removes the term (leaves the boundary)', () => {
    const dict: PronunciationEntry[] = [{ term: 'lol', replacement: '' }];
    // The term is removed; the replacement happens AFTER cleanText, so
    // the residual whitespace is not re-collapsed (pinned behavior).
    expect(applyPronunciation('isto lol acabou', dict)).toBe('isto  acabou');
  });

  it('is deterministic for the same input', () => {
    const dict: PronunciationEntry[] = [
      { term: 'gg', replacement: 'good game' },
      { term: 'wp', replacement: 'well played' },
    ];
    const out1 = applyPronunciation('gg wp gg', dict);
    const out2 = applyPronunciation('gg wp gg', dict);
    expect(out1).toBe(out2);
    expect(out1).toBe('good game well played good game');
  });

  it('replaces a multi-word term (nick with a space)', () => {
    const dict: PronunciationEntry[] = [{ term: 'xX Sniper Xx', replacement: 'o jogador' }];
    expect(applyPronunciation('boa xX Sniper Xx', dict)).toBe('boa o jogador');
  });
});
