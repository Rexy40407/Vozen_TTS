# Plan 019: Harden the /transcribe session lifecycle (teardown, races, selfMute, tmp names)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 965b15b..HEAD -- src/commands/handlers/transcribe.ts src/bot/deps.ts src/voice/transcriptionSession.ts src/voice/whisperTranscriber.ts src/tts/kokoroEngine.ts src/tts/cloneEngine.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `965b15b`, 2026-07-14

## Why this matters

`/transcribe` (live STT, shipped 2026-07-13) is the newest feature and its
session lifecycle has four confirmed defects. The worst: when the bot leaves
voice (kicked, `/leave`, alone-leave) mid-transcription, **nothing stops the
session** — the Whisper Python child process, a `speaking` listener on a dead
connection, a 15s interval and a button collector all leak, and the guild gets
stuck on "transcription already running" forever (until restart). On a 24/7
VPS with 3.7 GB RAM, leaked Python processes are a real availability risk.
Additionally, a race lets two concurrent `/transcribe start` calls double-post
every utterance, the start `rejoin` mutes the bot's own TTS for the whole
guild during transcription (privacy comment says "selfMute mantém-se" but it
actually flips `false→true`), and two concurrent guild sessions can collide on
temp WAV filenames. Finally, the load-bearing privacy invariant — "the bot is
deafened except during a session" — has **zero test coverage**.

## Current state

Files and roles:

- `src/commands/handlers/transcribe.ts` — the `/transcribe start|stop|revoke`
  handler. Module-private `activeSessions` Map (line 47) and `stopSession`
  (line 199). Portuguese comments (repo convention — keep it).
- `src/bot/deps.ts` — `removePlayer` (line 76) is the single funnel for every
  voice exit; `handleGuildDelete` (line 112) calls it on guild kick.
- `src/voice/transcriptionSession.ts` — session orchestration; per-instance
  `seq` counter (line 51) used in temp WAV names (line 83).
- `src/voice/whisperTranscriber.ts`, `src/tts/kokoroEngine.ts`,
  `src/tts/cloneEngine.ts` — persistent-sidecar clients; each registers
  `child.on('exit'|'error', … this.teardown())` without checking the event is
  from the *current* child.

Key excerpts (verified at `965b15b`):

`transcribe.ts:87-92` — the `alreadyRunning` check happens here…
```ts
  const verdict = evaluateTranscribeStart({
    canManage: i.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false,
    isPremium: isGuildPremium(deps.db, guildId, Date.now()),
    sidecarAvailable: cmd !== null,
    botInVoice: connection !== null,
    alreadyRunning: activeSessions.has(guildId),
```
…but `activeSessions.set(guildId, active)` only runs at `transcribe.ts:175`,
**after** `await channel.send(...)` (the announce). Two concurrent starts both
see `alreadyRunning:false` → both attach `conn.receiver.speaking.on('start')`
(line 146) → duplicate transcripts + the first session is orphaned.

`transcribe.ts:127-129` — the selfMute bug (comment contradicts the code; the
join default in `src/voice/session.ts:59-60` is `selfDeaf: true, selfMute: false`):
```ts
  // Des-ensurdece o bot SÓ agora (senão o receiver não recebe áudio). selfMute mantém-se
  // (o bot não fala pela transcrição). Restaurado no stop.
  conn.rejoin({ channelId: voiceChannelId, selfDeaf: false, selfMute: true });
```
A self-muted bot transmits no audio → **TTS is silenced for the whole guild
while transcription runs**.

`transcribe.ts:199-227` — `stopSession(guildId, deps, locale, reason)` already
does the right teardown (session.stop, `speaking.off`, collector stop,
clearInterval, `transcriber.dispose()`, re-deafen `rejoin` at line 219,
announce). It is only reachable from `handleTranscribe` and the auto-stop
interval — nothing external can trigger it.

`deps.ts:76-99` — `removePlayer` cleans aloneWatcher, games, lastSpeaker and
the player, with comments explaining it is "o FUNIL de todas as saídas". It
has no STT hook. Note its `deps` parameter is a `Pick<BotDeps, …>` — you will
widen it (see Step 1).

