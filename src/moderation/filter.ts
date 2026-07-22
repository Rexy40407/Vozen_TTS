function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Cache of RegExps compiled by blocklist CONTENT. Without this, isBlocked/redactBlocked would
// recompile N unicode RegExps on EVERY message read (the blocklist array arrives as a new copy
// on each call, so IDENTITY is no good for memoizing — we use the joined content). Reusing the
// RegExps is safe: isBlocked's patterns are NON-global (`.test` is stateless) and
// `String.replace` with a global RegExp resets `lastIndex` on each call. Simple cap with a full
// clear when the ceiling is reached (few guilds have an active blocklist).
const CACHE_CAP = 256;
const blockedTestCache = new Map<string, RegExp[]>();
const redactCache = new Map<string, RegExp[]>();

function compiled(
  cache: Map<string, RegExp[]>,
  words: string[],
  build: (w: string) => RegExp,
): RegExp[] {
  const key = words.join('\n');
  let regs = cache.get(key);
  if (!regs) {
    regs = words.map(build);
    if (cache.size >= CACHE_CAP) cache.clear();
    cache.set(key, regs);
  }
  return regs;
}

export function isBlocked(text: string, blocklist: string[]): boolean {
  const words = blocklist.map((w) => w.trim().toLowerCase()).filter((w) => w !== '');
  if (words.length === 0) return false;
  const haystack = text.toLowerCase();
  // whole-word match: boundaries at non-alphanumeric edges.
  // \b is not enough for accents/unicode, so we use manual lookarounds.
  const regs = compiled(
    blockedTestCache,
    words,
    (w) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(w)}([^\\p{L}\\p{N}]|$)`, 'u'),
  );
  return regs.some((re) => re.test(haystack));
}

/**
 * REDACTS (removes) the blocklist words from the text, keeping the rest readable — so that
 * Vozen does NOT SPEAK those words but still reads the message (instead of skipping the whole
 * message). WHOLE-WORD match (same unicode boundaries as isBlocked), case-insensitive. Uses
 * ZERO-WIDTH lookbehind/lookahead (does not consume the boundaries) so the GLOBAL replace
 * works even on consecutive blocked words. Collapses the spaces left over from removal. With
 * no blocked word present -> text unchanged (does not normalize spaces needlessly). PURE.
 */
export function redactBlocked(text: string, blocklist: string[]): string {
  const words = blocklist.map((w) => w.trim()).filter((w) => w !== '');
  if (words.length === 0) return text;
  const regs = compiled(
    redactCache,
    words,
    (w) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(w)}(?![\\p{L}\\p{N}])`, 'giu'),
  );
  let out = text;
  let changed = false;
  for (const re of regs) {
    const next = out.replace(re, ' ');
    if (next !== out) {
      out = next;
      changed = true;
    }
  }
  return changed ? out.replace(/\s+/g, ' ').trim() : out;
}
