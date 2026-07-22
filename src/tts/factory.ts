// src/tts/factory.ts
import type Database from 'better-sqlite3';
import type { AppConfig, TtsEngineKind } from '../config/index';
import type { TTSEngine } from './engine';
import { AudioCache } from './cache';
import { PiperEngine } from './piper';
import { NeuralEngine } from './neural';
import { GCloudEngine, type GcloudUsage, type GcloudLimits } from './gcloud';
import { refundGcloudChars, reserveGcloudChars } from '../store/gcloudUsage';
import { addOperationalMetric, setProviderHealth } from '../store/operationalMetrics';
import { GTTSEngine } from './gtts';
import { MultiSegmentEngine } from './multiSegment';
import { RouterEngine } from './router';
import { PerUserEngineRouter } from './perUserRouter';
import { CircuitBreakerEngine } from './circuitBreaker';
import { KokoroEngine, resolveKokoroCmd } from './kokoroEngine';
import { log } from '../logging/logger';

/** The unsupported Google Translate endpoint is available only by explicit operator opt-in. */
export function unofficialGttsEnabled(kind: TtsEngineKind): boolean {
  return kind === 'gtts' || kind === 'router';
}

/**
 * Builds the per-user engine router. Piper is the safe local default. The unsupported
 * Google Translate endpoint is created only for the explicit `gtts` and `router` modes.
 * Kokoro and official Google Cloud TTS fall back to the configured default.
 */
export function createPerUserEngine(
  config: AppConfig,
  cache: AudioCache,
  db?: Database.Database,
): TTSEngine {
  const piper = makePiper(config, cache);
  const useUnofficialGtts = unofficialGttsEnabled(config.ttsEngine);
  if (useUnofficialGtts) {
    log.warn(
      '[factory] TTS_ENGINE enables an unsupported Google Translate endpoint. Use Piper or an official provider API for production services that require contractual API support.',
    );
  }
  const defaultEngine: TTSEngine = useUnofficialGtts
    ? new CircuitBreakerEngine(
        new GTTSEngine(cache.withNamespace('gtts'), {
          chunkConcurrency: config.gttsChunkConcurrency,
        }),
        piper,
        {
          threshold: config.gttsBreakerThreshold,
          cooldownMs: config.gttsBreakerCooldownMs,
          label: 'gtts',
        },
      )
    : piper;
  // Kokoro is opt-in. Unsupported languages and sidecar failures use the configured
  // default; without a sidecar the route is exactly the default engine.
  const kokoroCmd = resolveKokoroCmd(config.kokoroCmd);
  const kokoro: TTSEngine = kokoroCmd
    ? new RouterEngine([
        {
          engine: new KokoroEngine(cache.withNamespace('kokoro'), kokoroCmd),
          langs: config.kokoroLangs,
          label: 'kokoro',
        },
        { engine: defaultEngine, langs: null, label: 'default' },
      ])
    : defaultEngine;
  // Google HD is a Premium opt-in. With an API key it uses the official Google Cloud
  // endpoint and falls back on failure or exhausted budget. Without a key it is the
  // configured default. Monthly counters are persistent when a database is supplied.
  const gcloudUsage: GcloudUsage | undefined = db
    ? {
        reserve: (s, k, m, monthlyLimit, day, dailyLimit, chars) =>
          reserveGcloudChars(db, s, k, m, monthlyLimit, day, dailyLimit, chars),
        refund: (s, k, m, day, dailyLimit, chars) =>
          refundGcloudChars(db, s, k, m, day, dailyLimit, chars),
        record: (metric, value = 1) => addOperationalMetric(db, metric, 'gcloud', value),
        setHealth: (health) => setProviderHealth(db, 'gcloud', health),
      }
    : undefined;
  const gcloudLimits: GcloudLimits = {
    maxChars: config.gcloudMaxChars,
    plusMonthly: config.gcloudPlusMonthlyChars,
    pass3Monthly: config.gcloudPass3MonthlyChars,
    pass8Monthly: config.gcloudPass8MonthlyChars,
    dailyBudget: config.gcloudDailyCharBudget,
  };
  const gcloud: TTSEngine = config.googleTtsApiKey
    ? new RouterEngine([
        {
          engine: new GCloudEngine(config.googleTtsApiKey, cache.withNamespace('gcloud'), {
            usage: gcloudUsage,
            limits: gcloudLimits,
          }),
          langs: null,
          label: 'gcloud',
        },
        { engine: defaultEngine, langs: null, label: 'default' },
      ])
    : defaultEngine;
  log.info(
    `[factory] per-user engine active: default=${useUnofficialGtts ? 'unofficial-gtts-with-piper-fallback' : 'piper-local'}; kokoro=${kokoroCmd ? 'sidecar-detected' : 'default-fallback'}; gcloud=${config.googleTtsApiKey ? 'official-api-configured' : 'default-fallback'}.`,
  );
  return new PerUserEngineRouter(defaultEngine, piper, kokoro, gcloud);
}

function makePiper(config: AppConfig, cache: AudioCache): TTSEngine {
  return new PiperEngine(config.piperPath, config.modelsDir, cache.withNamespace('piper'), {
    // Global synthesis-quality parameters from the environment-backed configuration.
    noiseScale: config.noiseScale,
    noiseW: config.noiseW,
    sentenceSilence: config.sentenceSilence,
  });
}

export function createEngine(config: AppConfig, cache: AudioCache): TTSEngine {
  if (config.ttsEngine === 'neural') {
    if (!config.openaiApiKey) {
      throw new Error('TTS_ENGINE=neural requires OPENAI_API_KEY');
    }
    return new NeuralEngine(config.openaiApiKey, cache.withNamespace('neural'));
  }
  if (config.ttsEngine === 'gtts') {
    // Legacy explicit opt-in. This is not an official or supported Google API.
    return new GTTSEngine(cache.withNamespace('gtts'), {
      chunkConcurrency: config.gttsChunkConcurrency,
    });
  }
  if (config.ttsEngine === 'router') {
    // Legacy explicit hybrid mode: unofficial gTTS first, local Piper on failure.
    const routes = [
      {
        engine: new GTTSEngine(cache.withNamespace('gtts'), {
          chunkConcurrency: config.gttsChunkConcurrency,
        }),
        langs: null,
        label: 'gtts',
      },
      { engine: makePiper(config, cache), langs: null, label: 'piper' },
    ];
    log.info(`[factory] engine 'router' active: ${routes.map((r) => r.label).join(' -> ')}`);
    return new RouterEngine(routes);
  }
  return makePiper(config, cache);
}

/** Optionally wraps the base engine with multilingual segment synthesis. */
export function selectEngine(
  base: TTSEngine,
  config: AppConfig,
  availableModels: string[],
  cache: AudioCache,
): TTSEngine {
  if (!config.multilingualSegments) return base;
  return new MultiSegmentEngine(base, availableModels, cache);
}
