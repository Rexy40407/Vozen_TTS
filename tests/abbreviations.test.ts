import { describe, it, expect } from 'vitest';
import { expandAbbreviations, isAllEnglishAbbrev } from '../src/textCleaning/abbreviations';

describe('expandAbbreviations', () => {
  // ── EN: English slang expands (without a language argument) ────────────────
  it('expands common EN abbreviations', () => {
    expect(expandAbbreviations('btw isto acabou')).toBe('by the way isto acabou');
    expect(expandAbbreviations('idk what to do')).toBe("I don't know what to do");
    expect(expandAbbreviations('imo this is fine')).toBe('in my opinion this is fine');
    expect(expandAbbreviations('come asap please')).toBe('come as soon as possible please');
  });

  // ── applied in ANY language ────────────────────────────────────────────────
  // The point of the new contract: EN slang applies regardless of the language
  // of the surrounding text (there is no more language detection in this step).
  it('expands EN slang even in text of another language', () => {
    // 'btw' in the middle of a clearly PT sentence expands anyway.
    expect(expandAbbreviations('btw isto foi ontem à noite no servidor')).toBe(
      'by the way isto foi ontem à noite no servidor',
    );
    // EN-in-French sentence: 'brb' expands.
    expect(expandAbbreviations('je reviens brb')).toBe('je reviens be right back');
  });

  // ── non-English abbreviations NO longer expand (by design) ─────────────────
  it('does not expand non-English abbreviations (pt/es/fr/de/…)', () => {
    // Old PT keys: 'vc'/'pq'/'tb'/'obg' — they no longer exist.
    expect(expandAbbreviations('vc viste isto')).toBe('vc viste isto');
    expect(expandAbbreviations('pq fizeste isso')).toBe('pq fizeste isso');
    expect(expandAbbreviations('eu tbm acho')).toBe('eu tbm acho');
    expect(expandAbbreviations('obg pela ajuda')).toBe('obg pela ajuda');
    // FR/DE/ES/IT/NL examples of the old keys — all unchanged now.
    expect(expandAbbreviations('mdr trop drôle')).toBe('mdr trop drôle');
    expect(expandAbbreviations('vllt komme ich')).toBe('vllt komme ich');
    expect(expandAbbreviations('porfa ven')).toBe('porfa ven');
    expect(expandAbbreviations('cmq va bene')).toBe('cmq va bene');
    expect(expandAbbreviations('idd goed idee')).toBe('idd goed idee');
  });

  // ── cross collision: dropped tokens do NOT expand ──────────────────────────
  // 'ty' = "you" in Polish, 'np' = "na przykład" (e.g.) in Polish -> DROPPED.
  it("does not expand 'ty' or 'np' (collision with Polish words)", () => {
    expect(expandAbbreviations('ty')).toBe('ty');
    expect(expandAbbreviations('np')).toBe('np');
    expect(expandAbbreviations('ty i np')).toBe('ty i np');
    // Even capitalized / in the middle of a sentence, they stay intact.
    expect(expandAbbreviations('Ty jesteś tutaj')).toBe('Ty jesteś tutaj');
    expect(expandAbbreviations('to jest np dobre')).toBe('to jest np dobre');
  });

  // ── case-insensitive ──────────────────────────────────────────────────────
  it('is case-insensitive on match', () => {
    expect(expandAbbreviations('BTW algo')).toBe('By the way algo');
    expect(expandAbbreviations('Btw algo')).toBe('By the way algo');
  });

  // ── capitalization preservation ────────────────────────────────────────────
  it('capitalizes the 1st letter of the expansion when the token starts with uppercase', () => {
    expect(expandAbbreviations('Btw isto')).toBe('By the way isto');
    expect(expandAbbreviations('btw isto')).toBe('by the way isto');
    expect(expandAbbreviations('BTW isto')).toBe('By the way isto');
  });

  it('an expansion that already starts with uppercase stays (idempotent)', () => {
    expect(expandAbbreviations('idk')).toBe("I don't know");
    expect(expandAbbreviations('Idk')).toBe("I don't know");
    expect(expandAbbreviations('IDK')).toBe("I don't know");
  });

  // ── word boundary ─────────────────────────────────────────────────────────
  it('only expands at a word boundary (not inside words)', () => {
    expect(expandAbbreviations('btwx')).toBe('btwx');
    expect(expandAbbreviations('xbtw')).toBe('xbtw');
    // 'ppl' is a token; 'apple' contains it as a substring but does not expand.
    expect(expandAbbreviations('apple')).toBe('apple');
  });

  // ── adjacent punctuation ──────────────────────────────────────────────────
  it('preserves punctuation around the token', () => {
    expect(expandAbbreviations('(btw)')).toBe('(by the way)');
    expect(expandAbbreviations('brb...')).toBe('be right back...');
  });

  // ── multiple in the same text ─────────────────────────────────────────────
  it('expands multiple different abbreviations', () => {
    expect(expandAbbreviations('idk tbh')).toBe("I don't know to be honest");
    expect(expandAbbreviations('omg brb')).toBe('oh my god be right back');
  });

  // ── adjacent (zero-width boundary) ────────────────────────────────────────
  it('expands adjacent abbreviations (both)', () => {
    expect(expandAbbreviations('btw btw')).toBe('by the way by the way');
  });

  // ── empty text -> empty ───────────────────────────────────────────────────
  it('empty text -> empty', () => {
    expect(expandAbbreviations('')).toBe('');
  });

  // ── determinism / purity ──────────────────────────────────────────────────
  it('is deterministic for the same input', () => {
    const out1 = expandAbbreviations('btw idk tbh brb');
    const out2 = expandAbbreviations('btw idk tbh brb');
    expect(out1).toBe(out2);
    expect(out1).toBe("by the way I don't know to be honest be right back");
  });

  // ── does not touch normal words ───────────────────────────────────────────
  it('does not expand normal words that contain a token as a substring', () => {
    expect(expandAbbreviations('snap')).toBe('snap');
    expect(expandAbbreviations('typical')).toBe('typical');
  });

  // ── EN refinement: keys added in P17 ──────────────────────────────────────
  it('EN refinement: new keys expand and do not collide', () => {
    expect(expandAbbreviations('afaik isto e assim')).toBe('as far as I know isto e assim');
    expect(expandAbbreviations('pls help')).toBe('please help');
    expect(expandAbbreviations('thx a lot')).toBe('thanks a lot');
  });
});

