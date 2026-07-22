import { describe, it, expect } from 'vitest';
import type Database from 'better-sqlite3';
import { cached, invalidate, MAX_ENTRIES_PER_TABLE } from '../src/store/cache';

// `db` is only ever used as a WeakMap key by the cache, so a plain object is enough
// to isolate each test's cache without touching SQLite.
const fakeDb = (): Database.Database => ({}) as Database.Database;

/** Reads a key and reports whether it had to hit `load` (i.e. it was a cache MISS). */
function readCounting(db: Database.Database, table: string, key: string): boolean {
  let loaded = false;
  cached(db, table, key, () => {
    loaded = true;
    return key;
  });
  return loaded;
}

describe('store cache — eviction at the cap', () => {
  it('keeps the RECENT entries when the cap is exceeded (evicts oldest, never wipes the table)', () => {
    const db = fakeDb();
    // Fill exactly to the cap: k0 is the oldest, k(cap-1) the newest.
    for (let i = 0; i < MAX_ENTRIES_PER_TABLE; i++) cached(db, 't', `k${i}`, () => i);
    // One more key tips it over the cap and must trigger an eviction.
    cached(db, 't', 'overflow', () => -1);

    // The OLDEST entry is the one that goes.
    expect(readCounting(db, 't', 'k0')).toBe(true); // miss -> was evicted
    // Everything else must still be cached. With a clear-all eviction the whole table
    // is dropped, so the hot recent keys would miss too — a latency cliff under load.
    expect(readCounting(db, 't', `k${MAX_ENTRIES_PER_TABLE - 1}`)).toBe(false); // still a hit
    expect(readCounting(db, 't', 'overflow')).toBe(false); // still a hit
  });

  it('stays bounded: the table never grows past the cap', () => {
    const db = fakeDb();
    for (let i = 0; i < MAX_ENTRIES_PER_TABLE + 500; i++) cached(db, 't', `k${i}`, () => i);
    // The last 500 inserts each evict one older entry, so the newest are all live...
    for (let i = MAX_ENTRIES_PER_TABLE + 400; i < MAX_ENTRIES_PER_TABLE + 500; i++) {
      expect(readCounting(db, 't', `k${i}`)).toBe(false);
    }
    // ...and the first 500 are gone.
    expect(readCounting(db, 't', 'k0')).toBe(true);
  });

  it('re-reading a key does NOT refresh its eviction order (insertion-ordered, not LRU)', () => {
    // Documents the deliberate simplicity: `cached` does not re-insert on hit, so the
    // order is by first insertion. Cheap and good enough — a refill is the worst case.
    const db = fakeDb();
    for (let i = 0; i < MAX_ENTRIES_PER_TABLE; i++) cached(db, 't', `k${i}`, () => i);
    cached(db, 't', 'k0', () => 0); // touch the oldest — still a hit, order unchanged
    cached(db, 't', 'overflow', () => -1);
    expect(readCounting(db, 't', 'k0')).toBe(true); // touched, but still the one evicted
  });

  it('the cap is per-table: filling one table does not evict another', () => {
    const db = fakeDb();
    cached(db, 'other', 'keep', () => 'v');
    for (let i = 0; i < MAX_ENTRIES_PER_TABLE + 10; i++) cached(db, 't', `k${i}`, () => i);
    expect(readCounting(db, 'other', 'keep')).toBe(false); // untouched
  });

  it('invalidate still removes a single key without disturbing the rest', () => {
    const db = fakeDb();
    cached(db, 't', 'a', () => 1);
    cached(db, 't', 'b', () => 2);
    invalidate(db, 't', 'a');
    expect(readCounting(db, 't', 'a')).toBe(true); // gone
    expect(readCounting(db, 't', 'b')).toBe(false); // kept
  });
});
