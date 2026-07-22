# Plan 010: Add a write-through in-memory cache for the stable store tables read on every message

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat fb7f916..HEAD -- src/store/ src/bot/deps.ts tests/store.test.ts tests/messageHandler.test.ts tests/langDetect.test.ts tests/voiceClone.test.ts tests/guildDelete.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: none (but plan 014 depends on THIS plan's invalidation calls
  surviving its refactor — land 010 before 014 if both are executed)
- **Category**: perf
- **Planned at**: commit `fb7f916`, 2026-07-07

## Why this matters

`src/commands/messageHandler.ts` performs ~9 synchronous SQLite reads plus one
read-modify-write **per guild message that reaches synthesis**: getGuildConfig
(line 90), isOptedOut (155), getBlocklist (193), getUserVoice (209),
isDetectionOn (210), getNickname (224), getPronunciations (231),
getVoiceEffect (257), getClone (260), bumpTalk (270). These tables change only
when an admin/user runs a slash command (minutes–days apart) but are re-read
on every message, blocking the event loop. There is **no caching anywhere in
`src/store/`** (verified: no Map/cache in any store module except a function
parameter in `gameScore.ts`). A small write-through cache — read accessors
populate it, every setter invalidates its key — removes ~9 queries per message
while keeping reads always-correct in-process. `bumpTalk` is a write and stays
uncached.

The risk is **stale-until-restart bugs**: one missed invalidation means a
`/config` change silently doesn't apply. That's why this plan enumerates every
setter exhaustively and adds a grep-based verification that no write site was
missed.

## Current state

### Files and their read accessors / setters (ALL verified at fb7f916)

Every raw SQL touching these tables lives ONLY in `src/store/*` (verified:
`grep -rn "db.prepare\|db.exec" src --include=*.ts | grep -v "src/store/"`
returns nothing). The complete mutation list per table:

