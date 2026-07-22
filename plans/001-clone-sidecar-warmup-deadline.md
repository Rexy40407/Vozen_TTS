# Plan 001: Add a warmup/ready deadline to the voice-clone sidecar so a wedged sidecar can never stall TTS forever

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat fb7f916..HEAD -- src/tts/cloneEngine.ts tests/cloneEngine.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `fb7f916`, 2026-07-07

## Why this matters

The voice-clone sidecar (`tools/clone_server.py`, driven by `src/tts/cloneEngine.ts`) is sent a `{warmup:true}` message on spawn, and every queued synthesis job waits for the `{ready:true}` reply before being written to the child. There is **no deadline on that reply**: the per-job `SYNTH_TIMEOUT_MS` timer is only armed _after_ the ready gate. If the sidecar process stays alive but never becomes ready (GPU driver hang, model load deadlock, Python wedged), queued jobs stay pending forever, `synth()` never resolves, and — because `src/voice/player.ts` runs a single-worker FIFO per guild — the entire guild's TTS stalls behind the stuck clone request with no recovery and no fallback. A crash of the sidecar is already handled cleanly (child `exit`/`error` → `teardown()` → jobs reject → callers fall back to the normal voice); this plan makes the "alive but never ready" case behave exactly like the crash case, after a generous deadline.

## Current state

- `src/tts/cloneEngine.ts` — the clone engine; wraps the normal TTS engine and talks to the Python sidecar over stdin/stdout JSON lines. All the changes happen here.
- `tests/cloneEngine.test.ts` — existing tests with a `fakeSidecar()` factory (fake child process). Extend this file.
- `src/voice/player.ts` — single-worker FIFO consumer of `synth()`; NOT modified by this plan (context only).

Verified excerpts as of commit `fb7f916`:

`src/tts/cloneEngine.ts:21-22` — the only timeout constant today:

```ts
/** Tempo máximo por síntese clonada (o 1.º pedido carrega o modelo — daí generoso). */
const SYNTH_TIMEOUT_MS = 60_000;
```

`src/tts/cloneEngine.ts:64-70` — constructor (note the injectable `spawnImpl`, the pattern to follow for the new injectable deadline):

```ts
constructor(
  private readonly inner: TTSEngine,
  private readonly cache: AudioCache,
  private readonly cmd: { exe: string; args: string[] } | null,
  // Injeção do spawn para testes (default: child_process.spawn real).
  private readonly spawnImpl: typeof spawn = spawn,
) {}
```

`src/tts/cloneEngine.ts:125-140` — `pump()` returns at the ready gate BEFORE the per-job timer is armed (this is the bug window):

```ts
private pump(): void {
  if (this.active || this.queue.length === 0) return;
  if (!this.ensureChild()) {
    const err = new Error('clone: sidecar indisponível');
    for (const j of this.queue.splice(0)) j.reject(err);
    return;
  }
  if (!this.ready) return; // à espera do warmup; onLine chama pump() quando ready
  const job = this.queue.shift()!;
  this.active = job;
  job.timer = setTimeout(() => {
```

`src/tts/cloneEngine.ts:160-170` — `ensureChild()` writes warmup with no deadline; only exit/error trigger teardown:

```ts
child.on('exit', (code) => {
  log.warn(`[clone] sidecar saiu (code ${code})`);
  this.teardown();
});
child.on('error', (err) => {
  log.warn('[clone] falha no sidecar:', err);
  this.teardown();
});
// Warmup: carrega o modelo já; o onLine liga this.ready e faz pump().
child.stdin!.write(JSON.stringify({ warmup: true }) + '\n');
```

`src/tts/cloneEngine.ts:196-201` — the ready branch of `onLine()` (where the new timer must be cleared):

```ts
if (msg.ready) {
  this.ready = true;
  this.starting = false;
  log.info('[clone] sidecar pronto');
  this.pump();
  return;
}
```

`src/tts/cloneEngine.ts:212-223` — existing `teardown()` (rejects the active job and the whole queue; this is the escape hatch the deadline must trigger):

```ts
private teardown(): void {
  const err = new Error('clone: sidecar morreu');
  this.ready = false;
  this.starting = false;
  this.child = null;
  if (this.active) {
    if (this.active.timer) clearTimeout(this.active.timer);
    this.active.reject(err);
    this.active = null;
  }
  for (const j of this.queue.splice(0)) j.reject(err);
}
```

`src/tts/cloneEngine.ts:225-232` — `restart()` = kill + teardown (use this on deadline expiry so the wedged process is also killed, not just abandoned):

```ts
private restart(): void {
  try {
    this.child?.kill('SIGKILL');
  } catch {
    // já morto
  }
  this.teardown();
}
```

Fallback contract (`src/tts/cloneEngine.ts:101-103`): any rejection from `enqueue` is caught in `synth()` and falls back to `this.inner.synth(req)` — "NUNCA silêncio". The deadline only has to make jobs reject; the fallback already exists.

Repo conventions that apply:

