# Plan 008: Replace per-put directory scan in AudioCache with an in-memory file counter

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat fb7f916..HEAD -- src/tts/cache.ts tests/cache.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `fb7f916`, 2026-07-07

## Why this matters

Every successful `AudioCache.put()` calls `evict()`, and `evict()` does a full
`readdirSync` of the cache directory plus one `statSync` per `.wav` file
**before** checking whether the cache is even over the cap. With the default
cap of 500 files, that is up to ~501 synchronous filesystem syscalls per
synthesis, per namespace (`gtts/`, `piper/`, `multiseg/`, `clone/` are separate
`AudioCache` instances) — all on the main event-loop thread of a Discord bot
that must answer autocomplete within ~3 s. Keeping an in-memory file counter
makes the common case (cache under cap) zero-readdir, while the actual
eviction pass (rare) keeps its current, readdir-based, authoritative behavior.

## Current state

- `src/tts/cache.ts` — the whole `AudioCache` class (constructor, `get`,
  `put`, `evict`). 173 lines. All code comments are in Portuguese; keep it
  that way for new comments.
- `tests/cache.test.ts` — 462 lines; already mocks `node:fs` so that
  `statSync`/`readdirSync` are `vi.fn` wrappers around the real
  implementations (lines 12–29) — you can assert call counts on
  `vi.mocked(readdirSync)` without adding new mocks.

Key excerpts (verify these against the live file before editing):

`src/tts/cache.ts:47-57` — constructor (creates the dir eagerly):

```ts
export class AudioCache {
  private readonly dir: string;
  private readonly maxFiles: number;
  /** Sequência para nomes de ficheiro temporários únicos (escrita atómica em put). */
  private tmpSeq = 0;

  constructor(dir: string, maxFiles: number = DEFAULT_MAX_FILES) {
    this.dir = dir;
    this.maxFiles = maxFiles;
    mkdirSync(this.dir, { recursive: true });
  }
```

`src/tts/cache.ts:95-131` — `put()`: exists-first guard (an overwrite of an
existing key returns early and never re-writes), unconditional `mkdirSync`
(recreates the dir after the out-of-band privacy purge of
`audio-cache/clone/`), atomic tmp+`renameSync` write, then unconditional
evict:

```ts
  put(key: string, srcPath: string): string {
    const dest = this.pathFor(key);
    ...
    if (existsSync(dest)) return dest;
    // A pasta pode ter sido REMOVIDA em runtime (ex.: o purge de privacidade do
    // /voice clone delete apaga audio-cache/clone/ inteira). ...
    mkdirSync(this.dir, { recursive: true });
    const tmp = `${dest}.${process.pid}.${this.tmpSeq++}.tmp`;
    copyFileSync(srcPath, tmp);
    try {
      renameSync(tmp, dest);
    } catch (err) {
      ...
      if (existsSync(dest)) return dest;
      throw err;
    }
    if (this.maxFiles > 0) {
      this.evict(dest);
    }
    return dest;
  }
```

`src/tts/cache.ts:138-157` — `evict()` scans the WHOLE dir before the early
return (this is the cost this plan removes from the hot path):

```ts
  private evict(justWritten: string): void {
    let entries: Array<{ path: string; mtime: number }>;
    try {
      entries = readdirSync(this.dir)
        .filter((f) => f.endsWith('.wav'))
        .map((f) => { ... statSync(p).mtimeMs ... })
        .filter((e): e is { path: string; mtime: number } => e !== null);
    } catch {
      // dir desapareceu entre o put e o evict — nada a fazer
      return;
    }

    if (entries.length <= this.maxFiles) return;
```

- `withNamespace()` (`src/tts/cache.ts:65-67`) returns a **new** `AudioCache`
  instance for a subdirectory — each instance must own its own counter.
- Temp files use the suffix `.tmp` (not `.wav`), so they never count.
- `get()` refreshes mtime but never creates/removes files — no counter impact.

Repo conventions: comments in Portuguese; tests use vitest with real tmp dirs
(`mkdtempSync`) — see `tests/cache.test.ts:85-97` for the setup/teardown
pattern to reuse.

## Commands you will need

| Purpose      | Command                              | Expected on success          |
| ------------ | ------------------------------------ | ---------------------------- |
| Install      | `npm install`                        | exit 0                       |
| Typecheck    | `npm run build`                      | exit 0 (tsc, no errors)      |
| Tests (file) | `npx vitest run tests/cache.test.ts` | all pass                     |
| Tests (all)  | `npx vitest run`                     | 114 files / 1298+ tests pass |

