# Plan 020: Tighten the Ko-fi email claim path (defensive, no UX break)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 965b15b..HEAD -- src/premium/claim.ts src/store/kofiPending.ts src/premium/kofiWebhook.ts tests/`
> On any in-scope drift, compare "Current state" excerpts before proceeding;
> mismatch = STOP.

## Status

- **Priority**: P1 (security)
- **Effort**: M
- **Risk**: MED — touches the money path; characterization tests first.
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `965b15b`, 2026-07-14

## Why this matters

A Ko-fi purchase that arrives without a linkable Discord ID becomes a
"pending grant" claimable at `vozen.org/account`. The **email path** accepts a
plain email address as the only proof of ownership: anyone who knows a
buyer's email (not a secret) and logs in with ANY Discord account can claim
that buyer's paid Premium for up to **90 days** (`PENDING_RETENTION_MS`).
The legitimate buyer then finds their purchase already claimed. The tx-id
path is fine (high-entropy UUID from the receipt). Current mitigations: a
tight per-IP rate bucket and generic 404 responses. This plan reduces the
exposure window and adds an audit trail WITHOUT breaking the guest-buyer UX —
the email path is a deliberate product decision (see the code comment below);
removing it requires an operator decision, explicitly out of scope here.

## Current state

- `src/premium/claim.ts:44-52` — doc comment records the product decision:
  "O `input` é o EMAIL do Ko-fi (via principal — o único identificador que um
  comprador GUEST controla de forma fiável) OU o CÓDIGO da transação".
- `src/premium/claim.ts:66-73` — email branch: hashes the input with the
  webhook token (`hashKofiEmail`) and applies ALL unclaimed pendings for that
  hash to the OAuth-authenticated `discordId`. No binding between the claimer
  and the email is possible (`resolveIdentity` in `src/premium/statusApi.ts`
  uses scope `identify` only — no email scope).
- `src/store/kofiPending.ts:127-130` — `PENDING_RETENTION_MS = 90 days`; the
  purge job removes pendings older than that.
- `src/premium/kofiWebhook.ts:508` — `const claimRate = new Map<string, RateState>();`
  a separate, tighter rate bucket for the claim endpoint (keyed per IP).
- Existing money tests: `tests/kofiWebhook.test.ts`, `tests/claim.test.ts`
  (verify the exact filenames with `ls tests/ | grep -i -E "kofi|claim"`) —
  model new tests on their style.

Conventions: TypeScript strict, Portuguese comments, TDD mandatory (failing
test first), prepared statements only, all new tables must be registered in
`src/store/dataLifecycle.ts` lists or `tests/dataLifecycle.test.ts` fails
(rot-guard).

## Commands you will need

| Purpose    | Command                          | Expected            |
|------------|----------------------------------|---------------------|
| Typecheck  | `npm run typecheck`              | exit 0              |
| Build      | `npm run build`                  | exit 0              |
| Money tests| `npx vitest run tests/claim.test.ts tests/kofiWebhook.test.ts tests/kofiPending.test.ts` | all pass |
| Full suite | `npx vitest run`                 | all pass            |
| Lint/format| `npm run lint && npx prettier --check <touched>` | clean |

## Scope

**In scope**:
- `src/store/kofiPending.ts` (retention split)
- `src/premium/claim.ts` (audit log call, claim-attempt throttle hook)
- `src/premium/kofiWebhook.ts` (per-account throttle wiring, if placed here)
- `src/store/db.ts` (only if adding the audit column/table — see Step 3)
- `src/store/dataLifecycle.ts` + `tests/dataLifecycle.test.ts` fixture (only
  if a new user-keyed table is added)
- `PRIVACY.md` (only if a new stored datum is added — disclosure duty)
- tests for all of the above

**Out of scope** (do NOT touch):
- Removing or gating the email claim path itself — **operator decision**;
  the code comment records it as the deliberate primary path for guest buyers.
- `src/premium/statusApi.ts` OAuth scopes (adding `email` scope changes the
  consent screen and re-auth flow — separate product decision).
- The site frontend (`site/`).

## Git workflow

- Branch: `advisor/020-kofi-claim-tightening`.
- Commits: Portuguese one-liners, e.g. `sec(kofi): janela de claim por email 14d + registo de claims`.
- Do NOT push unless instructed.

## Steps

### Step 1: Characterization tests of today's behavior (write FIRST)

In the existing claim test file, add tests that pin current behavior:
- email with