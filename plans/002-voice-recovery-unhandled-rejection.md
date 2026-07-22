# Plan 002: Stop the voice soft-recovery race from emitting spurious unhandledRejection reports

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat fb7f916..HEAD -- src/voice/player.ts src/voice/raceStates.ts tests/raceStates.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `fb7f916`, 2026-07-07

## Why this matters

When a voice connection drops, `GuildVoicePlayer.handleDisconnect()` races two `entersState(...)` promises (Signalling vs Connecting, 5s each). `Promise.race` settles with the first one, but the **losing** promise keeps running; when it later rejects (its 5s timeout fires), nothing has a handler attached — Node emits `unhandledRejection`. The global handler in `src/bot/client.ts:187-190` logs it as an error and forwards it to the operator's error webhook. Result: every failed (or partially failed) soft-recovery produces a spurious "error" report that looks like a bug but is expected behavior, training the operator to ignore the webhook. The fix is a zero-behavior-change: swallow the loser's rejection while keeping the race's own resolution/rejection semantics intact.

## Current state

- `src/voice/player.ts` — the guild voice player; contains the offending race in `handleDisconnect()` (lines 302-305).
- `src/bot/client.ts` — global `unhandledRejection` handler that forwards to the error webhook (context only; NOT modified).
- `src/voice/raceStates.ts` — does not exist yet; this plan creates it.
- `tests/raceStates.test.ts` — does not exist yet; this plan creates it.

Verified excerpts as of commit `fb7f916`:

`src/voice/player.ts:300-309` — the race (inside `handleDisconnect()`):

```ts
try {
  // Reconexao "soft": o gateway esta a renegociar a sessao de voz.
  await Promise.race([
    entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
    entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
  ]);
  // Recuperou — esperar que volte a Ready.
  await entersState(this.connection, VoiceConnectionStatus.Ready, 20_000);
  metrics.inc('voiceReconnects');
} catch {
```

`src/bot/client.ts:187-190` — where the loser's rejection ends up today:

```ts
process.on('unhandledRejection', (reason) => {
  log.error('[process] unhandledRejection', reason);
  void errorReporter.report(reason, 'unhandledRejection');
});
```

`src/voice/player.ts:1-11` — imports (for orientation; `entersState` comes from `@discordjs/voice`):

```ts
import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  StreamType,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
} from '@discordjs/voice';
```

Why the helper-extraction approach (not a direct inline `.catch()` only): unit-testing `entersState` on a real discord.js connection is not feasible cheaply, and the existing player tests (`tests/playerReconnect.test.ts`) mock `@discordjs/voice` entirely via `vi.mock`. Extracting the race into a tiny pure helper lets us unit-test the "no unhandledRejection" property directly with plain promises, with no discord.js involved. The player tests then cover the integration path unchanged.

Repo conventions that apply:

- Code comments are **Portuguese** — write new comments in Portuguese.
- Small pure, dependency-free modules with their own test file are the house pattern (e.g. `src/vote.ts` pure handler + `tests/vote.test.ts`).

## Commands you will need

| Purpose      | Command                                        | Expected on success |
| ------------ | ---------------------------------------------- | ------------------- |
| Install      | `npm install`                                  | exit 0              |
| Typecheck    | `npm run build`                                | exit 0 (tsc)        |
| New tests    | `npx vitest run tests/raceStates.test.ts`      | all pass            |
| Player tests | `npx vitest run tests/playerReconnect.test.ts` | all pass            |
| Full suite   | `npx vitest run`                               | all pass            |

(There is no lint script in this repo.)

## Scope

**In scope** (the only files you should modify/create):

- `src/voice/raceStates.ts` (create)
- `src/voice/player.ts` (replace the `Promise.race` at lines 302-305 with the helper; no other change)
- `tests/raceStates.test.ts` (create)

**Out of scope** (do NOT touch, even though they look related):

- `src/bot/client.ts` — the global handler is correct; the fix is at the source.
- `tests/playerReconnect.test.ts` — must keep passing UNCHANGED (that is part of the "zero behavior change" proof).
- The `await entersState(..., Ready, 20_000)` at player.ts:307 and the ones in `tryRejoin` — single awaits, no race, no orphan rejection; leave them alone.
- Any timeout value or reconnection logic change.

## Git workflow

- Branch: `advisor/002-voice-recovery-unhandled-rejection`
- Commit style: conventional-ish Portuguese one-liners, e.g. `fix(voice): race da recuperação soft já não vaza unhandledRejection para o webhook` (match `git log --oneline` style).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `src/voice/raceStates.ts`

New file, dependency-free (only types), comments in Portuguese:

```ts
// src/voice/raceStates.ts
//
// Promise.race "arrumado": o Promise.race nativo fica resolvido com a PRIMEIRA
// promessa a assentar, mas as PERDEDORAS continuam vivas — quando uma perdedora
// rejeita mais tarde (ex.: o timeout do entersState perdedor a disparar), ninguém
// tem handler nela e o Node emite unhandledRejection. No Vozen isso ia parar ao
// webhook de erros (src/bot/client.ts) como um falso alarme em CADA recuperação
// soft falhada. Este helper anexa um catch no-op a cada concorrente (marca a
// rejeição como tratada) e devolve o race normal — semântica idêntica:
// resolve/rejeita com a primeira a assentar.

export function raceStates<T>(promises: readonly Promise<T>[]): Promise<T> {
  for (const p of promises) {
    // no-op: só marca a promessa como "handled"; não altera o resultado do race
    p.catch(() => {});
  }
  return Promise.race(promises);
}
```

