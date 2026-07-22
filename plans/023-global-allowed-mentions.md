# Plan 023: Default `allowedMentions: { parse: [] }` on the Client (mass-mention / ban-risk)

> **Executor instructions**: Small, surgical change + tests. TDD: write the failing
> test first. Update this plan's row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat f1a1ac1..HEAD -- src/bot/client.ts src/index.ts src/commands/handlers/fun.ts src/commands/handlers/personal.ts src/games/`
> If any of these changed, re-locate the strings in "Current state" before editing.

## Status

- **Priority**: P1 (Discord ban-risk — highest-leverage security finding)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security / Discord-compliance
- **Planned at**: commit `f1a1ac1`, audit finding DISCORD-01

## Why this matters

Several bot-posted messages interpolate **user-controlled text** and are sent
WITHOUT `allowedMentions`, so Discord parses mentions in that text. A user can
make the bot ping on their behalf:
- `<@userId>` works **unconditionally** (no bot permission needed) — a reliable
  targeted-ping / harassment vector in any default-permission server.
- `@everyone` / `@here` / `<@&role>` escalate when the bot's role holds
  Mention-Everyone (not in `INVITE_PERMISSIONS`, but servers commonly grant it).

This is exactly the mass-mention abuse pattern Discord treats as a ban risk for
the bot account. The codebase ALREADY uses `allowedMentions: { parse: [] }` in
the correct places (message-read `src/commands/messageHandler.ts`, transcripts
`src/commands/handlers/transcribe.ts:152`, `meta.ts`) — this plan closes the
sites that were missed, and does it globally so future echo sites are safe by
default.

## Current state (exact locations)

- **`src/bot/client.ts:28-38`** — the `new Client({ intents, partials })` sets
  **no** `allowedMentions`, so the client default parses all mention types.
- Missing per-call guard (post user text, bare content):
  - `src/index.ts:~220-225` — games' `sendToChannel` does `ch.send(content)` (bare
    string). Choke point for every `ctx.send(...)` in `src/games/*`; several
    interpolate user text (e.g. `src/games/chess.ts` echoes the raw move; player
    `authorName`/typed words in `tictactoe.ts`, `reflexes.ts`, `vozenSays.ts`,
    `quizGame.ts`, `wordChain.ts`).
  - `src/commands/handlers/fun.ts:~340,351,399` — `/8ball` public `deferReply()`
    then `editReply` folding the user's free-text `question`, no `allowedMentions`.
  - `src/commands/handlers/personal.ts:~316-319` — `/randomizer` `drawAndAnnounce`
    posts the winning option (user text) as a public reply/followUp, no guard.

## Scope

**In scope**: `src/bot/client.ts` (add the global default); one new test file.
**Out of scope**: removing the existing per-call `{parse:[]}` (they stay —
redundant-but-harmless); rewriting the games/fun/personal handlers; the site.

## Approach

**Primary fix (preferred): global default.** Add `allowedMentions: { parse: [] }`
to the `Client` constructor in `src/bot/client.ts`. discord.js applies this as
the default for every `send`/`reply`/`editReply` that doesn't override it, which
closes all three sites above AND any future echo site. Per-call `{parse:[]}`
already present elsewhere continues to work (same value).

Note: a global `parse: []` means the bot NEVER pings via message content unless a
call explicitly opts in with its own `allowedMentions`. Confirm nothing in the
repo relies on the bot pinging a user — the streak/leaderboard `<@id>` lines
already use `{parse:[]}` to render the name without pinging, so this preserves
current behavior. (Interaction replies that must ping the invoker are unaffected —
Discord always notifies the command invoker regardless of `allowedMentions`.)

## Steps

### Step 1 (RED): test that the client is constructed with the safe default

Create `tests/clientAllowedMentions.test.ts`. Since `createClient()` returns a
real `Client`, assert on its options:
```ts
import { describe, it, expect } from 'vitest';
import { createClient } from '../src/bot/client';
describe('createClient — mass-mention hardening', () => {
  it('defaults allowedMentions to parse:[] (no @everyone/@here/role/user pings from content)', () => {
    const c = createClient();
    expect(c.options.allowedMentions).toEqual({ parse: [] });
    c.destroy();
  });
});
```
Run `npx vitest run tests/clientAllowedMentions.test.ts` → **fails** (currently
`allowedMentions` is undefined).

### Step 2 (GREEN): add the global default

In `src/bot/client.ts`, add to the `new Client({ ... })` options:
```ts
allowedMentions: { parse: [] },
```
Add a Portuguese comment explaining it defuses @everyone/@here/role/user pings in
any bot-posted content (ban-risk hardening; per-call overrides still possible).

Run the test → **passes**.

### Step 3: guard against regressions on the raw send sites (defense-in-depth, optional-but-recommended)

Leaving the global default is sufficient. Do NOT rewrite the games/fun/personal
handlers. If you want belt-and-suspenders on the highest-traffic site, you MAY
add an explicit `allowedMentions: { parse: [] }` to the games `sendToChannel`
`ch.send(...)` in `src/index.ts` — but only if it's a one-line addition; skip if
it requires restructuring.

## Test plan

- New `tests/clientAllowedMentions.test.ts` (Step 1) — the RED→GREEN gate.
- Full suite must stay green (`npx vitest run`) — no existing test should depend
  on the bot pinging via content.

## Done criteria

- [ ] `tests/clientAllowedMentions.test.ts` passes
- [ ] `grep -n "allowedMentions" src/bot/client.ts` → 1 match (`parse: []`)
- [ ] `npm run check` exits 0
- [ ] Only `src/bot/client.ts` (+ optional `src/index.ts` one-liner) + the new test changed

## STOP conditions

- If any existing test now fails because it asserted the bot pings a user via
  message content, STOP and report — that would be an intentional-ping surface
  the maintainer must confirm before suppressing.
- If `createClient()` cannot be constructed in the test env (e.g. it logs in on
  import), STOP; instead assert the option object passed to `new Client` by
  extracting it into an exported `CLIENT_OPTIONS` const and testing that.

## Maintenance notes

- With the global default, any NEW `channel.send(userText)` is safe automatically.
- If a future feature genuinely needs to ping someone, it must set its OWN
  `allowedMentions` on that specific call — make that explicit in review.