- Code comments are **Portuguese** — write all new comments in Portuguese, matching the tone of the existing ones in this file.
- Test-injectable dependencies are trailing constructor params with production defaults (see `spawnImpl` above and `fetchImpl` in `src/errorReporter.ts:53-56`). Follow the same pattern for the deadline.

## Commands you will need

| Purpose           | Command                                    | Expected on success     |
| ----------------- | ------------------------------------------ | ----------------------- |
| Install           | `npm install`                              | exit 0                  |
| Typecheck         | `npm run build`                            | exit 0 (tsc, no errors) |
| Tests (this file) | `npx vitest run tests/cloneEngine.test.ts` | all pass                |
| Full test suite   | `npx vitest run`                           | all pass                |

(There is no lint script in this repo.)

## Scope

**In scope** (the only files you should modify):

- `src/tts/cloneEngine.ts`
- `tests/cloneEngine.test.ts`

**Out of scope** (do NOT touch, even though they look related):

- `tools/clone_server.py` — the Python sidecar itself; the fix is entirely on the Node side.
- `src/voice/player.ts` — the FIFO stall is a _consequence_; fixing the deadline in the engine resolves it.
- `src/config/index.ts` — do NOT add an env var for the deadline; it is a constructor param with a constant default only.
- `SYNTH_TIMEOUT_MS` and the per-job timeout path — already correct; leave untouched.

## Git workflow

