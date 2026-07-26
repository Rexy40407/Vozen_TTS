# Vozen architecture

Vozen is a Rust workspace with one production process and a separate static
website. The former TypeScript runtime is preserved only on the
`legacy-typescript` recovery branch.

## Runtime crates

- `vozen-runtime`: process startup, Discord gateway, command promotion, health,
  metrics and integration wiring.
- `vozen-discord`: Discord interaction parsing/responses, voice sessions, TTS
  command pipeline, games, UI components and localized copy.
- `vozen-core`: pure text cleaning, language detection, policies, games,
  translation and shared business rules.
- `vozen-store`: SQLite schema/migrations, user/guild settings, telemetry,
  privacy erasure, Premium passes and vote/Ko-fi ledgers.
- `vozen-tts`: Piper, Google/gTTS, Kokoro and neural adapters with bounded
  caching and fail-closed paid-engine selection.
- `vozen-api`: dashboard, Discord OAuth, Premium status/claims, Top.gg and
  Ko-fi webhooks, public health/status routes.

## Compatibility boundaries

`contracts/` contains the committed Discord command, SQLite, voice/i18n and
game-content contracts. `tools/check-rust-contracts.mjs` validates them without
loading application source. `tools/check-rust-canaries.mjs` validates the full
runtime flag set against `.env.rust.staging.example`.

The runtime keeps the existing environment variable names and HTTP paths so
Top.gg, Ko-fi, OAuth, Premium and the `vozen.org` dashboard remain compatible.
SQLite opens existing `tts.db` files through migrations and never rewrites or
deletes production data during a normal deploy.

## Deployment

`Dockerfile.rust` builds the release binary and voice sidecars. Production uses
`docker-compose.rust.prod.yml` with persistent `rust-data:/data`, external model
and Piper mounts, health checks and `restart: unless-stopped`. The deploy script
backs up SQLite, builds before cutover, waits for gateway/health readiness and
restores the previous image on a failed canary.

## Website

`site/` is static and independent of the Discord runtime. `site-tests/` contains
the Vitest acceptance checks; `tools/build-i18n.mjs`, `tools/check-site-copy.mjs`
and `tools/minify-site.mjs` generate and validate the Pages assets.
