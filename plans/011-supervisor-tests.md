# Plan 011: Extract the production supervisor's decision logic and put it under test

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat fb7f916..HEAD -- scripts/start-prod.mjs tests/startProd.test.ts scripts/supervisorPolicy.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (touches the production supervisor; refactor must be strictly behavior-preserving)
- **Depends on**: none (see Maintenance notes for interaction with plan 005)
- **Category**: tests
- **Planned at**: commit `fb7f916`, 2026-07-07

## Why this matters

`scripts/start-prod.mjs` (216 lines) is the production supervisor: single-instance lock, native-module preheat with retries, auto-restart with exponential backoff, stop-on-clean-exit, log rotation, signal forwarding. It encodes hard-won incident fixes (the "5 accumulated instances" incident, the delayed-reset-timer backoff bug documented at lines 142-146) — and has **zero tests**. Any edit to it is a blind edit to the most safety-critical script in the repo. This plan extracts the pure decision logic (backoff schedule, exit-code classification, preheat retry policy) into a sibling module and covers it with vitest, without changing runtime behavior.

## Current state

- `scripts/start-prod.mjs` — plain Node ESM, run directly by `node` via `"start:prod": "npm run build && node scripts/start-prod.mjs"` (`package.json:11`). It is NOT part of the TypeScript build (header comment line 14: "Puro Node ESM; NÃO faz parte do build TypeScript."). All comments in Portuguese — keep new comments in Portuguese.

  The decision logic to extract, verbatim as it exists today:

  Exit classification + backoff (`scripts/start-prod.mjs:141-161`):

  ```js
  child.on('exit', (code, signal) => {
    if (currentChild === child) currentChild = null;
    // [comment about clearing the reset timer — lines 143-146]
    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }
    if (stopping) return;
    if (code === 0) {
      log('bot terminou de forma limpa (código 0) — não reinicio.');
      return;
    }
    // Backoff exponencial limitado a 60s.
    const delayMs = Math.min(60000, 2000 * 2 ** attempt);
    attempt++;
    log(
      `bot caiu (código ${code ?? 'null'}, sinal ${signal ?? 'null'}) — reinício #${attempt} em ${delayMs / 1000}s.`,
    );
    setTimeout(startOnce, delayMs);
  });
  ```

  Backoff reset after stable uptime — CONFIRMED present (`scripts/start-prod.mjs:163-168`):

  ```js
  // Um arranque que dure >60s conta como saudável → limpa o backoff. ...
  resetTimer = setTimeout(() => {
    resetTimer = null;
    if (!stopping) attempt = 0;
  }, 60000);
  ```

  Preheat retry loop (`scripts/start-prod.mjs:101-118`):

  ```js
  /** Pré-aquece o davey até carregar OK (anti-Smart App Control). */
  function prewarmDavey() {
    for (let i = 1; i <= 5; i++) {
      const r = spawnSync(process.execPath, ['-e', "require('@snazzah/davey')"], {
        cwd: ROOT,
        stdio: 'ignore',
      });
      if (r.status === 0) {
        log(`voz (davey) pronta (tentativa ${i}).`);
        return true;
      }
      log(`davey bloqueado/indisponível (tentativa ${i}/5) — a repetir…`);
    }
    log('AVISO: davey não carregou em 5 tentativas. Pode ser bloqueio persistente do');
    log('Smart App Control. Arranco na mesma; se o bot crashar no arranque com');
    log('ERR_DLOPEN_FAILED, vê docs/HOSPEDAR.md (secção Smart App Control).');
    return false;
  }
  ```

  Also present but NOT extracted (stays in start-prod.mjs, out of the pure module): single-instance lock via loopback port (lines 67-99, network side effect), log-file rotation (lines 29-57, fs side effect), signal forwarding with 8s SIGKILL timeout (lines 177-209, process side effect).

- `scripts/supervisorPolicy.mjs`, `scripts/supervisorPolicy.d.mts`, `tests/startProd.test.ts` — none exist yet (verified).
- `vitest.config.ts` includes `tests/**/*.test.ts`; tests import non-test code via plain relative imports (e.g. `tests/playerCrossKill.test.ts:68`: `import { GuildVoicePlayer } from '../src/voice/player';`). There is no precedent for importing an `.mjs` from a test, but vitest resolves ESM `.mjs` relative imports natively — the `.d.mts` file in Step 2 exists to keep `tsc` happy if/when plan 005's typecheck gate lands.
- There is NO safe way to smoke-run the full supervisor here: `node scripts/start-prod.mjs` immediately spawns `dist/index.js`, which needs a real Discord token and would crash-loop with backoff. Verification is therefore vitest + `node --check` + a pure import smoke of the policy module only (see Test plan).

## Commands you will need

| Purpose      | Command                                                                                                    | Expected on success                            |
| ------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Install      | `npm install`                                                                                              | exit 0                                         |
| Build        | `npm run build`                                                                                            | exit 0 (unaffected — scripts/ not in tsconfig) |
| Tests        | `npx vitest run tests/startProd.test.ts`                                                                   | new tests pass                                 |
| Full suite   | `npx vitest run`                                                                                           | all pass                                       |
| Syntax check | `node --check scripts/start-prod.mjs` and `node --check scripts/supervisorPolicy.mjs`                      | no output, exit 0                              |
| Import smoke | `node -e "import('./scripts/supervisorPolicy.mjs').then(m=>console.log(Object.keys(m).sort().join(',')))"` | prints the export names                        |

## Scope

**In scope** (the only files you should create/modify):

- `scripts/supervisorPolicy.mjs` (create)
- `scripts/supervisorPolicy.d.mts` (create — type declarations for the test import)
- `scripts/start-prod.mjs` (rewire to use the policy module; no behavior change)
- `tests/startProd.test.ts` (create)

**Out of scope** (do NOT touch):

- The single-instance lock, log rotation, and signal-forwarding blocks of `start-prod.mjs` — they stay exactly as they are (side-effectful, incident-hardened; extracting them is not worth the risk here).
- `package.json` scripts — `start:prod` must keep working unchanged.
- Anything under `src/` — the supervisor is deliberately outside the TS build.
- Log message TEXT — every log line the supervisor emits must remain byte-identical (operators grep these).

## Git workflow

- Branch: `advisor/011-supervisor-tests`
- Commit style: PT one-liner, e.g. `test(supervisor): extrai política pura (backoff/exit/preheat) e cobre com vitest`
- Suggested split: commit 1 = new policy module + rewire; commit 2 = tests. (Or one commit; both acceptable.)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `scripts/supervisorPolicy.mjs`

Pure decision logic only — no imports of `node:child_process`, `node:fs`, `node:net`, no timers. Portuguese comments. Target shape:

```js
// scripts/supervisorPolicy.mjs — política PURA do supervisor (start-prod.mjs).
// Extraída para ser testável em vitest sem processos reais. NÃO importa nada
// com efeitos secundários; o start-prod.mjs injeta spawn/log.

