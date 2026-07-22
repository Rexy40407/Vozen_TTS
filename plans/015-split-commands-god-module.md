# Plan 015: Split the 2821-line src/commands/index.ts into per-domain handler modules (pure code movement)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat fb7f916..HEAD -- src/commands/index.ts`
> src/commands/index.ts WILL likely have drifted: plans 003 and 004 edit this
> same file, and this plan is ordered LAST for that reason. Drift from those
> plans is EXPECTED — this plan moves whatever code is live at execution time,
> not the fb7f916 snapshot. Re-measure the anchors in "Current state" (they
> are identified by symbol name, not only by line number) before starting.
> STOP only if a named symbol no longer exists or the file was already split.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/003-_.md and plans/004-_.md (they edit
  `src/commands/index.ts`; executing 015 first would make their diffs
  unappliable — execute this plan LAST among all plans touching
  `src/commands/`)
- **Category**: tech-debt
- **Planned at**: commit `fb7f916`, 2026-07-07

## Why this matters

`src/commands/index.ts` is 2821 lines (measured at fb7f916) containing 27
handler functions, all command definitions, autocomplete plumbing, and shared
helpers in one file. Every feature PR touches it, merge conflicts are
constant, and finding a handler means scrolling a 2.8k-line file. A mechanical
split into domain modules keeps every public import path working, changes zero
behavior, and uses the existing 1298-test suite as the safety net. This plan
is deliberately movement-only: no renames, no logic edits, no "while I'm
here" cleanups.

## Current state

- `src/commands/index.ts` — 2821 lines. Verified inventory at fb7f916:

**Exported symbols** (external contract — must remain importable from
`../commands/index` afterwards):
`localeForUser` (:122), `INVITE_PERMISSIONS` (:148), `commandDefs` (:786),
`JoinOutcome` (type, :803), `joinUserVoice` (:817), `handleMessageContextMenu`
(:977), `localePrefixOf` (:1057), `formatDuration` (:2266),
`filterModelChoices` (:2589), `filterJokeLanguages` (:2617),
`filterLocaleChoices` (:2633), `sanitizeAutocompleteChoices` (:2654),
`handleAutocomplete` (:2708), `handleInteraction` (:2752).

**Who imports from `src/commands/index`** (verified by grep; all must keep
working unchanged):

- `src/bot/client.ts:13` — `handleInteraction, handleAutocomplete, handleMessageContextMenu`
- `src/bot/registerCommands.ts:5` — `commandDefs`
- ~25 test files (`tests/commands*.test.ts`, `tests/autocomplete.test.ts`,
  `tests/metrics.test.ts`, `tests/smoke.test.ts`) importing `handleInteraction`,
  `commandDefs`, `handleAutocomplete`, `handleMessageContextMenu`,
  `localeForUser`, `formatDuration`, `filterJokeLanguages`, and the other
  filter helpers.

**Non-exported handlers** (all `async function handleX(i, deps)` unless
noted), with fb7f916 line anchors:
handleJoin (:837), handleLeave (:857), handleTts (:959), handleSkip (:1013),
handleShutup (:1033), handleLaugh (:1070), handleJoke (:1124),
handleTopSpeakers (:1202), handlePremium (:1221), handleRedeem (:1250),
handleMicroFun (:1280, extra `kind` param), handleBirthday (:1339),
handleVoiceDetection (:1371, extra `locale` param, called only from
handleVoice at :1743), handleVoiceClone (:1418, extra `locale` param, called
only from handleVoice at :1738), handleVoice (:1733), handleConfig (:1883),
handleSetup (:2121), handleStats (:2232), handleUptime (:2279),
handleBotstats (:2285), handleGame (:2310), handleInvite (:2461),
handleVote (:2497), handleHelp (:2532).

**Shared non-exported helpers**: `localeFor` (:~100, used by
handleInteraction's catch and others), `reply` (:792 —
`async function reply(i, content)` ephemeral reply), `commandDefsRaw` +
`DM_CAPABLE_COMMANDS` (feeding `commandDefs` at :786),
`computeAutocompleteChoices` (:2665, used only by handleAutocomplete).

