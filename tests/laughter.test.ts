import { describe, it, expect } from 'vitest';
import { laughterFor } from '../src/content/laughter';

// Unicode ranges per script — used to PROVE the laughter comes out in the CORRECT script
// (not transliterated). A "хахаха" transliterated to "hahaha" would slip by unnoticed
// in a string equality; the range assertion catches exactly that.
const CYRILLIC = /[Ѐ-ӿ]/;
const ARABIC = /[؀-ۿ]/;
const HAN = /[一-鿿]/;
const DEVANAGARI = /[ऀ-ॿ]/;
const GEORGIAN = /[Ⴀ-ჿ]/;

// All supported prefixes (to prove the minimum number of syllables in ALL languages).
const ALL_PREFIXES = [
  'en_',
  'pt_',
  'fr_',
  'de_',
  'nl_',
  'pl_',
  'tr_',
  'cs_',
  'sv_',
  'fi_',
  'da_',
  'ro_',
  'hu_',
  'cy_',
  'is_',
  'lb_',
  'lv_',
  'sk_',
  'sl_',
  'sw_',
  'vi_',
  'es_',
  'ca_',
  'it_',
  'el_',
  'ru_',
  'uk_',
  'kk_',
  'sr_',
  'ar_',
  'fa_',
  'ka_',
  'ne_',
  'zh_',
];

describe('laughterFor', () => {
  it('returns a long laugh (>=5 spaced syllables) for English', () => {
    expect(laughterFor('en_')).toBe('ha ha ha ha ha ha');
  });

  it('Portuguese uses "he" (the \'h\' is silent in PT, "ha" does not voice) with a long laugh', () => {
    expect(laughterFor('pt_')).toBe('he he he he he he');
  });

  it('Italian uses "he" (also has a silent \'h\')', () => {
    expect(laughterFor('it_')).toBe('he he he he he');
  });

  it('fallback (long laugh) for an unknown prefix', () => {
    expect(laughterFor('xx_')).toBe('ha ha ha ha ha ha');
  });

  it('fallback (long laugh) for an empty prefix (model without "_")', () => {
    expect(laughterFor('')).toBe('ha ha ha ha ha ha');
  });

  // Diogo's requirement: the laugh must have at least ~5 "ha" (>= ~1.5s in TTS).
  it('ALL languages laugh with at least 5 syllables', () => {
    for (const p of ALL_PREFIXES) {
      const units = laughterFor(p).split(' ').filter(Boolean);
      expect(units.length, `riso de ${p}`).toBeGreaterThanOrEqual(5);
    }
  });

  it('is pure/deterministic (same input -> same output)', () => {
    expect(laughterFor('ru_')).toBe(laughterFor('ru_'));
    expect(laughterFor('ar_')).toBe(laughterFor('ar_'));
  });

  // Non-Latin: the laugh MUST be in the native script, never transliterated.
  it('Russian (ru_) comes out in Cyrillic', () => {
    expect(laughterFor('ru_')).toMatch(CYRILLIC);
  });

  it('Ukrainian (uk_) comes out in Cyrillic', () => {
    expect(laughterFor('uk_')).toMatch(CYRILLIC);
  });

  it('Kazakh (kk_) comes out in Cyrillic', () => {
    expect(laughterFor('kk_')).toMatch(CYRILLIC);
  });

  it('Serbian (sr_) comes out in Cyrillic', () => {
    expect(laughterFor('sr_')).toMatch(CYRILLIC);
  });

  it('Arabic (ar_) comes out in Arabic script', () => {
    expect(laughterFor('ar_')).toMatch(ARABIC);
  });

  it('Persian (fa_) comes out in Arabic script', () => {
    expect(laughterFor('fa_')).toMatch(ARABIC);
  });

  it('Georgian (ka_) comes out in Georgian script', () => {
    expect(laughterFor('ka_')).toMatch(GEORGIAN);
  });

  it('Nepali (ne_) comes out in Devanagari', () => {
    expect(laughterFor('ne_')).toMatch(DEVANAGARI);
  });

  it('Chinese (zh_) comes out in Han', () => {
    expect(laughterFor('zh_')).toMatch(HAN);
  });
});