(Verified at `fb7f916`: `npx vitest run` → 1298 passed. There is no lint script.)

## Scope

**In scope** (the only files you should modify):

- `src/tts/cache.ts`
- `tests/cache.test.ts`

**Out of scope** (do NOT touch, even though they look related):

- `src/tts/factory.ts`, `src/tts/multiSegment.ts`, `src/tts/gtts.ts`,
  `src/tts/piper.ts`, `src/tts/neural.ts` — consumers of `AudioCache`; the
  public API (`get`/`put`/`withNamespace` signatures and return values) must
  not change, so they need no edits.
- Any change to the eviction _policy_ (LRU by mtime, `justWritten` exclusion,
  `maxFiles=0` disables eviction). This plan only changes _when_ the scan runs.
- Cross-process counter coherence (multiple bot processes sharing one
  `audio-cache/` dir). The readdir inside `evict()` remains the authority; see
  Maintenance notes.

## Git workflow

- Branch: `advisor/008-audio-cache-size-counter`
- Commit style: conventional-ish Portuguese one-liners, e.g.
  `perf(tts): cache conta ficheiros em memória — evict só faz readdir acima do cap`
  (matches `git log` style like `fix(games): apagar da thread nunca falha às escuras`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the counter field and initialize it with one scan in the constructor

In `src/tts/cache.ts`, add a private mutable field `count` to `AudioCache`
and initialize it in the constructor **after** the `mkdirSync`, by counting
existing `.wav` files once:

```ts
  /** Nº de ficheiros .wav no dir, mantido em memória para evitar um readdir por put. */
  private count: number;

  constructor(dir: string, maxFiles: number = DEFAULT_MAX_FILES) {
    this.dir = dir;
    this.maxFiles = maxFiles;
    mkdirSync(this.dir, { recursive: true });
    // Um único scan no arranque (warm start: a cache persiste entre restarts).
    try {
      this.count = readdirSync(this.dir).filter((f) => f.endsWith('.wav')).length;
    } catch {
      this.count = 0; // dir inacessível — o próximo evict reconciliará
    }
  }
```

Write the actual comments in Portuguese (as above). `withNamespace` needs no
change — it constructs a fresh `AudioCache`, which now scans its own subdir
once.

**Verify**: `npm run build` → exit 0.

### Step 2: Maintain the counter in `put()` and gate `evict()` on it

Still in `src/tts/cache.ts`, inside `put()`:

1. Replace the unconditional `mkdirSync(this.dir, { recursive: true });`
   (line 111) with a cheap vanished-dir detection that also resets the counter
   (this is the hook for the out-of-band privacy purge that deletes
   `audio-cache/clone/` entirely):

```ts
// Detecao barata de pasta removida em runtime (purge do /voice clone delete):
// se o dir sumiu, recria-o e ZERA o contador (a pasta nova está vazia).
if (!existsSync(this.dir)) {
  mkdirSync(this.dir, { recursive: true });
  this.count = 0;
}
```

Note this preserves today's behavior: `mkdirSync(..., {recursive:true})` on
an existing dir was a no-op; now it is simply skipped. The exists-first
guard `if (existsSync(dest)) return dest;` at the top of `put()` must stay
BEFORE this block, unchanged — an overwrite of an existing key returns
early and must NOT touch the counter (no double-count).

2. Increment the counter only after a **successful** `renameSync` (a new file
   really landed). Do NOT increment on the `catch (err)` path (whether it
   returns the pre-existing `dest` or rethrows — no new file was added by us).

3. Gate the eviction on the counter:

```ts
if (this.maxFiles > 0) {
  this.count++;
  if (this.count > this.maxFiles) this.evict(dest);
} else {
  this.count++;
}
```

(Equivalently: increment once, then `if (this.maxFiles > 0 && this.count > this.maxFiles) this.evict(dest);` — pick the simpler form.)

**Verify**: `npm run build` → exit 0, then
`npx vitest run tests/cache.test.ts` → all existing tests still pass
(the existing eviction tests exercise caps of 1–5, so the gate `count > maxFiles`
still triggers eviction in them).

### Step 3: Reconcile the counter inside `evict()`

`evict()` already computes the authoritative `entries` list from `readdirSync`.
Use it to self-heal any drift (files deleted/added by another process, failed
unlinks):

1. Right after `entries` is built successfully, set `this.count = entries.length;`.
2. In the `catch {}` around `readdirSync` (dir vanished between put and evict),
   set `this.count = 0;` before the `return;`.
3. In the unlink loop, decrement on each **successful** `unlinkSync` only:

```ts
try {
  unlinkSync(candidates[i].path);
  this.count--;
} catch {
  // ficheiro já removido por outro processo — ignorar
}
```

Do not change the ordering, the `justWritten` exclusion, or the
`entries.length <= this.maxFiles` early return (it is now rarely reached, but
keep it — it is the safety net when the counter over-counts).

**Verify**: `npx vitest run tests/cache.test.ts` → all pass, including the
defensive-branch tests at the bottom of the file (they force `statSync`/
`readdirSync` to throw; the reconciliation must not break them).

### Step 4: Add the new tests

Extend `tests/cache.test.ts` (see Test plan below for the exact cases).

**Verify**: `npx vitest run tests/cache.test.ts` → all pass, including the new
tests.

### Step 5: Full suite + typecheck

**Verify**: `npm run build` → exit 0; `npx vitest run` → all 114+ files pass,
0 failures.

## Test plan

Add a new `describe('AudioCache contador em memória', ...)` block to
`tests/cache.test.ts`, modeled on the existing
`describe('AudioCache eviction (maxFiles)')` block (same `mkdtempSync`
setup/teardown, same `makeSrc` helper). The file's existing `vi.mock('node:fs')`
already turns `readdirSync` into a spy — use `vi.mocked(readdirSync)` and
`.mockClear()` to count calls. Cases:

1. **Counter-based skip (no readdir until cap)**: create `new AudioCache(dir, 5)`,
   call `vi.mocked(readdirSync).mockClear()` right after construction, do 4
   `put`s of distinct keys → assert `vi.mocked(readdirSync)` was **not called**
   (the constructor scan was the only readdir, and it was cleared). Then a 6th
   put (crossing the cap) → `readdirSync` called at least once and the oldest
   file evicted.
2. **Warm start**: pre-write 3 `*.wav` files directly into `dir` with
   `writeFileSync` BEFORE constructing `new AudioCache(dir, 3)`; one `put` of a
   new key → eviction triggers (counter picked up the pre-existing files) and
   at most 3 `.wav` files remain.
3. **Out-of-band dir deletion recovers the counter**: `new AudioCache(dir, 3)`
   (namespace optional), do 3 puts, `rmSync(dir, {recursive, force})` (simulates
   the privacy purge), then do 3 puts of NEW keys → no eviction happens
   (assert all 3 files exist — the counter was reset to 0, not left at 3),
   and a 4th put evicts.
4. **Overwrite of an existing key does not double-count**: cap 2; put `k1`,
   put `k1` again (same key), put `k2` → no eviction (2 files ≤ cap; a
   double-counted `k1` would have made count=3 and evicted). Assert both files
   exist and `readdirSync` was not called after `mockClear()`.
5. Existing tests are the regression net for eviction-past-cap, `maxFiles=0`,
   namespaces, and atomicity — they must pass unchanged.

Verification: `npx vitest run tests/cache.test.ts` → all pass, ≥4 new tests.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run build` exits 0
- [ ] `npx vitest run tests/cache.test.ts` exits 0; ≥4 new tests covering
      counter skip, warm start, purge recovery, and overwrite no-double-count
- [ ] `npx vitest run` exits 0 (full suite, no regressions)
- [ ] `grep -n "this.count" src/tts/cache.ts` returns matches in the
      constructor, `put`, and `evict`
- [ ] `grep -n "mkdirSync(this.dir" src/tts/cache.ts` shows the `put()` call is
      now inside an `existsSync` guard (or equivalent ENOENT handling)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts
  (e.g. `put()` no longer uses the exists-first guard or tmp+rename — the
  counter logic depends on both).
- The existing defensive-branch tests (`AudioCache.evict — ramos defensivos`)
  fail after Step 3 and cannot be fixed by adjusting only _call-count
  expectations_ — a behavioral change there means the reconciliation is wrong.
- You find another writer of `*.wav` files into the cache dir inside `src/`
  that bypasses `put()` (grep `audio-cache` and `\.wav` under `src/tts/`); the
  counter assumes `put()`/`evict()` are the only in-process mutators.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The counter is per-process. If the bot ever runs multiple processes sharing
  one `audio-cache/` dir (sharded mode `npm run start:sharded` spawns child
  processes), counters can drift between processes; drift is bounded and
  self-heals on every eviction pass (the `readdirSync` inside `evict()` remains
  the authority, and `entries.length <= maxFiles` still early-returns). A
  reviewer should confirm no code path adds `.wav` files without going through
  `put()`.
- If a future change makes `put()` delete or replace files (e.g. content
  refresh), the counter update rules must be revisited.
- Deferred (out of scope): making the eviction async/off-thread; counting
  bytes instead of files.