**Dispatch**: `handleInteraction` (:2752-2821) is a switch over
`i.commandName` calling the handlers; its catch block uses `localeFor` and
`t('error.generic', ...)`.

**The import block** (index.ts:1-89) pulls from ~25 modules (discord.js,
stores, tts, games, content, i18n...). Each moved handler will need the subset
it uses — TypeScript will tell you exactly which (missing-symbol errors).

- Repo test conventions: tests import ONLY from `../src/commands/index` (never
  from submodules) — verified by grep; keeping index.ts re-exports satisfies
  them without touching any test file.

## Commands you will need

| Purpose                        | Command                                                  | Expected on success                             |
| ------------------------------ | -------------------------------------------------------- | ----------------------------------------------- |
| Install                        | `npm install`                                            | exit 0                                          |
| Typecheck                      | `npm run build`                                          | exit 0 (tsc, no errors)                         |
| Tests (all — the primary gate) | `npx vitest run`                                         | **all 114 files / 1298+ tests pass, unchanged** |
| Line count                     | `wc -l src/commands/index.ts src/commands/handlers/*.ts` | index.ts well under 1300                        |

(Verified at `fb7f916`: `npx vitest run` → 1298 passed in ~9 s. No lint script.)

## Scope

**In scope**:

- `src/commands/index.ts` (shrinks; keeps: imports it still needs, command
  defs/registry (`commandDefsRaw`, `DM_CAPABLE_COMMANDS`, `commandDefs`),
  autocomplete plumbing (`computeAutocompleteChoices`, `handleAutocomplete`,
  `sanitizeAutocompleteChoices`, the three `filter*` helpers), the dispatch
  `handleInteraction`, and re-exports)
- `src/commands/helpers.ts` (create — shared helpers)
- `src/commands/handlers/core.ts` (create)
- `src/commands/handlers/voice.ts` (create)
- `src/commands/handlers/config.ts` (create)
- `src/commands/handlers/games.ts` (create)
- `src/commands/handlers/fun.ts` (create)
- `src/commands/handlers/meta.ts` (create)

**Out of scope** (do NOT touch):

- ANY test file — 1298 passing tests unchanged is the acceptance criterion,
  and no test imports a new path.
- `src/bot/client.ts`, `src/bot/registerCommands.ts` — their imports from
  `../commands/index` must keep working as-is.
- `src/commands/messageHandler.ts`, `src/commands/prepareSpeech.ts`,
  `src/commands/resolveSynth.ts`.
- Any logic change whatsoever: no renaming symbols, no changing signatures,
  no reordering switch cases, no comment rewrites beyond the moved-file
  headers, no dead-code removal, no formatting sweeps.

## Git workflow

- Branch: `advisor/015-split-commands-god-module`
- Commit per extracted module (helpers, then each domain file, then the final
  index cleanup) — this makes `git log -p` reviewable as pure moves.
