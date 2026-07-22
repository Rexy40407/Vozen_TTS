/**
 * PURE utilities shared by the minigames. Stateless, no I/O — testable in
 * isolation. Randomness is ALWAYS derived from a seed (seededShuffle/
 * seededIndex) so the tests are deterministic, just like pickJoke(key, seed).
 */

/**
 * Normalizes text for TOLERANT answer comparison: lowercase, no accents
 * (NFD + diacritic strip), trim and collapsed whitespace. So "Alemão", "alemao"
 * and "  ALEMAO " compare equal.
 */
export function normalizeAnswer(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** Base language code from a Piper model id: 'de_DE-thorsten-medium' -> 'de'. */
export function baseCodeOf(model: string): string {
  return model.split('-')[0].split('_')[0].toLowerCase();
}

/**
 * Name of the `base` language written in the user's `locale` (via Intl.DisplayNames,
 * Node's ICU data), capitalized. Falls back to the code itself if ICU does not know
 * the language or the locale is invalid. NEVER throws.
 */
export function localizedLanguageName(base: string, locale: string): string {
  try {
    const dn = new Intl.DisplayNames([locale, 'en'], { type: 'language' });
    const name = dn.of(base);
    if (name && name.toLowerCase() !== base.toLowerCase()) {
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  } catch {
    /* invalid locale/base -> fallback below */
  }
  return base;
}

/** 32-bit xorshift generator from a seed (never 0). Internal. */
function xorshift(seed: number): () => number {
  let state = Math.floor(seed) | 0 || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return Math.abs(state | 0);
  };
}

/** Deterministic non-negative integer generator from `seed` (stream). */
export function makeRng(seed: number): () => number {
  return xorshift(seed);
}

/** First integer (with optional sign) in a text; null if none. */
export function firstInteger(s: string): number | null {
  const m = s.match(/-?\d+/);
  return m ? parseInt(m[0], 10) : null;
}

/**
 * Jaccard similarity between two texts at the WORD level (both normalized):
 * |A∩B| / |A∪B|, in [0,1]. Used to accept "almost equal" answers (e.g. the
 * Speed game, where a typo should not invalidate). Empty sets -> 0.
 */
export function jaccard(a: string, b: string): number {
  const A = new Set(normalizeAnswer(a).split(' ').filter(Boolean));
  const B = new Set(normalizeAnswer(b).split(' ').filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Deterministic index in [0, n) from a seed. n<=0 -> 0. */
export function seededIndex(seed: number, n: number): number {
  if (n <= 0) return 0;
  return xorshift(seed)() % n;
}

/**
 * Deterministically shuffles a copy of `arr` from `seed` (Fisher-Yates
 * with xorshift). Same seed -> same order (testable); does not mutate the input.
 */
export function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const out = arr.slice();
  const next = xorshift(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = next() % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
