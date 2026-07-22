# Plan 020: AudioCache eviction without the per-miss directory scan

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the expected result before the next step. Obey the STOP
> conditions. Update this plan's row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 965b15b..HEAD -- src/tts/cache.ts`
> If `cache.ts` changed since this plan was written, compare the "Current
> state" excerpts against the live code; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `965b15b`, 2026-07-14

## Why this matters

The bot runs on a 2-vCPU / 3.7 GB VPS. `AudioCache.put()` triggers `evict()`
whenever the file count exceeds `maxFiles` (default 500) — which, once the
cache is warm (its normal steady state), is **every cache-miss synthesis**.
`evict()` does a `readdirSync` plus a `statSync` per file (~500 synchronous
metadata syscalls), then sorts and unlinks, all synchronously on the shared
event loop. Every new phrase on the default gTTS/Piper path therefore stalls
*all guilds'* playback scheduling for the duration of a 500-entry directory
sweep. Keeping an in-memory LRU index removes the sweep from the hot path.

## Current state

`src/tts/cache.ts` — the on-disk audio cache. Relevant excerpts at `965b15b`:

`cache.ts:106-148` — `put()`. It already tracks `this.count` in memory and
only evicts above the cap:
```ts
    this.count++;
    if (this.maxFiles > 0 && this.count > this.maxFiles) {
      this.evict(dest);
    }
    return dest;
```

`cache.ts:155-193` — `evict(justWritten)`. The hot-path cost:
```ts
  private evict(justWritten: string): void {
    let entries: Array<{ path: string; mtime: number }>;
    try {
      entries = readdirSync(this.dir)
        .filter((f) => f.endsWith('.wav'))
        .map((f) => {
          const p = join(this.dir, f);
          try { return { path: p, mtime: statSync(p).mtimeMs }; }
          catch { return null; }
        })
        .filter((e): e is { path: string; mtime: number } => e !== null);
    } catch { this.count = 0; return; }
    this.count = entries.length;              // readdir is the authority
    if (entries.length <= this.maxFiles) return;
    const candidates = entries
      .filter((e) => e.path !== justWritten)
      .sort((a, b) => a.mtime - b.mtime);
    const toRemove = Math.max(0, entries.length - this.maxFiles);
    for (let i = 0; i < toRemove && i < candidates.length; i++) {
      try { unlinkSync(candidates[i].path); } catch { /* já removido */ }
    }
  }
```

`cache.ts:85-104` — `get()` refreshes mtime on access (true-LRU) via
`utimesSync`. This is per-hit and cheap; **do not remove it** unless you fully
replace the LRU ordering with the in-memory index (see Step 2).

There is a startup scan already (search `cache.ts` for the constructor / a
`readdirSync` that seeds `this.count`) — reuse it to seed the index.

Existing tests: `tests/audioCache.test.ts` (or similar — run
`ls tests/ | grep -i cache` to find it). It exercises eviction by count; your
change must keep those green and add index-specific cases.

Conventions: TypeScript strict; Portuguese comments; better-sqlite3-style
synchronous code is fine here (this is disk I/O, not the DB). Namespaces
(`withNamespace('piper'|'clone'|…)`) create separate `AudioCache` instances
per subdir — the index must be per-instance, not global.

## Commands you will need

| Purpose    | Command                                | Expected            |
|------------|----------------------------------------|---------------------|
| Typecheck  | `npm run typecheck`                    | exit 0              |
| Tests      | `npx vitest run tests/audioCache.test.ts` | all pass         |
| Full suite | `npx vitest run`                       | ≥1714 pass          |
| Lint       | `npm run lint`                         | exit 0              |

## Scope

**In scope**: `src/tts/cache.ts`; the existing cache test file (extend it).
**Out of scope**: every caller of `AudioCache` (the public API —
`get`/`put`/`withNamespace` — must not change signature); `wavConcat.ts`;
`recorder.ts`.

## Git workflow

Branch `advisor/020-audiocache-lru`. Commit message e.g.
`perf(cache): índice LRU em memória, sem readdir/stat no hot path`.

## Steps

### Step 1: Add an in-memory insertion/access-ordered key index

