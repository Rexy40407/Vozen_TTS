import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import {
  monthKeyUTC,
  getGcloudMonthlyChars,
  addGcloudMonthlyChars,
} from '../src/store/gcloudUsage';

describe('monthKeyUTC — YYYY-MM month key in UTC', () => {
  it('formats with a 2-digit month', () => {
    expect(monthKeyUTC(Date.UTC(2026, 0, 15))).toBe('2026-01'); // January
    expect(monthKeyUTC(Date.UTC(2026, 11, 31))).toBe('2026-12'); // December
  });
  it('uses UTC (not the local timezone) — January 1st 00:30 UTC is still January', () => {
    expect(monthKeyUTC(Date.UTC(2026, 0, 1, 0, 30))).toBe('2026-01');
  });
});

describe('gcloud_usage — persistent monthly counters', () => {
  let db: Database.Database;
  const M = '2026-07';
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('no row -> 0 chars', () => {
    expect(getGcloudMonthlyChars(db, 'user', 'u1', M)).toBe(0);
  });

  it('add ACCUMULATES (atomic sum)', () => {
    addGcloudMonthlyChars(db, 'user', 'u1', M, 100);
    addGcloudMonthlyChars(db, 'user', 'u1', M, 250);
    expect(getGcloudMonthlyChars(db, 'user', 'u1', M)).toBe(350);
  });

  it('different scopes/keys/months are SEPARATE pools', () => {
    addGcloudMonthlyChars(db, 'user', 'u1', M, 100);
    addGcloudMonthlyChars(db, 'pass', 'u1', M, 200); // same id, different scope
    addGcloudMonthlyChars(db, 'user', 'u2', M, 300); // different key
    addGcloudMonthlyChars(db, 'user', 'u1', '2026-08', 400); // different month
    expect(getGcloudMonthlyChars(db, 'user', 'u1', M)).toBe(100);
    expect(getGcloudMonthlyChars(db, 'pass', 'u1', M)).toBe(200);
    expect(getGcloudMonthlyChars(db, 'user', 'u2', M)).toBe(300);
    expect(getGcloudMonthlyChars(db, 'user', 'u1', '2026-08')).toBe(400);
  });

  it('persists across DB reopens (same file)', () => {
    // :memory: is per-connection; use a temporary file to prove persistence.
    const path = `${process.env.TEMP || '/tmp'}/vozen-gcloud-usage-test-${M}.db`;
    const d1 = initDb(path);
    addGcloudMonthlyChars(d1, 'pass', 'owner-1', M, 12_345);
    d1.close();
    const d2 = initDb(path);
    expect(getGcloudMonthlyChars(d2, 'pass', 'owner-1', M)).toBe(12_345);
    d2.close();
    // cleanup
    try {
      require('node:fs').rmSync(path, { force: true });
    } catch {
      /* ignore */
    }
  });
});
