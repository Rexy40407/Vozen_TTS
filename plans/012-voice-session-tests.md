# Plan 012: Test createVoiceSession's identity-aware onIdle guard directly

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat fb7f916..HEAD -- src/voice/session.ts src/bot/deps.ts tests/voiceSession.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (test-only; no production code changes)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `fb7f916`, 2026-07-07

## Why this matters

`src/voice/session.ts` is the single source of the voice-session creation logic, shared by `/join` and autojoin. Its most subtle piece is the identity-aware `onIdle` guard: a STALE idle callback from a replaced player must NOT tear down its REPLACEMENT (a variant of the cross-player-kill incident, P19.B). Today no test exercises this module's real code: the only test that references it (`tests/messageHandlerAutojoin.test.ts:9-12`) mocks the whole module away, and `tests/playerCrossKill.test.ts:154-177` tests a hand-written REPLICA of the closure, not the one `createVoiceSession` actually builds. If someone "simplifies" the guard away, no test fails. This plan adds a direct unit test of the real closure.

## Current state

- `src/voice/session.ts` — 73 lines, the module under test. The factory and the guard, verbatim (`src/voice/session.ts:45-72`):

  ```ts
  export function createVoiceSession(
    deps: BotDeps,
    guildId: string,
    channelId: string,
    adapterCreator: DiscordGatewayAdapterCreator,
  ): GuildVoicePlayer {
    removePlayer(deps, guildId);
    const connection = joinVoiceChannel({
      channelId,
      guildId,
      adapterCreator,
      selfDeaf: true,
      selfMute: false,
    });
    const player = new GuildVoicePlayer(
      connection,
      deps.engine,
      deps.config.queueCap,
      deps.config.inactivityMs,
      () => {
        if (deps.players.get(guildId) !== player) return;
        removePlayer(deps, guildId);
        getVoiceConnection(guildId)?.destroy();
      },
    );
    deps.players.set(guildId, player);
    return player;
  }
  ```

  The guard is the line `if (deps.players.get(guildId) !== player) return;` — the onIdle closure of a player that is no longer the registered one becomes a no-op.

- Also exported from the same file (`src/voice/session.ts:26-36`): `becomeSpeakerIfStage(channel)` — returns immediately when `channel.type !== ChannelType.GuildStageVoice`; only for stage channels does it touch `channel.guild?.members?.me?.voice`.
- `src/bot/deps.ts:46-69` — the REAL `removePlayer` (used by the closure): clears `aloneWatcher`/`games`/`lastSpeaker` if present (all optional), then `p.destroy(); deps.players.delete(guildId)`. The test uses this real function transitively — so the fake player must have a `destroy()` method.
- `GuildVoicePlayer` constructor signature (`src/voice/player.ts:36-42`): `(connection, engine, queueCap, inactivityMs, onIdle)` — onIdle is the 5th argument.
- Existing mock pattern for `@discordjs/voice` — 30 test files already mock it; the closest exemplar for this plan is `tests/commandsJoin.test.ts:4-30`:

  ```ts
  const joinVoiceChannel = vi.fn();
  const getVoiceConnection = vi.fn();
  vi.mock('@discordjs/voice', async () => {
    ...
    return {
      joinVoiceChannel: (...args: unknown[]) => joinVoiceChannel(...args),
      getVoiceConnection: (...args: unknown[]) => getVoiceConnection(...args),
      ...
    };
  });
  ```

  (That file also fakes `createAudioPlayer` etc. because it constructs the REAL `GuildVoicePlayer`. This plan instead mocks `../src/voice/player`, so only `joinVoiceChannel` + `getVoiceConnection` are needed in the `@discordjs/voice` mock — `DiscordGatewayAdapterCreator` is a type-only import and erases.)

- `tests/messageHandlerAutojoin.test.ts:9-12` — the existing full-module mock, quoted so you don't duplicate its coverage:

  ```ts
  vi.mock('../src/voice/session', () => ({
    createVoiceSession: vi.fn(),
    becomeSpeakerIfStage: vi.fn(),
  }));
  ```

- Repo conventions: vitest, flat test files in `tests/`, header comment in Portuguese explaining the scenario (see `tests/playerCrossKill.test.ts:1-24` for the tone). New comments must be in Portuguese.

## Commands you will need

