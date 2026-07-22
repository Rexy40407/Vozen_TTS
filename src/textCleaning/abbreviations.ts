/**
 * Expansion of ENGLISH slang/abbreviations, so the TTS sounds natural (saying
 * "by the way" instead of spelling out "B-T-W").
 *
 * PURE, deterministic function: depends only on the input (text), with no side
 * effects and no state.
 *
 * Matches on WORD BOUNDARY, case-insensitive, using zero-width lookarounds
 * (same style as `applyPronunciation`): the boundary is NOT consumed, so
 * adjacent abbreviations ("btw btw") both expand and it never expands inside
 * a word ("btwx" stays intact).
 *
 * Language contract (P18): the slang is ENGLISH ONLY and applies in ANY
 * language. There is no more language detection/argument — the EN slang is universal
 * (a "brb" is "brb" in any chat). That is why the dictionary was audited against
 * CROSS-COLLISIONS with common words of the other supported languages (see below).
 */

/**
 * ENGLISH dictionary. Only tokens that do NOT trigger on normal words.
 *
 * GOLDEN RULE (quality > coverage): a wrong expansion is WORSE than none.
 * A key only goes in if (1) it is a REAL and common chat slang/abbreviation, and (2) it does NOT
 * collide with a normal word in ANY capitalization (the match is
 * case-insensitive) — neither in English NOR in any of the other supported languages.
 * When in doubt, EXCLUDE. Keys with letters only (no digits, no dots), in lowercase.
 *
 * CROSS-COLLISION AUDIT (P18): since we now apply the EN tokens to
 * messages in ANY language, each token was re-vetted against COMMON
 * words/abbreviations of the supported Latin-script languages (pt, es, fr, de, it, nl, pl, tr).
 * The Cyrillic/Arabic/CJK-script ones are safe (these tokens are all Latin).
 * Tokens dropped due to collision are listed in the "Excluded" block at the end.
 */
