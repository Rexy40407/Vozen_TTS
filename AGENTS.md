# Agent guidance

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before changing the repository and
[`DEPLOY.md`](DEPLOY.md) before touching a deploy or migration. Those files are
the canonical source for architecture, required checks, production boundaries,
and rollback guidance.

## Repository surfaces

- The production bot is the Rust workspace under `crates/`.
- `site/` is the static website; its checks live under `site-tests/`.
- `contracts/` contains compatibility contracts checked by the tooling in
  `tools/`.
- Database migrations and replica work require the staging/full-mode boundary
  described in `DEPLOY.md`; SQLite remains authoritative until an explicit
  cutover is approved.

## Required checks

For Rust or contract changes, run the smallest relevant targeted tests, then
the repository gates before handoff:

```sh
node tools/check-rust-contracts.mjs
cargo fmt --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
```

Website changes also require `npm run check:site` (see `CONTRIBUTING.md`).

## Safety and scope

- Never commit `.env` files, tokens, credentials, generated output, or build
  directories (`target/`, `node_modules/`, `dist/`, and `.pnpm-store/`).
- Preserve unrelated working-tree changes and public Discord, privacy, and
  compatibility contracts.
- Do not run destructive database commands.
- Do not commit, push, deploy, or change production data without explicit
  authorization from the repository owner.