Add a private field that preserves LRU order without touching disk. A
`Map<string, true>` in JS preserves insertion order and lets you delete+re-set
to move a key to the most-recent end. Store the **file path** (what `unlinkSync`
needs) as the key.

- Seed it from the startup directory scan that already computes `this.count`
  (add the `.wav` paths to the index in whatever order `readdir` returns —
  order across a restart is best-effort, which matches today's mtime behavior).
- In `put()`, after a new file lands: `this.lru.delete(dest); this.lru.set(dest, true);`
- In `get()` on a hit: move the key to most-recent (`this.lru.delete(p); this.lru.set(p, true);`).
  You may then DROP the `utimesSync` call (the in-memory order replaces mtime
  as the LRU signal) — but keep the `existsSync` check.

### Step 2: Evict from the index head, not from a directory scan

Rewrite `evict(justWritten)` to pop the oldest key(s) from the front of `this.lru`:

```ts
  private evict(justWritten: string): void {
    while (this.count > this.maxFiles) {
      // O mais antigo é o primeiro da ordem de inserção/acesso do Map.
      let oldest: string | undefined;
      for (const k of this.lru.keys()) {
        if (k !== justWritten) { oldest = k; break; }
      }
      if (!oldest) break; // só resta o recém-escrito
      this.lru.delete(oldest);
      try { unlinkSync(oldest); } catch { /* já removido fora do processo */ }
      this.count--;
    }
  }
```
No `readdirSync`, no `statSync`. The `count--` keeps the counter honest; the
startup scan self-heals any drift from files deleted out-of-process (e.g. the
`/voice clone delete` purge already zeroes `count` when the dir vanishes — that
path in `put()` at `cache.ts:122-125` must ALSO clear `this.lru`).

### Step 3: Clear the index when the directory is recreated

In `put()` where it detects the dir was removed and recreates it (the
`if (!existsSync(this.dir))` block that sets `this.count = 0`), also
`this.lru.clear();`.

**Verify**: `npm run typecheck` → exit 0.

## Test plan

Extend the existing cache test file:
- Eviction still removes the oldest by access order: put 3 with maxFiles=2,
  `get()` the first (touch it), put a 4th → the SECOND-inserted is evicted, not
  the first (proves access refresh works via the index, not mtime).
- `evict` performs no `readdirSync` on the hot path: spy on `fs.readdirSync`
  (via `vi.spyOn`) during a warm-cache `put()` and assert it is **not** called
  (only the constructor scan may call it). If the test file doesn't already
  import fs in a spyable way, model the spy on how other tests in the repo mock
  `fs` (search `vi.mock('node:fs'` / `vi.spyOn` in `tests/`).
- Dir-recreated path clears the index (put, delete the dir, put again → count
  and index consistent).

**Verify**: `npx vitest run tests/audioCache.test.ts` → all pass incl. new cases.

## Done criteria

- [ ] `npm run typecheck` exit 0, `npm run lint` exit 0
- [ ] `npx vitest run` exit 0; new eviction-order + no-readdir-on-hot-path tests present
- [ ] `grep -n "readdirSync" src/tts/cache.ts` → appears only in the startup scan, NOT in `evict`
- [ ] Public API of `AudioCache` unchanged (`git diff` shows no signature change to `get`/`put`/`withNamespace`)
- [ ] `plans/README.md` row updated

## STOP conditions

- `cache.ts` drifted from the excerpts (recheck against `965b15b`).
- The startup scan you need to seed the index doesn't exist or works
  differently than described — report what you found.
- A caller depends on mtime files being touched (grep for `utimesSync`/`mtime`
  outside `cache.ts`); if so, keep `utimesSync` in `get()` and only remove the
  readdir/stat from `evict`.

## Maintenance notes

- The index is per-`AudioCache` instance (per namespace) — correct, since each
  namespace is its own subdir with its own `maxFiles`.
- Cross-restart LRU order is approximate (seeded from `readdir` order), same
  fidelity as before; only steady-state ordering is now exact.
- Reviewer: confirm every place that mutates `this.count` also mutates
  `this.lru` in lockstep, or the two drift.
