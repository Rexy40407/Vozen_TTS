# Vozen repository guide

## Source of truth

- `crates/` is the production Rust runtime and API.
- `site/` is the static public website and dashboard tooling.
- `supabase/migrations/` contains the reviewed Postgres schema contract.
- `plans/` is legacy TypeScript history; `advisor-plans/` is the current Rust audit backlog.

## Required checks

Before a change is published, run the smallest relevant tests plus:

```sh
cargo fmt --check
npm run check:site
node tools/check-rust-contracts.mjs
node tools/check-rust-replica-contract.mjs
```

Use a separate `CARGO_TARGET_DIR` when another checkout is compiling. Never commit `target/`,
`node_modules/`, runtime databases, `.env` files, Discord tokens, OAuth secrets, or Supabase
credentials.

## Runtime and deployment boundaries

Production is Rust full mode on the `migration/vozen-rust` branch. Staging-only ownership flags are
documented in `docs/RUST-MIGRATION-STAGING.md`. Deploys require an explicit operator decision and
the CI-tested commit; never deploy from an unreviewed working tree.
