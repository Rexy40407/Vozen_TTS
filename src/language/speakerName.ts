// src/language/speakerName.ts
//
// Sanitizes the author name so it can be READ aloud by xsaid. Discord names come
// full of emojis, symbols and underscores ("🔥xX_Pro_Xx🔥") that sound like garbage in
// TTS. Here we strip whatever is not speech and leave something pronounceable. PURE.

const RE_CUSTOM_EMOJI = /<a?:\w+:\d+>/g;
const RE_PICTOGRAPHIC = /\p{Extended_Pictographic}/gu;
// Keeps ONLY letters, numbers, spaces and soft separators (- and apostrophes). Everything
// else — decorative symbols (▓★|~), and also the zero-width emoji components
// (ZWJ, VS16, keycap) and regional indicators, which are not \p{L}/\p{N}/space — falls here.
const RE_DECOR = /[^\p{L}\p{N}\s\-'’]/gu;
const RE_WS = /\s+/g;
const MAX_NAME_CHARS = 40;

/**
 * Returns a pronounceable name, or '' if after cleaning nothing readable is left
 * (a 100% emoji name) — the caller decides the fallback (username / generic / no xsaid).
 */
export function sanitizeSpeakerName(raw: string): string {
  let s = raw
    .replace(RE_CUSTOM_EMOJI, ' ')
    .replace(RE_PICTOGRAPHIC, ' ')
    .replace(/_/g, ' ')
    .replace(RE_DECOR, ' ')
    .replace(RE_WS, ' ')
    .trim();
  if (s.length > MAX_NAME_CHARS) s = s.slice(0, MAX_NAME_CHARS).trim();
  // Only counts as a name if it has at least one letter/number.
  return /[\p{L}\p{N}]/u.test(s) ? s : '';
}
