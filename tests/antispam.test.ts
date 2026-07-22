import { describe, it, expect } from 'vitest';
import {
  isRepetitionSpam,
  normalizeForDuplicate,
  DuplicateTracker,
  REPETITION_MIN_TOKENS,
  DUPLICATE_WINDOW_MS,
} from '../src/moderation/antispam';

const G = 'guild-1';
const U = 'user-1';

describe('isRepetitionSpam', () => {
  it('catches the real case: "POKEBOLAS" ×39', () => {
    expect(isRepetitionSpam(Array(39).fill('POKEBOLAS').join(' '))).toBe(true);
  });

  it('catches "eu gosto de ti" ×3 (ratio 0.33)', () => {
    expect(isRepetitionSpam(Array(3).fill('eu gosto de ti').join(' '))).toBe(true);
  });

  it('lets a normal sentence through (high diversity)', () => {
    expect(
      isRepetitionSpam(
        'hoje fui ao mercado comprar pão leite e ainda uns ovos frescos para o jantar',
      ),
    ).toBe(false);
  });

  it('lets short messages through even if repeated (< min tokens)', () => {
    expect(isRepetitionSpam('sim sim sim')).toBe(false); // 3 tokens < 10
    // Exactly on the boundary: 9 repetitions do not reach the minimum.
    expect(
      isRepetitionSpam(
        Array(REPETITION_MIN_TOKENS - 1)
          .fill('lol')
          .join(' '),
      ),
    ).toBe(false);
  });

  it('ratio boundary: 10 tokens with 4 unique (0.4) is NOT spam; with 3 unique (0.3) it is', () => {
    // "a a a a a a a b c d" -> 10 tokens, 4 unique = 0.4 > 0.35
    expect(isRepetitionSpam('a a a a a a a b c d')).toBe(false);
    // "a a a a a a a a b c" -> 10 tokens, 3 unique = 0.3 <= 0.35
    expect(isRepetitionSpam('a a a a a a a a b c')).toBe(true);
  });

  it('ignores punctuation/emoji in tokenization', () => {
    expect(isRepetitionSpam('POKEBOLAS!!! '.repeat(12))).toBe(true);
  });
});

describe('normalizeForDuplicate', () => {
  it('lowercases, collapses spaces and trims', () => {
    expect(normalizeForDuplicate('  Olá   MUNDO\n\tfim ')).toBe('olá mundo fim');
  });
});

describe('DuplicateTracker', () => {
  const big = 'esta é uma mensagem suficientemente grande para contar como duplicado spam ok'; // ≥40 chars

  it('the 1st occurrence is read; the 2nd identical one within the window is suppressed', () => {
    const t = new DuplicateTracker();
    expect(t.isDuplicateSpam(G, U, big, 0)).toBe(false);
    expect(t.isDuplicateSpam(G, U, big, 10_000)).toBe(true);
    expect(t.isDuplicateSpam(G, U, big, 30_000)).toBe(true);
  });

  it('past the window (≥60s) it reads once again', () => {
    const t = new DuplicateTracker();
    expect(t.isDuplicateSpam(G, U, big, 0)).toBe(false);
    expect(t.isDuplicateSpam(G, U, big, DUPLICATE_WINDOW_MS)).toBe(false); // 60s: outside the window
    expect(t.isDuplicateSpam(G, U, big, DUPLICATE_WINDOW_MS + 5_000)).toBe(true); // already inside the new one
  });

  it('short messages (< 40 chars) are never duplicate-spam', () => {
    const t = new DuplicateTracker();
    const short = 'ola malta tudo bem?'; // < 40 chars
    expect(t.isDuplicateSpam(G, U, short, 0)).toBe(false);
    expect(t.isDuplicateSpam(G, U, short, 1_000)).toBe(false);
  });

  it('different text from the same person is not a duplicate', () => {
    const t = new DuplicateTracker();
    const a = 'primeira mensagem bem grande para passar o limite dos quarenta chars';
    const b = 'segunda mensagem completamente diferente e também bem grande aqui';
    expect(t.isDuplicateSpam(G, U, a, 0)).toBe(false);
    expect(t.isDuplicateSpam(G, U, b, 1_000)).toBe(false);
  });

  it('different authors and guilds are independent', () => {
    const t = new DuplicateTracker();
    expect(t.isDuplicateSpam(G, U, big, 0)).toBe(false);
    expect(t.isDuplicateSpam(G, 'user-2', big, 1_000)).toBe(false); // another author
    expect(t.isDuplicateSpam('guild-2', U, big, 1_000)).toBe(false); // another guild
    expect(t.isDuplicateSpam(G, U, big, 2_000)).toBe(true); // the original pair repeats
  });

  it('normalizes before comparing (spaces/uppercase do not escape)', () => {
    const t = new DuplicateTracker();
    expect(t.isDuplicateSpam(G, U, big, 0)).toBe(false);
    expect(t.isDuplicateSpam(G, U, `  ${big.toUpperCase()}  `, 5_000)).toBe(true);
  });
});
