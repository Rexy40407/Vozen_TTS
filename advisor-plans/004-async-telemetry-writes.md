# Plan 004: Move telemetry writes off the speech hot path

> **Drift check**: `git diff --stat 99eef7d..HEAD -- crates/vozen-discord/src/message_voice_service.rs crates/vozen-store/src/runtime_batch.rs crates/vozen-runtime/src/postgres_outbox.rs`

> **Reconciliation (2026-08-01)**: The working tree already contains uncommitted changes to
> `RuntimeBatchBuffer` (including an enabled/disabled mode) and runtime metrics reporting. Those
> changes are preserved and excluded from the executor worktree; this plan must compose with the
> existing batch API rather than overwrite it, while still moving speech telemetry persistence off
> the synchronous path.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `99eef7d`, 2026-08-01

## Why this matters

Accepted speech currently performs synchronous SQLite metrics, provider-health, talk, guild-talk and
usage writes while holding the global store mutex. Under concurrent guild traffic this serializes the
message path and contributes directly to the delay users hear.

## Current state

- `message_voice_service.rs:392-402` records a batch event then writes an operational metric immediately.
- `message_voice_service.rs:425-477` repeats synchronous metric/provider and three talk writes.
- `RuntimeBatchBuffer` is in-memory and does not itself perform I/O.
- Counters are best-effort; entitlement/config writes must remain synchronous.

## Scope

**In scope**: speech telemetry event types, a bounded background writer/coalescer, flush/shutdown behavior,
and tests. **Out of scope**: changing user-visible quota rules, entitlement writes, or the SQLite schema
unless an explicitly reviewed index is required.

## Steps

### Step 1: Characterize current ordering and failure semantics

Add tests/metrics showing accepted speech returns without waiting on telemetry I/O, while quota and
entitlement decisions remain synchronous. Define a bounded queue policy and an explicit shutdown flush.

**Verify**: targeted `cargo test -p vozen-discord message_voice_service --locked` passes before refactor.

### Step 2: Add the writer and switch telemetry callers

Enqueue aggregate events, coalesce compatible counters, drain on a short interval, and preserve the
existing mirror/outbox events. On queue saturation, drop only best-effort telemetry and increment a
coarse drop metric; never drop quota reservations.

**Verify**: targeted tests prove no synchronous telemetry write occurs in `execute()` and shutdown flushes queued events.

### Step 3: Run latency and workspace gates

**Verify**: `cargo test --workspace --locked`; `cargo clippy --workspace --all-targets --locked -- -D warnings`; `cargo fmt --check`; `npm run check:rust` — all exit 0.

## Done criteria

- [ ] Speech acknowledgement does not synchronously write best-effort telemetry.
- [ ] Queue is bounded, observable, and flushed on graceful shutdown.
- [ ] Quota/entitlement correctness is unchanged and tested.

## STOP conditions

- Stop if persistence is required for a user-facing entitlement decision.
- Stop if a queue can grow without a hard memory bound.

## Maintenance notes

Keep telemetry loss semantics documented; do not silently convert entitlement or privacy mutations into
best-effort events.
