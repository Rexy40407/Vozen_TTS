# Self-hosting Vozen Rust

Vozen is now a Rust workspace. The Discord runtime, SQLite store, TTS engines,
games, Premium/OAuth API, Top.gg and Ko-fi integrations live under `crates/`.
The Node/TypeScript bot and its old compose files were removed from `main`.

## Prerequisites

- Linux VPS (x86_64 or ARM64) with Docker Engine and Compose v2;
- a Discord application token and client ID;
- Piper models and optional Kokoro/Whisper assets for the features you enable.

## Production compose

```sh
git clone https://github.com/Rexy40407/vozen.git
cd vozen
cp .env.rust.prod.example .env.rust.prod
# fill secrets and integration settings
docker compose -f docker-compose.rust.prod.yml up -d --build
docker compose -f docker-compose.rust.prod.yml logs -f vozen
```

The compose file mounts `./rust-data:/data` for SQLite and caches, `/models` for
voices and `/opt/piper` for the Piper binary. Keep `/data` persistent and back
up `rust-data/tts.db` before upgrades. The deploy script creates an online
SQLite backup, waits for health/gateway readiness and rolls back if the canary
fails.

## Configuration and integrations

Use `.env.rust.prod.example` as the variable inventory. Keep existing names for
`DISCORD_TOKEN`, `CLIENT_ID`, `TOPGG_TOKEN`, `TOPGG_WEBHOOK_SECRET`,
`VOTE_REDEMPTION_SECRET`, `KOFI_WEBHOOK_TOKEN`, `PREMIUM_API_*`,
`DISCORD_OAUTH_*`, `RUST_TTS_INSTALL_OAUTH_*`, the optional
`CLOUDFLARE_WEB_ANALYTICS_*` server-only proxy values, and the TTS/voice paths. Rust validates the same command,
database, voice/i18n and game contracts before starting.

For the ordered production rollout, Top.gg diagnostics, vote-reward migration
and browser-install checks, use [the growth operations runbook](GROWTH-OPERATIONS.md).

The public website remains a static Pages site (`site/`), while the dashboard/API
is served by the Rust API crates. Top.gg, Ko-fi, OAuth and Premium routes and
compatibility tests run in the Rust CI.

## Verification

```sh
docker compose -f docker-compose.rust.prod.yml ps
docker compose -f docker-compose.rust.prod.yml logs --tail 100 vozen
curl -fsS http://127.0.0.1:3001/health
```

Look for `healthy: Ready` and a successful health response. Also check
`https://api.vozen.org/health` and `https://vozen.org` on the public deployment.

## Development checks

```sh
npm ci --ignore-scripts
# Vitest loads esbuild. Rebuild only that audited binary after blocking all
# dependency install scripts; do not enable install scripts globally.
npm rebuild esbuild
npm run check:site
node tools/check-rust-contracts.mjs
node tools/check-rust-canaries.mjs
cargo fmt --check
cargo check --workspace --all-targets --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
```

The `legacy-typescript` branch is retained as a recovery snapshot; it is not
part of the production build.