export const BACKOFF_BASE_MS = 2000;
export const BACKOFF_MAX_MS = 60000;
export const STABLE_RESET_MS = 60000;
export const PREWARM_MAX_TRIES = 5;

/** Delay do reinício N (attempt começa em 0): 2s→4s→…→60s (limitado). */
export function backoffDelayMs(attempt) {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempt);
}

/**
 * Decide o que fazer quando o bot termina.
 * Espelha 1:1 o handler original: stopping → ignorar; código 0 → parar de vez;
 * caso contrário → reiniciar com backoff (delay do attempt ATUAL, attempt+1 a seguir).
 */
export function decideOnExit(code, stopping, attempt) {
  if (stopping) return { action: 'ignore' };
  if (code === 0) return { action: 'stop' };
  return { action: 'restart', delayMs: backoffDelayMs(attempt), nextAttempt: attempt + 1 };
}

/**
 * Loop de pré-aquecimento do módulo nativo, com o "carregar uma vez" INJETADO
 * (tryLoad devolve true quando o load teve sucesso). Mensagens idênticas às originais.
 */
export function prewarmNative(tryLoad, log, maxTries = PREWARM_MAX_TRIES) {
  for (let i = 1; i <= maxTries; i++) {
    if (tryLoad()) {
      log(`voz (davey) pronta (tentativa ${i}).`);
      return true;
    }
    log(`davey bloqueado/indisponível (tentativa ${i}/${maxTries}) — a repetir…`);
  }
  log('AVISO: davey não carregou em 5 tentativas. Pode ser bloqueio persistente do');
  log('Smart App Control. Arranco na mesma; se o bot crashar no arranque com');
  log('ERR_DLOPEN_FAILED, vê docs/HOSPEDAR.md (secção Smart App Control).');
  return false;
}
```

Note the retry message interpolates `${maxTries}` where the original hardcoded `5` — with the default `maxTries = 5` the output is byte-identical. The final warning keeps the literal "5 tentativas" (matches the default; acceptable because start-prod always uses the default).

**Verify**: `node --check scripts/supervisorPolicy.mjs` → exit 0; import smoke command (see table) → prints `BACKOFF_BASE_MS,BACKOFF_MAX_MS,PREWARM_MAX_TRIES,STABLE_RESET_MS,backoffDelayMs,decideOnExit,prewarmNative`.

### Step 2: Create `scripts/supervisorPolicy.d.mts`

So that `tests/startProd.test.ts` type-checks under `tsc` (plan 005 adds that gate; this file is harmless if 005 hasn't landed):

```ts
// scripts/supervisorPolicy.d.mts — tipos para o import em tests/startProd.test.ts.
export declare const BACKOFF_BASE_MS: number;
export declare const BACKOFF_MAX_MS: number;
export declare const STABLE_RESET_MS: number;
export declare const PREWARM_MAX_TRIES: number;
export declare function backoffDelayMs(attempt: number): number;
export type ExitDecision =
  | { action: 'ignore' }
  | { action: 'stop' }
  | { action: 'restart'; delayMs: number; nextAttempt: number };
