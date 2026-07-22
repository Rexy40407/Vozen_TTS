// src/tts/calibration.ts
/**
 * Per-Piper-model length_scale calibration.
 *
 * Some community models were trained with abnormally fast or slow prosody.
 * This factor corrects the BASE length_scale of the model:
 *   1   = no correction (the vast majority of models);
 *   >1  = slows down (the model spoke too fast);
 *   <1  = speeds up (the model spoke too slow).
 *
 * It composes MULTIPLICATIVELY with the user's speed, so the user keeps
 * relative control: lengthScale = calibration / speed.
 */
export const VOICE_CALIBRATION: Record<string, number> = {
  // pt_PT-tugão is the only European Portuguese voice in the Piper catalog and speaks
  // ~30% too fast at length_scale=1 (measured: ~53 ms/phoneme vs ~75 ms in the
  // reference voices amy/cadu). 1.5 approximates natural — it is MITIGATION, not
  // parity (the pace saturates at ~5.5s vs 6.4s for cadu; for natural PT use cadu).
  'pt_PT-tugao-medium': 1.5,
};

/**
 * GLOBAL length_scale factor of the ORGANIC preset (chosen via A/B by the
 * operator: "strong organic"). Multiplies ON TOP OF the per-voice calibration to
 * slightly slow down ALL voices — less rushed speech, more natural sound.
 * 1.10 = +10% duration. Composes with VOICE_CALIBRATION (which does NOT change): e.g.
 * a voice without calibration (1) resolves to 1.10; the tugão (1.5) resolves to 1.65.
 */
export const ORGANIC_LENGTH_SCALE = 1.1;

/**
 * Effective length_scale for a request: applies the voice's calibration (default 1),
 * multiplies by the global ORGANIC factor (ORGANIC_LENGTH_SCALE) and divides by the
 * user's speed (speed>0; invalid values => 1). Piper: low length_scale = faster;
 * high = slower. This is the ONLY source of --length_scale.
 */
export function lengthScaleFor(model: string, speed: number): number {
  const safeSpeed = speed > 0 ? speed : 1;
  const calibration = VOICE_CALIBRATION[model] ?? 1;
  return (calibration * ORGANIC_LENGTH_SCALE) / safeSpeed;
}

/**
 * Piper synthesis QUALITY parameters (independent of speed).
 * They correspond to flags of the binary. The global defaults are the ORGANIC preset
 * (chosen via A/B by the operator: more natural sound), NOT Piper's defaults:
 *   noiseScale (--noise_scale)      0.75 (Piper: 0.667) — more timbral variation
 *   noiseW     (--noise_w)          0.95 (Piper: 0.8)   — more duration variation
 *   sentenceSilence (--sentence_silence) 0.4 (Piper: 0.2) seconds — breathes more
 *
 * NB: the length_scale does NOT live here — the sole source remains the function
 * lengthScaleFor (voice calibration × ORGANIC_LENGTH_SCALE / speed). See above.
 */
export interface SynthParams {
  noiseScale: number;
  noiseW: number;
  sentenceSilence: number;
}

/**
 * GLOBAL synthesis defaults = "strong" ORGANIC preset (chosen via A/B by the
 * operator). SINGLE source — referenced by the config (fallback of the
 * NOISE_SCALE/NOISE_W/SENTENCE_SILENCE envs) AND by the PiperEngine constructor's
 * fallback, so the two never diverge. They remain env-overridable; these
 * are just the new factory default (more natural than Piper's defaults).
 */
export const PIPER_DEFAULT_SYNTH_PARAMS: SynthParams = {
  noiseScale: 0.75,
  noiseW: 0.95,
  sentenceSilence: 0.4,
};

/**
 * PER-VOICE synthesis param overrides — the tuning SURFACE for future
 * "by-ear" calibration. EMPTY by default on purpose: as long as there are no
 * entries here, NO voice changes relative to the global defaults (zero
 * audible regression). Each entry is PARTIAL — only the present fields
 * override; the rest fall back to the global defaults.
 *
 * The `lengthScale` key is RESERVED/documented but INERT today: composing
 * a length_scale override with the VOICE_CALIBRATION multiplier and the
 * user's speed is yet to be defined, so synthParamsFor does NOT
 * resolve it (--length_scale still comes exclusively from lengthScaleFor).
 *
 * Do NOT populate any override now — choosing values better than the default
 * (and which voices need tuning) is the operator's by-ear decision.
 */
export const VOICE_PARAM_OVERRIDES: Record<
  string,
  Partial<SynthParams & { lengthScale: number }>
> = {};

/**
 * Resolves the effective quality params for a voice: starts from the global
 * defaults and applies the per-voice override on top (if any), field by field.
 * Always returns a fresh COPY (does not mutate the passed defaults). Only resolves
 * noiseScale/noiseW/sentenceSilence — the length_scale is handled separately by
 * lengthScaleFor (see VOICE_PARAM_OVERRIDES about the inert lengthScale key).
 */
export function synthParamsFor(model: string, globalDefaults: SynthParams): SynthParams {
  const override = VOICE_PARAM_OVERRIDES[model];
  return {
    noiseScale: override?.noiseScale ?? globalDefaults.noiseScale,
    noiseW: override?.noiseW ?? globalDefaults.noiseW,
    sentenceSilence: override?.sentenceSilence ?? globalDefaults.sentenceSilence,
  };
}
