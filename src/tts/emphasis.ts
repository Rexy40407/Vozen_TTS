// EMPHASIS SIGNAL — "sound stronger when there's ! or UPPERCASE".
//
// WHY HERE AND NOT IN THE ENGINE: neither the free gTTS (translate_tts endpoint, plain
// text only — ignores SSML/prosody) nor Piper expose punctuation-based prosody control.
// The "expressive" intonation heard in Spanish is Google's native voice, not a feature —
// and it varies by language (PT sounds flat). This module classifies the signal once:
// playback applies volume and ProsodyEngine adds a language-independent pitch contour to
// an unambiguous terminal exclamation / all-uppercase utterance.
//
// The signal is computed over the ORIGINAL text (with uppercase and punctuation), before gTTS passes it through
// deCapsForGoogle (which lowercases uppercase just so the engine doesn't spell out acronyms).

// "Shout" detection: a run of 2+ uppercase letters (e.g. "STOP", "HELP"). NOT global
// (/g is stateful in .test() via lastIndex — reusing it would share state and give
// wrong results across calls). \p{M} catches combining diacritics (ÁÁ).
const RE_ALLCAPS_RUN = /\p{Lu}[\p{Lu}\p{M}]+/u;

// Amplitude gains (linear multipliers). The Piper/gTTS WAV doesn't come at maximum,
// so there's headroom; we raise them (from 1.22/1.4) so the "shout" is CLEARER — the
// request was for it to really be noticeable. Above this the risk of clipping/distortion
// grows fast on the strongest syllables, so we stop here. TUNABLE: if it sounds distorted,
// lower it; if it's too little, the next step is to give it pitch (ffmpeg), not more volume.
const GAIN_NONE = 1;
const GAIN_SOFT = 1.3; // one emphasis signal (one `!` or one uppercase word)
const GAIN_STRONG = 1.5; // strong emphasis (!! or more, or uppercase + `!`)

export type EmphasisStrength = 'none' | 'soft' | 'strong';

/**
 * Classifies the user's emphasis once, so playback volume and post-synthesis prosody use the
 * same rules. Keeping this language-independent is intentional: punctuation and Unicode
 * uppercase are available for every voice, including scripts outside ASCII. PURE.
 */
export function emphasisStrength(text: string): EmphasisStrength {
  if (!text) return 'none';
  const bangs = (text.match(/[!！՜]/gu) ?? []).length;
  const shout = RE_ALLCAPS_RUN.test(text);
  if (bangs === 0 && !shout) return 'none';
  if (bangs >= 2 || (shout && bangs >= 1)) return 'strong';
  return 'soft';
}

/** True only when all cased letters form one all-uppercase utterance (`HELP ME`, not `HELP me`). */
function isAllCapsUtterance(text: string): boolean {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length < 2) return false;
  const cased = letters.filter((letter) => letter.toUpperCase() !== letter.toLowerCase());
  return cased.length >= 2 && cased.every((letter) => letter === letter.toUpperCase());
}

/**
 * Strength that should also change the audio pitch contour. A `!` in the middle of a longer
 * sentence only gets the existing volume gain: shaping the final word would emphasize the
 * wrong phrase. A terminal exclamation or an entirely-uppercase utterance is unambiguous.
 */
export function expressiveEmphasisStrength(text: string): EmphasisStrength {
  const strength = emphasisStrength(text);
  if (strength === 'none') return 'none';
  // Armenian ՜ is written over the final word's stressed vowel, so letters may follow it.
  const terminalBang = /(?:[!！]|՜[\p{L}\p{M}]*)["'”»)\]\s]*$/u.test(text);
  return terminalBang || isAllCapsUtterance(text) ? strength : 'none';
}

/**
 * Volume gain for a speech utterance, from its text. 1.0 = normal (no gain).
 * >1.0 = louder. Pure and deterministic (testable in isolation). Engine-agnostic:
 * the player applies it at playback, so it works regardless of the TTS engine.
 */
export function emphasisGain(text: string): number {
  const strength = emphasisStrength(text);
  if (strength === 'strong') return GAIN_STRONG;
  if (strength === 'soft') return GAIN_SOFT;
  return GAIN_NONE;
}
