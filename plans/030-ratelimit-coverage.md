# Plan 030: Close rate-limit coverage gaps (`/voice preview`, feedback throttle, `/game` gating)

> **Executor instructions**: Small, mirror the existing rate-limit pattern. TDD for
> the pure bits. Update this plan's row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat f1a1ac1..HEAD -- src/commands/handlers/voice.ts src/commands/messageHandler.ts src/commands/handlers/games.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security / abuse-resistance
- **Planned at**: commit `f1a1ac1`, audit findings ABUSE-03, ABUSE-02, ABUSE-04

## Why this matters

Almost every expensive path is per-user rate-limited (`/tts`, Speak, `/laugh`,
`/joke`, `/rizz`, `/sound`, message-read all call `getLimiter().allow(...)`). Three
gaps remain:

1. **`/voice preview` bypasses the limiter** (ABUSE-03). It builds a `SynthRequest`
   and calls `player.say(req)` with NO `getLimiter`/`allow` check, so a user can
   spam it unmetered — monopolizing that guild's single-worker voice queue
   (drowning out legitimate TTS) and forcing cache-miss syntheses by cycling the
   `model:` option.
2. **Rate-limit feedback is per-message, unthrottled** (ABUSE-02). For every
   over-budget message, `messageHandler.ts` does `reactRateLimited(message)` (a 🐢
   REST call) + `log.info(...)`. A flood on an autoread channel turns each inbound
   message into a REST call + a persistent-log write → log-write storm that can fill
   the disk. Also `log.info('[game] mensagem consumida ...')` fires once per message
   in a game channel.
3. **`/game stop` has no permission gate + `/game play`/`stop` no cooldown**
   (ABUSE-04, LOW). Any member can stop any game; play→stop→play churns thread
   create/delete REST calls. Bounded by the one-game-per-guild lock and Discord rate
   limits — low impact, cheap fix.

## Current state (exact locations)

- `src/commands/handlers/voice.ts:510-555` — the `preview` branch; builds `req`
  (`:543`) and calls `player.say(req)` with no limiter. It already reads `cfg` via
  `getGuildConfig` (`:526`), so `cfg.ratePerMin` is in hand. Compare `/laugh`
  (`src/commands/handlers/fun.ts:~49-50`): `getLimiter(deps, guildId, cfg.ratePerMin).allow(userId, Date.now())` → return `tts.tooFast` on false.
- `src/commands/messageHandler.ts:~209-215` — per-drop `reactRateLimited` + `log.info`;
  `:~129` — per-message `log.info('[game] mensagem consumida ...')`.
- Existing cap+evict window-map pattern to reuse: `GreetCooldown` / `DuplicateTracker`
  (grep those) — MAX_ENTRIES 10k, per-(guild,user) windows.
- `src/commands/handlers/games.ts:~117` `createGameThread`; `:~149-152` `stop` with
  no permission check.

## Scope

**In scope**: `voice.ts` (preview limiter), `messageHandler.ts` (throttle feedback +
demote/sample the per-message logs), `games.ts` (optional cooldown + `/game stop`
gate). New i18n only if a message is missing (reuse `tts.tooFast`).
**Out of scope**: changing the token-bucket limiter itself; the queue depth cap
(already 20); the synthesis pipeline.

## Steps

### Step 1 (ABUSE-03): rate-limit `/voice preview`

In the `preview` branch of `voice.ts`, BEFORE `player.say(req)`, add the same guard
`/laugh` uses:
```ts
const rl = getLimiter(deps, i.guildId!, cfg.ratePerMin);
if (!rl.allow(i.user.id, Date.now())) { await reply(i, t('tts.tooFast', locale)); return; }
```
(Use the exact imports/signature `/laugh` uses — match it.)

### Step 2 (ABUSE-02): throttle the rate-limit feedback + quiet the per-message logs

- Wrap `reactRateLimited(message)` so it fires at most once per (guild,user) per
  window, reusing the `GreetCooldown`/`DuplicateTracker` cap+evict pattern (a new
  small `RateLimitFeedbackCooldown` map, MAX_ENTRIES bounded like the others).
- Demote the per-drop `log.info` and the per-message `[game] mensagem consumida`
  `log.info` to `log.debug` (or sample 1/N, or coalesce into a periodic counter) so
  a flood cannot storm the persistent log.

### Step 3 (ABUSE-04, LOW — do if cheap): gate `/game stop` + cooldown

- In `games.ts`, gate `/game stop` to the game's starter OR ManageGuild (mirror how
  other admin-ish game/config actions check permissions).
- Optionally add a short per-user (or per-guild) cooldown on `/game play`.
- If either turns out to require non-trivial restructuring, SKIP it and note it as a
  follow-up — Steps 1 and 2 are the leverage.

## Test plan

- If the limiter/cooldown maps are pure (they are — window maps), unit-test the new
  feedback-cooldown (fires once per window, evicts past MAX_ENTRIES) following the
  existing `GreetCooldown`/`DuplicateTracker` tests.
- `/voice preview` limiter: if there's a voice-handler test harness, assert the
  second rapid preview returns `tts.tooFast`; otherwise a characterization test on
  the limiter call is acceptable.
- `npm run check` green.

## Done criteria

- [ ] `/voice preview` calls the per-user limiter before `player.say` (grep `getLimiter` in the preview branch)
- [ ] Rate-limit feedback (🐢 + log) is throttled per (guild,user) per window; per-message `log.info` demoted/sampled
- [ ] (If done) `/game stop` requires starter/ManageGuild
- [ ] `npm run check` exits 0

## STOP conditions

- If `/voice preview` intentionally has a different rate policy than `/laugh` (check
  for a comment), respect it — but "no limiter at all" is the bug; at minimum add
  the standard limiter.
- Do not lower the limiter's global budget or change its algorithm here.

## Maintenance notes

- New synthesis-triggering commands must call `getLimiter().allow(...)` — the
  coverage map in audit finding ABUSE-02 lists the guarded paths; keep new commands
  on that list.
