// Generation and normalization of Vozen gift codes. PURE/testable:
// the randomness is injected (production uses node:crypto.randomInt; tests inject something
// deterministic). Format: VOZEN-XXXX-XXXX with an alphabet WITHOUT ambiguous characters
// (no 0/O, 1/I/L) — so nobody confuses them when copying/writing by hand.

export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Generates a "VOZEN-XXXX-XXXX" code. `randInt(max)` returns an integer in [0, max). */
export function generateCodeString(randInt: (max: number) => number): string {
  const block = (): string =>
    Array.from({ length: 4 }, () => CODE_ALPHABET[randInt(CODE_ALPHABET.length)]).join('');
  return `VOZEN-${block()}-${block()}`;
}

/** Normalizes the user input to match the stored format (uppercase, no spaces). */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}
