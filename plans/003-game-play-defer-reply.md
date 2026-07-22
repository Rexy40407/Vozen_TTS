# Plan 003: Defer the /game play interaction before the thread-creation REST call so slow gateways can't expire the token

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat fb7f916..HEAD -- src/commands/index.ts tests/commandsGamePlay.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `fb7f916`, 2026-07-07

## Why this matters

The `play` branch of `handleGame` (`src/commands/index.ts`) calls `await createGameThread(i.channel, …)` — a Discord REST call (`src/games/thread.ts`) — **before** acknowledging the interaction in any way. A slash-command interaction token must be acknowledged within 3 seconds; on a slow gateway/REST round-trip the token expires, the final `reply(i, …)` throws `10062 Unknown interaction`, and the user sees a failure **even though the game thread was created and the game actually started**. The fix is the pattern this repo already uses for `/tts` and `/speak`: `deferReply` first (buys 15 minutes), then `editReply` for every response in the branch. The generic outer catch already handles deferred interactions correctly, so no change is needed there.

## Current state

- `src/commands/index.ts` — all slash-command handlers; `handleGame` play branch is at lines 2320-2385; shared `reply()` helper at 792-794; outer catch at 2806-2820.
- `src/games/thread.ts` — `createGameThread(channel, name)`: real REST call `ch.threads.create(...)` (line 72); returns thread id or `null` on any failure (context only; NOT modified).
- `tests/commandsGamePlay.test.ts` — does not exist yet; this plan creates it. No existing test exercises the play branch through `handleInteraction` (verified: `grep -rln "startedThread|handleGame" tests/` matches nothing but `tests/gameManager.test.ts`, which tests the manager, not the command).

Verified excerpts as of commit `fb7f916`:

