import { describe, it, expect } from 'vitest';
import { JOKE_LANGUAGES, pickJoke, jokeLangByKey } from '../src/content/jokes';

// Unicode ranges by script (same as in laughter.test.ts).
const CYRILLIC = /[Ѐ-ӿ]/;
const ARABIC = /[؀-ۿ]/;
const HAN = /[一-鿿]/;
const DEVANAGARI = /[ऀ-ॿ]/;
const GEORGIAN = /[Ⴀ-ჿ]/;

describe('JOKE_LANGUAGES (list of supported languages)', () => {
  it('covers exactly the 35 distinct languages of the Piper models', () => {
    // DISTINCT prefixes of LANG_TO_PREFIX = 35 (Japanese 'ja_' included; no_/Norwegian
    // is not in: it only exists in LOCALE_NAMES, has no joke corpus). This number is the contract.
    expect(JOKE_LANGUAGES.length).toBe(35);
  });

  it('each language has non-empty key, prefix (xx_) and ENGLISH display name', () => {
    for (const lang of JOKE_LANGUAGES) {
      expect(lang.key.length).toBeGreaterThan(0);
      expect(lang.prefix).toMatch(/^[a-z]{2}_$/);
      expect(lang.display.length).toBeGreaterThan(0);
      // Display names in English (ASCII), so autocomplete filters by substring
      // that an English-speaking user types ("russ", "arab"...).
      expect(lang.display).toMatch(/^[A-Za-z() ]+$/);
    }
  });

  it('the keys are unique', () => {
    const keys = JOKE_LANGUAGES.map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('the prefixes are unique (no duplicate languages)', () => {
    const prefixes = JOKE_LANGUAGES.map((l) => l.prefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });
});

describe('pickJoke', () => {
  it('EVERY supported language returns a non-empty joke', () => {
    for (const lang of JOKE_LANGUAGES) {
      const joke = pickJoke(lang.key, 0);
      expect(joke, `language ${lang.key} without a joke`).toBeTruthy();
      expect(joke.trim().length).toBeGreaterThan(0);
    }
  });

  it('is PURE/DETERMINISTIC given (langKey, seed)', () => {
    for (const lang of JOKE_LANGUAGES) {
      expect(pickJoke(lang.key, 7)).toBe(pickJoke(lang.key, 7));
      expect(pickJoke(lang.key, 42)).toBe(pickJoke(lang.key, 42));
    }
  });

  it('the seed indexes by modulo (seed % n) — deterministic and wrap-around', () => {
    // For a language with >=1 joke, seed and seed+len point to the SAME joke.
    const en = jokeLangByKey('en');
    expect(en).toBeTruthy();
    // A large seed wraps; the equality proves the modulo (not a clamp/overflow).
    const a = pickJoke('en', 3);
    const b = pickJoke('en', 3 + 1_000_000 * jokeCount('en'));
    expect(a).toBe(b);
  });

  it('an unknown langKey falls back to English', () => {
    expect(pickJoke('xx-nao-existe', 0)).toBe(pickJoke('en', 0));
  });

  // Non-Latin scripts: the jokes MUST be in the native script.
  it('Russian (ru) in Cyrillic', () => {
    expect(pickJoke('ru', 0)).toMatch(CYRILLIC);
  });
  it('Ukrainian (uk) in Cyrillic', () => {
    expect(pickJoke('uk', 0)).toMatch(CYRILLIC);
  });
  it('Kazakh (kk) in Cyrillic', () => {
    expect(pickJoke('kk', 0)).toMatch(CYRILLIC);
  });
  it('Serbian (sr) in Cyrillic', () => {
    expect(pickJoke('sr', 0)).toMatch(CYRILLIC);
  });
  it('Arabic (ar) in Arabic script', () => {
    expect(pickJoke('ar', 0)).toMatch(ARABIC);
  });
  it('Persian (fa) in Arabic script', () => {
    expect(pickJoke('fa', 0)).toMatch(ARABIC);
  });
  it('Georgian (ka) in Georgian script', () => {
    expect(pickJoke('ka', 0)).toMatch(GEORGIAN);
  });
  it('Nepali (ne) in Devanagari', () => {
    expect(pickJoke('ne', 0)).toMatch(DEVANAGARI);
  });
  it('Chinese (zh) in Han', () => {
    expect(pickJoke('zh', 0)).toMatch(HAN);
  });
});

// Local helper: number of jokes for a language (via wrap-around of pickJoke would be
// circular; we don't count directly from the exported list — we use the bank length).
function jokeCount(key: string): number {
  // pickJoke with seeds 0..N should cycle; we determine N empirically until it repeats.
  const first = pickJoke(key, 0);
  let n = 1;
  while (n < 50 && pickJoke(key, n) !== first) n++;
  return n === 50 ? 1 : n;
}
