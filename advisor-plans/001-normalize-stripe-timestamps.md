# Plan 001: Normalize Stripe entitlement timestamps

> **Executor instructions**: Work only in an isolated worktree. Follow every gate. Do not print,
> copy, or commit credentials. Do not push or deploy.
>
> **Drift check**: `git diff --stat 99eef7d..HEAD -- crates/vozen-store/src/stripe.rs crates/vozen-api/src/stripe_api.rs`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `99eef7d`, 2026-08-01

## Why this matters

Stripe webhook timestamps arrive in Unix seconds, while the subscription row is later stored in
milliseconds by `InvoicePaid`. The fallback at `crates/vozen-store/src/stripe.rs:205-208` multiplies
an already-millisecond value by 1000, potentially granting Premium for an effectively unbounded
period. `SubscriptionUpdated` also stores raw seconds, so event order changes entitlement semantics.

## Current state

- `crates/vozen-api/src/stripe_api.rs:626-649` parses `period.end` and `current_period_end` as integers.
- `crates/vozen-store/src/stripe.rs:205-208` assumes seconds and writes milliseconds.
- `crates/vozen-store/src/stripe.rs:262-267` writes the subscription-update value without conversion.
- The database field `stripe_subscription.current_period_end` is used as a millisecond expiry by the
  Premium grant calculations. Preserve existing API and webhook idempotency behavior.

## Scope

**In scope**: the Stripe parser/store event boundary and regression tests in the existing Stripe test
modules. **Out of scope**: changing prices, plans, webhook authentication, or entitlement products.

## Steps

### Step 1: Establish one timestamp unit

Document and enforce that all internal `current_period_end` values are Unix milliseconds. Convert
provider seconds exactly once at `stripe_event_input` or at the store boundary. A missing invoice
period must either use an already-normalized millisecond value without re-multiplication or fail
closed; never infer a second-based value from an ambiguous integer.

**Verify**: `rg -n "current_period_end|period_end" crates/vozen-api/src/stripe_api.rs crates/vozen-store/src/stripe.rs` shows one explicit conversion boundary.

### Step 2: Add regression tests

Cover: checkout then invoice with a period, invoice without a period after a stored millisecond
expiry, subscription.updated with a period, subscription.updated without a period, and duplicate
event IDs. Assert realistic millisecond ranges and that no result saturates to an enormous expiry.

**Verify**: `cargo test -p vozen-store stripe --locked` and `cargo test -p vozen-api stripe --locked` pass.

### Step 3: Run the workspace gates

**Verify**: `cargo fmt --check`; `cargo clippy --workspace --all-targets --locked -- -D warnings`;
`cargo test --workspace --locked`; `node tools/check-rust-contracts.mjs` — all exit 0.

## Done criteria

- [ ] All Stripe period fields have one documented internal unit.
- [ ] Missing-period invoices cannot multiply milliseconds again.
- [ ] Regression tests cover both webhook event orders and idempotency.
- [ ] Workspace formatting, clippy, tests, and contract checks pass.
- [ ] Only the in-scope files changed.

## STOP conditions

- Stop if production data cannot be classified as seconds or milliseconds without a migration plan.
- Stop if fixing the unit requires changing public webhook payloads or payment products.
- Stop after two failed verification attempts and report the failing command.

## Maintenance notes

Keep timestamp conversion at the Stripe ingress boundary. Any new provider event must use the same
millisecond type or a named wrapper; do not add another raw `i64` path without a unit test.