`src/commands/index.ts:792-794` — the shared `reply()` helper (fresh `i.reply`, ephemeral; it has NO editReply sibling — the repo's deferred handlers call `i.editReply` directly):

```ts
async function reply(i: ChatInputCommandInteraction, content: string): Promise<void> {
  await i.reply({ content, flags: MessageFlags.Ephemeral });
}
```

`src/commands/index.ts:2320-2331` — top of the play branch (early-return replies):

```ts
if (sub === 'play') {
  const gameId = i.options.getString('game', true);
  const def = gameById(gameId);
  if (!def) {
    await reply(i, t('game.unknownGame', locale));
    return;
  }
  // Jogos de voz exigem o bot numa call (como o /tts): sem player, nada a anunciar.
  if (def.needsVoice && !getPlayer(deps, i.guildId!)) {
    await reply(i, t('game.start.needVoice', locale));
    return;
  }
```

`src/commands/index.ts:2345-2355` — the lock check and the un-acked REST call (the bug):

```ts
if (deps.games.active(i.guildId!)) {
  const ch = deps.games.channelOf(i.guildId!) ?? i.channelId;
  await reply(i, t('game.start.alreadyActive', locale, { channel: ch }));
  return;
}
// Servidores grandes afogam o canal com as mensagens do jogo — corremo-lo numa
// THREAD descartável criada a partir deste canal. Fallback (canal de voz/DM, sem
// permissões): joga no próprio canal, como antes.
const gameName = t(def.nameKey, locale);
const threadId = await createGameThread(i.channel, `🎮 ${gameName}`);
const gameChannelId = threadId ?? i.channelId;
```

`src/commands/index.ts:2371-2384` — race-loss and success responses (all via `reply`):

```ts
if (res === 'already-active') {
  // Perdemos a race após o active() acima — limpa a thread que acabámos de criar.
  if (threadId) void deleteChannelSafe(i.client, threadId);
  const ch = deps.games.channelOf(i.guildId!) ?? i.channelId;
  await reply(i, t('game.start.alreadyActive', locale, { channel: ch }));
  return;
}
await reply(
  i,
  threadId
    ? t('game.start.startedThread', locale, { game: gameName, channel: threadId })
    : t('game.start.started', locale, { game: gameName }),
);
return;
```

`src/commands/index.ts:961-969` — the repo's established defer+edit pattern (from the `/tts`-family handlers; MATCH THIS):

```ts
await i.deferReply({ flags: MessageFlags.Ephemeral });
...
  await i.editReply(t('tts.nothingToRead', locale));
...
await i.editReply(speakOutcomeMessage(outcome, locale));
```

`src/commands/index.ts:2806-2819` — the outer catch ALREADY copes with a deferred interaction (verify only, do not change):

```ts
} catch (err) {
  log.error('[command] erro em', i.commandName, err);
  if (!i.isRepliable()) return;
  ...
  if (i.deferred && !i.replied) {
    // Ja foi deferido (caso do /tts): editReply para o utilizador receber o erro
    // em vez de ficar preso em "a pensar...".
    await i.editReply({ content: msg }).catch(() => {});
  } else if (!i.replied) {
    await i.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}
```

Ephemerality: the handleGame doc comment (lines 2304-2307) states play/stop respond EPHEMERAL. Deferring with `{ flags: MessageFlags.Ephemeral }` preserves that (the defer fixes visibility; `editReply` inherits it).

Facts needed for the test (verified):

- `handleInteraction` is exported from `src/commands/index.ts` and is how `tests/commandsConfig.test.ts` drives handlers with a fake interaction object (see its `makeConfigInteraction()` helper and the `vi.mock('@discordjs/voice', ...)` at the top — copy both patterns).
- A free, no-voice game to use in tests: `tictactoe` (`src/games/tictactoe.ts:128-131`: `id: 'tictactoe'`, `needsVoice: false`, no `premium` flag), so the player/premium gates are skipped.
- `deps.games` needs only `{ active(guildId): boolean; channelOf(guildId): string | null; start(...): 'started' | 'already-active' }` for this branch (`src/games/manager.ts:44` `export type StartResult = 'started' | 'already-active';`).
- `createGameThread` accepts any object; a fake channel `{ type: 0, threads: { create: async () => ({ id: 'thread-1' }) } }` takes the happy path (`ChannelType.GuildText === 0`), and `{ type: 2 }` (voice) returns `null` (see `tests/gameThread.test.ts`).
- `tests/commandsConfig.test.ts` builds deps with `initDb(':memory:')` from `src/store/db` — do the same so `localeForUser` reads a real guild config.

Repo conventions: code comments in **Portuguese**; tests use vitest + hand-rolled fakes (no discord.js objects), model after `tests/commandsConfig.test.ts`.

## Commands you will need

| Purpose    | Command                                         | Expected on success |
| ---------- | ----------------------------------------------- | ------------------- |
| Install    | `npm install`                                   | exit 0              |
| Typecheck  | `npm run build`                                 | exit 0 (tsc)        |
| New tests  | `npx vitest run tests/commandsGamePlay.test.ts` | all pass            |
| Full suite | `npx vitest run`                                | all pass            |

(There is no lint script in this repo.)

## Scope

**In scope** (the only files you should modify/create):

- `src/commands/index.ts` — ONLY the `play` branch of `handleGame` (lines ~2320-2385)
- `tests/commandsGamePlay.test.ts` (create)

**Out of scope** (do NOT touch, even though they look related):

- The `stop` / `list` / `leaderboard` branches of `handleGame` — fast, no REST call before replying; leave on `reply()`/`i.reply`.
- The shared `reply()` helper (792-794) — other handlers depend on it as-is; do NOT add an editReply variant to it.
- The outer catch (2806-2820) — already correct for deferred interactions; verify, don't modify.
- `src/games/thread.ts` and the GameManager — behavior unchanged.

## Git workflow

- Branch: `advisor/003-game-play-defer-reply`
- Commit style: conventional-ish Portuguese one-liners, e.g. `fix(games): /game play faz deferReply antes da thread — adeus 10062 em gateways lentos` (match `git log --oneline` style).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Defer at the top of the play branch and convert its responses to editReply

In `src/commands/index.ts`, inside `if (sub === 'play') {` (line 2320):

1. Immediately after the opening brace, add (Portuguese comment):

```ts
// Ack IMEDIATO: criar a thread é uma chamada REST que num gateway lento estoira
// os 3s do token da interação (10062 Unknown interaction) com o jogo JÁ criado.
// deferReply compra 15 min; TODAS as respostas deste ramo passam a editReply.
await i.deferReply({ flags: MessageFlags.Ephemeral });
```

2. Convert every `await reply(i, X)` **inside the play branch only** to `await i.editReply(X)`. There are exactly 5, at these current lines:
   - 2324: `await reply(i, t('game.unknownGame', locale));` → `await i.editReply(t('game.unknownGame', locale));`
   - 2329: `await reply(i, t('game.start.needVoice', locale));` → `await i.editReply(t('game.start.needVoice', locale));`
   - 2338: `await reply(i, t('game.start.premiumLocked', locale, { game: t(def.nameKey, locale) }));` → same content via `i.editReply`
   - 2347: `await reply(i, t('game.start.alreadyActive', locale, { channel: ch }));` → same via `i.editReply`
   - 2375: the second `alreadyActive` (race-loss path) → same via `i.editReply`

   And the final success response (2378-2383): replace the `await reply(i, threadId ? ... : ...)` wrapper with `await i.editReply(threadId ? ... : ...)` keeping the ternary exactly as-is.

3. Leave everything else in the branch byte-identical (lock check order, `createGameThread` call, `deps.games.start(...)` args, `deleteChannelSafe` race cleanup).

**Verify**: `npm run build` → exit 0. Then `grep -n "reply(i," src/commands/index.ts | awk -F: '$2 >= 2320 && $2 <= 2390'` → no matches inside the play branch (the branch now spans a few more lines; eyeball that all remaining `reply(i,` hits are in other subcommands/handlers).

### Step 2: Confirm the outer catch needs no change

Read `src/commands/index.ts:2806-2820` and confirm it matches the excerpt in "Current state" (`i.deferred && !i.replied` → `editReply`). This is a verification step, not an edit. If it does NOT match, STOP.

**Verify**: `sed -n '2806,2822p' src/commands/index.ts` (line numbers may have shifted by the ~4 lines added in Step 1; locate the `} catch (err) {` of `handleInteraction`) → contains the `i.deferred && !i.replied` → `editReply` branch.

### Step 3: Create `tests/commandsGamePlay.test.ts`

Model on `tests/commandsConfig.test.ts` (same `vi.mock('@discordjs/voice', ...)` header, same fake-interaction style, `initDb(':memory:')`). The fake interaction needs `deferReply`/`editReply` and an order log so the tests can assert _defer happens before the REST call_. Suggested skeleton (comments in Portuguese; adapt freely but keep the listed assertions):

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: () => ({}),
  getVoiceConnection: () => undefined,
}));

