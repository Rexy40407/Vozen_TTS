import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
import type { SynthRequest, TTSEngine } from './engine';
import { AudioCache, cacheKey } from './cache';
import { rmDirSafe } from './cleanupDir';
import { log } from '../logging/logger';

// Voice effects (premium feature, with 2 free samples): transform the already
// synthesized WAV with an ffmpeg filter, AFTER the whole chain (cache included). Applied
// by an EffectEngine that wraps the engine from the OUTSIDE — with its OWN cache (the
// effected audio never collides with the clean one). ANY ffmpeg failure falls back to the
// clean voice, never to silence (critical: a synth that throws makes the player SKIP the item).

export type VoiceEffect =
  'none' | 'robot' | 'echo' | 'deep' | 'chipmunk' | 'radio' | 'phone' | 'underwater' | 'demon';

// Both engines (native Piper, gTTS via mp3ToWav) produce 22050Hz mono WAV, so the pitch
// filters (asetrate) safely use 22050. Only CORE ffmpeg filters
// (aecho/asetrate/aresample/atempo/highpass/lowpass/tremolo/volume) — no afftfilt/
// acrusher/rubberband, which may not be compiled into ffmpeg-static.
const FILTERS: Record<Exclude<VoiceEffect, 'none'>, string> = {
  robot: 'tremolo=f=30:d=0.7,aecho=0.8:0.88:6:0.5',
  echo: 'aecho=0.8:0.9:500:0.4',
  deep: 'asetrate=22050*0.82,aresample=22050,atempo=1.22',
  chipmunk: 'asetrate=22050*1.5,aresample=22050,atempo=0.667',
  radio: 'highpass=f=400,lowpass=f=3000,volume=1.4',
  phone: 'highpass=f=500,lowpass=f=3400',
  underwater: 'lowpass=f=500,aecho=0.8:0.9:120:0.4',
  demon: 'asetrate=22050*0.75,aresample=22050,atempo=1.1,aecho=0.8:0.9:70:0.4',
};

/** FREE effects (sample). The rest are premium. */
export const FREE_EFFECTS: readonly VoiceEffect[] = ['none', 'robot', 'echo'];

/** All effects (order of the /voice effect choices). */
export const VOICE_EFFECTS: readonly VoiceEffect[] = [
  'none',
  'robot',
  'echo',
  'deep',
  'chipmunk',
  'radio',
  'phone',
  'underwater',
  'demon',
];

export function isVoiceEffect(s: string): s is VoiceEffect {
  return (VOICE_EFFECTS as readonly string[]).includes(s);
}

/** Is this a premium-only effect (i.e. not in the free list)? */
export function isPremiumEffect(effect: VoiceEffect): boolean {
  return !FREE_EFFECTS.includes(effect);
}

/** ffmpeg filter for the effect, or null for 'none'/unknown (=> clean voice). */
export function ffmpegFilterFor(effect: string): string | null {
  if (!isVoiceEffect(effect) || effect === 'none') return null;
  return FILTERS[effect as Exclude<VoiceEffect, 'none'>];
}

const LABELS: Record<VoiceEffect, string> = {
  none: 'None (normal)',
  robot: '🤖 Robot',
  echo: '🔊 Echo',
  deep: '🕳️ Deep',
  chipmunk: '🐿️ Chipmunk',
  radio: '📻 Radio',
  phone: '📞 Phone',
  underwater: '🌊 Underwater',
  demon: '😈 Demon',
};

/** Human-readable label for an effect (for the replies). */
export function effectLabel(effect: VoiceEffect): string {
  return LABELS[effect] ?? effect;
}

/**
 * /voice effect choices: premium ones carry 💎 in the name so it's clear they need
 * Premium (the real gate is validated in the handler). ≤25 choices, ok.
 */
export const EFFECT_CHOICES: { name: string; value: VoiceEffect }[] = VOICE_EFFECTS.map((e) => ({
  name: isPremiumEffect(e) ? `💎 ${LABELS[e]}` : LABELS[e],
  value: e,
}));

/** Max time for the effect ffmpeg step (same ceiling as the rest of the pipeline). */
const FX_TIMEOUT_MS = 15_000;

export interface ApplyEffectDeps {
  ffmpegPath?: string | null;
  spawnImpl?: typeof spawn;
}

/**
 * Applies an ffmpeg filter to a WAV, returning the path of a NEW temporary WAV. Mirror of
 * the gtts runner: timeout+kill, best-effort cleanup, `settled` latch to never leave the
 * Promise pending. Rejects on error (the caller — EffectEngine — catches it and falls back
 * to the clean voice).
 */
export function applyEffect(
  inputWav: string,
  filter: string,
  deps: ApplyEffectDeps = {},
): Promise<string> {
  const ff = (deps.ffmpegPath ?? (ffmpegStatic as unknown as string | null)) as string | null;
  const spawnImpl = deps.spawnImpl ?? spawn;
  if (!ff) return Promise.reject(new Error('fx: ffmpeg-static not found'));

  const workDir = mkdtempSync(join(tmpdir(), 'vozen-fx-'));
  const outPath = join(workDir, 'out.wav');
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    inputWav,
    '-af',
    filter,
    '-ar',
    '22050',
    '-ac',
    '1',
    '-c:a',
    'pcm_s16le',
    '-f',
    'wav',
    outPath,
    '-y',
  ];

  return new Promise<string>((resolve, reject) => {
    const child = spawnImpl(ff, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        child.kill('SIGKILL');
      } catch {
        // already dead
      }
      reject(new Error(`fx: ffmpeg excedeu ${FX_TIMEOUT_MS}ms`));
      rmDirSafe(workDir);
    }, FX_TIMEOUT_MS);
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`fx: falha ao iniciar ffmpeg: ${err.message}`));
      rmDirSafe(workDir);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve(outPath);
        // NB: we do NOT clean workDir here — the caller copies outPath (cache.put) and only
        // then cleans up (cleanup is the EffectEngine's responsibility).
      } else {
        reject(new Error(`fx: ffmpeg saiu com ${code}: ${stderr.trim()}`));
        rmDirSafe(workDir);
      }
    });
  });
}

/**
 * Decorator engine that applies the voice effect (req.effect) AFTER synthesis, with its own
 * cache (namespace 'fx') keyed by cacheKey(req)+effect — the effected audio is shared across
 * identical reqs and the LRU cleans it up (no temp leak). 'none'/no effect -> returns the
 * base WAV as-is. Any ffmpeg error -> CLEAN voice (never throws: otherwise the player would
 * skip the speech and the premium user would hear silence).
 */
export class EffectEngine implements TTSEngine {
  constructor(
    private readonly inner: TTSEngine,
    private readonly cache: AudioCache,
    private readonly deps: ApplyEffectDeps = {},
  ) {}

  async synth(req: SynthRequest): Promise<string> {
    const base = await this.inner.synth(req);
    const effect = req.effect ?? 'none';
    const filter = ffmpegFilterFor(effect);
    if (!filter) return base; // 'none' or unknown -> clean voice

    const key = `${cacheKey(req)}_${effect}`;
    const hit = this.cache.get(key);
    if (hit) return hit;

    let tmp: string | null = null;
    try {
      tmp = await applyEffect(base, filter, this.deps);
      return this.cache.put(key, tmp);
    } catch (err) {
      log.warn('[fx] effect failed; using clean voice:', err);
      return base;
    } finally {
      // Clean up applyEffect's temp DIR (the cache already has its own copy of the WAV).
      if (tmp) rmDirSafe(dirname(tmp));
    }
  }
}
