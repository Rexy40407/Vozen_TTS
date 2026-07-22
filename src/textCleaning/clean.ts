export interface CleanOptions {
  maxChars: number;
  resolveUser: (id: string) => string;
  resolveChannel: (id: string) => string;
}

import type { MediaKind } from '../language/spokenPhrases';

const RE_CODE_BLOCK = /```[\s\S]*?```/g;
const RE_INLINE_CODE = /`[^`]*`/g;
// Discord spoiler: ||hidden content||. It must NOT be READ (speaking the secret out
// loud defeats the spoiler) — the content is removed from the body and announced as "spoiler".
const RE_SPOILER = /\|\|[\s\S]*?\|\|/g;
const RE_URL = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;

// A URL is a GIF when: (a) the path ends in .gif (direct media), or (b) the host
// belongs to a GIF provider (Tenor/Giphy). GIFs from the Discord picker arrive as a
// tenor.com link in the content, so this detection covers the dominant case.
// Simple substring instead of exact host match — for reading out loud a rare
// false positive ("evil-tenor.com") is harmless, and the simplicity is worth more.
function isGifUrl(url: string): boolean {
  const s = url.toLowerCase();
  return /\.gif\b/.test(s) || s.includes('tenor.com') || s.includes('giphy.com');
}

/**
 * Collects the URLs from `raw` as media items to ANNOUNCE (gif vs link), sharing
 * EXACTLY the same RE_URL + isGifUrl that `cleanText` uses to REMOVE them — so what
 * is removed and what is announced never go out of sync. Localizing the announcement
 * ("a link"/"a gif") happens downstream (prepareSpeech), once the voice is known.
 * PURE. Order preserved; one item per URL.
 */
export function collectUrlMedia(raw: string): MediaKind[] {
  // Counts URLs ONLY in what remains after stripping spoilers and code — the SAME
  // removal order as cleanText (spoiler -> block -> inline -> url). Without this, a URL
  // INSIDE a code block was announced TWICE: as "code" (collectMarkdownMedia) and as
  // "link"/"gif" here. Keeps exact parity with what cleanText actually removes from the
  // spoken body.
  const body = raw
    .replace(RE_SPOILER, ' ')
    .replace(RE_CODE_BLOCK, ' ')
    .replace(RE_INLINE_CODE, ' ');
  const matches = body.match(RE_URL);
  if (!matches) return [];
  return matches.map((u) => (isGifUrl(u) ? 'gif' : 'link'));
}

/**
 * Collects SPOILERS and CODE from `raw` as items to ANNOUNCE ("spoiler"/"code"), in
 * the SAME removal order as cleanText (spoiler first, then blocks and inline code) —
 * so code INSIDE a spoiler is not counted twice. The body loses them (cleanText
 * removes them); here we only announce that they existed. Localization is downstream
 * (prepareSpeech). PURE. One item per occurrence.
 */
export function collectMarkdownMedia(raw: string): MediaKind[] {
  const out: MediaKind[] = [];
  const spoilers = raw.match(RE_SPOILER);
  if (spoilers) for (let n = 0; n < spoilers.length; n++) out.push('spoiler');
  // Counts code ONLY in what remains after stripping the spoilers (avoids double-counting).
  const rest = raw.replace(RE_SPOILER, ' ');
  const blocks = rest.match(RE_CODE_BLOCK)?.length ?? 0;
  const inline = rest.replace(RE_CODE_BLOCK, ' ').match(RE_INLINE_CODE)?.length ?? 0;
  for (let n = 0; n < blocks + inline; n++) out.push('code');
  return out;
}
const RE_ROLE = /<@&\d+>/g;
const RE_USER = /<@!?(\d+)>/g;
const RE_CHANNEL = /<#(\d+)>/g;
const RE_CUSTOM_EMOJI = /<a?:(\w+):\d+>/g;
const RE_UNICODE_EMOJI = /\p{Extended_Pictographic}/gu;
// Zero-width components of modern emoji + regional indicators (flags). Stripping
// \p{Extended_Pictographic} removes the BASE pictogram but NOT these:
//   U+200D  ZWJ            (joins the parts of sequences like 👨‍💻)
//   U+FE0F  VS16           (makes the previous char "emoji", e.g. ❤️, 1️⃣)
//   U+20E3  keycap combining (the square of 1️⃣)
//   U+1F1E6..U+1F1FF        regional indicators -> \p{Regional_Indicator} (flags)
// None is \s, so they survived the whitespace collapse and the trim, leaving an
// invisible *truthy* residue that reached the synth. Written with \u (not the literal
// chars, which would be invisible in the diff). IMPORTANT: only components/RI — the
// base DIGIT/LETTER stays, so "1️⃣" -> "1" (only VS16+keycap are removed).
const RE_EMOJI_EXTRA = /[\u200D\uFE0F\u20E3]|\p{Regional_Indicator}/gu;
// Unicode-aware (\p{Ll}/\p{Lu}, not [a-z]/[A-Z]): without this, spam of ACCENTED or
// non-Latin letters ("ÁÁÁÁÁ…", "ÇÇÇÇ", "ЁЁЁЁ") was NOT collapsed and went whole into synthesis.
const RE_REPEAT_LOWER = /(\p{Ll})\1{2,}/gu;
const RE_REPEAT_UPPER = /(\p{Lu})\1{1,}/gu;
const RE_WS = /\s+/g;

export function cleanText(raw: string, opts: CleanOptions): string {
  let t = raw;

  // 0. remove SPOILERS (||...||) from the body — the hidden content is NOT read; it is
  // announced as "spoiler" downstream (collectMarkdownMedia). Before code so that a code
  // block inside a spoiler goes out with it (counted as spoiler, not as code).
  t = t.replace(RE_SPOILER, ' ');

  // 1. remove code blocks (fenced first, then inline)
  t = t.replace(RE_CODE_BLOCK, ' ');
  t = t.replace(RE_INLINE_CODE, ' ');

  // 2. URLs -> REMOVED from the body (Diogo doesn't want the raw URL spoken). The
  // ANNOUNCEMENT ("a link"/"a gif") is done downstream, already localized in the voice's
  // language: the messageHandler/`/tts` collect the URLs via `collectUrlMedia` (same
  // RE_URL, no dessync) and pass them as media to prepareSpeech, which appends them at the end.
  t = t.replace(RE_URL, ' ');

  // 3. role mentions (unresolved: removed so they aren't read as "<@&id>")
  t = t.replace(RE_ROLE, ' ');

  // 4. user and channel mentions
  t = t.replace(RE_USER, (_m, id: string) => opts.resolveUser(id));
  t = t.replace(RE_CHANNEL, (_m, id: string) => opts.resolveChannel(id));

  // 5. emojis:
  //  - Discord CUSTOM (<:name:id> / <a:name:id>): Diogo wants them READ, so they are
  //    replaced by the NAME (underscores -> spaces, e.g. party_blob -> "party blob").
  //    Spaces around them to separate from adjacent text.
  //  - UNICODE (😀) and the zero-width components/flags: REMOVED (Piper doesn't speak
  //    unicode emojis; Diogo asked for only the custom ones).
  t = t.replace(RE_CUSTOM_EMOJI, (_m, name: string) => ` ${name.replace(/_/g, ' ')} `);
  t = t.replace(RE_UNICODE_EMOJI, ' ');
  t = t.replace(RE_EMOJI_EXTRA, '');

  // 6. collapse repetitions (lowercase cap 3, uppercase cap 2)
  t = t.replace(RE_REPEAT_LOWER, '$1$1$1');
  t = t.replace(RE_REPEAT_UPPER, '$1$1');

  // 7. collapse whitespace + trim
  t = t.replace(RE_WS, ' ').trim();

  // 8. truncate (without splitting surrogate pairs: if the last code unit is an
  // orphan high surrogate, step back one so no garbage is emitted to Piper)
  if (t.length > opts.maxChars) {
    let end = opts.maxChars;
    const last = t.charCodeAt(end - 1);
    if (last >= 0xd800 && last <= 0xdbff) {
      end -= 1;
    }
    t = t.slice(0, end);
  }

  // 9. empty -> ''
  return t;
}
