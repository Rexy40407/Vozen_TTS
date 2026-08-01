# Plan 011: Consolidate duplicated config gateway plumbing

> **Drift check**: `git diff --stat 99eef7d..HEAD -- crates/vozen-runtime/src/config*_sink.rs crates/vozen-runtime/src`

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MED
- **Depends on**: 010
- **Category**: tech-debt
- **Planned at**: commit `99eef7d`, 2026-08-01

## Why this matters

Eleven config sinks repeat the same localizer construction, message rendering, interaction response,
and permission-error plumbing across about 2,000 lines. Copies can drift in permission checks or
localized error behavior.

## Current state and scope

Examples are `config_blockword_sink.rs:20-63`, `config_channel_sink.rs:21-61`, and
`config_toggle_sink.rs:21-66`. Extract a shared helper/trait while leaving command-specific parsers,
validation, response keys and service semantics intact.

## Steps

1. Add golden response/permission tests for each sink before moving code. **Verify**: `cargo test -p vozen-runtime config --locked`.
2. Introduce shared interaction/localizer plumbing and migrate one sink at a time. **Verify**: `cargo check --workspace --all-targets --locked` after each batch.
3. Remove duplicated helpers only after all callers migrate. **Verify**: `rg -n "VoiceResponseLocalizer::from_generated_contract|fn message\(" crates/vozen-runtime/src/config*_sink.rs` shows the intended single shared implementation plus explicit adapters; full clippy/tests pass.

## Done criteria

- [ ] All config leaves preserve exact response keys and permission behavior.
- [ ] Shared plumbing has tests and no sink bypasses it accidentally.
- [ ] No public command contract changes.

## STOP conditions

- Stop if a sink has intentionally different localization, ephemeral, or permission semantics.

## Maintenance notes

Keep command-specific outcome-to-key mapping local; the abstraction should own transport plumbing,
not product behavior.