`transcriptionSession.ts:83` — temp name uses a per-instance counter, so two
concurrent guild sessions both generate `vozen-stt-<pid>-0.wav`, `-1.wav`…:
```ts
    const out = join(this.deps.tmpDir ?? tmpdir(), `vozen-stt-${process.pid}-${this.seq++}.wav`);
```

`whisperTranscriber.ts:115-122` (same shape in `kokoroEngine.ts:178-185` and
`cloneEngine.ts:203-210`) — exit/error handlers act on `this` without checking
identity, so a delayed `exit` from a SIGKILLed child can tear down a freshly
respawned one:
```ts
      child.on('exit', (code) => {
        log.warn(`[whisper] sidecar saiu (code ${code})`);
        this.teardown();
      });
```

Conventions: TypeScript strict, comments in Portuguese, TDD mandatory (write
the failing test first), tests are flat files in `tests/` named after the
module (`tests/transcribeGate.test.ts` is the closest exemplar; it and
`tests/transcriptionSession.test.ts` show the fake-deps injection style).

## Commands you will need

| Purpose    | Command                              | Expected on success |
|------------|--------------------------------------|---------------------|
| Install    | `npm install`                        | exit 0              |
| Typecheck  | `npm run typecheck`                  | exit 0              |
| Build      | `npm run build`                      | exit 0              |
| Tests      | `npx vitest run tests/transcribeHandler.test.ts` | all pass |
| Full suite | `npx vitest run`                     | ≥1714 tests pass    |
| Lint       | `npm run lint`                       | exit 0              |
| Format     | `npx prettier --check <touched files>` | no warnings       |

## Scope

**In scope** (the only files you should modify):
- `src/commands/handlers/transcribe.ts`
- `src/bot/deps.ts`
- `src/voice/transcriptionSession.ts`
- `src/voice/whisperTranscriber.ts`
- `src/tts/kokoroEngine.ts` (one guard only)
- `src/tts/cloneEngine.ts` (one guard only)
- `tests/transcribeHandler.test.ts` (create)

**Out of scope** (do NOT touch):
- `src/commands/transcribeGate.ts` and its tests — the pure gates are correct.
- `tools/whisper_sidecar.py` — the Python side is fine.
- `src/voice/recorder.ts`, `src/voice/player.ts` — unrelated voice paths.
- Any i18n catalog change — no new user-facing strings are needed.

## Git workflow

- Branch: work on `main` is NOT allowed for an executor — create `advisor/019-transcribe-lifecycle`.
- Commit style: short Portuguese conventional-ish one-liners (see `git log`),
  e.g. `fix(stt): teardown da sessão ao sair da call + corrida no start`.
  Keep the commit authorship limited to the human author.
- Do NOT push unless the operator instructed it.

## Steps

### Step 1: Export a guild-scoped teardown and wire it into `removePlayer`

In `transcribe.ts`, add an exported function ABOVE `stopSession` (keep
`stopSession` private):

```ts
/** Teardown externo: chamado pelo funil de saída de voz (removePlayer). Melhor-esforço. */
export function stopTranscriptionForGuild(guildId: string): void {
  const a = activeSessions.get(guildId);
  if (!a) return;
  activeSessions.delete(guildId);
  a.session.stop();
  try {
    a.connection.receiver.speaking.off('start', a.onSpeaking);
  } catch { /* ligação pode já ter morrido */ }
  a.collector.stop('voice-left');
  if (a.autoStopTimer) clearInterval(a.autoStopTimer);
  a.transcriber.dispose();
  a.announceMsg.edit({ components: [] }).catch(() => {});
}
```

Refactor `stopSession` to call `stopTranscriptionForGuild(guildId)` for the
shared part, keeping its extra behavior (re-deafen `rejoin` + stop announce in
the channel) — the voice-left path must NOT `rejoin` (the connection is gone).

In `deps.ts` `removePlayer`, after `deps.games?.onVoiceLeft(guildId);` add:

```ts
  // STT: se havia uma sessão de transcrição, morre com a saída da call — senão o
  // sidecar Whisper, o listener de speaking e o intervalo de auto-stop ficavam órfãos.
  stopTranscriptionForGuild(guildId);
```

