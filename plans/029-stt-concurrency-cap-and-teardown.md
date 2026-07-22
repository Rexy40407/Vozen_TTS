# Plan 029: Global STT concurrency cap + `/transcribe start` error teardown (OOM + orphaned-listening)

> **Executor instructions**: TDD for the pure gate change; careful teardown wiring.
> Update this plan's row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat f1a1ac1..HEAD -- src/commands/transcribeGate.ts src/commands/handlers/transcribe.ts src/voice/whisperTranscriber.ts tests/transcribeGate.test.ts`

## Status

- **Priority**: P1 (OOM can kill the whole process = all guilds lose TTS; orphaned listening = privacy/trust)
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none
- **Category**: security / availability / Discord-trust
- **Planned at**: commit `f1a1ac1`, audit findings ABUSE-01, DISCORD-02

## Why this matters

**Part A (ABUSE-01 — OOM).** `/transcribe start` gates only on a **per-guild** lock
(`alreadyRunning = activeSessions.has(guildId) || startingGuilds.has(guildId)`).
There is no **global** cap. Each start does `new WhisperTranscriber(cmd)` +
`prewarm()`, which spawns a **dedicated persistent Python process** loading its own
faster-whisper `base` model (hundreds of MB). Unlike Kokoro (a shared singleton),
Whisper transcribers multiply with sessions. N Premium guilds transcribing at once
= N model copies in RAM; the VPS "OOMs at ~3.3 GB" (CONTRIBUTING.md), so a handful of
concurrent sessions can OOM-kill the whole bot process, not just degrade STT. The
Premium+ManageGuild gate limits *who* starts, not *how many* run at once — and the
paid tier's concurrency grows with the tier. `docs/SPIKE-STT.md` even recommends a
"cap de 1 transcrição concorrente (semáforo)"; the code only achieves cap-1
*within* a session (serial stdin), never across sessions (decision drift).

**Part B (DISCORD-02 — orphaned listening).** In `/transcribe start`, the bot
un-deafens (`conn.rejoin({ selfDeaf: false })`, transcribe.ts:142) and attaches the
speaking listener (:160) BEFORE recording the session in `activeSessions` (:189),
which happens AFTER `await channel.send(...)` (the consent announce, :170). If that
`channel.send` throws (lost SendMessages, rate-limit, network blip), the bot is
left **un-deafened and listening** with the speaking listener attached but **no
`activeSessions` entry** — so `stopSession`/`stopTranscriptionForGuild` are no-ops
and nothing re-deafens it short of leaving voice. A previously-consented member
speaking in that window is captured with no active consent announce shown. The
handler also never `deferReply`s and only acks at :209 after the send, so a
slow/failed announce can 3s-timeout the interaction too.

## Current state (exact locations)

- `src/commands/transcribeGate.ts:22-36` — `TranscribeVerdict` union +
  `evaluateTranscribeStart`; order canManage→isPremium→sidecarAvailable→botInVoice→
  alreadyRunning. No `atCapacity` verdict.
- `src/commands/handlers/transcribe.ts:47` — `const activeSessions = new Map<...>()`
  (no size cap); `:97` builds `alreadyRunning`; `:136-137` `new WhisperTranscriber`
  + `prewarm`; `:142` un-deafen; `:160` attach listener; `:170` `await channel.send`
  (announce); `:189` `activeSessions.set`; `:210` `finally { startingGuilds.delete }`.
- `src/tts/semaphore.ts` — an existing `Semaphore` class to reuse.
- `src/voice/whisperTranscriber.ts:104-139` — `ensureChild()` spawns the per-session
  Python process; `dispose()` kills it.

## Scope

**In scope**: `src/commands/transcribeGate.ts` (+ test), `src/commands/handlers/transcribe.ts`
(capacity check + error teardown), possibly a small module-level counter/semaphore.
**Out of scope**: making Whisper a shared singleton (a larger redesign — note as a
future option); changing the sidecar protocol; the per-guild lock (keep it).

## Steps

### Part A — global concurrency cap

