# Cargo dependency audit

Status: baseline inventory (no dependency upgrades in this change)

Date: 2026-08-01

Baseline: `99eef7d`

This document records the duplicate dependency stacks observed in the locked
workspace graph. Duplicate versions are retained until they can be removed in
an isolated staging canary; this audit makes no claim that a duplicate is a
security vulnerability.

## Reproduction commands

Run from the repository root:

```powershell
cargo tree -d --workspace --locked
cargo tree --workspace --locked -e features
cargo check --workspace --locked
cargo audit --locked # requires cargo-audit to be installed
```

The baseline audit completed the two `cargo tree` commands and
`cargo check --workspace --locked` successfully. `cargo-audit` was not
installed in the audit environment, so vulnerability advisories remain an
explicit follow-up rather than an inferred clean result.

## Retained duplicate stacks

| Stack | Reachable roots | Why it is retained | Safe reduction path |
| --- | --- | --- | --- |
| `rustls` 0.22 / 0.23, `tokio-rustls` 0.25 / 0.26, `rustls-webpki` 0.102 / 0.103, `webpki-roots` 0.26 / 1.0 | Serenity/Songbird's Discord websocket path uses the 0.22/0.25 branch; Reqwest/SQLx use the 0.23/0.26 branch | These versions are selected by upstream release compatibility; forcing one branch would require coordinated Serenity, Songbird, Reqwest, and SQLx upgrades | Upgrade the upstream stack in a staging canary, then re-run voice-driver tests before changing the lockfile |
| `rand` 0.7 / 0.8 (`rand_core` 0.5 / 0.6) | `chess` 3.2.0 uses 0.7; SQLx and websocket dependencies use 0.8 | `chess` is a transitive dependency with its own API/semver line; no direct application dependency needs the older API | Replace or upgrade the chess dependency only with a behavior-tested game-content canary |
| `thiserror` 1.0 / 2.0 | Older transitive proc-macros (including the chess/Songbird side) use 1.0; current workspace crates and SQLx use 2.0 | Error derive versions are coupled to upstream crates and are not interchangeable by a lockfile-only edit | Revisit when upstreams converge; no direct pin or patch is justified |
| `arrayvec` 0.5 / 0.7 | `chess` uses 0.5; Serenity/Symphonia use 0.7 | The 0.5 branch is isolated to chess's dependency graph | Same chess upgrade path as the `rand` exception |
| `syn` 1 / 2 / 3 and related proc-macro stacks | Legacy `failure`/`derivative` dependencies coexist with modern workspace derives | Proc-macro major versions are selected by their consumers; unifying them would require upstream changes | Allow each upstream to migrate; do not patch proc-macro crates locally |

Other duplicates in the `cargo tree -d` output (for example `bitflags`,
`hashbrown`, `windows-sys`, and `foldhash`) are similarly transitive and are
not direct workspace choices. They are intentionally not forced together by a
`[patch]` or lockfile surgery.

## Follow-up and release gate

Before proposing any reduction:

1. Install a pinned `cargo-audit` in CI and run it against the locked graph.
   High or critical reachable advisories stop the change until triaged.
2. Upgrade one upstream family at a time in an isolated branch.
3. Run `cargo check --workspace --locked`, the workspace tests, and the
   voice-driver/release gates (Discord connect, Songbird playback, TTS request
   and shutdown paths) against staging.
4. Compare the lockfile and `cargo tree -d` output; keep this exception list
   accurate and remove an entry only after the canary passes.

