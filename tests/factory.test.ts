// tests/factory.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createEngine,
  createPerUserEngine,
  selectEngine,
  unofficialGttsEnabled,
} from '../src/tts/factory';
import { AudioCache } from '../src/tts/cache';
import { PiperEngine } from '../src/tts/piper';
import { NeuralEngine } from '../src/tts/neural';
import { MultiSegmentEngine } from '../src/tts/multiSegment';
import { PerUserEngineRouter } from '../src/tts/perUserRouter';
import type { TTSEngine } from '../src/tts/engine';
import type { AppConfig } from '../src/config/index';

function baseConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    token: 'tok',
    clientId: 'cid',
    piperPath: 'piper',
    modelsDir: './models',
    dbPath: './tts.db',
    defaultVoice: 'en_US-amy-medium',
    defaultSpeed: 1,
    messageLeadMs: 200,
    queueCap: 20,
    maxChars: 300,
    ratePerMin: 5,
    publicStatusEnabled: false,
    ttsEngine: 'piper',
    openaiApiKey: undefined,
    googleTtsApiKey: undefined,
    gcloudMaxChars: 500,
    gcloudPlusMonthlyChars: 100_000,
    gcloudPass3MonthlyChars: 400_000,
    gcloudPass8MonthlyChars: 1_000_000,
    gcloudDailyCharBudget: 300_000,
    multilingualSegments: false,
    // Required AppConfig fields that the tests' typecheck now demands.
    noiseScale: 0.667,
    noiseW: 0.8,
    sentenceSilence: 0.2,
    gttsBreakerThreshold: 3,
    gttsBreakerCooldownMs: 60_000,
    gttsChunkConcurrency: 3,
    supportUrl: 'https://discord.gg/4kYw2WUbNN',
    kofiUrl: 'https://ko-fi.com/',
    kofiWebhookPort: 3001,
    premiumApiEnabled: false,
    premiumApiOrigin: 'https://rexy40407.github.io',
    kokoroCmd: undefined,
    kokoroLangs: new Set(['en', 'es', 'fr', 'hi', 'it', 'pt', 'ja']),
    ...overrides,
  };
}

describe('createEngine', () => {
  let dir: string;
  let cache: AudioCache;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'factorycache-'));
    cache = new AudioCache(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('default (piper) -> PiperEngine', () => {
    const engine = createEngine(baseConfig({ ttsEngine: 'piper' }), cache);
    expect(engine).toBeInstanceOf(PiperEngine);
  });

  it('neural + key -> NeuralEngine', () => {
    const engine = createEngine(
      baseConfig({ ttsEngine: 'neural', openaiApiKey: 'sk-test' }),
      cache,
    );
    expect(engine).toBeInstanceOf(NeuralEngine);
  });

  it('neural without a key fails fast with a clear error', () => {
    expect(() =>
      createEngine(baseConfig({ ttsEngine: 'neural', openaiApiKey: undefined }), cache),
    ).toThrow(/TTS_ENGINE=neural requires OPENAI_API_KEY/);
  });
});

describe('unofficial Google Translate TTS opt-in', () => {
  it('is disabled for the safe local default', () => {
    expect(unofficialGttsEnabled('piper')).toBe(false);
    expect(unofficialGttsEnabled('neural')).toBe(false);
  });

  it('is enabled only by the explicit legacy engine modes', () => {
    expect(unofficialGttsEnabled('gtts')).toBe(true);
    expect(unofficialGttsEnabled('router')).toBe(true);
  });
});

// Plan 016 — createPerUserEngine: Kokoro is OPT-IN. Without the sidecar, the per-user router
// is today's (google default + piper); with KOKORO_CMD, the 'kokoro' path becomes a
// RouterEngine(kokoro->gTTS). Construction does no spawn nor network — just the wiring.
describe('createPerUserEngine (google default + piper + kokoro opt-in)', () => {
  let dir: string;
  let cache: AudioCache;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'puecache-'));
    cache = new AudioCache(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('without the Kokoro sidecar -> builds the per-user router (today behavior)', () => {
    const eng = createPerUserEngine(baseConfig({ kokoroCmd: undefined }), cache);
    expect(eng).toBeInstanceOf(PerUserEngineRouter);
  });

  it('with explicit KOKORO_CMD -> builds anyway (Kokoro wrapped in RouterEngine)', () => {
    // resolveKokoroCmd(explicit) returns the cmd WITHOUT touching the disk -> exercises the
    // with-sidecar branch without needing the venv installed. Construction does not start the process.
    const eng = createPerUserEngine(baseConfig({ kokoroCmd: 'py tools/kokoro_server.py' }), cache);
    expect(eng).toBeInstanceOf(PerUserEngineRouter);
  });
});

// P14.4 — selectEngine: EXECUTABLE proof of the OFF-path invariant (the base engine
// is returned INTACT) and the ON wiring (wraps in MultiSegmentEngine).
describe('selectEngine (flag MULTILINGUAL_SEGMENTS)', () => {
  let dir: string;
  let cache: AudioCache;
  // fake base engine (just the synth contract): we only care about the SELECTION.
  const base: TTSEngine = { synth: async () => '/tmp/x.wav' };
  const AVAILABLE = ['en_US-amy-medium', 'ru_RU-denis-medium'];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'selcache-'));
    cache = new AudioCache(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('flag OFF (forced via env) -> returns the base engine AS IS (=== identity)', () => {
    const engine = selectEngine(
      base,
      baseConfig({ multilingualSegments: false }),
      AVAILABLE,
      cache,
    );
    expect(engine).toBe(base);
  });

  it('flag ON (default) -> wraps the base in a MultiSegmentEngine', () => {
    const engine = selectEngine(base, baseConfig({ multilingualSegments: true }), AVAILABLE, cache);
    expect(engine).toBeInstanceOf(MultiSegmentEngine);
    expect(engine).not.toBe(base);
  });
});