| Purpose       | Command                                     | Expected on success              |
| ------------- | ------------------------------------------- | -------------------------------- |
| Install       | `npm install`                               | exit 0                           |
| New test only | `npx vitest run tests/voiceSession.test.ts` | all pass                         |
| Full suite    | `npx vitest run`                            | all pass                         |
| Build         | `npm run build`                             | exit 0 (nothing in src/ changed) |

## Scope

**In scope** (the only file you should create/modify):

- `tests/voiceSession.test.ts` (create)

**Out of scope** (do NOT touch):

- `src/voice/session.ts` — this plan TESTS it; if the test reveals a genuine bug, that's a STOP-and-report, not a fix here.
- `src/bot/deps.ts`, `src/voice/player.ts` — used as-is.
- `tests/messageHandlerAutojoin.test.ts`, `tests/playerCrossKill.test.ts` — their coverage is complementary; don't refactor them.

## Git workflow

- Branch: `advisor/012-voice-session-tests`
- Commit style: PT one-liner, e.g. `test(voice): cobre o guard identity-aware do onIdle em createVoiceSession`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `tests/voiceSession.test.ts` — scaffolding and mocks

Two mocks, both declared BEFORE importing the module under test (vitest hoists `vi.mock`; use `vi.hoisted` for shared state, as `tests/playerCrossKill.test.ts:28` does):

1. **`@discordjs/voice`** — only what `session.ts` calls at runtime:
   ```ts
   const h = vi.hoisted(() => ({
     joinVoiceChannel: vi.fn(() => ({ fake: 'connection' })),
     connDestroy: vi.fn(),
   }));
   vi.mock('@discordjs/voice', () => ({
     joinVoiceChannel: (...args: unknown[]) => h.joinVoiceChannel(...args),
     getVoiceConnection: () => ({ destroy: h.connDestroy }),
   }));
   ```
2. **`../src/voice/player`** — a fake class that CAPTURES the onIdle closure (5th ctor arg) and exposes a `destroy` spy (the real `removePlayer` calls it):
   ```ts
   const captured = vi.hoisted(() => ({ players: [] as any[] }));
   vi.mock('../src/voice/player', () => ({
     GuildVoicePlayer: class {
       onIdle: () => void;
       destroy = vi.fn();
       constructor(
         _conn: unknown,
         _engine: unknown,
         _cap: number,
         _idleMs: number,
         onIdle: () => void,
       ) {
         this.onIdle = onIdle;
         captured.players.push(this);
       }
     },
   }));
   ```

Then import the real module under test and the real deps helpers:

```ts
import { createVoiceSession, becomeSpeakerIfStage } from '../src/voice/session';
import type { BotDeps } from '../src/bot/deps';
```

Minimal deps factory (only the fields `createVoiceSession` and `removePlayer` touch — `players`, `engine`, `config.queueCap`, `config.inactivityMs`; the optional `aloneWatcher`/`games`/`lastSpeaker` may be omitted, `removePlayer` guards them with `?.`):

```ts
function makeDeps(): BotDeps {
  return {
    players: new Map(),
    engine: {},
    config: { queueCap: 20, inactivityMs: 1000 },
  } as unknown as BotDeps;
}
```

Add a `beforeEach` that resets `captured.players.length = 0` and clears the spies. Header comment in Portuguese stating the scenario (stale onIdle must not tear down the replacement — P19.B at the createVoiceSession level).

**Verify**: `npx vitest run tests/voiceSession.test.ts` → file loads and any placeholder test passes (no import/hoisting errors).

### Step 2: Test (a) — normal idle tears down the session

- `const deps = makeDeps(); const player = createVoiceSession(deps, 'G', 'C', {} as any);`
- Assert setup: `deps.players.get('G')` is `player`; `h.joinVoiceChannel` called once with `{ channelId: 'C', guildId: 'G', adapterCreator: {}, selfDeaf: true, selfMute: false }`.
- Fire the captured closure: `(player as any).onIdle()`.
- Assert teardown: `deps.players.has('G')` is `false`; `(player as any).destroy` was called (via the real `removePlayer`); `h.connDestroy` was called once (the `getVoiceConnection(guildId)?.destroy()` line ran).

**Verify**: `npx vitest run tests/voiceSession.test.ts` → passes.

### Step 3: Test (b) — the identity guard: a stale onIdle must NOT remove the replacement

This is the core regression test:

