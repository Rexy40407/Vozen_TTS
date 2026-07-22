// src/tts/segments.ts — P14.4a
import { detectLang } from '../language/detect';

export interface Segment {
  text: string;
  lang: string;
}

/**
 * Minimum length (in non-blank characters) to trust the language detection of a
 * piece. Below this, franc is noise: the piece inherits the language of its
 * neighbor/dominant instead of becoming its own segment with a random language.
 */
const MIN_DETECT_CHARS = 12;

/**
 * Script class of a character. Used to split the text into script RUNS (the most
 * reliable boundary for separating languages): the Latin<->Cyrillic, Latin<->CJK,
 * etc. transition is a strong signal of a language change, unlike short-span
 * detection within the same script (imperfect — see limitations).
 */
type Script = 'latin' | 'cyrillic' | 'cjk' | 'arabic' | 'other';

function scriptOf(ch: string): Script {
  const c = ch.codePointAt(0) ?? 0;
  // Cyrillic (U+0400–U+04FF, +common supplements U+0500–U+052F).
  if (c >= 0x0400 && c <= 0x052f) return 'cyrillic';
  // Arabic (U+0600–U+06FF, +supplement U+0750–U+077F).
  if ((c >= 0x0600 && c <= 0x06ff) || (c >= 0x0750 && c <= 0x077f)) return 'arabic';
  // CJK: unified Han, Hiragana, Katakana, Hangul.
  if (
    (c >= 0x4e00 && c <= 0x9fff) || // unified CJK
    (c >= 0x3040 && c <= 0x30ff) || // Hiragana + Katakana
    (c >= 0xac00 && c <= 0xd7af) // Hangul
  ) {
    return 'cjk';
  }
  // Basic Latin + Latin-1 supplement + Latin Extended A/B (accents).
  if ((c >= 0x0041 && c <= 0x007a) || (c >= 0x00c0 && c <= 0x024f)) {
    return 'latin';
  }
  // Punctuation, digits, spaces, symbols: neutral (do not force a boundary).
  return 'other';
}

/**
 * Raw piece from the 1st pass: a contiguous substring of the input with its
 * dominant script. Preserves ALL text (including punctuation/spaces), so
 * concatenating the `text` fields reproduces the input.
 */
interface Piece {
  text: string;
  script: Script;
}

/**
 * 1st pass: split the text into pieces by script RUN. 'other' characters
 * (spaces, punctuation, digits) stick to the previous piece — they don't open a
 * new piece — so as not to fragment at every space.
 */
function splitByScript(text: string): Piece[] {
  const pieces: Piece[] = [];
  let current = '';
  let currentScript: Script | null = null;

  for (const ch of text) {
    const s = scriptOf(ch);
    if (s === 'other') {
      // Neutral: accumulate into the current piece (or start one if none yet).
      current += ch;
      continue;
    }
    if (currentScript === null) {
      currentScript = s;
      current += ch;
    } else if (s === currentScript) {
      current += ch;
    } else {
      // Script change -> close the current piece and open a new one.
      pieces.push({ text: current, script: currentScript });
      current = ch;
      currentScript = s;
    }
  }
  if (current.length > 0) {
    pieces.push({ text: current, script: currentScript ?? 'other' });
  }
  return pieces;
}

/**
 * Detects language segments in a text, for per-segment multilingual synthesis.
 *
 * HEURISTIC (documented and honest about its limitations):
 *  1. Splits the text into script RUNS (Latin / Cyrillic / CJK / Arabic). This is
 *     the RELIABLE boundary: a script transition is almost always a language
 *     change. Punctuation/spaces/digits are neutral and stick to the previous piece.
 *  2. Detects the language of each piece with `detectLang` (franc) — but ONLY if
 *     the piece is long enough (>= MIN_DETECT_CHARS non-blank characters). Pieces
 *     that are too short get lang '' (undetermined).
 *  3. Undetermined pieces inherit the language of the PREVIOUS neighbor (or, if
 *     they are the first, of the next determined piece / of the dominant language
 *     of the whole text).
 *  4. Merges CONSECUTIVE pieces with the same language into a single segment (the
 *     common monolingual case collapses to 1 segment).
 *
 * LIMITATIONS (do not over-promise):
 *  - Two languages of the SAME script in the same sentence (e.g. English + French,
 *    both Latin) are NOT reliably separated: there is no script boundary and franc
 *    over a short span is a coin toss. In those cases the text tends to stay in a
 *    single segment with the dominant language. Only the multi-script case (e.g.
 *    English + Russian/Cyrillic, or Latin + Arabic/CJK) separates confidently.
 *  - Short-span detection is imperfect by construction (franc needs text). That is
 *    why the merge + inheritance above exist: they reduce false positives.
 *
 * Returns [] for empty/spaces-only text. Returns 1 single segment when everything
 * is the same language (the common case). PURE: no side effects.
 */
export function detectSegments(text: string): Segment[] {
  if (text.trim().length === 0) return [];

  const pieces = splitByScript(text);
  if (pieces.length === 0) return [];

  // Step 2: detect language per piece (only when there is enough length).
  const langs: string[] = pieces.map((p) => {
    const nonSpace = p.text.replace(/\s+/g, '');
    if (nonSpace.length < MIN_DETECT_CHARS) return '';
    return detectLang(p.text);
  });

  // "Dominant" language: that of the longest determined piece (by non-blank
  // characters). Serves as an anchor for pieces that no one can inherit from.
  let dominant = '';
  let dominantLen = -1;
  for (let i = 0; i < pieces.length; i++) {
    if (!langs[i]) continue;
    const len = pieces[i].text.replace(/\s+/g, '').length;
    if (len > dominantLen) {
      dominantLen = len;
      dominant = langs[i];
    }
  }

  // Step 3: inheritance. Undetermined piece -> language of the already-resolved
  // previous one; if there is no previous, of the next determined one; else, the dominant.
  const resolved: string[] = new Array(pieces.length).fill('');
  for (let i = 0; i < pieces.length; i++) {
    if (langs[i]) {
      resolved[i] = langs[i];
      continue;
    }
    if (i > 0 && resolved[i - 1]) {
      resolved[i] = resolved[i - 1];
      continue;
    }
    // Look ahead for the next determined one.
    let next = '';
    for (let j = i + 1; j < pieces.length; j++) {
      if (langs[j]) {
        next = langs[j];
        break;
      }
    }
    resolved[i] = next || dominant;
  }

  // If NOTHING was detected (whole text short/undetermined), fall back to a single
  // segment with the detection of the entire text (best available signal).
  if (resolved.every((l) => l === '')) {
    return [{ text, lang: detectLang(text) }];
  }

  // Step 4: merge consecutive pieces with the same language.
  const segments: Segment[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const lang = resolved[i];
    const last = segments[segments.length - 1];
    if (last && last.lang === lang) {
      last.text += pieces[i].text;
    } else {
      segments.push({ text: pieces[i].text, lang });
    }
  }

  return segments;
}
