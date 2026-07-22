# Plan 009: Fetch gTTS chunks with bounded concurrency instead of a serial await-loop

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat fb7f916..HEAD -- src/tts/gtts.ts src/config/index.ts src/tts/factory.ts tests/gtts.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `fb7f916`, 2026-07-07

## Why this matters

`GTTSEngine.synth` splits text into ≤200-char chunks and fetches them **one at
a time** in an await-loop. The synthesis cap is 2400 chars
(`MAX_SYNTH_CHARS` in `src/commands/prepareSpeech.ts:104`), so a long message
can serialize up to ~12 HTTP round-trips to Google before any audio plays —
seconds of added latency for the guild's whole voice queue (players play FIFO
per guild). Fetching chunks with a small bounded concurrency (default 3)
cuts that wall-clock time roughly by the concurrency factor while keeping the
request pressure on Google's unofficial endpoint low and the per-chunk
retry/backoff behavior untouched.

## Current state

- `src/tts/gtts.ts` (368 lines) — the gTTS engine. All comments in Portuguese;
  write new comments in Portuguese.
- `src/config/index.ts` (228 lines) — env parsing; has an established
  positive-integer-env pattern to follow.
- `src/tts/factory.ts` (103 lines) — the three construction sites of
  `GTTSEngine`.
- `tests/gtts.test.ts` (221 lines) — existing tests with injected `fetchImpl`
  and `sleepImpl`; extend this file.

Key excerpts (verify before editing):

`src/tts/gtts.ts:200-206` — the serial loop this plan replaces:

```ts
// Um MP3 por pedaço; concatenam-se os bytes (frames MP3 do mesmo formato) e o
// ffmpeg demuxa o stream inteiro de uma vez.
const mp3s: Buffer[] = [];
for (const c of chunks) {
  mp3s.push(await this.fetchChunk(c, lang));
}
const mp3 = Buffer.concat(mp3s);
```

Order matters: `mp3s` must stay in chunk order — the buffers are concatenated
into one MP3 stream that ffmpeg demuxes as a whole.

`src/tts/gtts.ts:230-239` — `fetchChunk` wraps ONE chunk in `retryAsync`
(retries only transient errors, linear backoff). **Do not change this
function**:

```ts
  private async fetchChunk(text: string, lang: string): Promise<Buffer> {
    return retryAsync(() => this.fetchChunkOnce(text, lang), {
      retries: this.retries,
      sleep: this.sleep,
      onRetry: (err, attempt) => ...
    });
  }
```

`src/tts/gtts.ts:262-269` — the 429 handling inside `fetchChunkOnce`. A 429
(Google rate limit) or 5xx is tagged retryable → `retryAsync` retries it with
backoff; 403/other 4xx are hard failures; timeouts are NOT retried. This
tagging is load-bearing and must remain exactly as-is:

```ts
if (!res.ok) {
  // 429 = rate-limit da Google (o preço de um endpoint não-oficial); 5xx = erro do
  // servidor. Ambos transitórios -> retry. 403/outros 4xx -> falha dura.
  throw taggedError(
    `gTTS: HTTP ${res.status} ${res.statusText} (429 = limite da Google)`,
    isRetryableStatus(res.status),
  );
}
```

`src/tts/gtts.ts:166-186` — `GttsOptions` and the constructor (injection
pattern to extend):

```ts
export interface GttsOptions {
  /** fetch injetável (testes). Default: o `fetch` global. */
  fetchImpl?: typeof fetch;
  /** sleep injetável (testes deterministicos). Default: setTimeout real. */
  sleepImpl?: (ms: number) => Promise<void>;
  /** tentativas EXTRA por pedido para erros transitórios. Default GTTS_DEFAULT_RETRIES. */
  retries?: number;
}
```

`src/config/index.ts:216-217` — the optional-env pattern to imitate
(`numEnvPositive` warns and falls back on invalid values; defined at
`src/config/index.ts:104-116`):

