# Plan 010: Split runtime configuration and startup assembly

> **Drift check**: `git diff --stat 99eef7d..HEAD -- crates/vozen-runtime/src/main.rs crates/vozen-runtime/src`

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: 001, 002, 003
- **Category**: tech-debt
- **Planned at**: commit `99eef7d`, 2026-08-01

## Why this matters

`crates/vozen-runtime/src/main.rs` is over 4,000 lines and combines roughly 50 config fields, dozens
of env parsers, sink constructors, database setup, health, command registration and lifecycle workers.
This makes feature-flag drift and unsafe startup-order changes likely.

## Scope

Refactor only after characterization tests. Extract typed config groups and domain assembly modules,
but preserve defaults, opt-in flags, single-instance lock, health ordering and public behavior.

## Steps

1. Add feature-matrix and startup-order characterization tests for `main.rs:147-203`, `1018-1265`, and
   `2336-2440`. **Verify**: `cargo test -p vozen-runtime --locked`.
2. Move env parsing into typed sub-config modules; move sink factories by domain; keep `run()` as an
   ordered orchestrator. **Verify**: `cargo check --workspace --all-targets --locked`.
3. Remove only helpers with no callers and run all gates. **Verify**: `cargo fmt --check`; clippy;
   workspace tests; `node tools/check-rust-canaries.mjs`.

## Done criteria

- [ ] Startup ordering and feature defaults have regression tests.
- [ ] `main.rs` is a small orchestration module, not a behavior rewrite.
- [ ] All canary/contract/workspace gates pass.

## STOP conditions

- Stop on any change to production defaults, command ownership, database migration order, or health bind semantics.

## Maintenance notes

New feature flags must live in the typed config group and have a canary test; do not reintroduce direct
env reads into the composition root.
