# Plan 012: Audit and document duplicate Cargo dependency stacks

> **Drift check**: `git diff --stat 99eef7d..HEAD -- Cargo.toml Cargo.lock crates/*/Cargo.toml .github/workflows/ci.yml`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: none
- **Category**: dependencies
- **Planned at**: commit `99eef7d`, 2026-08-01

## Why this matters

The locked graph contains multiple rustls/tokio-rustls/webpki-roots, rand, thiserror and legacy
transitive branches across Serenity/Songbird, Reqwest, SQLx and chess. This increases build size and
the number of stacks to evaluate during security updates. No CVE claim is made by this plan.

## Steps

1. Capture `cargo tree -d --workspace --locked`, `cargo tree --workspace --locked -e features`, and
   `cargo audit` if installed; record only reachable runtime results. **Verify**: commands complete and
   no secret values are output.
2. For each duplicate, identify the root and test compatible feature/version alignment in an isolated
   branch. Do not upgrade Serenity/Songbird/SQLx blindly. **Verify**: `cargo check --workspace --all-targets --locked`.
3. Keep a small documented exception list for irreducible duplicates and run voice-driver CI gates.

## Done criteria

- [ ] Every retained duplicate has a root cause or documented compatibility reason.
- [ ] Any reduction preserves the lockfile and runtime TLS/voice behavior.
- [ ] `cargo test --workspace --locked` and release voice tests pass.

## STOP conditions

- Stop if a candidate upgrade changes Discord gateway/voice behavior or lacks a staging canary.
- Stop if `cargo audit` reports a high/critical reachable advisory; split remediation into a separate P1 plan.

## Maintenance notes

Re-run this audit after major Serenity, Songbird, Reqwest or SQLx upgrades; do not optimize duplicates
at the expense of supportability.