- Commit style: conventional-ish Portuguese one-liners, e.g.
  `refactor(commands): extrai handlers de voz para handlers/voice.ts (só movimento)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

Order matters: helpers first (everything depends on them), then domains, then
slim the index. After EVERY step run the same two gates:
`npm run build` → exit 0 AND `npx vitest run` → 1298+ pass. Never proceed on
red.

### Step 1: Extract shared helpers to `src/commands/helpers.ts`

MOVE (cut+paste, byte-identical bodies) from index.ts: `localeFor`,
`localeForUser`, `reply`, `INVITE_PERMISSIONS`, `localePrefixOf`,
`formatDuration`. Export ALL of them from helpers.ts (including the
previously-private `localeFor` and `reply` — the handler modules need them).
In index.ts add:

```ts
import { localeFor, reply } from './helpers';
export { localeForUser, INVITE_PERMISSIONS, localePrefixOf, formatDuration } from './helpers';
```

(index.ts itself still uses `localeFor` in handleInteraction's catch and
`reply`/others in the not-yet-moved handlers — the plain import covers that.)
Move only the imports helpers.ts needs (`PermissionsBitField`,
`MessageFlags`, `ChatInputCommandInteraction`, `BotDeps`, `getGuildConfig`,
i18n symbols, ...). Rationale for a separate helpers module instead of
importing back from `./index`: it keeps module dependency edges one-way
(handlers → helpers, index → handlers), avoiding require-cycles.

**Verify**: `npm run build` && `npx vitest run` → green;
`grep -n "export" src/commands/helpers.ts` lists the six symbols.

### Step 2: Extract `handlers/core.ts` (join/leave/tts/skip/shutup + context menu)

MOVE: `JoinOutcome` (type), `joinUserVoice`, `handleJoin`, `handleLeave`,
`handleTts`, `handleMessageContextMenu`, `handleSkip`, `handleShutup`.
Export every one of them (the handle* functions become exported so index.ts
can dispatch). In index.ts:

```ts
import { handleJoin, handleLeave, handleTts, handleSkip, handleShutup } from './handlers/core';
export { joinUserVoice, handleMessageContextMenu, type JoinOutcome } from './handlers/core';
```

Note: `handleSetup` (moves in Step 4) calls `joinUserVoice` — it will import
it from `'./core'` (sibling) or `'../handlers/core'`; wire that in Step 4.

**Verify**: `npm run build` && `npx vitest run` → green (especially
`tests/commandsJoin.test.ts`, `tests/commandsSpeakContext.test.ts`,
`tests/commandsTts.test.ts`, `tests/commandsSkip.test.ts`,
`tests/commandsShutup.test.ts`).

### Step 3: Extract `handlers/voice.ts`

MOVE: `handleVoiceDetection`, `handleVoiceClone`, `handleVoice` (keep the
three together — the first two are called only by `handleVoice`). Export
`handleVoice`; the other two can stay module-private in voice.ts. Index
imports `handleVoice` for the dispatch.

**Verify**: gates green (`tests/commandsVoiceSet.test.ts`,
`tests/commandsVoiceList.test.ts`, `tests/commandsDetection.test.ts`,
`tests/voiceClone.test.ts`, `tests/commandsPreview.test.ts`,
`tests/commandsOptout.test.ts`).

### Step 4: Extract `handlers/config.ts`

MOVE: `handleConfig`, `handleSetup`, `handleStats`. `handleSetup` imports
`joinUserVoice` from `./core`.

**Verify**: gates green (`tests/commandsConfig.test.ts`,
`tests/commandsSetup.test.ts`).

### Step 5: Extract `handlers/games.ts` and `handlers/fun.ts`

- games.ts: MOVE `handleGame` (plus any game-only private helpers adjacent to
  it — check for small functions used only by handleGame before moving).
- fun.ts: MOVE `handleLaugh`, `handleJoke`, `handleMicroFun`, `handleBirthday`.

**Verify**: gates green (`tests/gamesInteractive.test.ts`,
`tests/gameThread.test.ts`, `tests/commandsLaugh.test.ts`,
`tests/commandsJoke.test.ts`, `tests/microfun.test.ts`,
`tests/birthday.test.ts`).

### Step 6: Extract `handlers/meta.ts`

MOVE: `handleHelp`, `handleInvite`, `handleVote`, `handleUptime`,
`handleBotstats`, `handleTopSpeakers`, `handlePremium`, `handleRedeem`.
(`handleInvite` uses `INVITE_PERMISSIONS` → import from `../helpers`.)

**Verify**: gates green (`tests/commandsHelp.test.ts`,
`tests/commandsInvite.test.ts`, `tests/commandsVote.test.ts`,
`tests/commandsPublicStats.test.ts`, `tests/entitlements.test.ts`,
`tests/premium.test.ts`).

### Step 7: Slim index.ts and final sweep

index.ts now contains ONLY: its (pruned) import block, `commandDefsRaw` +
`DM_CAPABLE_COMMANDS` + `commandDefs`, the autocomplete plumbing
(`computeAutocompleteChoices`, `handleAutocomplete`,
`sanitizeAutocompleteChoices`, `filterModelChoices`, `filterJokeLanguages`,
`filterLocaleChoices`), `handleInteraction` (the dispatch switch, body
unchanged), the handler imports, and the re-exports. Remove now-unused
imports (tsc's `noUnusedLocals`, if enabled, or manual pruning — `npm run
build` must be clean either way).

Machine checks for "movement only":

1. `npx vitest run` → same totals as the pre-split baseline (run it on the
   branch base first and note the number — 1298 at fb7f916, possibly higher
   after plans 003/004).
2. For each moved function, the body is byte-identical:
   spot-check with `git log -p` or
   `git diff <base>..HEAD -- src/commands/ | grep "^[+-]" | grep -v "^[+-][+-]" | grep -v "^\+import\|^-import\|^\+export {\|^\+} from\|^[+-]$"`
   — the remaining +/- lines should be only `function` → `export function` /
   `export async function` visibility changes and moved-file headers, never
   edited statements.

**Verify**: `npm run build` → exit 0; `npx vitest run` → all pass;
`wc -l src/commands/index.ts` → under ~1300 lines.

## Test plan

No new tests — by design. The contract of this plan is that the EXISTING
suite passes byte-for-byte:

- Baseline: before Step 1, run `npx vitest run` on the branch point and record
  files/tests counts.
- After Step 7: identical counts, all green. Any delta (a skipped test, a
  changed count) violates the movement-only constraint.
- The suite covers every dispatch target (`tests/commands*.test.ts` drive
  `handleInteraction` end-to-end with fake interactions), so a broken import
  edge or a dropped switch case fails loudly.

Verification: `npx vitest run` → same file/test counts as baseline, 0 failures.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run build` exits 0
- [ ] `npx vitest run` exits 0 with the SAME file/test counts as the pre-split
      baseline (1298+ tests) — the primary done criterion
