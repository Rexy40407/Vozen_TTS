import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import { reserveGcloudChars } from '../src/store/gcloudUsage';
import { addOperationalMetric, setProviderHealth } from '../src/store/operationalMetrics';

// CHARACTERIZATION of the durability settings production actually runs with.
//
// These are NOT set by our code — `initDb` only asks for WAL. better-sqlite3 derives the
// rest (verified empirically 2026-07-16: a raw connection reports synchronous=FULL until
// the first statement runs, then settles on NORMAL under WAL; busy_timeout comes from the
// driver's own 5s default). Reading the code alone suggests the SQLite default of FULL —
// i.e. an fsync per spoken message via bumpTalk — which is NOT what happens. These tests
// pin the real values so an upgrade or an option change that silently reintroduces that
// fsync fails here instead of quietly halving write throughput on the VPS.
//
// A real file DB (not :memory:) — WAL and the fsync behaviour of `synchronous` only
// mean anything on disk, which is what production runs on.
describe('initDb — durability pragmas (characterization)', () => {
  let dir: string;
  let db: Database.Database | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'vozen-db-'));
  });
  afterEach(() => {
    db?.close();
    db = undefined;
    rmSync(dir, { recursive: true, force: true });
  });

  it('runs in WAL mode', () => {
    db = initDb(join(dir, 'test.db'));
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
  });

  it('uses synchronous=NORMAL, so a spoken message does not force an fsync', () => {
    // bumpTalk writes on EVERY read message. With the default synchronous=FULL each of
    // those auto-commits fsyncs the WAL — a disk round-trip per message on the VPS.
    // NORMAL+WAL is the documented crash-safe pairing: a power loss may cost the last
    // transaction, never corruption. 1 === NORMAL in SQLite's pragma encoding.
    db = initDb(join(dir, 'test.db'));
    expect(db.pragma('synchronous', { simple: true })).toBe(1);
  });

  it('sets a busy_timeout so a concurrent reader never fails instantly', () => {
    db = initDb(join(dir, 'test.db'));
    expect(db.pragma('busy_timeout', { simple: true })).toBeGreaterThan(0);
  });

  it('migrates the old vote-only reminder state into the alternating rotation', () => {
    const path = join(dir, 'legacy-promo.db');
    const legacy = new Database(path);
    legacy.exec(`CREATE TABLE vote_promo_state (
      guild_id TEXT PRIMARY KEY,
      last_post_at INTEGER NOT NULL
    )`);
    legacy.prepare('INSERT INTO vote_promo_state VALUES (?, ?)').run('guild-1', 123);
    legacy.close();

    db = initDb(path);
    const columns = db.pragma('table_info(vote_promo_state)') as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).toContain('last_kind');
    expect(
      db.prepare('SELECT last_kind FROM vote_promo_state WHERE guild_id = ?').get('guild-1'),
    ).toEqual({ last_kind: 'vote' });
  });
});

describe('persistent operational aggregates and paid quota admission', () => {
  let dir: string;
  let primary: Database.Database | undefined;
  let secondary: Database.Database | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'vozen-operational-db-'));
    primary = initDb(join(dir, 'shared.db'));
    secondary = initDb(join(dir, 'shared.db'));
  });
  afterEach(() => {
    secondary?.close();
    primary?.close();
    secondary = undefined;
    primary = undefined;
    rmSync(dir, { recursive: true, force: true });
  });

  it('admits only one monthly reservation across independent SQLite connections', () => {
    expect(reserveGcloudChars(primary!, 'user', 'pool', '2026-07', 5, '2026-07-15', 0, 3)).toBe(
      true,
    );
    expect(reserveGcloudChars(secondary!, 'user', 'pool', '2026-07', 5, '2026-07-15', 0, 3)).toBe(
      false,
    );
    expect(
      primary!
        .prepare('SELECT chars FROM gcloud_usage WHERE scope = ? AND key = ?')
        .get('user', 'pool'),
    ).toEqual({ chars: 3 });
  });

  it('rolls back the monthly reservation when a second connection loses the daily global race', () => {
    expect(reserveGcloudChars(primary!, 'user', 'pool-a', '2026-07', 100, '2026-07-15', 5, 3)).toBe(
      true,
    );
    expect(
      reserveGcloudChars(secondary!, 'user', 'pool-b', '2026-07', 100, '2026-07-15', 5, 3),
    ).toBe(false);
    expect(
      primary!.prepare('SELECT chars FROM gcloud_daily_usage WHERE day = ?').get('2026-07-15'),
    ).toEqual({ chars: 3 });
    expect(
      primary!.prepare('SELECT chars FROM gcloud_usage WHERE key = ?').get('pool-b'),
    ).toBeUndefined();
  });

  it('stores only daily numeric aggregates and provider health timestamps', () => {
    addOperationalMetric(primary!, 'provider_charged_chars', 'gcloud', 12, '2026-07-15');
    addOperationalMetric(secondary!, 'provider_charged_chars', 'gcloud', 8, '2026-07-15');
    setProviderHealth(primary!, 'gcloud', 'degraded', 10);
    setProviderHealth(secondary!, 'gcloud', 'healthy', 20);
    expect(
      primary!.prepare('SELECT day, metric, provider, value FROM operational_daily_metric').get(),
    ).toEqual({
      day: '2026-07-15',
      metric: 'provider_charged_chars',
      provider: 'gcloud',
      value: 20,
    });
    expect(
      primary!
        .prepare(
          'SELECT provider, health, changed_at, last_healthy_at, last_degraded_at FROM provider_health_state',
        )
        .get(),
    ).toEqual({
      provider: 'gcloud',
      health: 'healthy',
      changed_at: 20,
      last_healthy_at: 20,
      last_degraded_at: 10,
    });
  });
});
