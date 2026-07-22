# 038 — Shared `BoundedMap` utility (kill the 14× hand-rolled bounded-map idiom)

**Source:** 5th audit (2026-07-18), finding DEBT-03. **Written against:** commit `a9ca723`.
**Priority:** P2 · **Effort:** S-M · **Risk:** LOW · **Confidence:** HIGH (facts) / MED (payoff).
**Value:** convergence insurance, NOT a perf win — the surviving caches are tiny (≤256-512 entries,
cheap recompiles). The real cost is proven pattern-drift: without a shared helper, each new feature
re-decides the eviction policy and sometimes re-decides it wrong (plan 033's B8 fixed a "wipe" site
claiming "every other map evicts oldest" — which was false, 4 wipe sites remained — and
`claimHelp.ts` re-introduced the wipe flavor the very next day).

## Current state — the two flavors

**Evict-oldest (FIFO, correct) — 10 sites:** `src/commands/messageHandler.ts:133`,
`src/leaderboard/randomPost.ts:54`, `src/moderation/antispam.ts:84`, `src/moderation/countGate.ts:95`,
`src/premium/dashboardApi.ts:136`, `src/premium/kofiWebhook.ts:161` (`pruneRateMap`),
`src/premium/statusApi.ts:66`, `src/store/cache.ts:84`, `src/tts/piperPool.ts:226`,
`src/voice/greetCooldown.ts:47`.

**Wipe-everything (clears the whole map at cap — worse) — 4 sites:** `src/moderation/filter.ts:24`,
`src/textCleaning/pronunciation.ts:44`, `src/errorReporter.ts:100`, `src/premium/claimHelp.ts:64`.

Open each before touching it — the exact shape differs (some are `Map`, some `Set`, some LRU-touch
on hit). Do NOT assume; read the site.

## The change

1. Create `src/util/boundedMap.ts` exporting a small, dependency-free helper. Suggested shape (adjust
   to what the sites actually need after reading them):
   - `class BoundedMap<K, V>` wrapping a `Map`, with `{ cap: number; touchOnHit?: boolean }`.
     On `set`, if size > cap after insert, delete oldest key(s) (FIFO via `Map` iteration order).
     If `touchOnHit`, `get` re-inserts the key to move it to newest (LRU). Expose `get/set/has/delete/size`.
   - Optionally `boundedSet(cap)` for the Set sites.
2. Migrate each of the 14 sites to the helper. **Both flavors converge on evict-oldest** (the wipe
   sites lose the whole-map clear — that is the point). Keep LRU-touch only where a site deliberately
   used it (e.g. an LRU cache); FIFO otherwise.
3. Delete the 4 hand-rolled wipe implementations.

## Boundaries

- IN scope: the 14 sites above + the new util + its test. OUT: `src/store/cache.ts`'s AudioCache
  LRU is already a deliberate LRU with a 500-cap (plan 020) — migrate only its bounded-map internals
  if they map cleanly, else leave it and note why.
- Do NOT change any cap value or eviction semantics a site depends on (e.g. rate-limit windows). This
  is a mechanical extraction, behavior-preserving per site.

## TDD

- New `tests/boundedMap.test.ts`: cap enforced; oldest evicted first (FIFO); `touchOnHit` moves a key
  to newest so it survives eviction; `delete`/`has`/`size` correct.
- Each migrated site already has tests — run them per migration. The full `npm run check` must stay
  green (194+ files / 2009+ tests).

## Done criteria

- `npm run check` exit 0.
- `rg "map.clear\(\)" src/` shows no bounded-map wipe pattern in the 4 sites (rate-limit/other clears
  that are NOT bounded-map eviction may remain — verify each).
- `tests/boundedMap.test.ts` green.

## STOP conditions

- If a site's "map" is load-bearing in a way the FIFO helper changes (e.g. a Set used for membership
  with no cap intent, or an LRU whose touch semantics differ), STOP and report it — do not force it
  into the helper.