1. **(RED)** In `tests/transcribeGate.test.ts`, add cases for a new `atCapacity`
   verdict: when a `globalActive >= MAX_CONCURRENT_STT` signal is passed to
   `evaluateTranscribeStart`, it returns `'atCapacity'` (checked AFTER the per-guild
   `alreadyRunning`, or in a sensible order — decide and document). Existing verdict
   tests must still pass.
2. **(GREEN)** Add `MAX_CONCURRENT_STT` (small — 1 or 2, matching the SPIKE-STT
   intent; make it a named const, optionally env-overridable via config) and an
   `atCapacity` verdict. `evaluateTranscribeStart` takes a new input (e.g.
   `globalActiveCount` or `atCapacity: boolean`) — keep the function PURE (caller
   passes the count). Map `atCapacity` to a new i18n key `stt.atCapacity`
   ("too many transcriptions running right now, try again shortly") in the verdict
   switch in `transcribe.ts`.
3. Track the global count: increment when a session is reserved (alongside
   `startingGuilds.add`) and decrement in `stopTranscriptionForGuild` teardown (the
   single place both stop paths funnel through). A module-level counter or the
   `Semaphore` both work; a counter is simplest and mirrors `startingGuilds`.
   Ensure the decrement happens on EVERY teardown path (stop, auto-stop, voice-left,
   AND the error path from Part B).

### Part B — error teardown for the announce failure

4. Make the post-`rejoin` setup resilient. Preferred shape:
   - `deferReply` (ephemeral) at the TOP of the start branch so a slow announce
     can't 3s-timeout the interaction (then use `editReply` for the final ack).
   - Register the `activeSessions` entry (and the global-count reservation) BEFORE
     `await channel.send(...)`, OR wrap everything after `rejoin` in a try/catch
     that, on failure, **re-deafens** (`conn.rejoin({ selfDeaf: true, selfMute: false })`),
     removes the speaking listener, clears any timer, disposes the transcriber, and
     decrements the global count — then surfaces `stt.startFailed` to the user.
   - The invariant to guarantee: **if the bot ever un-deafened, some code path
     ALWAYS re-deafens**, even when `channel.send` throws.

## Test plan

- `transcribeGate.test.ts`: the new `atCapacity` verdict (RED→GREEN) + existing
  verdicts unchanged.
- If feasible, a unit test around the teardown invariant: simulate the capture/
  session deps so that a throwing `post`/announce triggers the re-deafen + count
  decrement (follow the existing `transcribe`/session test patterns — grep
  `activeSessions`/`stopTranscriptionForGuild` in `tests/`). If the handler is too
  Discord-coupled to test directly, at minimum unit-test the gate and add a
  characterization test for the counter increment/decrement symmetry.
- `npm run check` green.

## Done criteria

- [ ] `evaluateTranscribeStart` returns `atCapacity` past the cap; existing verdicts intact (tests)
- [ ] `MAX_CONCURRENT_STT` enforced; the global count increments on reserve and decrements on EVERY teardown path (incl. the error path)
- [ ] A failed announce after un-deafen re-deafens the bot and leaves no orphaned listener/session (test or characterization)
- [ ] `/transcribe start` defers or otherwise cannot 3s-timeout on a slow announce
- [ ] New i18n keys (`stt.atCapacity`, `stt.startFailed`) added (en+pt, matching the existing `stt.*` catalog pattern)
- [ ] `npm run check` exits 0

## STOP conditions

- If reconciling the global counter with the existing `startingGuilds`/`activeSessions`
  lifecycle risks a double-decrement (e.g. both the error path and `stopTranscriptionForGuild`
  firing), STOP and make the decrement idempotent (decrement only if this session
  was counted) — do not ship an asymmetric counter that could drift to block all STT.
- If a shared-singleton Whisper redesign turns out necessary to truly bound RAM
  (rather than a session cap), note it as a follow-up — this plan's cap is the
  agreed, low-risk mitigation.

## Maintenance notes

- The counter must stay symmetric with session lifecycle; any new teardown path
  MUST decrement. Consider funnelling all teardown through one function to keep it
  in one place (`stopTranscriptionForGuild` already is that funnel for two paths).
- If STT ever moves to a shared model process, this cap becomes moot — revisit then.
