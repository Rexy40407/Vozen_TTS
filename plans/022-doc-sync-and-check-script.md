# Plan 022: Fix wrong docs (compliance + onboarding + architecture) and add a `check` script

> **Executor instructions**: Follow step by step. Each fix is a small, exact
> text edit — do not rewrite surrounding prose. Run the verification greps.
> Update this plan's row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 965b15b..HEAD -- PRIVACY.md README.md docs/ARCHITECTURE.md package.json CONTRIBUTING.md`
> On any change, compare against "Current state" before editing.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs + dx
- **Planned at**: commit `965b15b`, 2026-07-14

## Why this matters

Four docs are actively wrong (worse than missing — a reader trusts them):
a compliance document names a data-deletion command that doesn't exist, the
public README recommends the exact production command the maintainer's hard
rule bans, and ARCHITECTURE.md describes removed behavior and a stale CI. Plus
there is no single command to reproduce CI's five gates locally, so a
contributor following CONTRIBUTING.md runs 2 of 5 and gets a red pipeline on
auto-deploy-to-main. All are small, high-certainty fixes.

## Current state (exact strings to change)

1. **`PRIVACY.md:107`** — documents a non-existent command. The real command is
   `/transcribe revoke` (there is no `consent` subcommand; consent is an inline
   button). Current line contains:
   `` | Your transcription consent   | `/transcribe consent revoke`     | Deletes your row in `stt_consent`… ``
   The actual handler: `src/commands/handlers/transcribe.ts:68` handles
   `sub === 'revoke'`; `src/commands/definitions.ts` defines subcommands
   `start`, `stop`, `revoke` only.

2. **`README.md:165`** — recommends the banned production path:
   `For a production build: ``npm run build`` and then ``npm start`` (or ``node dist/index.js``).`
   CONTRIBUTING.md (Commands) states: "Production: `npm run start:prod` — NEVER plain
   `npm start` in production" (it skips the supervisor's single-instance lock,
   preheat, auto-restart, logs — `scripts/start-prod.mjs`).

3. **`docs/ARCHITECTURE.md:422-425`** — "Limitações conhecidas" still says the
   voice is chosen by detected language on the main path:
   "A língua da mensagem pode sobrepor-se ao `default_voice` da guild. Como a voz
   é escolhida pela língua detetada (`pickVoiceForLang`)…". This contradicts the
   current main path: `src/commands/prepareSpeech.ts` uses `singleVoice: true`
   with no `detectLang` — the preferred voice reads all languages; detection now
   lives only in the flag-gated experimental `MULTILINGUAL_SEGMENTS` path.

4. **`docs/ARCHITECTURE.md:403`** — stale CI: "Corre `build` + `vitest` em Node
   20 e 22". Actual `.github/workflows/ci.yml` matrix is `[22.x, 24.x]` and the
   steps are build + typecheck + lint + format:check + vitest. Node 20 would
   also fail `package.json` `engines: ">=22.12.0"`.

5. **`package.json` scripts** — no aggregate `check`. CI (`ci.yml:29-33`) runs
   five gates; `CONTRIBUTING.md`'s closing line mentions only two
   (`npx vitest run + npm run typecheck`).

Conventions: docs in this repo mix EN (README, PRIVACY, ARCHITECTURE) — match
the surrounding language of each file. Do not reflow unrelated lines.

## Commands you will need

| Purpose   | Command                        | Expected      |
|-----------|--------------------------------|---------------|
| Verify #1 | `grep -n "transcribe revoke" PRIVACY.md` | 1 match, no "consent" |
| Verify #2 | `grep -n "start:prod" README.md` | ≥1 match      |
| Run check | `npm run check`                | exit 0        |

## Scope

**In scope**: `PRIVACY.md`, `README.md`, `docs/ARCHITECTURE.md`,
`package.json` (scripts only), `CONTRIBUTING.md` (one line).
**Out of scope**: any source under `src/`; the CI workflow file; the site.