- `const deps = makeDeps();`
- `const a = createVoiceSession(deps, 'G', 'C1', {} as any);` — player A registered.
- `const b = createVoiceSession(deps, 'G', 'C2', {} as any);` — replacement: note `createVoiceSession` itself calls the real `removePlayer` first, so A's `destroy` spy has now been called and `deps.players.get('G') === b`.
- Reset `h.connDestroy` call count here (`h.connDestroy.mockClear()`) so the assertion below isolates the stale callback.
- Fire A's STALE closure: `(a as any).onIdle()`.
- Assert the guard held: `deps.players.get('G')` is still `b`; `(b as any).destroy` NOT called; `h.connDestroy` NOT called after the clear (the closure returned before `getVoiceConnection`).

**Verify**: `npx vitest run tests/voiceSession.test.ts` → passes. Sanity: temporarily comment out nothing — but note that if someone deleted the guard line in `session.ts`, this test would fail with `deps.players.get('G')` undefined / `b.destroy` called. That is the regression it pins.

### Step 4: Test (c) — `becomeSpeakerIfStage` is a no-op on non-stage channels

Cheap and worth it (the function promises "num canal de voz normal é no-op"):

```ts
import { ChannelType } from 'discord.js';
...
const setSuppressed = vi.fn();
const channel = {
  type: ChannelType.GuildVoice,
  guild: { members: { me: { voice: { setSuppressed } } } },
} as any;
expect(() => becomeSpeakerIfStage(channel)).not.toThrow();
expect(setSuppressed).not.toHaveBeenCalled();
```

Do NOT attempt the stage-channel positive path — the module's own comment (`src/voice/session.ts:24`) says it's not unit-testable (needs a real Discord stage).

**Verify**: `npx vitest run tests/voiceSession.test.ts` → all tests pass.

### Step 5: Full gate

**Verify**:

- `npx vitest run` → full suite passes (previous count + new tests, no other file affected).
- `npm run build` → exit 0.
- `git status --short` → only `tests/voiceSession.test.ts`.

## Test plan

New file `tests/voiceSession.test.ts` (this plan IS the test plan). Cases:

1. Happy path: `createVoiceSession` registers the player and wires `joinVoiceChannel` with `selfDeaf: true, selfMute: false`; firing its onIdle removes the player and destroys the connection.
2. The regression this plan pins: player replaced, OLD session's onIdle fires → NEW player survives (map unchanged, no destroy, no connection teardown).
3. `becomeSpeakerIfStage` no-op on a non-stage channel.

Structural pattern: mock style from `tests/commandsJoin.test.ts` (spy-wrapped `vi.mock('@discordjs/voice', ...)`), hoisted shared state from `tests/playerCrossKill.test.ts` (`vi.hoisted`), Portuguese header comment like both.

Verification: `npx vitest run tests/voiceSession.test.ts` → ≥3 tests, all pass; `npx vitest run` → suite green.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `tests/voiceSession.test.ts` exists with the 3 cases above
- [ ] `npx vitest run tests/voiceSession.test.ts` exits 0
- [ ] `npx vitest run` exits 0 (full suite)
- [ ] `git grep -n "players.get" -- tests/voiceSession.test.ts` → at least 1 match (the guard assertion exists)
- [ ] `git status` shows only `tests/voiceSession.test.ts` (no src/ change)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `src/voice/session.ts:45-72` no longer matches the verbatim excerpt in "Current state" (in particular the guard line `if (deps.players.get(guildId) !== player) return;` or the `GuildVoicePlayer` ctor argument order).
- Test (b) FAILS against the real code — that would mean the guard is genuinely broken in `src/`; report it, do not patch `session.ts` under this plan.
- The `vi.mock('../src/voice/player', ...)` approach can't capture the closure after one reasonable fix attempt (e.g. hoisting issues) — report rather than switching to mocking deep `@discordjs/voice` internals.
- Fixing anything would require touching a file outside `tests/voiceSession.test.ts`.

## Maintenance notes

- If `createVoiceSession` ever gains parameters (e.g. selfDeaf toggle) or the `GuildVoicePlayer` ctor changes arity, the fake class in this test must be updated in the same PR — the captured `onIdle` is positional (5th arg).
- Reviewer focus: test (b) must clear `h.connDestroy` BETWEEN creating B and firing A's stale closure — otherwise the assertion is vacuously checking the wrong call.
- Complementary coverage map (do not duplicate): `tests/playerCrossKill.test.ts` covers the handleDisconnect-level defense and a replica of the /join call-site closure; `tests/messageHandlerAutojoin.test.ts` covers the autojoin DECISION with this module mocked. This new file covers the real closure built by `createVoiceSession`.
