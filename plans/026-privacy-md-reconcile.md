# Plan 026: Reconcile PRIVACY.md with the real schema (§1 table) and STT audio wording (§2.4)

> **Executor instructions**: Docs-only, high-certainty text edits. Cross-check every
> row against `src/store/db.ts` before writing. Do not reflow unrelated lines.
> Update this plan's row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat f1a1ac1..HEAD -- PRIVACY.md src/store/db.ts`

## Status

- **Priority**: P2 (Discord Policy requires accurate disclosure; wrong docs mislead data-subject requests)
- **Effort**: M
- **Risk**: LOW
- **Depends on**: coordinate with plan 025 (which also touches `gcloud_usage` disclosure — do 025 first or merge the `gcloud_usage` row here)
- **Category**: docs / compliance
- **Planned at**: commit `f1a1ac1`, audit findings DATA-05, DATA-04

## Why this matters

`PRIVACY.md §1` is the disclosed inventory of stored data (a Discord Developer
Policy obligation). It currently: describes a table that **does not exist**, hides
the identity column of a **recorded third party**, and omits several user-facing
stores. Separately, §2.4 makes a categorically **false** statement about the most
sensitive processing (raw voice audio). Wrong docs are worse than missing — a user
reading them cannot learn what is actually held, and a data-subject request would
be answered against a fictional schema.

## Current state (exact discrepancies — verify each against `src/store/db.ts`)

1. **`PRIVACY.md:33`** discloses a table **`redeem_code`** with columns
   `code, kind, days, used_by, used_at, created_at`. That table does not exist.
   The real one is **`premium_code`** (`db.ts:~282-292`): `code, plan, days, seats,
   created_by, created_at, expires_at, redeemed_by, redeemed_at`. (`kind`→`plan`,
   `used_by`→`redeemed_by`, and `seats`/`created_by`/`expires_at` undisclosed.)
2. **`PRIVACY.md:35`** discloses `user_clone` as `user_id, sample_path, consent_at,
   enabled` — omits **`target_id`** (`db.ts:172`), the Discord ID of the *recorded
   third party*. §2.3 also never mentions `target_id`.
3. **Tables entirely absent from §1** despite storing user/guild data:
   `pronunciation_user` (`db.ts:~76`, personal pronunciations — it IS erased at
   `dataLifecycle.ts:52` but never disclosed), `premium_pass` (`db.ts:~193`),
   `premium_pass_activation` (`db.ts:~204`), `kofi_pending` (`db.ts:~254`, stores
   `email_hash`), `gcloud_usage` (see plan 025), plus operational `voice_presence`
   and `guild_departed`.
4. **`guild_config` disclosed columns** (`PRIVACY.md:20`) omit `antispam`,
   `stay_in_call`, `streak_announce`, `soundboard` (present at `db.ts:~39-42`).
5. **`PRIVACY.md:88` (§2.4)** asserts: "No audio is ever stored… the bot **never
   writes an audio file for transcription**." This is false: STT writes a transient
   temp WAV to `os.tmpdir()` (`src/voice/transcriptionSession.ts:87-93`) that the
   Whisper sidecar reads by path (`src/voice/whisperTranscriber.ts:95`). The file
   IS deleted immediately in a `finally` (`transcriptionSession.ts:99-105`), so the
   exposure is tiny — but the disclosure must match reality.

## Scope

**In scope**: `PRIVACY.md` (§1 table rows, §2.3 `target_id` mention, §2.4 wording,
and the "Nota/Note (EN)" summary paragraph if it repeats the same claims).
**Out of scope**: any `src/` change; PRIVACY translations on the site (note them as
a follow-up if the site mirrors this file); adding the `gcloud_usage` row if plan
025 already added it (avoid duplication — coordinate).

## Steps

1. **Fix the `premium_code` row**: replace the `redeem_code` row with a
   `premium_code` row using the real columns; describe it as offline-generated
   Premium codes (created_by/redeemed_by are Discord IDs; financial-retained).
2. **Add `target_id` to `user_clone`**: update the §1 row's columns and add a
   sentence to §2.3 that a clone records BOTH the owner (`user_id`) and, for a
   third-party recording, the recorded person's `target_id` (who can always revoke).
3. **Add the missing tables** to §1: `pronunciation_user`, `premium_pass`,
   `premium_pass_activation`, `kofi_pending` (note it stores only `email_hash`,
   never plaintext), and `gcloud_usage` (unless 025 did it). For operational
   `voice_presence`/`guild_departed`, either add short rows or a footnote that the
   bot keeps ephemeral operational rows (voice presence, guild-departure marker)
   purged on guild-leave.
4. **Complete `guild_config` columns**: add `antispam`, `stay_in_call`,
   `streak_announce`, `soundboard` to the disclosed list.
5. **Fix §2.4 wording**: change "never writes an audio file for transcription" to
   state that a **transient temp file** is written and **deleted immediately** after
   the local sidecar transcribes it (never persisted, never sent externally).
   Update the "Nota/Note (EN)" paragraph if it repeats the claim.

## Test plan

No unit tests (docs). Verification is greps + a manual read-through against
`db.ts`.

## Done criteria

- [ ] `grep -n "redeem_code" PRIVACY.md` → no matches (replaced by `premium_code`)
- [ ] `grep -n "target_id" PRIVACY.md` → ≥1 match (in §1 and/or §2.3)
- [ ] `grep -n "pronunciation_user" PRIVACY.md` and `kofi_pending` → each ≥1 match
- [ ] `grep -n "never writes an audio file" PRIVACY.md` → no matches
- [ ] Every table created in `db.ts` with user/guild data is represented or footnoted in §1 (manual cross-check)
- [ ] `npm run build:site` still passes the mojibake guard (PRIVACY.md is not minified but keep encoding clean)
- [ ] Only `PRIVACY.md` changed

## STOP conditions

- If a table's columns in `db.ts` differ from what's written here (drift since
  `f1a1ac1`), disclose what the schema actually says, not this plan's snapshot.
- If the site ships its own copy of the privacy policy (check `site/` for a
  privacy page), note that it also needs updating — do NOT edit the site in this
  plan; flag it as a follow-up.

## Maintenance notes

- `db.ts` is the source of truth; whenever a table is added/changed, §1 must move
  with it. Plan 025's broadened rot-guard catches undeleted identifier columns but
  does NOT catch undisclosed ones — disclosure drift is still a manual gate.