// ── OPTIONAL STRETCH: isAllEnglishAbbrev ─────────────────────────────────────
describe('isAllEnglishAbbrev', () => {
  it('true when ALL tokens are known EN slang', () => {
    expect(isAllEnglishAbbrev('brb')).toBe(true);
    expect(isAllEnglishAbbrev('omg lol')).toBe(false); // 'lol' is not a key -> false
    expect(isAllEnglishAbbrev('brb omg')).toBe(true);
    expect(isAllEnglishAbbrev('BRB OMG')).toBe(true); // case-insensitive
  });

  it('false when there is at least one non-slang token', () => {
    expect(isAllEnglishAbbrev('brb amigo')).toBe(false);
    expect(isAllEnglishAbbrev('ola omg')).toBe(false);
  });

  it('false for empty text / only spaces (nothing to force)', () => {
    expect(isAllEnglishAbbrev('')).toBe(false);
    expect(isAllEnglishAbbrev('   ')).toBe(false);
  });

  it('dropped tokens (ty, np) do not count as EN slang', () => {
    expect(isAllEnglishAbbrev('ty')).toBe(false);
    expect(isAllEnglishAbbrev('brb np')).toBe(false);
  });

  // ── punctuation around the token: must be IGNORED ───────────────────────────
  // `expandAbbreviations` ALREADY expands "omg!"/"wyd?"/"brb..." (the boundary treats
  // punctuation as a limit). Without stripping, isAllEnglishAbbrev failed the lookup of
  // the raw token and returned false — defeating forceLang='eng' in the MOST natural
  // way of writing slang (with !/?/...). We mirror the boundary semantics.
  it('ignores punctuation around the token (omg! wyd? brb...)', () => {
    expect(isAllEnglishAbbrev('omg!')).toBe(true);
    expect(isAllEnglishAbbrev('wyd?')).toBe(true);
    expect(isAllEnglishAbbrev('brb...')).toBe(true);
    expect(isAllEnglishAbbrev('OMG! BRB')).toBe(true);
  });

  it('token that reduces to empty (only punctuation) -> false', () => {
    expect(isAllEnglishAbbrev('!!!')).toBe(false);
  });

  it('mix of slang+normal word (even with punctuation) -> false', () => {
    expect(isAllEnglishAbbrev('omg carro')).toBe(false);
  });
});