Import it at top of `deps.ts`: `import { stopTranscriptionForGuild } from '../commands/handlers/transcribe';`
**Circular-import check**: `transcribe.ts` imports `BotDeps` from
`'../../bot/deps'` as a `type` only — a value import in the other direction is
safe at runtime, but verify with the build. If `npm run build` reports a cycle
error, instead register a callback: add `onVoiceExit?: (guildId: string) => void`
to `BotDeps`, set it in `src/index.ts` after handlers are constructed, and call
it from `removePlayer`. Prefer the direct import if the build is clean.

**Verify**: `npm run build` → exit 0; `npm run typecheck` → exit 0.

### Step 2: Close the start race (reserve the slot synchronously)

In `handleTranscribe`, immediately after the `verdict !== 'ok'` early-return
(after line ~104), and BEFORE any `await`, reserve the guild:

```ts
  // Reserva a guild JÁ (antes de qualquer await) — dois /transcribe start quase
  // simultâneos passavam ambos no gate e duplicavam listeners (mesmo padrão do
  // guard activeCloneRecordings no clone). Substituída pela sessão real abaixo.
  activeSessions.set(guildId, null as unknown as ActiveSession);
```

Wrap everything from that point to the final `activeSessions.set(guildId, active)`
in `try { … } catch (e) { activeSessions.delete(guildId); throw e; }` — any
early `return` between the reservation and the real `set` must also
`activeSessions.delete(guildId)` first (there are two: the `noChannel` return
and the `!voiceChannelId` return). Alternatively (cleaner): use a separate
`const startingGuilds = new Set<string>()` guard checked inside
`evaluateTranscribeStart`'s `alreadyRunning` input
(`activeSessions.has(guildId) || startingGuilds.has(guildId)`), added before
awaits and removed in a `finally`. Choose ONE approach; the Set approach avoids
placing a null in the Map. Also make `stopTranscriptionForGuild` null-safe
(`if (!a) return;` already covers the placeholder only if you chose the Set
approach — with the Map-placeholder approach add `if (!a) return;` semantics
for null).

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Fix the selfMute flip

Change `transcribe.ts:129` to keep the bot audible and fix the comment:

```ts
  // Des-ensurdece o bot SÓ agora (senão o receiver não recebe áudio). selfMute fica
  // FALSE como em todos os outros join/rejoin — um bot self-muted não transmite áudio,
  // o que silenciava o TTS da guild inteira durante a transcrição.
  conn.rejoin({ channelId: voiceChannelId, selfDeaf: false, selfMute: false });
```

**Verify**: `grep -n "selfMute: true" src/commands/handlers/transcribe.ts` → no matches.

### Step 4: Unique temp WAV names per session

In `transcriptionSession.ts`, make names globally unique: add a per-instance
random component created in the constructor:

```ts
  private readonly id = Math.random().toString(36).slice(2, 8);
```
and use it at line 83: `vozen-stt-${process.pid}-${this.id}-${this.seq++}.wav`.

**Verify**: `npx vitest run tests/transcriptionSession.test.ts` → all pass.

### Step 5: Identity guard on sidecar exit/error handlers (3 files)

In `whisperTranscriber.ts`, `kokoroEngine.ts`, `cloneEngine.ts`, change the
`exit` and `error` handlers registered in `ensureChild` to early-return when
stale:

```ts
      child.on('exit', (code) => {
        if (this.child !== child) return; // evento de um child JÁ substituído — ignora
        log.warn(`[whisper] sidecar saiu (code ${code})`);
        this.teardown();
      });
```
(Same one-line guard on the `error` handler; adapt the log tag per file.)

**Verify**: `npx vitest run tests/whisperTranscriber.test.ts tests/kokoroEngine.test.ts tests/cloneEngine.test.ts` → all pass.

### Step 6: Characterization tests for the handler (TDD note: these are the
tests that lock the invariants of steps 1–3; write them as you implement)

Create `tests/transcribeHandler.test.ts`. Build a minimal fake harness — model
the injection style on `tests/transcriptionSession.test.ts`. You need:

- a fake `VoiceConnection`: `{ joinConfig: { channelId: 'VC' }, rejoin: vi.fn(),
  receiver: { speaking: { on: vi.fn(), off: vi.fn() } } }`;