- [ ] `wc -l src/commands/index.ts` < 1300
- [ ] Six files exist under `src/commands/handlers/` plus
      `src/commands/helpers.ts` (`ls src/commands/handlers`)
- [ ] All 14 previously-exported symbols still resolve from the same path:
      `node -e "const m=require('./dist/commands/index.js'); const need=['localeForUser','INVITE_PERMISSIONS','commandDefs','joinUserVoice','handleMessageContextMenu','localePrefixOf','formatDuration','filterModelChoices','filterJokeLanguages','filterLocaleChoices','sanitizeAutocompleteChoices','handleAutocomplete','handleInteraction']; const miss=need.filter(k=>!(k in m)); if(miss.length){console.error(miss);process.exit(1)}console.log('ok')"`
      → prints `ok` (run after `npm run build`)
- [ ] `grep -rn "from '../commands/index'" src/bot` unchanged (client.ts,
      registerCommands.ts untouched: `git diff --stat -- src/bot` empty)
- [ ] No test file modified (`git diff --stat -- tests/` empty)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A named symbol from the Current state inventory no longer exists in
  index.ts, or the file has already been split (someone executed a similar
  refactor) — re-planning is needed, not adaptation.
- Plans 003/004 are IN PROGRESS (check `plans/README.md` status column) —
  executing concurrently guarantees conflicts; wait or report.
- Any test fails at any step and the fix would require changing a test file
  or changing moved code beyond visibility keywords (`export`) and import
  paths — that means the move altered behavior (typical culprit: a
  module-level side effect or a require cycle). Report the cycle rather than
  restructuring modules ad hoc.
- `npm run build` reveals a circular-import runtime hazard (e.g. a handler
  module needs a value from index.ts at module-load time, not call time).
  The design avoids this (handlers depend only on `./helpers` and external
  modules), so hitting one means the plan's dependency map missed something —
  stop and report which symbol.
- The suite's test count CHANGES (up or down) versus baseline.

## Maintenance notes

- Future handlers should be added to the matching `handlers/<domain>.ts` (or a
  new domain file), registered in `commandDefsRaw`, and wired in the
  `handleInteraction` switch — index.ts stays a thin registry/dispatcher.
- Reviewer should scrutinize: (a) that the diff is pure movement (use the
  Step 7 grep), (b) the pruned import block in index.ts, (c) that
  `handleVoiceDetection`/`handleVoiceClone` did NOT become exported (they are
  internal to voice.ts).
- Explicitly deferred: splitting `commandDefsRaw` (the ~640-line builder
  block) per domain — riskier (ordering affects registration payload) and not
  needed for the conflict-reduction goal; also deferred: any autocomplete
  refactor.
- This plan intentionally executes LAST: plans 003 and 004 edit
  `src/commands/index.ts`, and their reviewers expect the file layout they
  were written against.
