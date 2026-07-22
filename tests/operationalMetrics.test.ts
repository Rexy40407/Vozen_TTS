import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import {
  addOperationalMetric,
  listDailyOperationalMetrics,
  providerForEngine,
} from '../src/store/operationalMetrics';

describe('identity-free daily operational metrics', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
  });

  afterEach(() => db.close());

  it('aggregates the product signals needed for reliability without identity columns', () => {
    addOperationalMetric(db, 'command_invoked', 'internal', 1, '2026-07-22');
    addOperationalMetric(db, 'command_invoked', 'internal', 2, '2026-07-22');
    addOperationalMetric(db, 'ttfa_ms', 'piper', 125, '2026-07-22');

    expect(listDailyOperationalMetrics(db, '2026-07-22')).toEqual([
      { day: '2026-07-22', metric: 'command_invoked', provider: 'internal', value: 3 },
      { day: '2026-07-22', metric: 'ttfa_ms', provider: 'piper', value: 125 },
    ]);
    const columns = db.pragma('table_info(operational_daily_metric)') as Array<{ name: string }>;
    expect(columns.map((entry) => entry.name)).toEqual(['day', 'metric', 'provider', 'value']);
  });

  it('maps resolved TTS engine names to stable provider labels', () => {
    expect(providerForEngine('piper')).toBe('piper');
    expect(providerForEngine('kokoro')).toBe('kokoro');
    expect(providerForEngine('gcloud')).toBe('gcloud');
    expect(providerForEngine('google')).toBe('gtts');
    expect(providerForEngine(undefined)).toBe('internal');
  });
});
