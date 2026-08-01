# Plan 003: Replace the stale Postgres voice-cache fingerprint gate

> **Drift check**: `git diff --stat 99eef7d..HEAD -- crates/vozen-runtime/src/postgres_voice_cache.rs crates/vozen-runtime/src/postgres_import.rs crates/vozen-runtime/src/postgres_outbox.rs`

> **Reconciliation (2026-08-01)**: The working tree contains uncommitted changes in the import/cache
> modules plus an untracked migration adding generation/fingerprint columns. The current draft still
> compares live refreshes to the immutable import fingerprint, so it can reject legitimate updates.
> Those user changes are preserved and excluded from the executor worktree; this execution must
> implement a genuinely separate live freshness marker and include the migration/test contract needed
> to compose with the pending local work.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: migration
- **Planned at**: commit `99eef7d`, 2026-08-01

## Why this matters

`postgres_voice_cache::refresh_once` compares current voice rows against the immutable fingerprint
written by the initial import. Any legitimate mirror write changes those rows, so every 15-second
refresh can fail with `FingerprintMismatch`, freezing the local voice/config cache at stale data.

## Current state

- `postgres_import.rs:112-130` writes `generation` and `fingerprint` only during import.
- `postgres_voice_cache.rs:81-88` reads that fingerprint on every refresh.
- `postgres_voice_cache.rs:123-127` rejects a changed snapshot.
- The outbox/mirror path legitimately updates voice-cache tables after import.

## Scope

**In scope**: generation/checkpoint semantics, cache refresh tests, and the staging runbook. **Out of
scope**: enabling the mirror in production, changing SQLite source-of-truth policy, or weakening the
initial import safety gate.

## Steps

### Step 1: Separate import identity from live snapshot freshness

Keep a durable initial-import marker, but validate refreshes using an updated generation/checkpoint
or a transaction-consistent read marker that the mirror advances after applied batches. Do not reject
ordinary row changes merely because content differs from the initial snapshot.

**Verify**: `rg -n "FingerprintMismatch|generation|fingerprint|checkpoint" crates/vozen-runtime/src/postgres_voice_cache.rs crates/vozen-runtime/src/postgres_import.rs crates/vozen-runtime/src/postgres_outbox.rs` shows the initial gate and live refresh gate are distinct.

### Step 2: Add regression coverage

Test initial import/load, a changed `guild_config` or voice row followed by refresh, a failed/incomplete
marker, and a genuinely inconsistent generation. Assert the last known-good local cache is retained on
remote failure.

**Verify**: `cargo test -p vozen-runtime postgres_voice_cache --locked` and the existing import tests pass.

### Step 3: Run migration gates

**Verify**: `node tools/check-rust-replica-contract.mjs`; `cargo fmt --check`; `cargo clippy --workspace --all-targets --locked -- -D warnings`; `cargo test --workspace --locked` — all exit 0.

## Done criteria

- [ ] Initial import still fails closed when absent or malformed.
- [ ] A legitimate post-import row update reaches the local cache on the next refresh.
- [ ] Inconsistent generation/checkpoint still fails closed and preserves last known good state.

## STOP conditions

- Stop if the proposed generation cannot be advanced atomically with the mirror batch.
- Stop if the change would allow an empty/unverified remote snapshot to replace local state.

## Maintenance notes

Document which marker is immutable import identity and which value represents live mirror freshness;
future schema migrations must not overload one field for both meanings.