export declare function decideOnExit(
  code: number | null,
  stopping: boolean,
  attempt: number,
): ExitDecision;
export declare function prewarmNative(
  tryLoad: () => boolean,
  log: (m: string) => void,
  maxTries?: number,
): boolean;
```

**Verify**: file exists; if plan 005 already landed, `npm run typecheck` still exits 0 (the `.d.mts` sits outside `tests/**` and `src/**` includes, so it's only pulled in via the import — that's the point).

### Step 3: Rewire `scripts/start-prod.mjs` (behavior-preserving)

1. Add the import near the other imports (line ~16-20):
   ```js
   import { decideOnExit, prewarmNative, STABLE_RESET_MS } from './supervisorPolicy.mjs';
   ```
2. Replace the BODY of `prewarmDavey()` (lines 101-118) with a thin wrapper that injects the real spawnSync — the exported name and call site (line 214 `prewarmDavey();`) stay:
   ```js
   /** Pré-aquece o davey até carregar OK (anti-Smart App Control). */
   function prewarmDavey() {
     const tryLoad = () =>
       spawnSync(process.execPath, ['-e', "require('@snazzah/davey')"], {
         cwd: ROOT,
         stdio: 'ignore',
       }).status === 0;
     return prewarmNative(tryLoad, log);
   }
   ```
3. In the `child.on('exit', ...)` handler (lines 141-161), replace ONLY the block from `if (stopping) return;` through `setTimeout(startOnce, delayMs);` with:
   ```js
   const d = decideOnExit(code, stopping, attempt);
   if (d.action === 'ignore') return;
   if (d.action === 'stop') {
     log('bot terminou de forma limpa (código 0) — não reinicio.');
     return;
   }
   attempt = d.nextAttempt;
   log(
     `bot caiu (código ${code ?? 'null'}, sinal ${signal ?? 'null'}) — reinício #${attempt} em ${d.delayMs / 1000}s.`,
   );
   setTimeout(startOnce, d.delayMs);
   ```
   This is 1:1: the original computed `delayMs` from the pre-increment `attempt` and logged the post-increment value — `decideOnExit` reproduces exactly that (`delayMs` from current attempt, `nextAttempt = attempt + 1`, and the log prints `#${attempt}` AFTER the assignment). The `currentChild`/`resetTimer` cleanup lines above it stay untouched.
4. Replace the literal `60000` in the reset timer (line 168) with `STABLE_RESET_MS` — value identical.

Do not change anything else: shebang-less header, lock, logging, signals all untouched.

**Verify**:

- `node --check scripts/start-prod.mjs` → exit 0.
- `git diff scripts/start-prod.mjs` — confirm the diff touches only: the import line, the `prewarmDavey` body, the exit-decision block, the reset-timer constant. No log string changed (inspect the diff: every removed log line reappears verbatim).

### Step 4: Write `tests/startProd.test.ts`

Import via relative path — vitest resolves `.mjs` natively:

```ts
import { describe, it, expect, vi } from 'vitest';
import {
  backoffDelayMs,
  decideOnExit,
  prewarmNative,
  PREWARM_MAX_TRIES,
} from '../scripts/supervisorPolicy.mjs';
```

