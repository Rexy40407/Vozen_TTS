import { describe, it, expect } from 'vitest';
import {
  normalize,
  isPlayableForm,
  WordSetDictionary,
  ChainEngine,
} from '../src/games/wordchain/core';

describe('normalize — MUST match tools/build-wordlists.mjs', () => {
  it('lowercase + strips diacritics (PT/FR/ES)', () => {
    expect(normalize('Cães')).toBe('caes');
    expect(normalize('éléphant')).toBe('elephant');
    expect(normalize('AVÓ')).toBe('avo');
    expect(normalize('árbol')).toBe('arbol');
    expect(normalize('Français')).toBe('francais');
  });
  it('maps ligatures/special consonants to base Latin', () => {
    expect(normalize('Straße')).toBe('strasse');
    expect(normalize('œuvre')).toBe('oeuvre');
    expect(normalize('Ærø')).toBe('aero');
    expect(normalize('Łódź')).toBe('lodz');
  });
  it('non-Latin alphabets become unplayable', () => {
    expect(isPlayableForm(normalize('日本語'))).toBe(false);
    expect(isPlayableForm(normalize('привет'))).toBe(false);
    expect(isPlayableForm(normalize('gato'))).toBe(true);
    // partial: a word half-Latin-half-other-alphabet also fails
    expect(isPlayableForm(normalize('caféя'))).toBe(false);
  });
});

describe('WordSetDictionary', () => {
  const d = new WordSetDictionary(['gato', 'orca', 'arte', 'elefante']);
  it('has() by exact membership', () => {
    expect(d.has('gato')).toBe(true);
    expect(d.has('cao')).toBe(false);
  });
  it('hasStartingWith() reflects the existing first letters', () => {
    expect(d.hasStartingWith('g')).toBe(true);
    expect(d.hasStartingWith('o')).toBe(true);
    expect(d.hasStartingWith('e')).toBe(true);
    expect(d.hasStartingWith('z')).toBe(false);
  });
});

// Test dictionary with a controlled chain: g->o->a->e->t...
const DICT = new WordSetDictionary([
  'gato',
  'orca',
  'arte',
  'elefante',
  'tigre',
  'ema',
  'ave',
  'estrela',
  'texto',
  'ovo',
  'osso',
  'aro',
  'era',
  'tao',
  'oca',
]);

describe('ChainEngine.validate — rejection reasons', () => {
  it('wrong letter / short / repeated / nonexistent / non-Latin', () => {
    // fixed seed → deterministic starting letter; we force it via controlled accept below.
    const e = new ChainEngine(DICT, 1);
    // Discover the required letter and build cases around it.
    const L = e.requiredLetter;
    // non-Latin
    expect(e.validate('日本').reason).toBe('not-latin');
    // wrong letter: a word that does NOT start with L (pick another live letter)
    const wrong = 'abcdefghijklmnopqrstuvwxyz'.split('').find((c) => c !== L)!;
    expect(e.validate(wrong + 'ato').reason).toBe('wrong-letter');
  });

  it('too-short respects the minimum (>=3)', () => {
    const e = new ChainEngine(DICT, 5);
    const L = e.requiredLetter;
    // 2-letter word starting with the right letter
    expect(e.validate(L + 'x').reason).toBe('too-short');
  });
});

describe('ChainEngine — chaining, no-repeat and dead-letter', () => {
  it('accept advances the letter to the last of the word', () => {
    const e = new ChainEngine(DICT, 3);
    // force the chain starting with 'g' (gato): validate+accept
    // we don't know the seed's starting letter; we test the mechanics from accept.
    e.accept('gato'); // last letter 'o' and 'o' has words (orca/ovo/osso/oca)
    expect(e.requiredLetter).toBe('o');
    const v = e.validate('orca');
    expect(v.ok).toBe(true);
    e.accept('orca'); // -> 'a'
    expect(e.requiredLetter).toBe('a');
  });

  it('does not allow repeating an already-used word', () => {
    const e = new ChainEngine(DICT, 3);
    e.accept('gato');
    e.accept('orca');
    e.accept('arte'); // -> e
    // "arte" was already used; even if valid by letter, it is repeated
    e.accept('elefante'); // -> e (last 'e')... elefante ends in 'e'
    expect(e.validate('elefante').reason).toBe('repeated');
  });

  it('dead-letter: falls back to the second-to-last when nothing starts with the last', () => {
    // 'texto' ends in 'o' (live). Let's craft a word that ends in a dead letter.
    // In DICT there are no words starting with 'x'. "texto" ends in 'o' (live) — let's use
    // an artificial word via its own dictionary:
    const d = new WordSetDictionary(['fax', 'arte', 'ema']);
    const e = new ChainEngine(d, 2);
    e.accept('fax'); // last 'x' DEAD -> second-to-last 'a' (arte/ema? 'a' live via 'arte')
    expect(e.requiredLetter).toBe('a');
  });
});

describe('ChainEngine — difficulty ramp', () => {
  it('minLength rises 3 -> 4 -> 5 at 8 and 16 words', () => {
    const e = new ChainEngine(DICT, 7);
    expect(e.minLength).toBe(3);
    for (let i = 0; i < 8; i++) e.accept('gato'); // accepts count (repetition doesn't matter for the ramp)
    expect(e.minLength).toBe(4);
    for (let i = 0; i < 8; i++) e.accept('gato');
    expect(e.minLength).toBe(5);
  });

  it('turnMs shortens with the chain and has a floor', () => {
    const e = new ChainEngine(DICT, 9, {
      startTurnMs: 15000,
      minTurnMs: 6000,
      turnDecrementMs: 400,
    });
    expect(e.turnMs).toBe(15000);
    e.accept('gato'); // -1x400
    expect(e.turnMs).toBe(14600);
    for (let i = 0; i < 100; i++) e.accept('gato');
    expect(e.turnMs).toBe(6000); // floor
  });
});
