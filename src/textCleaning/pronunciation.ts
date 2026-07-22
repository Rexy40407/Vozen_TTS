export interface PronunciationEntry {
  term: string;
  replacement: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Applies the pronunciation dictionary to the text: each `term` is replaced by its
 * `replacement`, case-insensitive and whole-word. PURE, deterministic function.
 *
 * Boundaries: uses zero-width lookarounds (same unicode style as `isBlocked`, but
 * WITHOUT consuming the boundary characters) so that repeated or adjacent terms
 * are all replaced — unlike `isBlocked`, whose pattern consumes the
 * boundary and is safe only because it just does `.test()`.
 *
 * Applied AFTER `cleanText` and BEFORE synth. The residual whitespace from an
 * empty replacement is not re-collapsed (cleanText already ran).
 */
// Cache of compiled RegExp keyed by the dictionary's CONTENT. Without this, the loop recompiled a
// unicode RegExp per entry on EVERY message read (the dict arrives fresh on each call; it is keyed
// by content — term AND replacement, because both affect the result). Reusing is safe:
// `String.replace` with a global RegExp resets the `lastIndex`. Simple cap with cleanup at the ceiling.
const PRON_CACHE_CAP = 256;
const pronCache = new Map<string, { re: RegExp; replacement: string }[]>();

export function applyPronunciation(text: string, dict: PronunciationEntry[]): string {
  const entries = dict.filter((e) => e.term.trim() !== '');
  if (entries.length === 0) return text;
  // Control separators (U+241F field, U+2426 entry) that do not appear in normal text
  // — they prevent key collisions between different dictionaries.
  const key = entries.map((e) => `${e.term.trim()}␟${e.replacement}`).join('␦');
  let compiled = pronCache.get(key);
  if (!compiled) {
    compiled = entries.map((e) => ({
      re: new RegExp(
        `(?<=^|[^\\p{L}\\p{N}])${escapeRegExp(e.term.trim())}(?=[^\\p{L}\\p{N}]|$)`,
        'giu',
      ),
      replacement: e.replacement,
    }));
    if (pronCache.size >= PRON_CACHE_CAP) pronCache.clear();
    pronCache.set(key, compiled);
  }
  let out = text;
  for (const { re, replacement } of compiled) {
    // A replacer FUNCTION (not a string) to treat the replacement as LITERAL: a raw
    // string would make String.replace interpret $&, $1, $`, $', $$ as directives (the
    // replacement is controlled by the admin via /server-pronunciation — e.g.: "R$"). The
    // sibling restoreAccents/expandAbbreviations already use function-replacers for this.
    out = out.replace(re, () => replacement);
  }
  return out;
}
