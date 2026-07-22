// src/tts/prosody.ts — language-independent punctuation prosody.
//
// WHY: the expressive punctuation heard in some languages (especially Spanish) is Google's
// NATIVE voice and varies by language. Volume alone made `!` louder but still flat in PT/EN.
// We add a small rising tail for questions and a falling tail for emphatic statements to the
// FINAL synthesized WAV, so the behavior is independent of language and TTS engine.
//
// HOW: ffmpeg CORE filters (asetrate+aresample+atempo — the same as the deep/chipmunk
// effects; no rubberband, which may not be compiled into ffmpeg-static).
// We normalize the final WAV to 22050/mono/16-bit when necessary, cut its last syllable in JS,
// pitch ONLY that piece, and concatenate [body + shaped tail].
//
// DECORATOR engine (same pattern as EffectEngine) with its own cache (namespace 'q') and
// FAIL-SAFE: any error returns the CLEAN voice — NEVER throws (a synth that throws makes
// the player SKIP the speech => silence). Runs for a terminal `?`, terminal `!`, or a wholly
// uppercase utterance. Non-canonical engines (e.g. Kokoro at 24 kHz) are normalized first.

import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import type { SynthRequest, TTSEngine } from './engine';
import { AudioCache, cacheKey } from './cache';
import { applyEffect, type ApplyEffectDeps } from './effects';
import { parseWav, buildWav, concatWavs } from './wavConcat';
import { rmDirSafe } from './cleanupDir';
import { log } from '../logging/logger';
import { expressiveEmphasisStrength, type EmphasisStrength } from './emphasis';

// Canonical format (gTTS/Piper). The split assumes it; splitTailWav validates it and bails if it doesn't match.
const SR = 22050;
const CHANNELS = 1;
const BITS = 16;
const BLOCK_ALIGN = (CHANNELS * BITS) / 8; // 2 bytes per sample-frame (mono 16-bit)

// TUNABLE: how much of the END gets the rise (ms) and how HIGH it goes (pitch multiplier).
// 500 ms ~= the last word/syllable; 1.10 = +10% pitch. Higher sounds "chipmunk" in the
// tail; lower goes unnoticed. If it sounds artificial, this is where to tune it.
const QUESTION_TAIL_MS = 500;
const QUESTION_PITCH = 1.1;
const EXCLAMATION_TAIL_MS = 650;
const EXCLAMATION_PITCH_SOFT = 0.97;
const EXCLAMATION_PITCH_STRONG = 0.94;

// asetrate speeds up+raises pitch; aresample returns to 22050; atempo=1/pitch restores the
// DURATION without lowering the pitch. Result: same length, higher pitch (same mechanic as deep/chipmunk).
export const QUESTION_FILTER = `asetrate=${SR}*${QUESTION_PITCH},aresample=${SR},atempo=${(
  1 / QUESTION_PITCH
).toFixed(4)}`;

/** Falling pitch contours. Loudness remains in the player, avoiding double gain and clipping. */
export const EXCLAMATION_FILTERS: Record<Exclude<EmphasisStrength, 'none'>, string> = {
  soft: `asetrate=${SR}*${EXCLAMATION_PITCH_SOFT},aresample=${SR},atempo=${(
    1 / EXCLAMATION_PITCH_SOFT
  ).toFixed(4)}`,
  strong: `asetrate=${SR}*${EXCLAMATION_PITCH_STRONG},aresample=${SR},atempo=${(
    1 / EXCLAMATION_PITCH_STRONG
  ).toFixed(4)}`,
};

