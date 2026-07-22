# Plan 021: Harden the Ko-fi email-based Premium claim (design spike + fix)

> **Executor instructions**: This is a **design/spike-then-implement** plan for
> a security-sensitive money path. Do Step 0 (investigate + decide) and STOP for
> operator confirmation of the chosen option before implementing Steps that
> change claim behavior. Run every verification command. Update this plan's row
> in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 965b15b..HEAD -- src/premium/claim.ts src/store/kofiPending.ts src/premium/kofiWebhook.ts src/premium/statusApi.ts`
> On any change to these, compare against "Current state" before proceeding.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (touches paid-grant application — a wrong change can break
  legitimate guest claims or double-grant)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `965b15b`, 2026-07-14

## Why this matters

The Ko-fi purchase claim (`POST /api/link`) lets a Discord-authenticated user
apply a pending paid purchase to their account. The **email** path
(`src/premium/claim.ts:66-73`) treats the buyer's email as the sole proof of
ownership: it hashes the submitted email and applies **all** unclaimed pending
grants for that hash to whoever is logged in — without ever checking that the
logged-in account's own email matches (the OAuth `identify` scope carries no
email: `src/premium/statusApi.ts` `resolveIdentity`). Pending grants remain
claimable by email for **90 days** (`src/store/kofiPending.ts:130`,
`PENDING_RETENTION_MS`). An email is not a secret. So for up to 90 days, anyone
who knows a buyer's email can log in with **any** Discord account and steal that
buyer's Premium; the real buyer then finds it already claimed. Mitigations
present: a tight rate limit (5 per 10 min per IP, `kofiWebhook.ts:508`) and a
generic 404. The tx-id path is fine (a high-entropy UUID from the receipt).

The email path exists deliberately — `claim.ts:45-46` calls it "o único
identificador que um comprador GUEST controla de forma fiável". So the fix is
**not** to delete it blindly (that breaks guest purchasers); it is to raise the
proof bar. This plan investigates the options and implements the chosen one.

## Current state

- `src/premium/claim.ts:53-89` — `claimPendingGrant(db, discordId, input,
  webhookToken, now)`. If `input` contains `@` → email path
  (`listUnclaimedPendingByEmailHash`); else → tx-id path
  (`findUnclaimedPendingByTx`). Transactional, single-use, applies all pendings
  of the same email hash.
- `src/store/kofiPending.ts:127-130` — `PENDING_RETENTION_MS = 90 days`;
  `purgeOldPendingGrants` runs on a schedule.
- `src/premium/kofiWebhook.ts:235-339` — `POST /api/link` handler: resolves
  identity via OAuth, calls `claimPendingGrant(ctx.db, identity.id, code,
  ctx.token, ctx.now())`. `ctx.token` is the Ko-fi webhook token (the HMAC key
  for `hashKofiEmail`).
- `src/premium/statusApi.ts` — `resolveIdentity` uses scope `identify`
  (no email).

Conventions: money paths are transactional and have characterization tests
(see `tests/kofiWebhook.test.ts`, `tests/claim*.test.ts` — run
`ls tests/ | grep -iE "claim|kofi"`). TDD mandatory. Portuguese comments.

## Step 0 — Investigate and choose (do this first, then STOP for confirmation)

Read `claim.ts`, `kofiPending.ts`, `statusApi.ts`, `kofiWebhook.ts` fully and
`docs/MONETIZATION.md` + any `docs/*AutoLink*`/`docs/HANDOFF-HETZNER-KOFI*`.
Determine and write a 5–10 line note in this plan file (append under a
"## Decision" heading) recommending ONE option:

- **Option A — tx-id only for cross-account claims** (recommended default):
  keep the email path only when the resolved OAuth account has *no* other
  signal, or drop the email path entirely and make the receipt tx-id the sole
  claim key. Guest buyers get the tx-id from their Ko-fi receipt email. Lowest
  code risk, highest security. Breaks: buyers who lost the receipt.
- **Option B — require email-match**: add the `email` OAuth scope, and in the
  email path require `hash(oauthEmail) == hash(submittedEmail)`. Strong, but
  adds a scope (re-consent) and PII-adjacent handling; verify Discord returns a
  verified email.
- **Option C — shorten the window + keep email**: cut `PENDING_RETENTION_MS`
  for *unclaimed-by-email* pendings to e.g. 7 days, accept the residual risk,
  and document it. Cheapest, weakest.

**STOP** and report the recommendation with its trade-offs. Implement only the
option the operator confirms.

## Steps (after the operator picks an option)

The implementation differs by option; here is Option A (the recommended path)
concretely. If B or C is chosen, adapt scope accordingly and keep the test
discipline.

### Step A1: Route email input away from cross-account application

In `claim.ts`, change the email branch so it no longer applies grants to an
arbitrary logged-in account. Minimal shape: if `input.includes('@')`, return a
distinct outcome `{ ok: false, reason: 'use_receipt_code' }` (new reason)
instead of applying. Keep tx-id path unchanged. Add the reason to the
`ClaimOutcome` type and map it in `kofiWebhook.ts` to a helpful response
("Please paste the transaction code from your Ko-fi receipt email instead").

### Step A2: Update the account UI copy

`site/account.html` (and its i18n if the claim form has localized strings —
grep `site/js` for the claim/link copy): tell buyers to paste the **receipt
transaction code**, not their email. Do NOT change the OAuth flow.

### Step A3: Tests

Model on the existing claim tests. Cases:
- email input → `use_receipt_code` (no grant applied; assert the pending row is
  still unclaimed and no `premium_pass`/`premium_user` row was created);
- valid tx-id → grant applied (regression: the good path still works);
- tx-id belonging to a different email → still applies only that purchase chain
  as before (unchanged behavior).

**Verify**: `npx vitest run tests/claim*.test.ts tests/kofiWebhook.test.ts` → all pass.

### Step A4: Full gates

**Verify**: `npm run build && npm run typecheck && npm run lint` exit 0;
`npx vitest run` all pass; `npx prettier --check src/premium/claim.ts src/premium/kofiWebhook.ts` clean.

## Done criteria

- [ ] "## Decision" section appended with the chosen option + rationale
- [ ] Operator confirmed the option before behavior changed (note it in the row)
- [ ] For Option A: `grep -n "listUnclaimedPendingByEmailHash" src/premium/claim.ts`
      no longer applies grants to `discordId` on the email path (returns the new reason)
- [ ] New tests exist and pass; existing money-path tests stay green
- [ ] `npm run build/typecheck/lint` exit 0; full suite green
- [ ] `plans/README.md` row updated

## STOP conditions

- Files drifted from the excerpts.
- Step 0 reveals the email path IS a documented, deliberately-accepted risk in
  `docs/` (then this becomes a docs-only finding — record it and stop).
- Any change would double-apply a grant or break the tx-id path — stop and
  report; money bugs are worse than the exposure.

## Maintenance notes

- If Option B (email scope) is ever pursued later, it requires PRIVACY.md +
  re-consent handling — treat as its own plan.
- Reviewer: the money path is transactional and idempotent today (ledger
  `kofi_transaction`); confirm the change preserves single-use + no double-grant.
- The tight rate limit and generic 404 stay regardless of option.
