// src/games/wordchain/core.ts
//
// PURE core of the "word-chain" minigame. No I/O, no discord.js, no global state —
// just the chain rules, so it can be tested in isolation and deterministically.
// The orchestration (lobby, turns, lives, voice) lives in src/games/wordChain.ts.

/** Supported Latin languages (they have a wordlist in assets/wordlists/). */
export type WordChainLang = 'pt' | 'en' | 'es' | 'fr';
export const WORDCHAIN_LANGS: readonly WordChainLang[] = ['pt', 'en', 'es', 'fr'];

// NORMALIZATION — MUST be byte-for-byte identical to the one in tools/build-wordlists.mjs,
// otherwise user input normalizes differently from the list and valid words are rejected.
// The test pins the canonical outputs (Cães->caes, éléphant->elephant, Straße->strasse).
const RE_PLAYABLE = /^[a-z]+$/;
export function normalize(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // combining diacritics
    .toLowerCase() // BEFORE the ligatures, to catch uppercase (Æ, Ø, Ł…)
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/ø/g, 'o')
    .replace(/đ/g, 'd')
    .replace(/ł/g, 'l');
}

/** true if the normalized form is "playable" (only a-z, no spaces/digits/punctuation). */
export function isPlayableForm(normalized: string): boolean {
  return RE_PLAYABLE.test(normalized);
}

/** Dictionary of a language: membership + which starting letters have words. */
export interface Dictionary {
  has(normalizedWord: string): boolean;
  /** Is there ANY word starting with this letter (a-z)? For the dead-letter rule. */
  hasStartingWith(letter: string): boolean;
}

/** Dictionary from a list of ALREADY normalized words (what the loader provides). */
export class WordSetDictionary implements Dictionary {
  private readonly words: Set<string>;
  private readonly firstLetters: Set<string>;
  constructor(normalizedWords: Iterable<string>) {
    this.words = new Set(normalizedWords);
    this.firstLetters = new Set();
    for (const w of this.words) if (w) this.firstLetters.add(w[0]);
  }
  has(w: string): boolean {
    return this.words.has(w);
  }
  hasStartingWith(letter: string): boolean {
    return this.firstLetters.has(letter);
  }
}

export type ValidationReason =
  | 'ok'
  | 'not-latin' // has letters outside a-z after normalizing (e.g. a word in another alphabet)
  | 'too-short'
  | 'wrong-letter'
  | 'repeated'
  | 'not-a-word';

export interface ValidationResult {
  ok: boolean;
  reason: ValidationReason;
  /** Normalized form evaluated (for logs / messages). */
  normalized: string;
}

export interface ChainConfig {
  /** Duration of the 1st turn (ms). Default 15000. */
  startTurnMs?: number;
  /** Floor of the turn duration (ms). Default 6000. */
  minTurnMs?: number;
  /** How much the turn shortens per accepted word (ms). Default 400. */
  turnDecrementMs?: number;
  /** Initial minimum word length. Default 3. */
  baseMinLength?: number;
}

const DEFAULTS: Required<ChainConfig> = {
  startTurnMs: 15000,
  minTurnMs: 6000,
  turnDecrementMs: 400,
  baseMinLength: 3,
};

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

/** Deterministic RNG (mulberry32) — reproducible start-letter from the game seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Chain engine: keeps the required letter, the words already used and the difficulty.
 * Knows NOTHING about players/turns/lives — that's the game's job. Mutable by design
 * (one instance = one match), but each method is deterministic given the state.
 */
export class ChainEngine {
  private readonly cfg: Required<ChainConfig>;
  private readonly used = new Set<string>();
  private letter: string;
  private accepted = 0;

  constructor(
    private readonly dict: Dictionary,
    seed: number,
    config: ChainConfig = {},
  ) {
    this.cfg = { ...DEFAULTS, ...config };
    // Starting letter: random (seeded) among those that HAVE words in the dictionary.
    const rng = mulberry32(seed);
    const candidates = [...ALPHABET].filter((l) => dict.hasStartingWith(l));
    const pool = candidates.length ? candidates : [...ALPHABET];
    this.letter = pool[Math.floor(rng() * pool.length)];
  }

  /** Letter the next word must start with. */
  get requiredLetter(): string {
    return this.letter;
  }

  /** Words accepted so far (chain length). */
  get chainLength(): number {
    return this.accepted;
  }

  /** Current minimum length: 3 → 4 (after 8 words) → 5 (after 16). */
  get minLength(): number {
    const base = this.cfg.baseMinLength;
    if (this.accepted >= 16) return base + 2;
    if (this.accepted >= 8) return base + 1;
    return base;
  }

  /** Current turn duration (ms): shortens with the chain, with a floor. */
  get turnMs(): number {
    const raw = this.cfg.startTurnMs - this.accepted * this.cfg.turnDecrementMs;
    return Math.max(this.cfg.minTurnMs, raw);
  }

  /** Validates a raw word (as the user typed it) against the current state. */
  validate(rawWord: string): ValidationResult {
    const normalized = normalize(rawWord.trim());
    if (!isPlayableForm(normalized) || normalized.length === 0) {
      return { ok: false, reason: 'not-latin', normalized };
    }
    if (normalized[0] !== this.letter) {
      return { ok: false, reason: 'wrong-letter', normalized };
    }
    if (normalized.length < this.minLength) {
      return { ok: false, reason: 'too-short', normalized };
    }
    if (this.used.has(normalized)) {
      return { ok: false, reason: 'repeated', normalized };
    }
    if (!this.dict.has(normalized)) {
      return { ok: false, reason: 'not-a-word', normalized };
    }
    return { ok: true, reason: 'ok', normalized };
  }

  /**
   * Accepts an ALREADY validated word: records it, advances the difficulty and picks the
   * next required letter. Dead-letter rule: uses the last letter; if no dictionary word
   * starts with it, falls back to the second-to-last; if that is also dead, picks any live
   * letter (deterministic). Assumes validate()===ok — does not re-validate.
   */
  accept(normalizedWord: string): void {
    this.used.add(normalizedWord);
    this.accepted += 1;
    const last = normalizedWord[normalizedWord.length - 1];
    const penult = normalizedWord.length >= 2 ? normalizedWord[normalizedWord.length - 2] : last;
    if (this.dict.hasStartingWith(last)) {
      this.letter = last;
    } else if (this.dict.hasStartingWith(penult)) {
      this.letter = penult;
    } else {
      const alive = [...ALPHABET].find((l) => this.dict.hasStartingWith(l));
      this.letter = alive ?? last;
    }
  }

  /** Has a word already been used in this match? (for messages/tests) */
  isUsed(normalizedWord: string): boolean {
    return this.used.has(normalizedWord);
  }
}