**Verify**: `npm run build` → exit 0.

### Step 2: Use the helper in `handleDisconnect()`

In `src/voice/player.ts`:

1. Add the import (after the existing imports, near `import { PlayQueue } from './queue';`):

```ts
import { raceStates } from './raceStates';
```

2. Replace exactly lines 302-305:

```ts
await Promise.race([
  entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
  entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
]);
```

with:

```ts
// raceStates (e não Promise.race): o entersState PERDEDOR rejeita mais tarde
// e sem handler gerava um unhandledRejection espúrio no webhook de erros.
await raceStates([
  entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
  entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
]);
```

Behavior notes (do not deviate): if BOTH reject, `raceStates` rejects with the first rejection — the surrounding `catch` at player.ts:309 still enters and `tryRejoin` still runs, exactly as today.

**Verify**: `npm run build` → exit 0. Then `npx vitest run tests/playerReconnect.test.ts` → both existing tests pass UNCHANGED.

### Step 3: Create `tests/raceStates.test.ts`

Unit tests with plain promises — no discord.js, no mocks of `@discordjs/voice`. Listen for real `unhandledRejection` events on the process to prove the property. Suggested content (comments in Portuguese):

```ts
import { describe, it, expect } from 'vitest';
import { raceStates } from '../src/voice/raceStates';

/** Espera N ms (para dar tempo à perdedora de rejeitar e ao Node de emitir o evento). */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('raceStates — Promise.race sem unhandledRejection da perdedora', () => {
  it('resolve com o vencedor; a perdedora a rejeitar DEPOIS não emite unhandledRejection', async () => {
    const seen: unknown[] = [];
    const onUnhandled = (reason: unknown) => seen.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      const winner = Promise.resolve('ok');
      const loser = new Promise<string>((_, rej) =>
        setTimeout(() => rej(new Error('perdedora tardia')), 10),
      );
      await expect(raceStates([winner, loser])).resolves.toBe('ok');
      // Janela para a perdedora rejeitar e o Node processar a fila de rejeições.
      await sleep(50);
      expect(seen).toEqual([]); // era aqui que o bug aparecia
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('todas rejeitam -> rejeita com a primeira (semântica do race preservada)', async () => {
    const a = new Promise<string>((_, rej) => setTimeout(() => rej(new Error('a')), 5));
    const b = new Promise<string>((_, rej) => setTimeout(() => rej(new Error('b')), 15));
    await expect(raceStates([a, b])).rejects.toThrow('a');
    await sleep(30); // b rejeita depois — também não pode vazar
  });

  it('propaga o valor de resolução tal e qual', async () => {
    await expect(raceStates([Promise.resolve(42)])).resolves.toBe(42);
  });
});
```

Caveat: if the first test proves flaky because vitest intercepts `unhandledRejection` before the listener (vitest normally _fails_ a test file on unhandled rejections — which means simply having the second test pass without the file erroring is itself evidence), keep the structure but rely on vitest's own unhandled-rejection failure as the assertion: with the helper in place the file passes; with plain `Promise.race` it would be flagged. Note this in a Portuguese comment if you go that route.

**Verify**: `npx vitest run tests/raceStates.test.ts` → all pass.

## Test plan

- New file `tests/raceStates.test.ts` (cases listed in Step 3): winner resolves + late loser rejection leaks nothing; all-reject propagates first rejection; resolution value passthrough. Model the file header/comment style on `tests/vote.test.ts`.
- Regression safety: `tests/playerReconnect.test.ts` (soft-recovery failure path through the race → catch → tryRejoin) passes without modification.
- Verification: `npx vitest run tests/raceStates.test.ts tests/playerReconnect.test.ts` → all pass; then `npx vitest run` → full suite passes.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run build` exits 0
- [ ] `npx vitest run` exits 0; `tests/raceStates.test.ts` exists with ≥3 passing tests
- [ ] `grep -n "Promise.race" src/voice/player.ts` returns no matches (the only one was replaced)
- [ ] `grep -n "raceStates" src/voice/player.ts` shows the import and the call site in handleDisconnect
- [ ] `git diff fb7f916..HEAD -- tests/playerReconnect.test.ts` is empty (zero behavior change proof)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `src/voice/player.ts:302-305` does not match the excerpt above (drift).
- `tests/playerReconnect.test.ts` fails after Step 2 — the helper changed race semantics; do not patch the test, report.
- You are tempted to modify `src/bot/client.ts` or add filtering to the error reporter to silence the report instead — that is the wrong layer; stop and report.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Any future `Promise.race` over `entersState` (or any rejecting promises) in this codebase should use `raceStates` — a reviewer should grep for new `Promise.race` uses in voice code.
- Reviewer should scrutinize: the no-op `.catch` is attached to the ORIGINAL promises and the race is over the ORIGINALS (not over the `.catch(...)` results — racing those would swallow the winner's rejection too and break the catch path in `handleDisconnect`).
- Deferred on purpose: an AbortController-based cancellation of the loser (discord.js `entersState` accepts no signal in the version used here; the no-op catch is sufficient and simpler).
