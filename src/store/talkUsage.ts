import type Database from 'better-sqlite3';
import type { UserEngine } from './userVoice';

// Aggregate-only usage for the owner dashboard. No message content is stored: one counter per
// (guild, user, voice locale, resolved engine). It complements talk_stats, whose unit is also one
// message accepted by the anti-inflation count gate.

const VALID_ENGINES = new Set<UserEngine>(['google', 'piper', 'kokoro', 'gcloud']);
const DEFAULT_MODEL = 'en_US-amy-medium';

function normalizeEngine(engine: string | null | undefined): UserEngine {
  return VALID_ENGINES.has(engine as UserEngine) ? (engine as UserEngine) : 'google';
}

/** Locale embedded in a voice id (`pt_PT-tugao-medium` -> `pt_PT`). */
export function voiceLocale(model: string): string {
  const locale = (model || '').split('-', 1)[0]?.trim();
  return locale || 'unknown';
}

/** Records the resolved base language + engine for one message counted in talk_stats. */
export function bumpTalkUsage(
  db: Database.Database,
  guildId: string,
  userId: string,
  model: string,
  engine: UserEngine,
): void {
  db.prepare(
    `INSERT INTO talk_usage (guild_id, user_id, language, engine, spoken_count)
     VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(guild_id, user_id, language, engine)
     DO UPDATE SET spoken_count = spoken_count + 1`,
  ).run(guildId, userId, voiceLocale(model), normalizeEngine(engine));
}

export interface DominantTalkUsage {
  language: string | null;
  engine: UserEngine | null;
  /** Real queued-message samples, never inferred from historical talk_stats. */
  samples: number;
  /** `configured` is an honest current-state fallback until real samples exist. */
  source: 'measured' | 'configured' | 'none';
}

export interface DominantTalkUsageOptions {
  /** Runtime global fallback; defaults to the same value as AppConfig. */
  defaultModel?: string;
  /** Runtime catalogue, used to mirror prepareSpeech's unavailable-model fallback. */
  availableModels?: readonly string[];
  /** Resolves current paid-engine gating (for example expired Google HD -> default). */
  resolveConfiguredEngine?: (
    guildId: string,
    userId: string,
    storedEngine: UserEngine,
  ) => UserEngine;
}

type UsageRow = {
  guild_id: string;
  user_id: string;
  language: string;
  engine: string;
  spoken_count: number;
};

type ConfiguredRow = {
  guild_id: string;
  user_id: string;
  spoken_count: number;
  user_model: string | null;
  guild_model: string | null;
  engine: string | null;
};

function addCount<T extends string>(map: Map<T, number>, key: T, count: number): void {
  map.set(key, (map.get(key) ?? 0) + count);
}

function winner<T extends string>(counts: Map<T, number>): T | null {
  let best: T | null = null;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount || (count === bestCount && (best === null || key < best))) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Dominant language and engine for each requested user, aggregated across every guild.
 *
 * `talk_usage` is measured from the migration onwards. Historical talk_stats must NEVER be
 * attributed to a person's current setting: doing that turns present state into invented history
 * and lets hundreds of legacy messages drown out new real measurements. Until a user has a real
 * sample, this returns their effective CURRENT configuration and marks it as `configured`.
 */
export function getDominantTalkUsage(
  db: Database.Database,
  userIds: string[],
  options: DominantTalkUsageOptions = {},
): Map<string, DominantTalkUsage> {
  const ids = [...new Set(userIds)].filter(Boolean);
  const result = new Map<string, DominantTalkUsage>();
  if (ids.length === 0) return result;

  const placeholders = ids.map(() => '?').join(',');
  const usage = db
    .prepare(
      `SELECT guild_id, user_id, language, engine, spoken_count
       FROM talk_usage WHERE user_id IN (${placeholders})`,
    )
    .all(...ids) as UsageRow[];

  const configured = db
    .prepare(
      `SELECT ts.guild_id, ts.user_id, ts.spoken_count,
              uv.voice_model AS user_model,
              gc.default_voice AS guild_model,
              uv.engine AS engine
       FROM talk_stats ts
       LEFT JOIN user_voice uv ON uv.guild_id = ts.guild_id AND uv.user_id = ts.user_id
       LEFT JOIN guild_config gc ON gc.guild_id = ts.guild_id
       WHERE ts.user_id IN (${placeholders})`,
    )
    .all(...ids) as ConfiguredRow[];

  const measuredLanguages = new Map<string, Map<string, number>>();
  const measuredEngines = new Map<string, Map<UserEngine, number>>();
  const samples = new Map<string, number>();
  const measuredBuckets = (userId: string) => {
    let lang = measuredLanguages.get(userId);
    if (!lang) measuredLanguages.set(userId, (lang = new Map()));
    let engine = measuredEngines.get(userId);
    if (!engine) measuredEngines.set(userId, (engine = new Map()));
    return { lang, engine };
  };

  for (const row of usage) {
    const count = Math.max(0, Number(row.spoken_count) || 0);
    if (count === 0) continue;
    const b = measuredBuckets(row.user_id);
    addCount(b.lang, row.language, count);
    addCount(b.engine, normalizeEngine(row.engine), count);
    samples.set(row.user_id, (samples.get(row.user_id) ?? 0) + count);
  }

  const currentLanguages = new Map<string, Map<string, number>>();
  const currentEngines = new Map<string, Map<UserEngine, number>>();
  const defaultModel = options.defaultModel?.trim() || DEFAULT_MODEL;
  for (const row of configured) {
    // Exact data wins completely. Current configuration is a fallback, never mixed into measured
    // history. Weighting only chooses a representative CURRENT config for multi-guild users.
    if ((samples.get(row.user_id) ?? 0) > 0) continue;
    const count = Math.max(0, Number(row.spoken_count) || 0);
    if (count === 0) continue;
    const configuredModels = [row.user_model, row.guild_model, defaultModel]
      .map((model) => model?.trim() ?? '')
      .filter(Boolean);
    const model = options.availableModels
      ? (configuredModels.find((candidate) => options.availableModels!.includes(candidate)) ??
        options.availableModels[0] ??
        configuredModels[0] ??
        DEFAULT_MODEL)
      : (configuredModels[0] ?? DEFAULT_MODEL);
    const storedEngine = normalizeEngine(row.engine);
    const engine = options.resolveConfiguredEngine
      ? options.resolveConfiguredEngine(row.guild_id, row.user_id, storedEngine)
      : storedEngine;

    let langCounts = currentLanguages.get(row.user_id);
    if (!langCounts) currentLanguages.set(row.user_id, (langCounts = new Map()));
    let engineCounts = currentEngines.get(row.user_id);
    if (!engineCounts) currentEngines.set(row.user_id, (engineCounts = new Map()));
    addCount(langCounts, voiceLocale(model), count);
    addCount(engineCounts, engine, count);
  }

  for (const userId of ids) {
    const sampleCount = samples.get(userId) ?? 0;
    if (sampleCount > 0) {
      result.set(userId, {
        language: winner(measuredLanguages.get(userId) ?? new Map()),
        engine: winner(measuredEngines.get(userId) ?? new Map()),
        samples: sampleCount,
        source: 'measured',
      });
      continue;
    }
    const language = winner(currentLanguages.get(userId) ?? new Map());
    const engine = winner(currentEngines.get(userId) ?? new Map());
    result.set(userId, {
      language,
      engine,
      samples: 0,
      source: language && engine ? 'configured' : 'none',
    });
  }
  return result;
}
