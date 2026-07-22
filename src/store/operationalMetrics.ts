// Identity-free operational aggregates. Rows are keyed only by UTC day, metric and provider.
import type Database from 'better-sqlite3';

export type OperationalProvider =
  'internal' | 'piper' | 'kokoro' | 'gtts' | 'gcloud' | 'azure_tts' | 'azure_translation';
export type OperationalMetric =
  | 'command_invoked'
  | 'guild_join'
  | 'synth_success'
  | 'synth_failure'
  | 'synth_fallback'
  | 'synth_latency_ms'
  | 'ttfa_ms'
  | 'queue_drop'
  | 'stt_audio_ms'
  | 'translation_success'
  | 'translation_failure'
  | 'translation_chars'
  | 'provider_charged_chars';

export interface DailyOperationalMetric {
  day: string;
  metric: OperationalMetric;
  provider: OperationalProvider;
  value: number;
}

export function providerForEngine(
  engine: 'google' | 'piper' | 'kokoro' | 'gcloud' | undefined,
): OperationalProvider {
  if (engine === 'google') return 'gtts';
  return engine ?? 'internal';
}

function requireFiniteNonNegative(value: number): void {
  if (!Number.isFinite(value) || value < 0)
    throw new Error('Operational metric value must be finite and non-negative');
}

export function utcDayKey(now = Date.now()): string {
  if (!Number.isFinite(now)) throw new Error('Operational metric timestamp must be finite');
  return new Date(now).toISOString().slice(0, 10);
}

/** Adds a numeric, identity-free operational aggregate. No content or request metadata is accepted. */
export function addOperationalMetric(
  db: Database.Database,
  metric: OperationalMetric,
  provider: OperationalProvider,
  value = 1,
  day = utcDayKey(),
): void {
  requireFiniteNonNegative(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
    throw new Error('Operational metric day must be UTC YYYY-MM-DD');
  db.prepare(
    `INSERT INTO operational_daily_metric (day, metric, provider, value)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(day, metric, provider) DO UPDATE SET value = value + excluded.value`,
  ).run(day, metric, provider, Math.round(value));
}

/** Reads aggregates for operator diagnostics without introducing an identity dimension. */
export function listDailyOperationalMetrics(
  db: Database.Database,
  day = utcDayKey(),
): DailyOperationalMetric[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
    throw new Error('Operational metric day must be UTC YYYY-MM-DD');
  return db
    .prepare(
      `SELECT day, metric, provider, value FROM operational_daily_metric
       WHERE day = ? ORDER BY metric ASC, provider ASC`,
    )
    .all(day) as DailyOperationalMetric[];
}

export type ProviderHealth = 'healthy' | 'degraded';

export interface ProviderHealthSnapshot {
  provider: OperationalProvider;
  health: ProviderHealth;
}

/** Reads only the coarse provider state needed by the optional public status mapper. */
export function listProviderHealth(db: Database.Database): ProviderHealthSnapshot[] {
  return db
    .prepare('SELECT provider, health FROM provider_health_state ORDER BY provider ASC')
    .all() as ProviderHealthSnapshot[];
}

/** Stores only a provider label, its current health and transition timestamps. */
export function setProviderHealth(
  db: Database.Database,
  provider: OperationalProvider,
  health: ProviderHealth,
  changedAt = Date.now(),
): void {
  if (!Number.isFinite(changedAt)) throw new Error('Provider health timestamp must be finite');
  db.prepare(
    `INSERT INTO provider_health_state (provider, health, changed_at, last_healthy_at, last_degraded_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(provider) DO UPDATE SET
       health = excluded.health,
       changed_at = CASE WHEN provider_health_state.health = excluded.health THEN provider_health_state.changed_at ELSE excluded.changed_at END,
       last_healthy_at = CASE WHEN excluded.health = 'healthy' THEN excluded.last_healthy_at ELSE provider_health_state.last_healthy_at END,
       last_degraded_at = CASE WHEN excluded.health = 'degraded' THEN excluded.last_degraded_at ELSE provider_health_state.last_degraded_at END`,
  ).run(
    provider,
    health,
    changedAt,
    health === 'healthy' ? changedAt : null,
    health === 'degraded' ? changedAt : null,
  );
}
