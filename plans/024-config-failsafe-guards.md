# Plan 024: Config-load fail-safe guards (present-but-empty secrets, CLONE_KEY, redundant webhook listener)

> **Executor instructions**: TDD where the logic is pure; docs/warn where not.
> Update this plan's row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat f1a1ac1..HEAD -- src/config/index.ts src/vote.ts .env.example`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security (fail-safe config)
- **Planned at**: commit `f1a1ac1`, audit findings SECRET-01, SECRET-02

## Why this matters

Two config-load gaps let a security control silently degrade with **no signal**:

1. **Present-but-empty secret is indistinguishable from absent** (SECRET-01).
   `src/config/index.ts:280` reads `topggWebhookSecret: strEnv('TOPGG_WEBHOOK_SECRET', '') || undefined`,
   collapsing "not set" and "set to empty" to `undefined`. dotenv v16 resolves
   **duplicate keys last-wins**, so a stray leftover `TOPGG_WEBHOOK_SECRET=` line
   (exactly the state the production `.env` reached during manual edits) silently
   overwrites the real value with empty → the vote webhook stops working while the
   operator still sees the real line in the file. Same risk for
   `KOFI_WEBHOOK_TOKEN`. Behaviour today is fail-**closed** (webhook disabled),
   but there is a **latent fail-open**: `handleVoteWebhook` (`src/vote.ts:113`)
   skips auth entirely when `secret === ''`; only config's `|| undefined` prevents
   an empty string reaching it. Rejecting present-but-empty at load makes that
   invariant explicit instead of incidental.

2. **`CLONE_KEY` absent silently stores biometric samples in plaintext** (SECRET-02).
   `src/config/index.ts:~302-305` derives `cloneKey` only if `CLONE_KEY` is set;
   `src/tts/cloneEngine.ts` then writes/reads `.wav` samples unencrypted with no
   warning. This is the genuine fail-open of the "empty secret disables a control"
   theme. Production exposure is currently low (clone OOMs on the VPS and is
   hidden), but any capable host enabling clone without `CLONE_KEY` stores
   biometric data unencrypted and is never told.

3. **Redundant dedicated webhook listener** (SECRET-01, secondary). If a leftover
   `TOPGG_WEBHOOK_PORT` remains set alongside a real secret, `src/index.ts` starts
   a SECOND authenticated `/webhook/topgg` listener on the dedicated port in
   addition to the shared one on the API port — an easy-to-forget extra surface.
   Production uses the shared `api.vozen.org/webhook/topgg` route; the dedicated
   port is not needed there.

## Current state (exact locations)

- `src/config/index.ts:280` — `topggWebhookSecret: strEnv('TOPGG_WEBHOOK_SECRET', '') || undefined`.
- `src/config/index.ts` — `kofiWebhookToken` read similarly (grep `KOFI_WEBHOOK_TOKEN`); `cloneKey` derived near line ~302.
- `src/config/index.ts:229-230` — existing fail-fast on `DISCORD_TOKEN`/`CLIENT_ID` (the pattern to mirror for the new warnings).
- `src/vote.ts:113` — `handleVoteWebhook` treats `secret === ''` as "no auth".
- `.env.example` — where a "no duplicate keys" note belongs (dotenv can't detect a duplicate at `loadConfig` time — it has already collapsed them — so this is a documentation guard).

## Scope

**In scope**: `src/config/index.ts` (a validation/warn pass), `.env.example` (a
comment), one test for the pure validation helper. Optionally a startup `warn`
wired from `src/index.ts` for the CLONE_KEY case (needs `cloneEngine.available`).
**Out of scope**: changing `handleVoteWebhook`'s empty-secret behavior (the config
guard is the fix); the webhook routing; adding encryption where CLONE_KEY is
unset (that's the deferred at-rest decision — only WARN, don't change behavior).

## Approach

Add a pure `validateConfigEnv(env)` helper (testable) that inspects `process.env`
and returns an array of `{ level: 'warn'|'error', message }`:
- **present-but-empty**: for `TOPGG_WEBHOOK_SECRET` and `KOFI_WEBHOOK_TOKEN`, flag
  when `KEY in env && env[KEY].trim() === ''` → a loud warning (recommend `error`
  only if you also want to refuse start; a WARN is the safer default so a
  half-configured box still boots the rest of the bot). Message must name the var
  and say "present but empty — a stray/duplicate line may have clobbered it".
- **redundant listener**: warn when `TOPGG_WEBHOOK_PORT` is set AND
  `TOPGG_WEBHOOK_SECRET` is non-empty (dedicated listener redundant with the
  shared route).
- Do NOT reproduce any secret value in the message (name the var only).

The CLONE_KEY warning needs runtime info (`cloneEngine.available`), so wire it
where the engine availability is known (`src/index.ts`, near the clone-engine
setup ~line 131): if the clone engine is available and `config.cloneKey` is
undefined, `log.warn(...)` that biometric samples will be stored UNENCRYPTED and
`CLONE_KEY` should be set.

Also add to `.env.example`: a one-line note under the webhook vars — "não
dupliques chaves neste ficheiro; o dotenv usa a ÚLTIMA — uma linha
`TOPGG_WEBHOOK_SECRET=` vazia a seguir à boa desliga o webhook em silêncio."

## Steps

1. **(RED)** Add `tests/configValidation.test.ts` for `validateConfigEnv`:
   - `{ TOPGG_WEBHOOK_SECRET: '' }` → one `warn`/`error` mentioning the var.
   - `{ TOPGG_WEBHOOK_SECRET: 'x' }` → no finding for it.
   - `{}` (absent) → no finding (absent is legitimately "feature off").
   - `{ TOPGG_WEBHOOK_PORT: '3002', TOPGG_WEBHOOK_SECRET: 'x' }` → a redundancy warn.
   - Assert NO secret value appears in any message.
2. **(GREEN)** Implement `validateConfigEnv` in `src/config/index.ts` (exported,
   pure — takes an env record, returns findings; no reading of `process.env`
   inside so it's testable). Call it inside `loadConfig` and `log.warn`/`log.error`
   each finding (reuse the logger; keep fail-fast only for the existing required
   vars unless you deliberately choose to hard-fail empty secrets).
3. Wire the CLONE_KEY warning in `src/index.ts` where clone availability is known.
4. Add the `.env.example` note.

## Test plan

- `tests/configValidation.test.ts` (Step 1) covers the pure helper incl. the
  "no secret value leaks into the message" assertion.
- `npm run check` green.

## Done criteria

- [ ] `tests/configValidation.test.ts` passes (empty-secret, present-secret, absent, redundant-port, no-leak)
- [ ] Booting with `TOPGG_WEBHOOK_SECRET=` (empty) emits a warning naming the var (manual: not asserted in CI)
- [ ] `.env.example` has the "no duplicate keys / dotenv last-wins" note
- [ ] `npm run check` exits 0
- [ ] No secret value is printed anywhere the helper runs

## STOP conditions

- If `loadConfig` already has a validation aggregator, extend it instead of adding
  a parallel one — report the shape you found.
- Do NOT change `handleVoteWebhook` to hard-reject `''` in this plan (that's a
  behavior change to the webhook path; the config guard is the agreed fix). If you
  believe it should also be hardened, note it as a follow-up.

## Maintenance notes

- Any new secret-backed feature should add its var to `validateConfigEnv` so
  present-but-empty is caught consistently.
- The dotenv last-wins caveat is a property of the loader; if the project ever
  adds a `.env` linter (e.g. dotenv-linter in CI), it supersedes the `.env.example`
  note for catching duplicates before deploy.
