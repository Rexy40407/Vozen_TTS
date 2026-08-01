# Plan 016: Define the shadow-flag retirement matrix

> **Drift check**: `git diff --stat 99eef7d..HEAD -- crates/vozen-runtime/src/main.rs .env.rust.prod.example .env.rust.staging.example tools/check-rust-canaries.mjs docs/RUST-MIGRATION-STAGING.md`

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: 001, 002, 003, 006
- **Category**: direction
- **Planned at**: commit `99eef7d`, 2026-08-01

## Why this matters

Production already runs Rust full mode while staging retains many independent ownership flags and the
runtime still describes itself as shadow migration. This split-brain surface makes command availability
and future releases harder to reason about. Removing flags without parity evidence could silently drop
commands or data, so this plan is a design/deprecation exercise first.

## Steps

1. Inventory every `RUST_*` flag in `main.rs:336-569`, ownership mapping, production/staging examples,
   and contract canaries. Classify each as production-default, staging-only, or legacy. **Verify**:
   `node tools/check-rust-canaries.mjs` and a generated inventory diff are clean.
2. Add telemetry/contract evidence that no command remains Node-owned and that rollback can restore the
   previous owner. **Verify**: CI canary/contract checks and the gateway-sink tests from Plan 006 pass.
3. Propose a staged deprecation matrix with dates, removal guards, rollback criteria and an operator
   sign-off checkpoint. Do not delete flags in this plan. **Verify**: review the matrix against
   `docs/RUST-MIGRATION-STAGING.md` and `.github/workflows/deploy-bot.yml`.

## Done criteria

- [ ] Every flag has an owner, environment, purpose and retirement condition.
- [ ] No flag is removed before parity and rollback evidence exists.
- [ ] The result is a reviewed deprecation plan, not an untested cleanup.

## STOP conditions

- Stop if any command has ambiguous ownership or lacks a tested rollback path.
- Stop if evidence would require production traffic changes or a live deploy.

## Maintenance notes

Only a later, explicitly approved migration plan may remove a flag; keep the matrix current as features
graduate from canary to full production ownership.