Cover exactly these cases (see Test plan for the full list): the backoff sequence, stop on clean exit, restart on crash with correct delay/attempt, ignore while stopping, preheat success/retry-cap. File header comment in Portuguese, following the style of e.g. `tests/playerCrossKill.test.ts:1-2`.

**Verify**: `npx vitest run tests/startProd.test.ts` → all new tests pass.

### Step 5: Full gate

**Verify**:

- `npx vitest run` → entire suite passes (previous count + new tests).
- `npm run build` → exit 0 (scripts/ is outside the TS build; this proves no accidental spillover).
- If `npm run typecheck` exists (plan 005 landed): exit 0.

## Test plan

New file `tests/startProd.test.ts`, structural pattern: plain function-level tests (no mocks of `@discordjs/voice` needed here); model the header/comment style on `tests/playerCrossKill.test.ts`.

Cases (all must be present):

1. **Backoff sequence values**: `[0,1,2,3,4,5,6].map(backoffDelayMs)` → `[2000, 4000, 8000, 16000, 32000, 60000, 60000]` (doubles from 2s, caps at 60s).
2. **Stop on clean exit**: `decideOnExit(0, false, 3)` → `{ action: 'stop' }` (attempt irrelevant).
3. **Restart on crash**: `decideOnExit(1, false, 0)` → `{ action: 'restart', delayMs: 2000, nextAttempt: 1 }`; and `decideOnExit(null, false, 2)` → `{ action: 'restart', delayMs: 8000, nextAttempt: 3 }` (a `null` code — killed by signal — restarts, mirroring the original `code === 0` check).
4. **Ignore while stopping**: `decideOnExit(1, true, 0)` → `{ action: 'ignore' }` and `decideOnExit(0, true, 0)` → `{ action: 'ignore' }`.
5. **Preheat succeeds mid-way**: `tryLoad` = `vi.fn()` failing twice then succeeding → `prewarmNative(tryLoad, log)` returns `true`, `tryLoad` called exactly 3 times, last log line matches `/pronta \(tentativa 3\)/`.
6. **Preheat retry cap**: `tryLoad` always false → returns `false`, called exactly `PREWARM_MAX_TRIES` (5) times, and the collected log lines include the `AVISO:` warning.

Verification: `npx vitest run tests/startProd.test.ts` → 6+ tests pass; `npx vitest run` → full suite green.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `scripts/supervisorPolicy.mjs` and `scripts/supervisorPolicy.d.mts` exist
- [ ] `tests/startProd.test.ts` exists and covers the 6 cases above
- [ ] `npx vitest run` exits 0
- [ ] `npm run build` exits 0
- [ ] `node --check scripts/start-prod.mjs` and `node --check scripts/supervisorPolicy.mjs` exit 0
- [ ] Import smoke prints the 7 export names
- [ ] `git diff fb7f916..HEAD -- scripts/start-prod.mjs` contains NO changed log-string literal (every log message present before is present after, byte-identical)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `scripts/start-prod.mjs` no longer matches the excerpts in "Current state" (especially lines 101-118, 141-168) — the 1:1 extraction recipe depends on them.
- Preserving behavior would require changing any log message text or the order of operations around `attempt`/`resetTimer`.
- vitest fails to import `../scripts/supervisorPolicy.mjs` (resolution error) after one reasonable config-free fix attempt — do NOT modify `vitest.config.ts` to force it; report instead.
- You find yourself wanting to extract the lock/signal/log-rotation code "while you're here" — explicitly out of scope.

## Maintenance notes

- **Manual smoke deferred**: no automated end-to-end run of the supervisor exists (it needs a real token). The operator should run `npm run start:prod` once after this lands, watch for the usual `[start-prod]` startup lines, and Ctrl-C to confirm clean shutdown — the log lines must look exactly as before.
- Interaction with plan 005: the `.d.mts` file exists so `npm run typecheck` (if present) accepts the `.mjs` import. If the policy module's exports change, update the `.d.mts` in the same commit.
- Reviewer focus: the `git diff` of `start-prod.mjs` — it must read as a pure mechanical rewire; any logic-looking change is a red flag. Also check `decideOnExit` restart math against the original (`delayMs` from pre-increment attempt, log shows post-increment).
- Deferred: testing the restart LOOP with fake timers and an injected `spawn` (a `createSupervisor({ spawn, setTimeout })` factory). Worth doing later; this plan deliberately stops at the pure policy layer to keep the production diff minimal.
