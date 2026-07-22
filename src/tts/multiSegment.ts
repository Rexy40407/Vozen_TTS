// src/tts/multiSegment.ts — P14.4b
//
// TTSEngine decorator that, for texts with MORE THAN ONE language, synthesizes
// each segment with its language's voice and concatenates the WAVs. EXPERIMENTAL, only
// used when the MULTILINGUAL_SEGMENTS flag is ON (see src/index.ts). With the
// flag OFF, this module is NOT even instantiated — the base engine is used as is,
// so the default behavior is byte-for-byte today's.

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { rmDirSafe } from './cleanupDir';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { TTSEngine, SynthRequest } from './engine';
import { AudioCache, cacheKey } from './cache';
import { detectSegments } from './segments';
import { concatWavs, silenceWav } from './wavConcat';
import { pickVoice } from '../language/voiceMap';
import { log } from '../logging/logger';

/** Silence between segments (ms). Small, anti-click. */
const SEGMENT_SILENCE_MS = 60;

export class MultiSegmentEngine implements TTSEngine {
  private readonly cache: AudioCache;

  /**
   * @param base           real engine (Piper/Neural) that synthesizes ONE segment.
   * @param availableModels available .onnx models, for per-segment pickVoice.
   * @param cache           root cache; the COMBINED WAV is stored in a SEPARATE
   *                        namespace ('multiseg') to NEVER contaminate the
   *                        single-voice path (flag OFF) that uses the same key.
   */
  constructor(
    private readonly base: TTSEngine,
    private readonly availableModels: string[],
    cache: AudioCache,
  ) {
    this.cache = cache.withNamespace('multiseg');
  }

  async synth(req: SynthRequest): Promise<string> {
    // Single-voice gate: when the request explicitly asks for ONE voice (a
    // deliberately chosen voice — /voice preview, /joke, /laugh, or the per-user
    // detection toggle turned off), we NEVER split by segment. Delegate to base with
    // the req INTACT (honors `model` and `leadSilenceMs`). Checked BEFORE the split.
    if (req.singleVoice) {
      return this.base.synth(req);
    }

    // EXPLICIT segments (text, voice already resolved by prepareSpeech) take
    // precedence over per-script detection: it is the MIXED synthesis (base + EN
    // slang). Checked BEFORE detectSegments to avoid re-splitting by script.
    if (req.segments && req.segments.length > 0) {
      return this.synthExplicitSegments(req);
    }

    const segments = detectSegments(req.text);

    // 0 or 1 segment (the COMMON case: monolingual text) -> nothing to combine.
    // Delegate to the base engine with the req INTACT — respects req.model, which
    // comes already resolved by resolveSynth (the message's language decides; the
    // preferred voice [user > guild > .env] is honored when the language matches). We do
    // NOT re-pick the voice here: for monolingual text req.model is already the right
    // voice for that language. We only split by segment when there really is >1 language.
    if (segments.length <= 1) {
      return this.base.synth(req);
    }

    // Cache key of the COMBINED result (namespace 'multiseg'). Includes
    // req.model (base/fallback voice) because it affects the per-segment choice.
    const key = cacheKey(req);
    const cached = this.cache.get(key);
    if (cached) return cached;

    try {
      const wavs: Buffer[] = [];
      for (const seg of segments) {
        const model = pickVoice(seg.lang, this.availableModels, req.model);
        // Each segment goes through the base engine (base's single-voice cache
        // reused — legitimate synthesis of a substring). Inherits the `engine` AND the
        // `gcloudBudget` of the message: the PerUserEngineRouter uses the user's right
        // engine and the GCloudEngine (chokepoint) needs the budget — without it,
        // a multilingual message from a Premium user would fall into gTTS (fail-safe).
        const path = await this.base.synth({
          text: seg.text,
          model,
          speed: req.speed,
          engine: req.engine,
          gcloudBudget: req.gcloudBudget,
        });
        wavs.push(readFileSync(path));
      }

      const combined = this.withLead(req, concatWavs(wavs, { silenceMs: SEGMENT_SILENCE_MS }));
      return this.persist(key, combined);
    } catch (err) {
      // Error policy: if ANY segment (or the concatenation) fails, we do NOT
      // crash and do NOT drop content — we fall into the single-voice path
      // for ALL the text with the base voice (req.model). The player always gets a WAV.
      log.warn(
        '[multiSegment] per-segment path failed; falling back to a single voice:',
        (err as Error).message,
      );
      return this.base.synth(req);
    }
  }

