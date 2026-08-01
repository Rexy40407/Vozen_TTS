# Plan 005: Parallelize bounded multi-segment TTS synthesis

> **Drift check**: `git diff --stat 99eef7d..HEAD -- crates/vozen-tts/src/lib.rs crates/vozen-tts/src/gtts.rs`

> **Reconciliation (2026-08-01)**: No local working-tree drift was found in the TTS segment
> implementation. Plan 004 is approved on its isolated branch; this plan can proceed from the clean
> baseline and must retain its bounded provider semaphore and exact ordered WAV semantics.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 004
- **Category**: perf
- **Planned at**: commit `99eef7d`, 2026-08-01

## Why this matters

`vozen-tts` awaits every segment serially even though Piper has a global concurrency semaphore and the
gTTS adapter already uses bounded unordered work. Multi-segment messages therefore pay the sum of all
provider latencies and increase the Discord queue delay.

## Current state

- `crates/vozen-tts/src/lib.rs:262-306` loops over segments and awaits each synthesis.
- `crates/vozen-tts/src/lib.rs:324-328` bounds Piper concurrency.
- `crates/vozen-tts/src/gtts.rs:143` is the existing bounded-parallel exemplar.

## Scope

**In scope**: segment scheduling, ordered result collection, fallback/error behavior, and tests.
**Out of scope**: changing provider limits, voice selection, cache format, or audio concatenation format.

## Steps

### Step 1: Add characterization tests

Use a fake engine with controllable delays to prove output WAV order, failure fallback, and concurrency
bound. Record the latency baseline with the telemetry from Plan 004.

**Verify**: `cargo test -p vozen-tts --locked` passes before changing scheduling.

### Step 2: Implement bounded indexed concurrency

Schedule independent segments through a bounded stream/JoinSet no larger than the existing provider
limit. Store each result by original index, concatenate only after all required results arrive, and
retain the current single-segment fallback when a segment fails.

**Verify**: targeted tests show overlap when capacity exists, never exceed the configured bound, and preserve exact segment order.

### Step 3: Run voice gates

**Verify**: `cargo test --workspace --locked`; `cargo test --release -p vozen-runtime --features voice-driver`; `cargo fmt --check`; `cargo clippy --workspace --all-targets --locked -- -D warnings` — all exit 0.

## Done criteria

- [ ] Multi-segment synthesis uses bounded parallelism.
- [ ] Audio order, cache keys, fallback and error semantics are unchanged.
- [ ] Voice-driver release tests pass.

## STOP conditions

- Stop if a provider's documented limit is lower than the proposed bound.
- Stop if failure handling can return audio in a different segment order.

## Maintenance notes

Keep the concurrency bound provider-owned; do not create an unbounded task per user message.
