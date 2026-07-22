# Plan 032: Hardening bundle — error-scrubber, aborted-guard, biometric orphan sweep, env docs, intent decision

> **Executor instructions**: Five independent small items; each can be done and
> committed separately. Do the ones with clear verification first. Update this
> plan's row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat f1a1ac1..HEAD -- src/errorReporter.ts src/premium/kofiWebhook.ts src/store/dataLifecycle.ts src/commands/handlers/voice.ts src/commands/handlers/privacy.ts .env.example src/bot/client.ts`

## Status

- **Priority**: P3 (defense-in-depth + one worst-consequence-but-rare item)
- **Effort**: S each (DATA-06 is M)
- **Risk**: LOW (except DATA-06 sweep: MED — could delete a live sample if mis-parsed)
- **Depends on**: none
- **Category**: security / defense-in-depth / DX
- **Planned at**: commit `f1a1ac1`, audit findings SECRET-03, HTTP-01, DATA-06, SECRET-04, DISCORD-03

## Items

### Item A (SECRET-03) — broaden the error-webhook scrubber

`src/errorReporter.ts:36-51` `scrub()` redacts only the Discord bot-token shape and
`Bearer …`, then forwards (truncated) stacks to an external Discord webhook
(`ERROR_WEBHOOK_URL`). It does NOT redact OpenAI (`sk-…`), Google (`x-goog-api-key`/
`key=…`), the Ko-fi token, or the top.gg secret. No proven leak today (keys travel
in headers, and read call sites interpolate only status+detail), but this is a broad
egress path — defense-in-depth.

**Fix**: extend `scrub()` with patterns for `sk-[A-Za-z0-9_-]{20,}`, an
`x-goog-api-key`/`key=` value redaction, and a generic `authorization: …` header
redaction. Keep the redact-then-truncate ordering. **Test** (`tests/errorReporter*.test.ts`
or new): feed a synthetic stack containing a fake `sk-` and a fake `x-goog-api-key`
header value and assert the output contains `[REDACTED]` (use obviously-fake values;
never a real key).

### Item B (HTTP-01) — add the `if (aborted) return;` guard to the 4 body readers

`src/premium/kofiWebhook.ts` — the `req.on('data', …)` handlers at the claim (`:~292`),
dashboard POST (`:~466`), topgg (`:~531`), and Ko-fi catch-all (`:~628`) set
`aborted = true` + 413 + `req.destroy()` but don't guard the handler top with
`if (aborted) return;` the way `src/vote.ts:~207` does. Not exploitable today (after
`req.destroy()` Node stops emitting `data`), but a latent hazard if the surrounding
code is ever refactored to `await` before `destroy()`.

**Fix**: prepend `if (aborted) return;` to each of the four `data` handlers, matching
`vote.ts`. Pure consistency/defense-in-depth; no test needed beyond the existing
webhook tests staying green (the 413/oversized cases in `tests/kofi.test.ts` exercise
these).

### Item C (DATA-06) — biometric `.wav` orphan reconciliation sweep

The most sensitive data class (voice-clone `.wav`) can be orphaned on disk: `eraseUser`
/`/voice clone delete` delete the DB row, then `unlink` the file best-effort
(`.catch(()=>{})` / swallowed try/catch — `dataLifecycle.ts:~104-109`,
`voice.ts:~88-97`). If the process dies (or `unlink` throws — Windows lock) between
the row delete and the file removal, the sample is permanently orphaned with no DB
reference, so no future `/privacy erase` can find it.

**Fix**: on `ClientReady`, diff the `voice-clones/` directory against
`SELECT sample_path FROM user_clone` and delete files with no matching live
`sample_path`. **This is MED-risk** — match against actual `sample_path` values, NOT
a filename heuristic, or a live sample could be deleted.

**Test** (mandatory for this item): seed a temp `voice-clones/` dir with (a) a file
referenced by a `user_clone` row and (b) an orphan file with no row; run the sweep;
assert the orphan is removed and the referenced file survives. Follow the
`voiceClone`/`dataLifecycle` test patterns.

### Item D (SECRET-04) — document the operational env vars in `.env.example`

`FORCE_REGISTER` (`registerCommands.ts:75`), `WHISPER_MODEL` (`transcribe.ts:90`),
`PIPER_PERSISTENT` / `PIPER_WARM_VOICES` / `PIPER_MAX_CONCURRENCY` (`piper.ts:32,38,90`)
are read from `process.env` but absent from `.env.example`. Non-secret, non-required —
DX only.

**Fix**: add the five vars (with their defaults + a one-line comment each) to
`.env.example` under the existing advanced-tuning block. No test.

### Item E (DISCORD-03) — decide on the `GuildMembers` privileged intent

`src/bot/client.ts:35` requests `GatewayIntentBits.GuildMembers` (privileged). No
`GuildMember*` event handlers and no bulk `members.fetch()` exist; its only consumer
is `<@id>`→display-name resolution for TTS (`cleanText.resolveUser`), which already
degrades gracefully to username/`'alguem'`. Verification reviewers scrutinize
privileged intents at the ~75-server gate.

**This item is a MAINTAINER DECISION, not a code fix — do NOT drop the intent
unilaterally.** Deliverable: a short written recommendation (in this plan's PR
description or a note appended to `docs/COMPLIANCE-DISCORD.md`) laying out the
trade-off: keeping it (better spoken names for uncached users) vs dropping it
(smaller privileged-intent footprint, cleaner verification story, names fall back to
username). If the maintainer chooses to drop it, THEN remove the intent + add a test
that mentions still resolve to a fallback name. Leave the code as-is otherwise.

## Scope

**In scope**: the five files named per item + tests for A and C.
**Out of scope**: changing webhook behavior (B is a guard only); at-rest encryption
(the CLONE_KEY warning is plan 024); dropping the intent without a decision (E).

## Done criteria

- [ ] A: scrubber redacts `sk-`, Google key, and generic `authorization:` — with a test using fake values
- [ ] B: all four `data` handlers in `kofiWebhook.ts` start with `if (aborted) return;`; `tests/kofi.test.ts` still green
- [ ] C: `ClientReady` sweep removes orphan `voice-clones/*.wav` (matched against `sample_path`, not filenames) — with a seed-orphan-and-live test
- [ ] D: the five env vars are in `.env.example`
- [ ] E: a written keep-or-drop recommendation exists for the `GuildMembers` intent (no code change unless the maintainer decides to drop)
- [ ] `npm run check` exits 0

## STOP conditions

- Item C: if you cannot reliably match a file to a `sample_path` (path format
  differs between OSes, or `sample_path` is absolute vs relative), STOP — a wrong
  match deletes a live biometric sample. Prefer conservative: only delete files that
  provably have NO matching `sample_path` after normalizing both sides.
- Item E: do NOT remove the intent without an explicit maintainer decision recorded.

## Maintenance notes

- Item A: any new credential type added to the codebase should get a scrubber pattern.
- Item C: the sweep is the safety net for the best-effort unlinks; if clone storage
  moves (e.g. encrypted-at-rest per the deferred decision), the sweep must match the
  new on-disk naming.