  /**
   * EXPLICIT segments path: the parts (text, voice) come already resolved in
   * `req.segments` (MIXED synthesis — base in one language + EN slang in an English voice).
   * Does NOT re-detect nor re-split: synthesizes each part with its OWN model and concatenates.
   */
  private async synthExplicitSegments(req: SynthRequest): Promise<string> {
    const segs = req.segments!;

    // A single segment -> delegate to base with that segment's {text,model} (without
    // combining or caching in the 'multiseg' namespace; base's single-voice cache is enough).
    if (segs.length === 1) {
      const seg = segs[0];
      return this.base.synth({
        text: seg.text,
        model: seg.model,
        speed: req.speed,
        engine: req.engine,
        gcloudBudget: req.gcloudBudget,
      });
    }

    // Cache key of the COMBINED result. Includes the segments THEMSELVES (text+voice)
    // to NEVER collide with the per-script path (key = cacheKey(req)) nor with a
    // literal message equal to the joined text. Unit separators (U+241F between
    // text and voice, U+2426 between segments) that do not appear in normal text.
    const SEP_FIELD = '␟';
    const SEP_SEG = '␦';
    const payload = segs.map((s) => `${s.text}${SEP_FIELD}${s.model}`).join(SEP_SEG);
    // leadSilenceMs is part of the key: with/without lead silence cannot collide. The
    // ENGINE too (append-only for 'piper'): two users with different engines and the same
    // mixed text do NOT cross in this combined namespace.
    const engineKey = req.engine === 'piper' ? ' piper' : '';
    const key = createHash('sha1')
      .update(`${payload} ${req.speed} lead${req.leadSilenceMs ?? 0}${engineKey}`, 'utf8')
      .digest('hex');
    const cached = this.cache.get(key);
    if (cached) return cached;

    try {
      const wavs: Buffer[] = [];
      for (const seg of segs) {
        const path = await this.base.synth({
          text: seg.text,
          model: seg.model,
          speed: req.speed,
          engine: req.engine,
          gcloudBudget: req.gcloudBudget,
        });
        wavs.push(readFileSync(path));
      }
      const combined = this.withLead(req, concatWavs(wavs, { silenceMs: SEGMENT_SILENCE_MS }));
      return this.persist(key, combined);
    } catch (err) {
      // Same resilience as the per-script path: if any part (or the
      // concatenation) fails, falls into the single-voice of ALL the text with the base voice.
      log.warn(
        '[multiSegment] explicit-segment path failed; falling back to a single voice:',
        (err as Error).message,
      );
      return this.base.synth({
        text: req.text,
        model: req.model,
        speed: req.speed,
        engine: req.engine,
        gcloudBudget: req.gcloudBudget,
      });
    }
  }

  /**
   * Writes the combined WAV to a temporary file and puts it in the 'multiseg' cache
   * (which copies it to its directory and returns the definitive path). Same pattern
   * as PiperEngine (temp -> cache.put -> cleanup).
   */
  /** Prepend `req.leadSilenceMs` of silence to the combined WAV (no-op if 0/absent). */
  private withLead(req: SynthRequest, wav: Buffer): Buffer {
    if (req.leadSilenceMs && req.leadSilenceMs > 0) {
      return concatWavs([silenceWav(req.leadSilenceMs), wav], { silenceMs: 0 });
    }
    return wav;
  }

  private persist(key: string, wav: Buffer): string {
    const workDir = mkdtempSync(join(tmpdir(), 'multiseg-'));
    const outPath = join(workDir, 'out.wav');
    try {
      writeFileSync(outPath, wav);
      return this.cache.put(key, outPath);
    } finally {
      rmDirSafe(workDir);
    }
  }
}
