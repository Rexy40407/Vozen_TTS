import { describe, it, expect, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FREE_EFFECTS,
  VOICE_EFFECTS,
  isVoiceEffect,
  isPremiumEffect,
  ffmpegFilterFor,
  EFFECT_CHOICES,
  applyEffect,
  EffectEngine,
} from '../src/tts/effects';
import { AudioCache } from '../src/tts/cache';
import type { SynthRequest, TTSEngine } from '../src/tts/engine';

describe('effects — metadata', () => {
  it('none/robot/echo are free; the rest premium', () => {
    expect(isPremiumEffect('none')).toBe(false);
    expect(isPremiumEffect('robot')).toBe(false);
    expect(isPremiumEffect('echo')).toBe(false);
    expect(isPremiumEffect('deep')).toBe(true);
    expect(isPremiumEffect('demon')).toBe(true);
    expect(FREE_EFFECTS).toContain('robot');
  });

  it('isVoiceEffect validates', () => {
    expect(isVoiceEffect('robot')).toBe(true);
    expect(isVoiceEffect('banana')).toBe(false);
  });

  it("ffmpegFilterFor: 'none'/unknown -> null; real effect -> filter", () => {
    expect(ffmpegFilterFor('none')).toBeNull();
    expect(ffmpegFilterFor('banana')).toBeNull();
    expect(ffmpegFilterFor('robot')).toContain('tremolo');
    expect(ffmpegFilterFor('deep')).toContain('asetrate');
  });

  it('choices: premium ones carry 💎, one per effect', () => {
    expect(EFFECT_CHOICES).toHaveLength(VOICE_EFFECTS.length);
    for (const c of EFFECT_CHOICES) {
      expect(VOICE_EFFECTS).toContain(c.value);
      if (isPremiumEffect(c.value)) expect(c.name.startsWith('💎')).toBe(true);
    }
  });
});

// Fake of ffmpeg's `spawn`: 'ok' writes out.wav and exits 0; 'fail' exits 1; 'error' emits an error.
function fakeFfmpeg(behavior: 'ok' | 'fail' | 'error') {
  return ((_ff: string, args: readonly string[]) => {
    const child = new EventEmitter() as EventEmitter & {
      stderr: EventEmitter;
      kill: () => void;
    };
    child.stderr = new EventEmitter();
    child.kill = () => {};
    queueMicrotask(() => {
      if (behavior === 'error') {
        child.emit('error', new Error('ENOENT'));
        return;
      }
      if (behavior === 'ok') {
        const outPath = args[args.length - 2]; // [..., outPath, '-y']
        writeFileSync(outPath, Buffer.from('RIFFfake-wav'));
        child.emit('close', 0);
      } else {
        child.stderr.emit('data', Buffer.from('bad filter'));
        child.emit('close', 1);
      }
    });
    return child;
  }) as any;
}

describe('applyEffect — ffmpeg step (injected spawn)', () => {
  let base: string;
  afterEach(() => {
    if (base && existsSync(base)) rmSync(base, { force: true });
  });

  it('success (code 0) -> resolves with an existing WAV path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fx-base-'));
    base = join(dir, 'base.wav');
    writeFileSync(base, Buffer.from('RIFFbase'));
    const out = await applyEffect(base, 'aecho=0.8:0.9:500:0.4', {
      ffmpegPath: '/fake/ffmpeg',
      spawnImpl: fakeFfmpeg('ok'),
    });
    expect(existsSync(out)).toBe(true);
    rmSync(join(out, '..'), { recursive: true, force: true });
  });

  it('failure (code 1) -> rejects', async () => {
    await expect(
      applyEffect('/x/base.wav', 'badfilter', {
        ffmpegPath: '/fake/ffmpeg',
        spawnImpl: fakeFfmpeg('fail'),
      }),
    ).rejects.toThrow(/saiu com 1/);
  });

  it('error starting ffmpeg -> rejects', async () => {
    await expect(
      applyEffect('/x/base.wav', 'aecho', {
        ffmpegPath: '/fake/ffmpeg',
        spawnImpl: fakeFfmpeg('error'),
      }),
    ).rejects.toThrow(/falha ao iniciar/);
  });
});

const REQ: SynthRequest = { text: 'ola', model: 'en_US-amy-medium', speed: 1 };
const innerReturning = (p: string): TTSEngine => ({ synth: async () => p });

describe('EffectEngine — decorator', () => {
  const dirs: string[] = [];
  const cache = () => {
    const d = mkdtempSync(join(tmpdir(), 'fx-cache-'));
    dirs.push(d);
    return new AudioCache(d);
  };
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it("effect 'none'/absent -> returns the base WAV as-is (does not call ffmpeg)", async () => {
    const eng = new EffectEngine(innerReturning('/base.wav'), cache(), {
      spawnImpl: fakeFfmpeg('fail'),
    });
    expect(await eng.synth({ ...REQ })).toBe('/base.wav');
    expect(await eng.synth({ ...REQ, effect: 'none' })).toBe('/base.wav');
  });

  it('CRITICAL: ffmpeg failure -> falls back to the CLEAN VOICE (never throws)', async () => {
    const eng = new EffectEngine(innerReturning('/base.wav'), cache(), {
      ffmpegPath: '/fake/ffmpeg',
      spawnImpl: fakeFfmpeg('fail'),
    });
    // robot is a real effect; the fake ffmpeg "fails" -> should return the base, without throwing.
    await expect(eng.synth({ ...REQ, effect: 'robot' })).resolves.toBe('/base.wav');
  });

  it('success -> returns a path in the fx cache (and cache-hits on the 2nd)', async () => {
    // The base must exist for applyEffect to receive it; the fake ignores it but the EffectEngine
    // passes it. The fake writes out.wav -> cache.put copies it.
    const bdir = mkdtempSync(join(tmpdir(), 'fx-b-'));
    dirs.push(bdir);
    const basePath = join(bdir, 'base.wav');
    writeFileSync(basePath, Buffer.from('RIFFb'));
    const eng = new EffectEngine(innerReturning(basePath), cache(), {
      ffmpegPath: '/fake/ffmpeg',
      spawnImpl: fakeFfmpeg('ok'),
    });
    const out1 = await eng.synth({ ...REQ, effect: 'echo' });
    expect(out1).not.toBe(basePath);
    expect(existsSync(out1)).toBe(true);
    // 2nd identical call -> cache-hit (same path).
    const out2 = await eng.synth({ ...REQ, effect: 'echo' });
    expect(out2).toBe(out1);
  });
});