- Branch: `advisor/001-clone-sidecar-warmup-deadline`
- Commit style: conventional-ish Portuguese one-liners, e.g. `fix(clone): deadline no warmup do sidecar — jobs nunca ficam pendurados` (see `git log --oneline -10` for the house style: `fix(clone): voz clonada caía SEMPRE no fallback após /voice clone delete`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the ready-deadline constant and injectable constructor param

In `src/tts/cloneEngine.ts`:

1. Below `SYNTH_TIMEOUT_MS` (line 22), add (comment in Portuguese):

```ts
/**
 * Tempo máximo à espera do {ready} do warmup. O load do modelo em GPU é lento
 * (~35s a frio — ver prewarm()), daí um teto generoso; mas um sidecar vivo que
 * NUNCA fica pronto não pode segurar a fila para sempre.
 */
const READY_TIMEOUT_MS = 120_000;
```

2. Add a trailing constructor param, following the `spawnImpl` pattern:

```ts
constructor(
  private readonly inner: TTSEngine,
  private readonly cache: AudioCache,
  private readonly cmd: { exe: string; args: string[] } | null,
  // Injeção do spawn para testes (default: child_process.spawn real).
  private readonly spawnImpl: typeof spawn = spawn,
  // Deadline do warmup injetável para testes (default: READY_TIMEOUT_MS).
  private readonly readyTimeoutMs: number = READY_TIMEOUT_MS,
) {}
```

3. Add a private field next to the other state fields (`buffer`, `ready`, `starting`):

```ts
private warmupTimer: ReturnType<typeof setTimeout> | null = null;
```

**Verify**: `npm run build` → exit 0.

### Step 2: Arm the deadline in `ensureChild()`, clear it on ready and on teardown

1. In `ensureChild()`, immediately after the line `child.stdin!.write(JSON.stringify({ warmup: true }) + '\n');`, arm the timer (Portuguese comment):

```ts
// Deadline do warmup: um sidecar vivo-mas-nunca-pronto prendia os jobs para
// sempre (o gate !ready em pump() corre ANTES do timer por-job). Expirar =>
// restart(): mata o processo wedged e o teardown rejeita a fila — os chamadores
// caem na voz normal, exatamente como no caminho de crash.
this.warmupTimer = setTimeout(() => {
  this.warmupTimer = null;
  if (this.ready) return; // corrida benigna: ficou pronto entretanto
  log.warn(`[clone] sidecar não ficou pronto em ${this.readyTimeoutMs}ms — a reiniciar`);
  this.restart();
}, this.readyTimeoutMs);
// Não segurar o processo vivo só por causa deste timer (shutdown limpo).
this.warmupTimer.unref?.();
```

Note: `unref` may not exist on the fake timers used in tests — the optional call (`?.()`) keeps both worlds working. If `tsc` complains that `unref` does not exist on the timer type, use `(this.warmupTimer as NodeJS.Timeout).unref?.()`.

2. In `onLine()`, in the `if (msg.ready)` branch, clear the timer before setting `this.ready = true`:

```ts
if (msg.ready) {
  if (this.warmupTimer) {
    clearTimeout(this.warmupTimer);
    this.warmupTimer = null;
  }
  this.ready = true;
  ...
```

3. In `teardown()`, clear the timer as the first action (so a child `exit` during warmup also disarms it, and a stale timer can never fire against a _new_ child spawned later):

```ts
private teardown(): void {
  if (this.warmupTimer) {
    clearTimeout(this.warmupTimer);
    this.warmupTimer = null;
  }
  const err = new Error('clone: sidecar morreu');
  ...
```

**Verify**: `npm run build` → exit 0. Then `npx vitest run tests/cloneEngine.test.ts` → all existing tests still pass (the fake sidecar answers ready via `queueMicrotask`, well within any deadline).

### Step 3: Extend `tests/cloneEngine.test.ts`

The existing `fakeSidecar(behavior)` factory (lines 34-66) handles `'ok' | 'fail' | 'hang'`. Extend it:

1. Add a `'never-ready'` behavior: on `warmup`, do **nothing** (no `{ready}` reply); on job lines, also do nothing. Keep the other behaviors untouched.

2. To assert "no spurious restart", make the factory countable. Suggested shape (adjust to taste, keep comments in Portuguese):

```ts
function fakeSidecar(behavior: 'ok' | 'fail' | 'hang' | 'never-ready' = 'ok', counter?: { spawns: number }) {
  return (() => {
    if (counter) counter.spawns++;
    const child = ... // existing body
    child.stdin = {
      write: (s: string) => {
        const req = JSON.parse(s.trim());
        queueMicrotask(() => {
          if (req.warmup) {
            if (behavior === 'never-ready') return; // wedged: nunca responde {ready}
            child.stdout.emit('data', ...);
            return;
          }
          ...
```

3. Add the two new tests (constructor call passes the injectable deadline as the 5th arg; use a SHORT real deadline — the fake sidecar is microtask-based, so real timers of tens of ms are deterministic enough):

Test (a) — warmup never answered → jobs reject after the deadline and the inner-engine fallback kicks in:

```ts
it('BUG-01: sidecar vivo mas nunca pronto -> deadline expira, job rejeita e cai na voz normal', async () => {
  const eng = new CloneEngine(
    innerReturning('/normal.wav'),
    cache(),
    { exe: 'x', args: [] },
    fakeSidecar('never-ready'),
    30, // deadline curto para o teste
  );
  // Sem deadline isto ficava PENDENTE para sempre (era o bug).
  await expect(eng.synth(REQ({ cloneRef: '/ref.wav' }))).resolves.toBe('/normal.wav');
});
```

Test (b) — ready arrives in time → timer cleared, no spurious teardown/restart:

```ts
it('BUG-01: ready dentro do prazo -> timer limpo, SEM teardown espúrio (1 só spawn)', async () => {
  const counter = { spawns: 0 };
  const eng = new CloneEngine(
    innerReturning('/normal.wav'),
    cache(),
    { exe: 'x', args: [] },
    fakeSidecar('ok', counter),
    50,
  );
  const a = await eng.synth(REQ({ text: 'um', cloneRef: '/ref.wav' }));
  expect(a).not.toBe('/normal.wav'); // veio do clone
  // Espera para lá do deadline: se o timer NÃO tivesse sido limpo, restart()
  // matava o sidecar e o spawn seguinte contava 2.
  await new Promise((r) => setTimeout(r, 80));
  const b = await eng.synth(REQ({ text: 'dois', cloneRef: '/ref.wav' }));
  expect(b).not.toBe('/normal.wav');
  expect(counter.spawns).toBe(1); // nunca reiniciou
});
```

**Verify**: `npx vitest run tests/cloneEngine.test.ts` → all pass, including 2 new tests. Then `npx vitest run` → full suite passes.

## Test plan

- `tests/cloneEngine.test.ts` (extend, model after the existing tests in the same file):
  - never-ready sidecar → `synth()` resolves to the inner engine's output after the injected deadline (the regression this plan fixes).
  - ready-in-time sidecar → clone output served, waiting past the deadline causes no restart (spawn count stays 1).
  - All 6 pre-existing tests in the file keep passing unchanged.
- Verification: `npx vitest run tests/cloneEngine.test.ts` → all pass; `npx vitest run` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run build` exits 0
- [ ] `npx vitest run` exits 0; the 2 new BUG-01 tests exist in `tests/cloneEngine.test.ts` and pass
- [ ] `grep -n "warmupTimer" src/tts/cloneEngine.ts` shows the field, the arm site (ensureChild), and BOTH clear sites (onLine ready branch, teardown)
- [ ] `grep -n "readyTimeoutMs" src/tts/cloneEngine.ts` shows the constructor param with default `READY_TIMEOUT_MS`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts in "Current state" don't match `src/tts/cloneEngine.ts` at the cited lines (codebase drifted).
- The existing 6 tests in `tests/cloneEngine.test.ts` fail after Step 2 with no test changes — that means the deadline broke the happy path (e.g. the timer fires before the microtask-based fake answers), and the design needs review rather than tweaks.
- You find any OTHER call site constructing `CloneEngine` with positional args beyond `spawnImpl` (check with `grep -rn "new CloneEngine" src/ tests/`) — the new 5th param must stay backward-compatible; if something already occupies that position, stop.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- If the sidecar model load ever gets slower than ~2 minutes (bigger model), `READY_TIMEOUT_MS` must be raised — the log line `[clone] sidecar não ficou pronto em ...ms` firing on healthy startups is the symptom.
- Reviewer should scrutinize: the timer is cleared in **both** `onLine` (ready) and `teardown` — a missed clear either leaks a timer that kills a healthy new child, or leaves a wedged child alive.
- Deferred on purpose: making the deadline env-configurable (no operator need today), and any watchdog for a sidecar that goes ready and _then_ wedges mid-job (already covered by `SYNTH_TIMEOUT_MS`).