```ts
    gttsBreakerThreshold: numEnvPositive('GTTS_BREAKER_THRESHOLD', 3, { integer: true }),
    gttsBreakerCooldownMs: numEnvPositive('GTTS_BREAKER_COOLDOWN_MS', 60_000, { integer: true }),
```

`src/tts/factory.ts` — the three `GTTSEngine` construction sites that must
pass the new option through:

- line 29 (`createPerUserEngine`): `const gtts = new GTTSEngine(cache.withNamespace('gtts'));`
- line 66 (`createEngine`, `ttsEngine === 'gtts'`): `return new GTTSEngine(cache.withNamespace('gtts'));`
- line 75 (`createEngine`, `ttsEngine === 'router'`): `{ engine: new GTTSEngine(cache.withNamespace('gtts')), langs: null, label: 'gtts' },`

Related cooldown logic (context, NOT to be modified): the gTTS **failure
cooldown** lives in `src/tts/circuitBreaker.ts` (`CircuitBreakerEngine`,
`cooldownMs`), wrapped around the gTTS engine in `src/tts/factory.ts:35-39`.
It counts **whole-`synth` failures**, not per-chunk failures. Bounded
concurrency does not change what `synth` throws (one failed chunk still fails
the synth), so the breaker's counting semantics stay identical — but see STOP
conditions.

## Commands you will need

| Purpose       | Command                                                                                                     | Expected on success          |
| ------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Install       | `npm install`                                                                                               | exit 0                       |
| Typecheck     | `npm run build`                                                                                             | exit 0 (tsc, no errors)      |
| Tests (files) | `npx vitest run tests/gtts.test.ts tests/config.test.ts tests/factory.test.ts tests/circuitBreaker.test.ts` | all pass                     |
| Tests (all)   | `npx vitest run`                                                                                            | 114 files / 1298+ tests pass |

(Verified at `fb7f916`: `npx vitest run` → 1298 passed. No lint script.)

## Scope

**In scope** (the only files you should modify):