| Store file                   | Cached read accessor     | Cache key                   | Setters that MUST invalidate that key                                                                                                                                                                                                                                   |
| ---------------------------- | ------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/store/guildConfig.ts`   | `getGuildConfig` (:74)   | `guildId`                   | `setGuildConfig` (:105-148), `resetGuildConfig` (:101-103)                                                                                                                                                                                                              |
| `src/store/blocklist.ts`     | `getBlocklist` (:7)      | `guildId`                   | `addBlockword` (:14-19), `removeBlockword` (:21-23)                                                                                                                                                                                                                     |
| `src/store/pronunciation.ts` | `getPronunciations` (:4) | `guildId`                   | `addPronunciation` (:11-23), `removePronunciation` (:25-27)                                                                                                                                                                                                             |
| `src/store/userVoice.ts`     | `getUserVoice` (:12)     | `guildId:userId`            | `setUserVoice` (:25-39), `resetUserVoice` (:41-47)                                                                                                                                                                                                                      |
| `src/store/nickname.ts`      | `getNickname` (:7)       | `guildId:userId`            | `setNickname` (:18-29), `clearNickname` (:31-33)                                                                                                                                                                                                                        |
| `src/store/optout.ts`        | `isOptedOut` (:7)        | `guildId:userId`            | `setOptOut` (:14-19), `setOptIn` (:21-23)                                                                                                                                                                                                                               |
| `src/store/langDetect.ts`    | `isDetectionOn` (:20)    | `guildId:userId`            | `setDetection` (:37-54) — BOTH branches (insert and delete)                                                                                                                                                                                                             |
| `src/store/voiceEffect.ts`   | `getVoiceEffect` (:8)    | `guildId:userId`            | `setVoiceEffect` (:16-31) AND `clearVoiceEffect` (:33-35). Note: `setVoiceEffect('none')` delegates to `clearVoiceEffect`, so invalidating in both is safe/idempotent                                                                                                   |
| `src/store/voiceClone.ts`    | `getClone` (:18)         | `userId` (GLOBAL, no guild) | `saveClone` (:38-53), `setCloneEnabled` (:56-61), `deleteClone` (:64-69), `deleteClonesByTarget` (:77-87) — the last one deletes MANY rows; it already SELECTs the affected `user_id`s into `rows` before the DELETE (:81-85), so invalidate `rows[i].user_id` for each |

NOT cached (out of scope): `talkStats.ts` (`bumpTalk` is a write;
`getTopSpeakers` is a rare command), `premium.ts` (written by
vote-webhook/entitlement paths), `birthday.ts`, `gameScore.ts`, `db.ts`.

### Key excerpts

`src/store/guildConfig.ts:105-112` — note `setGuildConfig` READS via
`getGuildConfig` before writing (read-merge-write). The cache must be
invalidated AFTER the write; the internal read populating the cache with the
pre-write value is fine because the invalidation follows:

```ts
export function setGuildConfig(
  db: Database.Database,
  guildId: string,
  patch: Partial<GuildConfig>,
): void {
  const current = getGuildConfig(db, guildId);
  const next: GuildConfig = { ...current, ...patch };
  db.prepare(
    `INSERT INTO guild_config ...
```

`src/store/voiceClone.ts:64-69` — `deleteClone` also reads via `getClone`
first (same pattern, same rule: invalidate after the DELETE):

```ts
export function deleteClone(db: Database.Database, userId: string): string | null {
  const row = getClone(db, userId);
  if (!row) return null;
  db.prepare('DELETE FROM user_clone WHERE user_id = ?').run(userId);
  return row.samplePath;
}
```

`src/store/nickname.ts:7-16` — `getNickname` returns `null` for absent rows.
The cache MUST cache negative results too (a `null` is a valid cached value),
otherwise the hot path still hits SQLite for every user without a nickname —
which is most users. Same for `getUserVoice` (null) and `getClone` (null);
`isOptedOut`/`isDetectionOn` return `false`, `getVoiceEffect` returns
`'none'` — plain values, cache them as-is.

`src/bot/deps.ts:82-96` — guild teardown hook (where guild-keyed cache entries
get evicted to bound memory):

```ts
export function handleGuildDelete(
  deps: Pick<BotDeps, 'players' | 'limiters' | 'aloneWatcher' | 'games'>,
  guildId: string,
): void {
  try {
    deps.limiters.delete(guildId);
    removePlayer(deps, guildId);
    ...
```

It is called from `src/bot/client.ts:158-160` with the FULL `deps` object
(which includes `db`), so widening the `Pick` is safe for the caller.

### Process model (the assumption this cache rests on)

- Default deployment is a **single bot process** (`npm start` →
  `dist/index.js`). Verified in `src/shard.ts`: sharding is opt-in via
  `BOT_SHARDS`; when enabled, a `ShardingManager` spawns **separate child
  processes** each running `index.js` (src/shard.ts:52-55).
- In sharded mode, each process opens its own DB connection and would hold its
  own cache. Discord routes all gateway events (messages AND slash commands)
  for a given guild to exactly one shard, so **guild-keyed** tables stay
  coherent per process. The one exception is `user_clone`, which is keyed by
  `userId` only (global): a user can run `/voice clone` in guild A (shard 1)
  and speak in guild B (shard 2). To keep that safe under sharding, the clone
  cache entry gets a short TTL (60 s) — everything else has no TTL.
- No other process writes these tables (top.gg webhook and entitlements write
  only `premium_*`/`redeem_code`, which are not cached).

### Test conventions

- `tests/store.test.ts` — per-store tests; `initDb(':memory:')` per test in
  `beforeEach`, closed in `afterEach`. New per-store cache tests go here.
- `tests/messageHandler.test.ts` — builds fake `deps` with a real `:memory:`
  db and a fake player (`makeDeps`, lines 40-58); the happy-path test shows
  how to drive `handleMessage`. The db-query-count test goes here.
- Tests get a FRESH db per test. Therefore the cache MUST be scoped per
  database instance, not module-global-by-guildId — otherwise test A's cache
  would poison test B. Use a `WeakMap` keyed by the `Database` object (also
  makes closed dbs collectable).

## Commands you will need

| Purpose       | Command                                                                                                                                       | Expected on success          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Install       | `npm install`                                                                                                                                 | exit 0                       |
| Typecheck     | `npm run build`                                                                                                                               | exit 0 (tsc, no errors)      |
| Tests (files) | `npx vitest run tests/store.test.ts tests/messageHandler.test.ts tests/langDetect.test.ts tests/voiceClone.test.ts tests/guildDelete.test.ts` | all pass                     |
| Tests (all)   | `npx vitest run`                                                                                                                              | 114 files / 1298+ tests pass |

(Verified at `fb7f916`: `npx vitest run` → 1298 passed. No lint script.)

## Scope

**In scope** (the only files you should modify):

- `src/store/cache.ts` (create)
- `src/store/guildConfig.ts`, `src/store/blocklist.ts`,
  `src/store/pronunciation.ts`, `src/store/userVoice.ts`,
  `src/store/nickname.ts`, `src/store/optout.ts`, `src/store/langDetect.ts`,
  `src/store/voiceEffect.ts`, `src/store/voiceClone.ts`
- `src/bot/deps.ts` (widen `handleGuildDelete` to evict guild keys)
- `tests/store.test.ts`, `tests/messageHandler.test.ts`,
  `tests/langDetect.test.ts`, `tests/voiceClone.test.ts`,
  `tests/guildDelete.test.ts`

**Out of scope** (do NOT touch, even though they look related):

- `src/store/talkStats.ts`, `src/store/premium.ts`, `src/store/birthday.ts`,
  `src/store/gameScore.ts`, `src/store/db.ts` — not cached in this plan.
- `src/commands/messageHandler.ts` and `src/commands/index.ts` — the whole
  point of caching inside the store accessors is that call sites stay
  untouched.
- Any SQL statement text — reads/writes keep byte-identical SQL.
- Function signatures of any existing store function — callers must not change.

## Git workflow

- Branch: `advisor/010-hot-path-store-cache`
- Commit style: conventional-ish Portuguese one-liner, e.g.
  `perf(store): cache write-through das tabelas estáveis — ~9 queries a menos por mensagem`
- Commit per logical unit (cache module; store wiring; guildDelete eviction;
  tests) so a reviewer can bisect.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `src/store/cache.ts`

New module, comments in Portuguese. Required API (names may vary slightly, but
keep them descriptive; the semantics may not vary):

```ts
import type Database from 'better-sqlite3';

// Cache write-through por-INSTÂNCIA de db (WeakMap): cada ligação tem o seu
// espaço — testes com :memory: novos por teste nunca se contaminam, e fechar
// a db liberta as entradas (GC).
type TableCache = Map<string, { value: unknown; at: number }>;
const caches = new WeakMap<Database.Database, Map<string, TableCache>>();

/** Nº máximo de entradas por tabela; ao exceder, limpa tudo (read-through repõe). */
const MAX_ENTRIES_PER_TABLE = 10_000;

export function cached<T>(
  db: Database.Database,
  table: string,
  key: string,
  load: () => T,
  ttlMs?: number,          // só o user_clone usa (ver Step 3)
): T { ... }

export function invalidate(db: Database.Database, table: string, key: string): void { ... }

/** Remove TODAS as entradas de uma guild (chave === guildId ou prefixo `guildId:`). */
export function invalidateGuild(db: Database.Database, guildId: string): void { ... }
```

Semantics `cached` MUST implement:

- `map.has(key)` decides a hit (so cached `null`/`false` values are hits);
- entry stores `{ value, at: Date.now() }`; if `ttlMs` is provided and
  `Date.now() - at >= ttlMs`, treat as miss (reload and overwrite);
- on a miss: `const value = load();` store, return. `load` runs synchronously
  (better-sqlite3 is sync) — no async, no locking needed;
- before inserting a NEW key, if `map.size >= MAX_ENTRIES_PER_TABLE`, call
  `map.clear()` first (crude but safe memory bound: worst case is a refill,
  never wrong data).

`invalidateGuild` iterates every table map of that db and deletes keys where
`key === guildId || key.startsWith(guildId + ':')`. The `user_clone` table
uses bare `userId` keys — a userId never equals a guildId in practice, but do
not rely on that: register per-table key kinds OR simply accept that clone
entries are only evicted by their own invalidations/TTL (document with a
comment; do NOT try to purge clone entries in `invalidateGuild`). Simplest
correct approach: keep a module-level set of GUILD-KEYED table names, e.g.
`const GUILD_KEYED = new Set(['guild_config','blocklist','pronunciation','user_voice','user_nickname','tts_optout','tts_lang_detect_on','user_effect']);`
and have `invalidateGuild` only touch those.

**Verify**: `npm run build` → exit 0.

### Step 2: Wire the eight guild-keyed stores

For each of the eight files, wrap the read accessor body in `cached(...)` and
add `invalidate(...)` as the LAST statement of every setter listed in the
Current state table. Use the SQL table name as the cache `table` string (it is
already unique and stable). Examples of the exact target shape:

`src/store/blocklist.ts`:

```ts
import { cached, invalidate } from './cache';

export function getBlocklist(db: Database.Database, guildId: string): string[] {
  return cached(db, 'blocklist', guildId, () => {
    const rows = db
      .prepare('SELECT word FROM blocklist WHERE guild_id = ? ORDER BY word ASC')
      .all(guildId) as WordRow[];
    return rows.map((r) => r.word);
  });
}

export function addBlockword(db: Database.Database, guildId: string, word: string): void {
  db.prepare(...).run(guildId, word);
  invalidate(db, 'blocklist', guildId);
}
```

`src/store/optout.ts` (per-user key):

```ts
export function isOptedOut(db: Database.Database, guildId: string, userId: string): boolean {
  return cached(db, 'tts_optout', `${guildId}:${userId}`, () => { ...existing query... });
}
export function setOptOut(...) { ...existing run...; invalidate(db, 'tts_optout', `${guildId}:${userId}`); }
export function setOptIn(...)  { ...existing run...; invalidate(db, 'tts_optout', `${guildId}:${userId}`); }
```

Apply the same mechanical pattern to: `guildConfig.ts` (key `guildId`, both
`setGuildConfig` and `resetGuildConfig` invalidate), `pronunciation.ts`
(key `guildId`), `userVoice.ts`, `nickname.ts`, `langDetect.ts` (invalidate in
BOTH branches of `setDetection` — or once before the `if`, after the writes;
simplest: at the end of each branch), `voiceEffect.ts` (invalidate in
`setVoiceEffect`'s upsert path AND in `clearVoiceEffect`).

Two ordering rules (both matter):

1. Invalidation goes AFTER the DB write (a throw in `.run()` must not evict a
   still-valid entry — better-sqlite3 writes are atomic).
2. `getGuildConfig`'s cached value must be the OBJECT the function returns
   today. Callers may mutate the returned object? Check: `getGuildConfig`
   returns a fresh object per call today (`{ ...DEFAULTS }` or a fresh
   literal). To preserve that isolation, have the guildConfig loader return
   the object and `getGuildConfig` return a shallow copy of the cached value:
   `return { ...cached(db, 'guild_config', guildId, loader) };` — cheap and
   removes any aliasing risk. Do the same for `getUserVoice` and `getClone`
   (`row ? { ...row } : null`) and return a copied array for `getBlocklist`
   (`[...cachedArr]`) and `getPronunciations` (`cachedArr.map((e) => ({ ...e }))`).
   Scalars (`boolean`, `string`, `'none'`, `null`) need no copy.

**Verify**: `npm run build` → exit 0;
`npx vitest run tests/store.test.ts tests/langDetect.test.ts` → all pass
(these suites do get→set→get sequences on the same db, so a broken
invalidation fails HERE, immediately).

### Step 3: Wire `voiceClone.ts` with the 60 s TTL

Same pattern, key = `userId`, table `'user_clone'`, but pass a TTL:

```ts
/** TTL do clone: única tabela cacheada com chave GLOBAL (userId, sem guild). Em modo
 * sharded (processos separados) uma escrita noutro shard não invalida este processo;
 * o TTL limita a janela de staleness (relevante p/ revogação RGPD) a 60s. */
const CLONE_TTL_MS = 60_000;

export function getClone(db, userId) {
  const row = cached(db, 'user_clone', userId, () => { ...existing query... }, CLONE_TTL_MS);
  return row ? { ...row } : null;
}
```

Invalidate in ALL FOUR setters: `saveClone`, `setCloneEnabled`, `deleteClone`
(after the DELETE — note it calls `getClone` internally first, which is fine),
and `deleteClonesByTarget` — there, loop the already-fetched `rows` and
`invalidate(db, 'user_clone', r.user_id)` for each after the DELETE runs.

**Verify**: `npx vitest run tests/voiceClone.test.ts tests/store.test.ts` → pass.

### Step 4: Evict guild keys on guildDelete

In `src/bot/deps.ts`, widen `handleGuildDelete`'s parameter type and call the
eviction inside the existing `try`:

```ts
export function handleGuildDelete(
  deps: Pick<BotDeps, 'players' | 'limiters' | 'aloneWatcher' | 'games'> &
    Partial<Pick<BotDeps, 'db'>>,
  guildId: string,
): void {
  try {
    deps.limiters.delete(guildId);
    removePlayer(deps, guildId);
    deps.games?.endGuild(guildId);
    if (deps.db) invalidateGuild(deps.db, guildId);
  } catch (err) { ... }
}
```

`db` is optional so existing tests constructing partial deps keep compiling.
The real caller (`src/bot/client.ts:158-160`) passes full `deps` — no change
needed there.

**Verify**: `npm run build` → exit 0; `npx vitest run tests/guildDelete.test.ts` → pass.

### Step 5: Exhaustiveness check (machine-checkable, do not skip)

Confirm no write site outside the enumerated setters exists for any cached
table. Run, and compare against the expected output:

```
grep -rln "guild_config\|blocklist\|pronunciation\|tts_optout\|tts_lang_detect_on\|user_nickname\|user_voice\|user_effect\|user_clone" src --include=*.ts | grep -v "src/store/" | grep -v "src/i18n/"
```

Expected: only files that reference these names in comments or via the store
functions — verify each hit contains NO `db.prepare`/`db.exec` for these
tables: `grep -rn "db.prepare\|db.exec" src --include=*.ts | grep -v "src/store/"`
must return **nothing** (verified true at fb7f916). If it returns anything,
STOP.

**Verify**: the second grep returns no output → exit code 1 from grep is the
success signal here.

### Step 6: Add the new tests, then full suite

See Test plan.

**Verify**: `npm run build` → exit 0; `npx vitest run` → all pass, 0 failures.

## Test plan

Model per-store tests on the existing get→set→get blocks in
`tests/store.test.ts` (e.g. the guildConfig upsert tests around lines
100-160).

1. **Per-store read-through + invalidation-on-set** — in `tests/store.test.ts`,
   one new `describe('cache write-through')` with, for EACH of the 9 cached
   accessors: (a) call get twice, assert `vi.spyOn(db, 'prepare')` recorded the
   table's SELECT only once between the two gets (spy AFTER the first get, or
   count SQL strings passed to `prepare` — `db.prepare` is a plain method on
   the better-sqlite3 instance and can be spied with
   `const spy = vi.spyOn(db, 'prepare')`); (b) call the setter, call get,
   assert the NEW value is returned (this catches a missing invalidation
   regardless of the spy mechanics). Cover EVERY setter in the Current state
   table — including `resetGuildConfig`, `removeBlockword`,
   `removePronunciation`, `resetUserVoice`, `clearNickname`, `setOptIn`,
   `setDetection(off)`, `clearVoiceEffect`, `deleteClone`,
   `deleteClonesByTarget` (assert the OWNER's `getClone` goes null right after).
2. **Negative caching** — `getNickname` twice for an absent row: second call
   does not re-prepare the SELECT; then `setNickname` → get returns the value.
3. **Isolation between db instances** — two `initDb(':memory:')` instances;
   write a nickname in db1; `getNickname(db2, ...)` returns null (WeakMap
   scoping works).
4. **Returned objects are not aliased** — `const a = getGuildConfig(db, G);
a.maxChars = 999;` then `getGuildConfig(db, G).maxChars` still equals the
   stored value (shallow-copy rule from Step 2).
5. **Clone TTL** — with `vi.useFakeTimers()`: `getClone` (miss), external
   change simulated by running the raw UPDATE via `db.prepare` directly in the
   test (bypassing the setter, as another process would), `getClone` still old
   (cached), `vi.advanceTimersByTime(61_000)`, `getClone` now returns the new
   value. Restore real timers in `afterEach`.
6. **messageHandler-level** — in `tests/messageHandler.test.ts`, add one test
   modeled on the existing happy-path test: send TWO messages through
   `handleMessage` with the same deps/db; spy on `db.prepare` after the first
   message completes; assert that during the second message NO
   `prepare` call whose SQL contains `FROM guild_config` occurs (and
   optionally none for `FROM blocklist` / `FROM pronunciation`), while
   `player.say` was still called twice. (`bumpTalk`'s SQL will still appear —
   that's expected; filter by SQL substring.)
7. **guildDelete eviction** — in `tests/guildDelete.test.ts`: populate config
   for guild G, call `handleGuildDelete({ ...deps, db }, G)`, mutate the row
   via raw SQL (simulating nothing — actually simply assert via the spy that
   the next `getGuildConfig(db, G)` re-prepares the SELECT, i.e. the cache
   entry was evicted).

Verification: `npx vitest run tests/store.test.ts tests/messageHandler.test.ts tests/langDetect.test.ts tests/voiceClone.test.ts tests/guildDelete.test.ts`
→ all pass, ≥15 new tests total.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run build` exits 0
- [ ] `npx vitest run` exits 0 (full 1298+ suite, no regressions)
- [ ] `src/store/cache.ts` exists; `grep -n "WeakMap" src/store/cache.ts` matches
- [ ] Every setter listed in the Current state table contains an `invalidate(`
      call: `grep -c "invalidate(" src/store/guildConfig.ts src/store/blocklist.ts src/store/pronunciation.ts src/store/userVoice.ts src/store/nickname.ts src/store/optout.ts src/store/langDetect.ts src/store/voiceEffect.ts src/store/voiceClone.ts`
      → counts ≥ 2,2,2,2,2,2,1,2,4 respectively
- [ ] `grep -n "cached(" src/store/talkStats.ts src/store/premium.ts` returns
      no matches (uncached tables stayed uncached)
- [ ] `grep -rn "db.prepare\|db.exec" src --include=*.ts | grep -v "src/store/"`
      returns nothing (no out-of-store write sites appeared)
- [ ] New messageHandler test proves `FROM guild_config` is not re-prepared on
      the second message
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts —
  in particular if any store module already contains caching, or if any
  `db.prepare`/`db.exec` for the nine tables exists outside `src/store/`
  (Step 5 grep) — the exhaustive setter list would then be incomplete and the
  whole design unsafe.
- You discover a second PROCESS writing these tables while the bot runs
  (anything beyond the documented top.gg webhook / entitlements which touch
  only `premium_*`): the single-writer-process assumption is false → stop.
- You discover the assumption "in sharded mode every gateway event for a guild
  reaches exactly one shard process" is contradicted anywhere in `src/`
  (e.g. a cross-shard broadcast that writes guild-keyed tables) — the
  guild-keyed caches would then need TTLs too; do not improvise that.
- Widening `handleGuildDelete`'s type breaks compilation of callers/tests in a
  way that requires changing `BotDeps` itself.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **Anyone adding a new setter to a cached store module MUST add the matching
  `invalidate` call** — put a short Portuguese comment at the top of each
  wired store file saying exactly that. This is the #1 thing a reviewer should
  check in this PR, and in every future PR touching `src/store/`.
- Plan 014 (guild_config descriptor table) rewrites `setGuildConfig`'s SQL
  generation — its plan explicitly requires preserving the `invalidate` call
  added here. If 014 lands first instead, this plan must add the calls into
  the descriptor-driven functions.
- If sharding (`BOT_SHARDS`) is ever enabled in production, revisit
  `user_clone`'s 60 s TTL (RGPD revocation latency across shards) and consider
  TTLs for guild-keyed tables only if guild-to-shard routing ever changes.
- The `MAX_ENTRIES_PER_TABLE` clear-all bound is deliberately crude; if memory
  profiling ever shows churn, replace with LRU — but measure first.
- Deferred: caching `getBirthday` (greeting path) and `talkStats` reads —
  different access patterns, not message-hot.
