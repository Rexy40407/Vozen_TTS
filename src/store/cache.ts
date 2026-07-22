// src/store/cache.ts
//
// WRITE-THROUGH cache of the STABLE tables read on every message (guild_config,
// blocklist, pronunciation, per-user voice/nickname/opt-out/detection, effect). The
// reads populate the cache; EVERY setter must invalidate it. This takes ~9 synchronous SQLite
// queries off the event-loop per message, keeping the reads always correct WITHIN the process.
//
// GOLDEN RULE: whoever adds a new setter to a cached table MUST call
// invalidate(...) for the same key — otherwise the change stays stale-until-restart.
//
// Per-INSTANCE db scope (WeakMap): tests with a fresh :memory: per test never
// contaminate each other, and closing the db frees the entries (GC).

import type Database from 'better-sqlite3';

interface Entry {
  value: unknown;
  at: number;
}
type TableCache = Map<string, Entry>;
const caches = new WeakMap<Database.Database, Map<string, TableCache>>();

/** Max number of entries PER TABLE; on exceeding, the oldest entries are evicted. */
export const MAX_ENTRIES_PER_TABLE = 10_000;

/**
 * Tables with a per-GUILD key (key === guildId or `guildId:` prefix). Only these are
 * purged in invalidateGuild; the user-keyed tables are evicted only by their own
 * invalidates + TTL.
 */
const GUILD_KEYED = new Set([
  'guild_config',
  'blocklist',
  'pronunciation',
  'user_voice',
  'user_nickname',
  'tts_optout',
  'tts_lang_detect_on',
  'user_effect',
  'channel_profile',
]);

function tableMap(db: Database.Database, table: string): TableCache {
  let byTable = caches.get(db);
  if (!byTable) {
    byTable = new Map();
    caches.set(db, byTable);
  }
  let map = byTable.get(table);
  if (!map) {
    map = new Map();
    byTable.set(table, map);
  }
  return map;
}

/**
 * Returns the cached value for (db, table, key), loading it via `load` on a miss.
 * `map.has` decides the hit — so `null`/`false` values are also hits (negative
 * caching, essential: most users have no nickname/pinned voice). If
 * `ttlMs` is given and the entry expired, it is treated as a miss. `load` is SYNCHRONOUS
 * (better-sqlite3 is synchronous) — no async, no locks.
 */
export function cached<T>(
  db: Database.Database,
  table: string,
  key: string,
  load: () => T,
  ttlMs?: number,
): T {
  const map = tableMap(db, table);
  const hit = map.get(key);
  if (hit && (ttlMs === undefined || Date.now() - hit.at < ttlMs)) {
    return hit.value as T;
  }
  const value = load();
  // Memory bound (never serves wrong data: the worst case is a refill). Evicts the
  // OLDEST entries, never the whole table: wiping it dropped every hot key at once, so
  // the next burst re-hit SQLite across ~5 tables synchronously — a latency cliff that
  // landed exactly when the bot was busiest. Map preserves insertion order, so the first
  // key is the oldest (same evict pattern as GreetCooldown/CountGate/DuplicateTracker).
  // `while` (not `if`) so a lowered cap converges instead of staying over budget forever.
  if (!map.has(key)) {
    while (map.size >= MAX_ENTRIES_PER_TABLE) {
      const oldest = map.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      map.delete(oldest);
    }
  }
  map.set(key, { value, at: Date.now() });
  return value;
}

/** Invalidates a key of a table (call AFTER each write to that table). */
export function invalidate(db: Database.Database, table: string, key: string): void {
  caches.get(db)?.get(table)?.delete(key);
}

/**
 * Removes ALL of a guild's entries (key === guildId or `guildId:` prefix) from the
 * GUILD-KEYED tables. Called in handleGuildDelete to limit memory. The user-keyed tables
 * leave via their own invalidates/TTL.
 */
export function invalidateGuild(db: Database.Database, guildId: string): void {
  const byTable = caches.get(db);
  if (!byTable) return;
  const prefix = `${guildId}:`;
  for (const table of GUILD_KEYED) {
    const map = byTable.get(table);
    if (!map) continue;
    for (const key of map.keys()) {
      if (key === guildId || key.startsWith(prefix)) map.delete(key);
    }
  }
}

/**
 * Cached tables whose key is (or ends in) a userId: key === userId (the global ones) or
 * `:userId` suffix (the per-(guild,user) ones, key `guildId:userId`).
 */
const USER_KEYED = new Set([
  'user_voice',
  'user_nickname',
  'tts_optout',
  'tts_lang_detect_on',
  'user_effect',
  // pronunciation_user is deleted by eraseUser (GDPR) but cached by userId; without being
  // here, invalidateUser did not clear it and the deleted pronunciations persisted in memory.
  'pronunciation_user',
]);

/**
 * Removes ALL of a user's entries (in any server) from the USER-KEYED tables.
 * Used by `eraseUser` (GDPR): deletes across several servers at once, so a pointwise
 * invalidation is not enough.
 */
export function invalidateUser(db: Database.Database, userId: string): void {
  const byTable = caches.get(db);
  if (!byTable) return;
  const suffix = `:${userId}`;
  for (const table of USER_KEYED) {
    const map = byTable.get(table);
    if (!map) continue;
    for (const key of map.keys()) {
      if (key === userId || key.endsWith(suffix)) map.delete(key);
    }
  }
}