- `src/tts/gtts.ts`
- `src/config/index.ts`
- `src/tts/factory.ts`
- `tests/gtts.test.ts`
- `tests/config.test.ts` (only if it asserts the exact shape of `AppConfig`;
  extend, don't rewrite)

**Out of scope** (do NOT touch, even though they look related):

- `src/tts/circuitBreaker.ts` — the failure-cooldown decorator; its semantics
  must remain byte-identical.
- `src/commands/prepareSpeech.ts` — the 2400-char cap is a deliberate
  anti-amplification guard; do not raise it because fetching got faster.
- `chunkText`, `deCapsForGoogle`, `retryAsync`, `fetchChunk`, `fetchChunkOnce`,
  `mp3ToWav` in `src/tts/gtts.ts` — no behavioral changes to any of these.
- `.env` / deployment files.

## Git workflow

- Branch: `advisor/009-gtts-bounded-concurrency`
- Commit style: conventional-ish Portuguese one-liner, e.g.
  `perf(gtts): pedaços em paralelo limitado (3) — mensagens longas falam mais cedo`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add `gttsChunkConcurrency` to AppConfig

In `src/config/index.ts`:

1. Add to the `AppConfig` interface (near `gttsBreakerThreshold`, with a
   Portuguese comment explaining it caps simultaneous chunk fetches to Google):

```ts
gttsChunkConcurrency: number;
```

2. In `loadConfig()`, next to the breaker lines (216-217):

```ts
    gttsChunkConcurrency: numEnvPositive('GTTS_CHUNK_CONCURRENCY', 3, { integer: true }),
```

`numEnvPositive` already rejects 0/negative/non-integer with a warning and
falls back to 3 — no extra validation needed. A value of 1 reproduces today's
serial behavior.

**Verify**: `npm run build` → exit 0; `npx vitest run tests/config.test.ts` → pass.

### Step 2: Add an order-preserving bounded-concurrency helper to gtts.ts

In `src/tts/gtts.ts`, add an **exported pure** helper (exported so tests can
exercise it directly, matching the file's pattern of exporting `retryAsync`,
`chunkText`, etc.), with a Portuguese doc comment:

```ts
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
```

Properties the implementation MUST have (however you phrase it):

- results indexed by input position (order preserved regardless of completion order);
- never more than `limit` invocations of `fn` in flight;
- if any `fn` rejects, the returned promise rejects (Promise.all semantics);
  other in-flight calls are already attached to the same `Promise.all`, so no
  unhandled-rejection warnings.

**Verify**: `npm run build` → exit 0.

### Step 3: Use the helper in `synth` and thread the option through

1. In `GttsOptions`, add (Portuguese comment):

```ts
  /** Máx. de pedaços buscados em paralelo. Default GTTS_DEFAULT_CHUNK_CONCURRENCY. */
  chunkConcurrency?: number;
```

2. Add a module constant near `GTTS_DEFAULT_RETRIES` (line 39):
   `const GTTS_DEFAULT_CHUNK_CONCURRENCY = 3;`

3. In the constructor, store
   `this.chunkConcurrency = opts.chunkConcurrency ?? GTTS_DEFAULT_CHUNK_CONCURRENCY;`
   (private readonly field, like `retries`).

4. Replace the serial loop at lines 202-205 with:

```ts
// Fan-out LIMITADO (default 3): pedaços em paralelo, ordem preservada no array.
// O retry/backoff por pedaço (fetchChunk) fica intacto; um pedaço que falhe
// (esgotadas as tentativas) rejeita a síntese inteira — como no loop serial.
const mp3s = await mapWithConcurrency(chunks, this.chunkConcurrency, (c) =>
  this.fetchChunk(c, lang),
);
const mp3 = Buffer.concat(mp3s);
```

5. In `src/tts/factory.ts`, pass the config value at the three construction
   sites listed in Current state, e.g.:

```ts
const gtts = new GTTSEngine(cache.withNamespace('gtts'), {
  chunkConcurrency: config.gttsChunkConcurrency,
});
```

Note: `tests/gtts.test.ts:218` builds a partial config
(`{ ttsEngine: 'gtts', openaiApiKey: undefined } as unknown as AppConfig`) —
`config.gttsChunkConcurrency` will be `undefined` there, which falls back to
the default 3 via `?? GTTS_DEFAULT_CHUNK_CONCURRENCY`. Confirm this
fallback chain works (i.e. the constructor default handles `undefined`).

**Verify**: `npm run build` → exit 0;
`npx vitest run tests/gtts.test.ts tests/factory.test.ts` → all existing tests
pass (the existing retry tests use single-chunk texts, so serial vs bounded
makes no observable difference to them).

### Step 4: Add the new tests

Extend `tests/gtts.test.ts` (see Test plan).

**Verify**: `npx vitest run tests/gtts.test.ts` → all pass including new ones.

### Step 5: Full suite + typecheck

**Verify**: `npm run build` → exit 0; `npx vitest run` → all files pass, 0
failures (pay attention to `tests/circuitBreaker.test.ts` and
`tests/integration.pipeline.test.ts`).

## Test plan

Extend `tests/gtts.test.ts`, following its existing patterns (injected
`fetchImpl` as `vi.fn`, `sleepImpl: noSleep`, tmp cache dirs, `tagged()`
helper). New `describe` blocks:

1. **`mapWithConcurrency` — order preserved**: 6 items where item i resolves
   after a staggered delay (later items resolve first, e.g. via manually
   resolved promises); assert the result array equals the input order.
2. **`mapWithConcurrency` — cap respected**: fn increments an `inFlight`
   counter on entry, records `maxInFlight = Math.max(...)`, awaits a deferred,
   decrements on exit; run with limit 3 over 8 items, release the deferreds,
   assert `maxInFlight <= 3` and `maxInFlight >= 2` (it actually parallelized).
3. **`mapWithConcurrency` — one rejection rejects the whole call**: item 2 of 5
   rejects with a tagged error; `await expect(...).rejects.toThrow(...)`.
4. **`GTTSEngine.synth` — multi-chunk fan-out with order**: text longer than
   200 chars (e.g. 3 distinct 150-char words → 3 chunks via `chunkText`);
   `fetchImpl` records each requested `q=` param and returns distinct bytes per
   chunk; make the FIRST chunk's fetch resolve LAST (deferred). Because ffmpeg
   would need real MP3 bytes, don't assert on the WAV — instead assert
   (a) `fetchImpl` was called once per chunk, and (b) if you need to observe
   the concatenation order, spy on the concat step indirectly by testing
   `mapWithConcurrency` (case 1) — the synth-level test only needs to prove
   all chunks were requested and synth still resolves/rejects correctly. Let
   the synth call end in `.catch(() => {})` if ffmpeg conversion of fake bytes
   fails, exactly like the existing test at `tests/gtts.test.ts:195`.
5. **One failing chunk rejects the synth the same way as today**: 3 chunks,
   `fetchImpl` returns 403 for the second chunk (non-retryable) → synth rejects
   with `/403/`, and the failing chunk was fetched exactly once (no retry) —
   mirrors the existing single-chunk 403 test at lines 199-207.
6. **`retries` behavior under concurrency**: one chunk returns 503 once then
   succeeds → `fetchImpl` called `chunks + 1` times total (per-chunk retry
   preserved).

Also extend `tests/config.test.ts` with: `GTTS_CHUNK_CONCURRENCY` unset →
3; set to `'5'` → 5; set to `'0'` or `'abc'` → falls back to 3 (match the
existing tests for `GTTS_BREAKER_THRESHOLD` in that file — find them with
`grep -n GTTS_BREAKER tests/config.test.ts`).

Verification: `npx vitest run tests/gtts.test.ts tests/config.test.ts` → all
pass, ≥6 new tests.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run build` exits 0
- [ ] `npx vitest run` exits 0 (full suite)
- [ ] `grep -n "for (const c of chunks)" src/tts/gtts.ts` returns no matches
- [ ] `grep -n "mapWithConcurrency" src/tts/gtts.ts tests/gtts.test.ts` returns
      matches in both files
- [ ] `grep -n "GTTS_CHUNK_CONCURRENCY" src/config/index.ts` returns a match
- [ ] `grep -n "chunkConcurrency" src/tts/factory.ts` returns matches at all
      three GTTSEngine construction sites
- [ ] `git diff fb7f916..HEAD -- src/tts/circuitBreaker.ts` is empty
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts
  (especially the serial loop at gtts.ts:202-205 or the 429 tagging at 262-269).
- Implementing the change appears to require modifying
  `src/tts/circuitBreaker.ts`, `fetchChunk`, `fetchChunkOnce`, or `retryAsync`
  — the gTTS failure cooldown (breaker) and per-chunk retry/backoff must not
  be redesigned in this plan.
- Any existing test in `tests/circuitBreaker.test.ts`,
  `tests/integration.pipeline.test.ts`, or `tests/gtts.test.ts` fails in a way
  that is not a pure call-count/ordering expectation adjustment — that means
  failure semantics changed (e.g. a rejection is now swallowed or doubled),
  which would break how the breaker counts gTTS failures.
- You cannot make the "one chunk fails → whole synth rejects with the same
  error" test pass without catching/re-wrapping errors (re-wrapping would
  change the error messages the breaker and logs rely on).

## Maintenance notes

- Concurrency 3 multiplies the _instantaneous_ request rate to Google's
  unofficial endpoint by up to 3 for long messages. If 429s become more
  frequent in production logs (`[gtts] tentativa ... falhou`) or the breaker
  opens more often (`[breaker] 'gtts' ABERTO`), lower `GTTS_CHUNK_CONCURRENCY`
  to 2 or 1 via env — no redeploy of code needed.
- If a future plan adds request pacing/jitter between chunks, it should live
  inside `mapWithConcurrency`'s caller, not in `fetchChunk` (which must stay a
  single-request primitive).
- Reviewer should scrutinize: order preservation of `mp3s` (a swapped chunk
  produces garbled speech, which no test can hear) — the `results[i] = `
  index-assignment is the load-bearing line.
