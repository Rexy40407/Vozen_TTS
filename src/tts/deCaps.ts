// src/tts/deCaps.ts — lowercases ALL-CAPS words before synthesis.
//
// WHY: several TTS engines SPELL OUT all-uppercase words — they read "HELP"
// as "H-E-L-P" (treating them as an acronym) instead of reading them as a WORD. In chat,
// ALL-CAPS is almost always emphasis/shouting (not an acronym), so we lowercase it
// so the engine reads the word. The "shout" itself (louder) is applied SEPARATELY, at
// playback, as a VOLUME gain (see emphasis.ts) — so lowercasing the caps here
// does NOT remove the emphasis, it only prevents the word from being spelled out.
//
// A SINGLE capital (sentence start, "I", "A", or the "V" in "Voltei") is NOT touched —
// only RUNS of 2+. \p{M} catches combining diacritics (ÁÁ). PURE.
//
// Shared: gTTS uses it (deCapsForGoogle) and it is also applied in Kokoro and Neural,
// which lacked this step. Piper is the EXCEPTION — it reads caps as a word
// (see accents.ts, which even RE-capitalizes restored accents without issue), so there
// it is unnecessary and we do not apply it.

const RE_ALLCAPS_RUN = /\p{Lu}[\p{Lu}\p{M}]+/gu;

/** Lowercases runs of 2+ capitals in the text. PURE. */
export function lowerAllCapsRuns(text: string): string {
  return text.replace(RE_ALLCAPS_RUN, (run) => run.toLowerCase());
}
