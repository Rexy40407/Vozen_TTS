# Plan 006: Add gateway-sink integration coverage

> **Drift check**: `git diff --stat 99eef7d..HEAD -- crates/vozen-runtime/src/file_export_sink.rs crates/vozen-runtime/src/live_transcription_sink.rs crates/vozen-runtime/src/guild_welcome_sink.rs crates/vozen-runtime/src`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `99eef7d`, 2026-08-01

## Why this matters

Critical runtime sinks currently rely mostly on unit tests in lower layers. Discord acknowledgement
ordering, private uploads, consent lifecycle, channel selection, teardown and mention suppression can
regress while all existing tests remain green.

## Current state

- `file_export_sink.rs:72-189` acknowledges and uploads private audio.
- `live_transcription_sink.rs:54-63,651-805` owns consent, Whisper execution and teardown.
- `guild_welcome_sink.rs:89-137` selects a channel and posts onboarding.
- There are no `#[cfg(test)]` blocks or `crates/*/tests` covering these sink types.

## Scope

Add deterministic fake HTTP/Discord boundaries and representative integration tests. Do not call
Discord, Whisper, Stripe, or any production endpoint.

## Steps

### Step 1: Extract minimal test seams

Introduce traits/adapters only where needed to fake interaction responses, message edits/uploads,
channel lookup and sidecar execution. Keep production implementations unchanged in behavior.

**Verify**: `cargo check --workspace --all-targets --locked` exits 0.

### Step 2: Test critical flows

Cover accepted/ignored commands, deferred acknowledgement, upload/edit failure, Manage Guild checks,
STT consent grant/revoke, guild-delete teardown, channel fallback, and allowed-mentions suppression.

**Verify**: `cargo test -p vozen-runtime --locked` passes with the new tests.

### Step 3: Full gate

**Verify**: `cargo test --workspace --locked`; `cargo clippy --workspace --all-targets --locked -- -D warnings`; `cargo fmt --check` — all exit 0.

## Done criteria

- [ ] Each named sink has at least one integration-level test.
- [ ] Tests are deterministic and contain no external credentials/network calls.
- [ ] Error and teardown paths are covered, not only happy paths.

## STOP conditions

- Stop if testing requires a live Discord bot or production database.
- Stop if a seam changes the public command/response contract.

## Maintenance notes

New promoted sinks should add one boundary test before their canary flag is enabled.
