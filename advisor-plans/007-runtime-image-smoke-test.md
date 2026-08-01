# Plan 007: Make the production image smoke test start the runtime

> **Drift check**: `git diff --stat 99eef7d..HEAD -- .github/workflows/ci.yml Dockerfile.rust docker/healthcheck-rust.sh crates/vozen-runtime`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 006
- **Category**: tests
- **Planned at**: commit `99eef7d`, 2026-08-01

## Why this matters

CI currently builds the image and invokes a healthcheck that is intentionally a no-op when
`HEALTH_PORT` is absent. A broken entrypoint, missing asset, config parser, or native runtime startup
can therefore pass CI and fail during deploy.

## Current state

- `.github/workflows/ci.yml:50-58` only runs the image healthcheck script.
- `Dockerfile.rust:73-76` documents the no-op behavior without `HEALTH_PORT`.
- Runtime requires a Discord token, so the smoke test must use a test-only startup seam or stubbed gateway.

## Scope

Add a deterministic container smoke job using temporary SQLite and a local health listener. Never use
production Discord credentials, databases, models, or external payment services.

## Steps

### Step 1: Define a test-only startup mode

Add a narrowly scoped fixture/configuration that validates config, opens temporary SQLite, starts
`/health`, and avoids Discord gateway ownership. Keep production startup fail-closed when the token is
missing.

**Verify**: `cargo test -p vozen-runtime --locked` covers missing-token production behavior and smoke-mode health.

### Step 2: Add CI container smoke

Build the image, run it with an ephemeral writable data directory and health port, wait for `/health`,
assert the response, then stop and remove the container. Keep the existing voice-driver build gate.

**Verify**: the new CI job exits 0 without secrets; a missing binary/asset causes a non-zero job.

### Step 3: Run local gates

**Verify**: `docker build --file Dockerfile.rust --tag vozen-rust:ci .` and the documented smoke command pass locally where Docker is available; otherwise CI is the authoritative gate.

## Done criteria

- [ ] Image smoke starts the actual entrypoint or a clearly documented test-only runtime path.
- [ ] No external credentials or production state are used.
- [ ] Health readiness and clean shutdown are asserted.

## STOP conditions

- Stop if the only possible smoke test requires a real Discord gateway token.
- Stop if the test would write into the repository or production volume.

## Maintenance notes

Keep this smoke test separate from live voice canaries; image startup and Discord voice behavior are
different gates.