## Git workflow

Branch `advisor/022-doc-sync`. Commit e.g.
`docs: corrigir comando de revoke, produção e CI + script check`.

## Steps

### Step 1: Fix the PRIVACY.md deletion command

In `PRIVACY.md:107`, change `/transcribe consent revoke` → `/transcribe revoke`
(leave the rest of the row unchanged).

**Verify**: `grep -n "consent revoke" PRIVACY.md` → no matches;
`grep -n "transcribe revoke" PRIVACY.md` → 1 match.

### Step 2: Fix the README production command

In `README.md:165`, replace the sentence so `npm run start:prod` is the
recommended path, keeping `node dist/index.js` only as an explicit
"no-supervisor" caveat. Suggested text:
"For production, use `npm run start:prod` (it runs the supervisor:
single-instance lock, native-module preheat, auto-restart, persistent logs).
`node dist/index.js` runs the bot directly **without** that supervisor — not
recommended in production."

**Verify**: `grep -n "start:prod" README.md` → ≥1; `grep -n "then \`npm start\`" README.md` → no matches.

### Step 3: Fix the ARCHITECTURE.md "Limitações conhecidas" voice bullet

Rewrite the bullet at `docs/ARCHITECTURE.md:422-425` to state that on the main
path the voice is fixed — the member's preferred/default voice reads every
language — and that language override survives only behind the experimental
`MULTILINGUAL_SEGMENTS` flag (`detectSegments`). Keep it to ~3 lines; don't
touch the neighboring `cacheKey` and multi-segment bullets except as needed for
consistency.

**Verify**: `grep -n "pickVoiceForLang" docs/ARCHITECTURE.md` → the claim no
longer asserts it drives the main path (0 in the Limitações bullet, or reworded).

### Step 4: Fix the ARCHITECTURE.md CI line

`docs/ARCHITECTURE.md:403`: change "Node 20 e 22" → "Node 22 e 24" and the
step list to "build + typecheck + lint + format:check + vitest".

**Verify**: `grep -n "Node 20" docs/ARCHITECTURE.md` → no matches.

### Step 5: Add the `check` aggregate script

In `package.json` `scripts`, add:
```json
"check": "npm run build && npm run typecheck && npm run lint && npm run format:check && vitest run"
```
Then update `CONTRIBUTING.md`'s closing verification line to reference `npm run check`
as the single command that reproduces CI (keep the mention of the individual
commands if present).

**Verify**: `npm run check` → exit 0 (this runs the full CI locally; expect it
to pass on a clean tree). If `format:check` fails on pre-existing unformatted
files OUTSIDE your edits, STOP and report (do not run `format:write` across the
repo — that is out of scope).

## Test plan

No unit tests (docs + a script). The verification is the greps above plus
`npm run check` exiting 0.

## Done criteria

- [ ] `grep -n "consent revoke" PRIVACY.md` → no matches
- [ ] `grep -n "then \`npm start\`" README.md` → no matches; `start:prod` present
- [ ] `grep -n "Node 20" docs/ARCHITECTURE.md` → no matches
- [ ] `npm run check` exits 0
- [ ] `grep -n "\"check\"" package.json` → 1 match
- [ ] Only in-scope files modified (`git status`)
- [ ] `plans/README.md` row updated

## STOP conditions

- Any target string differs from "Current state" (drift since `965b15b`) —
  re-locate the string, and if the meaning changed, report instead of guessing.
- `npm run check` fails due to a pre-existing lint/format/test issue unrelated
  to these edits — report it (it may be a real regression this plan surfaced,
  not something to silence).

## Maintenance notes

- ARCHITECTURE.md declares "código é a verdade" — when the main-path voice
  logic or CI changes again, this bullet/line must move with it.
- The `check` script is now the canonical local gate; future CI step additions
  should be mirrored into it.
