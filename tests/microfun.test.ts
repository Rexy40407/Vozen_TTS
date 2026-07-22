import { describe, it, expect } from 'vitest';
import {
  funLocaleOf,
  pickEightball,
  pickFortune,
  pickFact,
  pickWyr,
} from '../src/content/microfun';

describe('funLocaleOf — normalizes the UI locale to en|pt', () => {
  it("'pt' and 'pt-BR' -> pt; everything else -> en", () => {
    expect(funLocaleOf('pt')).toBe('pt');
    expect(funLocaleOf('pt-BR')).toBe('pt');
    expect(funLocaleOf('en')).toBe('en');
    expect(funLocaleOf('en-US')).toBe('en');
    expect(funLocaleOf('de')).toBe('en'); // languages without a bank fall back to English
    expect(funLocaleOf('')).toBe('en');
  });
});

const pickers = [
  { name: '8ball', fn: pickEightball },
  { name: 'fortune', fn: pickFortune },
  { name: 'fact', fn: pickFact },
  { name: 'wyr', fn: pickWyr },
] as const;

describe('pick* — pure, deterministic and always return a non-empty phrase', () => {
  for (const { name, fn } of pickers) {
    it(`${name}: same seed -> same phrase (deterministic)`, () => {
      expect(fn('en', 42)).toBe(fn('en', 42));
      expect(fn('pt', 7)).toBe(fn('pt', 7));
    });

    it(`${name}: returns a non-empty string for en and pt, at any seed`, () => {
      for (const seed of [0, 1, 5, 13, 99, 1000]) {
        expect(fn('en', seed).length).toBeGreaterThan(0);
        expect(fn('pt', seed).length).toBeGreaterThan(0);
      }
    });

    it(`${name}: index wraps around (large seed does not blow up)`, () => {
      expect(() => fn('en', Number.MAX_SAFE_INTEGER)).not.toThrow();
      expect(fn('en', 0)).toBe(fn('en', 0));
    });
  }
});