import { handleInteraction } from '../src/commands/index';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import type Database from 'better-sqlite3';

const GUILD = 'g-gameplay-test';

function makeDeps(db: Database.Database, games: unknown): BotDeps {
  return {
    client: { user: { id: 'bot-1' }, channels: { cache: new Map(), fetch: async () => null } },
    players: new Map(),
    db,
    config: {},
    availableModels: ['en_US-amy-medium'],
    games,
  } as unknown as BotDeps;
}

/** Interação falsa do /game play com deferReply/editReply e um log de ordem. */
function makePlayInteraction(opts: { gameId?: string; channel?: unknown; calls?: string[] }) {
  const calls = opts.calls ?? [];
  const edits: string[] = [];
  return {
    commandName: 'game',
    guildId: GUILD,
    channelId: 'chan-1',
    channel: opts.channel ?? null,
    user: { id: 'u-1' },
    client: { channels: { cache: new Map(), fetch: async () => null } },
    calls,
    edits,
    replied: false,
    deferred: false,
    isRepliable: () => true,
    deferReply: async function (this: { deferred: boolean }) {
      calls.push('defer');
      this.deferred = true;
    },
    editReply: async (content: string | { content: string }) => {
      calls.push('edit');
      edits.push(typeof content === 'string' ? content : content.content);
    },
    reply: async () => {
      calls.push('reply'); // o ramo play NÃO pode usar isto depois do fix
    },
    options: {
      getSubcommand: () => 'play',
      getSubcommandGroup: () => null,
      getString: (name: string) => (name === 'game' ? (opts.gameId ?? 'tictactoe') : null),
    },
  };
}
```

Tests to write (use `tictactoe` — free, no voice needed):

1. **Happy path with thread — defer BEFORE the REST call, success via editReply**: channel `{ type: 0, threads: { create: async () => { calls.push('createThread'); return { id: 'thread-1' }; } } }` (push into the shared `calls` array); fake games `{ active: () => false, channelOf: () => null, start: () => 'started' }`. Assert: `calls` starts with `'defer'` and `'defer'` comes before `'createThread'` (`calls.indexOf('defer') < calls.indexOf('createThread')`); `edits.length === 1`; `calls` does not contain `'reply'`; `i.deferred === true`.
2. **already-active path answers via editReply**: fake games `{ active: () => true, channelOf: () => 'chan-9', start: ... }`. Assert one `edit`, zero `reply`, and the edited content is non-empty (it is the localized `game.start.alreadyActive` text).
3. **thread creation unavailable (voice-type channel) still works**: channel `{ type: 2 }` → `createGameThread` returns null → game starts in the invoking channel. Assert one `edit`, zero `reply`, `start` was called with `'chan-1'` as the channel (capture args with `vi.fn`).
4. **unknown game answers via editReply**: `gameId: 'nope'` → one `edit`, zero `reply` (proves the early returns were converted too).

**Verify**: `npx vitest run tests/commandsGamePlay.test.ts` → all pass (4 tests). Then `npx vitest run` → full suite passes.

## Test plan

- New file `tests/commandsGamePlay.test.ts`, modeled after `tests/commandsConfig.test.ts` (fake interaction + `handleInteraction` + in-memory db) — cases 1-4 in Step 3, covering: the ordering regression this plan fixes (defer before REST), success/already-active/fallback/unknown all through `editReply`, and `i.reply` never used in the branch.
- Verification: `npx vitest run tests/commandsGamePlay.test.ts` → 4 pass; `npx vitest run` → all pass (in particular `tests/gameManager.test.ts` and `tests/gameThread.test.ts` untouched and green).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run build` exits 0
- [ ] `npx vitest run` exits 0; `tests/commandsGamePlay.test.ts` exists with ≥4 passing tests
- [ ] In the play branch of `handleGame`, `i.deferReply({ flags: MessageFlags.Ephemeral })` is the first await and no `reply(i,` call remains (inspect `sed -n '/if (sub === .play.)/,/if (sub === .stop.)/p' src/commands/index.ts`)
- [ ] The outer catch of `handleInteraction` is unmodified (`git diff fb7f916..HEAD -- src/commands/index.ts` shows changes only inside the play branch)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The play-branch code does not match the "Current state" excerpts (drift), or the outer catch does NOT contain the `i.deferred && !i.replied → editReply` branch.
- `handleInteraction`'s dispatch or the fake-interaction approach from `tests/commandsConfig.test.ts` does not work for `commandName: 'game'` (e.g. an upstream gate rejects the fake before reaching `handleGame`) after one honest debugging attempt — report what gate fired.
- The fix appears to require changing the shared `reply()` helper or other subcommand branches.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Anyone adding a new early-return to the play branch must use `i.editReply`, never `reply(i, …)` — after a defer, `i.reply` throws `InteractionAlreadyReplied`. Test 4 partially guards this.
- Reviewer should scrutinize: ephemerality is preserved (defer carries `MessageFlags.Ephemeral`; per the handleGame doc comment, play acks are ephemeral by design) and that `stop`/`list`/`leaderboard` were left untouched.
- Deferred on purpose: applying the same defer pattern to other handlers that do REST work before replying (none currently exceed the 3s budget in practice; audit separately if 10062 shows up elsewhere in the error webhook).