/** Does the speech END in a question? (`?` at the end, tolerating quotes/parentheses/spaces after). PURE. */
export function isQuestion(text: string): boolean {
  // Arabic/full-width/Ethiopic marks are terminal. Armenian ՞ sits over the stressed vowel,
  // so the final word may still contain letters after the punctuation code point.
  return /(?:[?؟？፧]|՞[\p{L}\p{M}]*)["'”»)\]\s]*$/u.test(text);
}

/**
 * Splits the WAV into [body, tail] where the tail is the last `tailMs` ms, each already as
 * a canonical WAV. Returns `null` if the input is not 22050/mono/16-bit PCM (e.g. Kokoro at 24k)
 * — the caller then falls back to the clean voice. Cut aligned to the sample-frame. PURE.
 */
export function splitTailWav(wav: Buffer, tailMs: number): { head: Buffer; tail: Buffer } | null {
  let parsed;
  try {
    parsed = parseWav(wav, 0);
  } catch {
    return null; // not a valid RIFF WAV
  }
  if (
    parsed.audioFormat !== 1 ||
    parsed.sampleRate !== SR ||
    parsed.channels !== CHANNELS ||
    parsed.bits !== BITS
  ) {
    return null; // unexpected format -> no intonation (fail-safe upstream)
  }
  const data = parsed.data;
  const tailFrames = Math.round((tailMs / 1000) * SR);
  const tailBytes = Math.min(data.length, tailFrames * BLOCK_ALIGN);
  const splitAt = data.length - tailBytes;
  return {
    head: buildWav(data.subarray(0, splitAt)), // empty when the speech is all "tail" (short)
    tail: buildWav(data.subarray(splitAt)),
  };
}

/**
 * Decorator engine that gives punctuation INTONATION to the final WAV: questions rise;
 * emphatic terminal `!` / all-uppercase utterances fall. It uses `emphasisSource` (the user's
 * original body), so xsaid/media decorations cannot hide or invent punctuation. Any error ->
 * CLEAN voice (never throws).
 */
export class ProsodyEngine implements TTSEngine {
  constructor(
    private readonly inner: TTSEngine,
    private readonly cache: AudioCache,
    private readonly deps: ApplyEffectDeps = {},
  ) {}

  async synth(req: SynthRequest): Promise<string> {
    const base = await this.inner.synth(req);
    const source = req.emphasisSource ?? req.text;
    const emphasis = expressiveEmphasisStrength(source);
    const mode = isQuestion(source) ? 'question' : emphasis;
    if (mode === 'none') return base;

    // v2 invalidates the old question cache now that emphasisSource and non-22050 audio are
    // handled correctly. The mode prevents question/exclamation contours from colliding.
    const key = `${cacheKey(req)}_${mode}_v2`;
    const hit = this.cache.get(key);
    if (hit) return hit;

    let workDir: string | null = null;
    let shapedDir: string | null = null;
    let normalizedDir: string | null = null;
    try {
      const tailMs = mode === 'question' ? QUESTION_TAIL_MS : EXCLAMATION_TAIL_MS;
      let split = splitTailWav(readFileSync(base), tailMs);
      if (!split) {
        const normalizedPath = await applyEffect(base, 'anull', this.deps);
        normalizedDir = dirname(normalizedPath);
        split = splitTailWav(readFileSync(normalizedPath), tailMs);
      }
      if (!split) return base;

      workDir = mkdtempSync(join(tmpdir(), 'vozen-q-'));
      const tailPath = join(workDir, 'tail.wav');
      writeFileSync(tailPath, split.tail);

      const filter = mode === 'question' ? QUESTION_FILTER : EXCLAMATION_FILTERS[mode];
      const shapedPath = await applyEffect(tailPath, filter, this.deps);
      shapedDir = dirname(shapedPath);
      const out = concatWavs([split.head, readFileSync(shapedPath)], { silenceMs: 0 });

      const outPath = join(workDir, 'out.wav');
      writeFileSync(outPath, out);
      return this.cache.put(key, outPath);
    } catch (err) {
      log.warn('[prosody] punctuation intonation failed; using clean voice:', err);
      return base;
    } finally {
      // applyEffect does NOT clean up its dir on success (the caller copies and cleans up);
      // cache.put already copied out.wav from the workDir, so we can clean up both.
      if (shapedDir) rmDirSafe(shapedDir);
      if (normalizedDir) rmDirSafe(normalizedDir);
      if (workDir) rmDirSafe(workDir);
    }
  }
}
