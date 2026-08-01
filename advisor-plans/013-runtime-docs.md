# Plan 013: Correct the runtime migration documentation

> **Drift check**: `git diff --stat 99eef7d..HEAD -- crates/vozen-runtime/src/main.rs docs/RUST-MIGRATION-STAGING.md .env.rust.prod.example .env.rust.staging.example`

> **Reconciliation (2026-08-01)**: The main working tree already contains expanded staging-runbook
> edits and startup/image-smoke changes. Preserve them; execute the documentation-only header update
> from the clean baseline without changing runtime code or environment behavior.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 001, 002, 003
- **Category**: docs
- **Planned at**: commit `99eef7d`, 2026-08-01

## Why this matters

The module header still says the process is an opt-in shadow migration with voice/message ownership
awaiting canaries, while the production template and deploy workflow run Rust full mode. This can lead
operators to diagnose production using the wrong ownership and rollback assumptions.

## Steps

Update `crates/vozen-runtime/src/main.rs:3-7` to distinguish production full mode from staging/shadow
mode, link `docs/RUST-MIGRATION-STAGING.md`, and list the remaining staging-only flags. Do not change
any runtime behavior or env defaults.

**Verify**: `rg -n "shadow|full|voice-driver|RUST_RUNTIME_MODE" crates/vozen-runtime/src/main.rs docs/RUST-MIGRATION-STAGING.md .env.rust.prod.example .env.rust.staging.example`; `npm run check:rust-canaries` exits 0.

## Done criteria

- [ ] Runtime comments match production configuration.
- [ ] Staging instructions remain explicit and safe.
- [ ] No code or flag behavior changes.

## STOP conditions

- Stop if documentation cannot distinguish current production from a legacy branch without changing code.

## Maintenance notes

Update this header whenever command ownership or runtime mode defaults change.
