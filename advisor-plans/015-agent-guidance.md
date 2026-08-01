# Plan 015: Add repository-local agent and deploy guidance

> **Drift check**: `git diff --stat 99eef7d..HEAD -- AGENTS.md CONTRIBUTING.md docs/RUST-MIGRATION-STAGING.md .github/workflows/deploy-bot.yml`

> **Reconciliation (2026-08-01)**: The main working tree already contains an uncommitted root
> `AGENTS.md` draft and Pages workflow edits. Preserve those user changes; execute a concise,
> canonical guidance file from the clean baseline and verify it does not alter workflows.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `99eef7d`, 2026-08-01

## Why this matters

The repository has contributor commands but no local `AGENTS.md`/`CLAUDE.md` describing that Rust
`crates/` is production, `site/` is static tooling, the migration branch owns deploys, and deploys
need explicit operator approval. Agents can otherwise edit the wrong surface or attempt unsafe actions.

## Steps

Add a concise root `AGENTS.md` that links `CONTRIBUTING.md`, lists required checks, excludes `target/`,
`node_modules/`, runtime data and secrets, explains staging/full-mode boundaries, and says never to
commit/push/deploy without explicit authorization. Do not duplicate secrets or embed credentials.

**Verify**: `Get-Content AGENTS.md`; `git diff --check`; `npm run check:rust-contracts`; `cargo fmt --check`.

## Done criteria

- [ ] New agents can identify production source, static site, ignored runtime data and deploy boundary.
- [ ] Guidance links existing canonical docs instead of copying unstable details.
- [ ] No workflow behavior changes.

## STOP conditions

- Stop if guidance conflicts with `CONTRIBUTING.md` or the deploy workflow; resolve the conflict in the canonical document first.

## Maintenance notes

Keep this file short and update it when branch ownership or deployment safety gates change.