const DICT: Record<string, string> = {
  btw: 'by the way',
  idk: "I don't know",
  idc: "I don't care",
  imo: 'in my opinion',
  imho: 'in my humble opinion',
  tbh: 'to be honest',
  brb: 'be right back',
  omg: 'oh my god',
  omw: 'on my way',
  rn: 'right now',
  fyi: 'for your information',
  asap: 'as soon as possible',
  aka: 'also known as',
  tysm: 'thank you so much',
  yw: "you're welcome",
  nvm: 'never mind',
  ttyl: 'talk to you later',
  gtg: 'got to go',
  wyd: 'what are you doing',
  ikr: 'I know right',
  smh: 'shaking my head',
  tldr: "too long didn't read",
  irl: 'in real life',
  afaik: 'as far as I know',
  lmk: 'let me know',
  nbd: 'no big deal',
  tba: 'to be announced',
  tbd: 'to be determined',
  ppl: 'people',
  pls: 'please',
  plz: 'please',
  thx: 'thanks',
  // Excluded due to CROSS-COLLISION with common words of other supported languages:
  //   'ty' -> in POLISH "ty" is the word "you" (2nd person pronoun). DROPPED.
  //   'np' -> in POLISH "np." is "na przykład" (= "for example"/"e.g."). DROPPED.
  // Also excluded (collision/ambiguity in English, inherited from the original curation):
  //   'bc'  -> triggers on "500 BC" ("500 because"),
  //   'dm'  -> collides with the verb/start of names; ambiguous,
  //   'gg'/'wp' -> gaming, risky out of context,
  //   'u'/'r'/'ur' -> 1-letter keys, collide too much.
  // Audit note: 'thx' in Polish is also used as "dzięki" (=thanks) — SAME
  //   meaning, harmless collision -> kept. The remaining tokens (aka/imo/rn/…) are
  //   consonant clusters or are not words in the 8 Latin languages -> kept.
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Regexes PRE-COMPILED once at load (not per message). `expandAbbreviations`
// is on the hot path (once per message read); recompiling ~33 RegExp with \p{...}+lookbehind
// on every call was wasted event-loop CPU. Same pattern as emphasis.ts/clean.ts.
const COMPILED_ABBREV: ReadonlyArray<readonly [RegExp, string]> = Object.keys(DICT).map((token) => [
  new RegExp(`(?<=^|[^\\p{L}\\p{N}])${escapeRegExp(token)}(?=[^\\p{L}\\p{N}]|$)`, 'giu'),
  DICT[token],
]);

/** Capitalizes only the 1st letter (preserving the rest of the expansion). */
function capitalizeFirst(s: string): string {
  if (s.length === 0) return s;
  return s[0].toUpperCase() + s.slice(1);
}

/**
 * Expands the known English slang in `text`, in ANY language.
 * Capitalization rule (the only one): if the matched token starts with an uppercase
 * letter (e.g. "Btw" or "BTW"), the 1st letter of the expansion is capitalized — for
 * natural sentences. Lowercase token -> expansion as-is.
 */
export function expandAbbreviations(text: string): string {
  let out = text;
  for (const [pattern, expansion] of COMPILED_ABBREV) {
    out = out.replace(pattern, (match) => {
      const first = match[0];
      // Token starts with uppercase -> capitalize the 1st letter of the expansion.
      return /\p{Lu}/u.test(first) ? capitalizeFirst(expansion) : expansion;
    });
  }
  return out;
}

/** A contiguous segment of the text, classified as EN slang or not. */
export interface SlangSegment {
  text: string;
  isEnglish: boolean;
}

/**
 * Splits `text` into contiguous segments by class (known EN slang vs rest),
 * for MIXED synthesis: the base-language part is detected on its own, and each EN
 * slang is spoken in an English voice as a SEPARATE segment (instead of "btw"->"by the way"
 * polluting the detection and reading the whole message in one voice [often wrong]).
 *
 * - Splits the text by whitespace into words (discards empties).
 * - For each word, `core` = nucleus without surrounding punctuation (SAME idiom as
 *   `isAllEnglishAbbrev`); `isEnglish = core is in DICT` (hasOwnProperty).
 * - Merges CONSECUTIVE words with the same `isEnglish` into one segment (join by 1 space).
 * - Empty/whitespace-only text -> [].
 * PURE and deterministic.
 */
export function splitEnglishSlang(text: string): SlangSegment[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const segments: SlangSegment[] = [];
  for (const word of words) {
    const core = word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    const isEnglish = Object.prototype.hasOwnProperty.call(DICT, core);
    const last = segments[segments.length - 1];
    if (last && last.isEnglish === isEnglish) {
      last.text += ` ${word}`;
    } else {
      segments.push({ text: word, isEnglish });
    }
  }
  return segments;
}

/**
 * True if `text` is composed ENTIRELY of known EN slang: each token
 * separated by whitespace must be a dictionary key (case-insensitive).
 * Empty/whitespace-only text -> false (there is nothing to force).
 *
 * Used (P18 stretch) to force an English voice on messages that are ONLY slang
 * ("brb", "omg lol"): without this, a voice pinned to another language would read the
 * slang with the wrong accent. PURE function.
 */
export function isAllEnglishAbbrev(text: string): boolean {
  const tokens = text
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return false;
  // Before the lookup, strip the surrounding punctuation (non-\p{L}\p{N} at start/end),
  // mirroring the BOUNDARY semantics of expandAbbreviations: it expands "omg!"/
  // "wyd?"/"brb..." (the punctuation is a boundary), so the all-check has to match the
  // SAME nucleus. A token that reduces to empty (punctuation only, e.g. "!!!") is not in
  // DICT (hasOwnProperty(DICT, '') is false) -> every() returns false. This keeps
  // the "all tokens are keys" contract and ''/whitespace still yields false.
  return tokens.every((tok) => {
    const core = tok.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    return Object.prototype.hasOwnProperty.call(DICT, core);
  });
}