- a fake interaction `i`: `guildId`, `user.id`, `memberPermissions.has: () => true`,
  `options.getSubcommand()`, `options.getString()`, `reply`, `channel` with
  `isTextBased: () => true`, `isDMBased: () => false`, `send: vi.fn(async () => announceMsg)`;
  `guild.channels.cache.get` returning a voice channel with `members` for the
  auto-stop path; `guild.members.cache.get`;
- `announceMsg`: `{ edit: vi.fn(async () => {}), channel, createMessageComponentCollector: () => ({ on: vi.fn(), stop: vi.fn() }) }`;
- deps: real in-memory db via `initDb(':memory:')` (see
  `tests/sttConsent.test.ts`), `config` stub;
- mock `resolveWhisperCmd` to return a fake cmd and mock/inject a fake spawn
  via `WhisperTranscriber` — OR mock the module with `vi.mock`. Prefer
  `vi.mock('../src/voice/whisperSidecar', …)` returning a non-null cmd, and
  `vi.mock('../src/voice/whisperTranscriber')` with a stub class exposing
  `prewarm/transcribe/dispose` spies.

Test cases (minimum):
1. start happy path → `rejoin` called with `{ selfDeaf: false, selfMute: false }`
   (asserts Step 3).
2. `/transcribe stop` → `rejoin` called with `selfDeaf: true` and the speaking
   listener removed (`speaking.off` called) and `dispose()` called — the
   privacy invariant.
3. `stopTranscriptionForGuild(guildId)` after a start → same cleanup, but
   `rejoin` NOT called again with selfDeaf:false, `activeSessions` entry gone —
   and a subsequent start does not reply `stt.alreadyRunning`.
4. Two awaited-in-parallel starts (`Promise.all`) → exactly ONE
   `speaking.on('start')` registration (asserts Step 2).
5. Auto-stop: with the voice channel empty of humans, advancing timers
   (`vi.useFakeTimers()`, advance 15s) → cleanup runs (assert `speaking.off`).

**Verify**: `npx vitest run tests/transcribeHandler.test.ts` → 5+ tests pass.

### Step 7: Full gates

**Verify**: `npm run build && npm run typecheck && npm run lint` → exit 0;
`npx vitest run` → everything passes (baseline was 1714; you added ≥5);
`npx prettier --check src/commands/handlers/transcribe.ts src/bot/deps.ts src/voice/transcriptionSession.ts src/voice/whisperTranscriber.ts src/tts/kokoroEngine.ts src/tts/cloneEngine.ts tests/transcribeHandler.test.ts` → clean.

## Test plan

Covered by Step 6 (5 characterization tests). Existing suites that must stay
green: `transcribeGate.test.ts`, `transcriptionSession.test.ts`,
`whisperTranscriber.test.ts`, `kokoroEngine.test.ts`, `cloneEngine.test.ts`,
`deps`-related tests (`tests/guildDelete.test.ts` if present — run the full
suite).

## Done criteria

- [ ] `npm run build`, `npm run typecheck`, `npm run lint` all exit 0
- [ ] `npx vitest run` exits 0 with ≥5 new tests in `tests/transcribeHandler.test.ts`
- [ ] `grep -n "selfMute: true" src/commands/handlers/transcribe.ts` → no matches
- [ ] `grep -n "stopTranscriptionForGuild" src/bot/deps.ts` → 1 import + 1 call
- [ ] `grep -c "this.child !== child" src/voice/whisperTranscriber.ts src/tts/kokoroEngine.ts src/tts/cloneEngine.ts` → 2 per file (exit+error)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The excerpts above don't match the live code (drift since `965b15b`).
- `npm run build` reports a require-cycle after Step 1 AND the callback
  fallback described there also fails.
- Any existing test fails and the fix would require touching an out-of-scope
  file.
- You find `stopSession`'s re-deafen path already reached from `removePlayer`
  by some mechanism this plan missed — report, don't duplicate.

## Maintenance notes

- Future work adding new voice-exit paths must go through `removePlayer` —
  that is the documented funnel; the STT teardown now rides on it.
- If STT ever becomes multi-channel-per-guild, `activeSessions` keyed by
  guildId and the reservation guard need rethinking.
- Reviewer: scrutinize the early-return paths between slot reservation and
  session installation in Step 2 — a missed `delete` bricks `/transcribe`
  for that guild until restart.
