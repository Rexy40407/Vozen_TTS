# Plan 017: Remediate reachable TTS runtime dependency advisories

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> STOP condition occurs, stop and report — do not improvise. When complete,
> update this plan's row in `advisor-plans/README.md`.
>
> **Drift check (run first)**:
>
> ```powershell
> git diff --stat acd7ce9..HEAD -- Cargo.toml Cargo.lock crates .github/workflows/ci.yml package.json package-lock.json
> ```
>
> If the dependency graph differs, re-run the advisory inventory and update
> this plan before making a version change.

## Status

- **Priority**: P0
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: none
- **Category**: security / dependencies
- **Planned at**: commit `acd7ce9`, 2026-08-19
- **Implementation**: partial. The reachable rustls/webpki branch was removed
  and the lockfile was refreshed; the DAVE/OpenMLS and chess/failure paths
  still need a maintained upstream replacement, so production release remains
  blocked.

## Why this matters

The production TTS runtime directly depends on Serenity and Songbird for
Discord gateway/voice functionality. The locked graph currently contains
multiple known advisories, including old `libcrux-*` packages and
`rustls-webpki 0.102.8`, as well as the unmaintained/unsound `failure 0.1.8`
through `chess 3.2.0`. These are not a safe target for blind `cargo update`:
voice and gateway compatibility are production-critical. This plan remediates
reachable advisories with an explicit staging and voice-driver proof instead of
trading security for an untested bot outage.

## Current state

- `Cargo.toml:35-46` directly pins the roots that own the affected graph:

  ```toml
  serenity = { version = "0.12.5", default-features = false, features = ["client", "gateway", "model", "rustls_backend"] }
  songbird = { version = "0.6.0", default-features = false, features = ["gateway", "rustls", "serenity"] }
  reqwest = { version = "0.12.28", default-features = false, features = ["json", "rustls-tls"] }
  chess = "3.2.0"
  ```

- `Cargo.lock:326-335` shows `chess 3.2.0` depends on `failure` and
  `rand 0.7.3`; `Cargo.lock:913-920` pins `failure 0.1.8`.
- `Cargo.lock:3368-3376` includes `rustls-webpki 0.102.8`; the same lockfile
  also contains a newer 0.103 branch, so version duplication must be explained
  rather than assumed harmless.
- `Cargo.lock:1898-1908` locks `libcrux-chacha20poly1305 0.0.7`.
  Songbird is a direct runtime dependency (`Cargo.toml:36`) and its graph
  includes Davey/OpenMLS crypto transitives (`Cargo.lock:3832+`, `628+`,
  `2376+`). Treat the voice-driver feature as the compatibility boundary.
- `package.json:10-25` already defines the authoritative checks:
  `npm run check:rust`, `npm run check:rust-voice`, and `npm run check:site`.
  CI also runs a release voice-runtime test at
  `.github/workflows/ci.yml:45`.
- Previous Plan 012 was an advisory inventory only. It explicitly says a high
  or critical reachable advisory must become a separate P1 plan; this Plan 017
  supersedes that condition at P0.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Inventory | `cargo audit` | no high/critical runtime advisories after remediation |
| Dependency provenance | `cargo tree --workspace --all-features -i <crate>` | identifies root for each affected crate |
| Standard Rust checks | `npm run check:rust` | exit 0 |
| Voice-driver checks | `npm run check:rust-voice` | exit 0 |
| Release voice test | `cargo test --release -p vozen-runtime --features voice-driver` | all pass |
| Static checks | `npm ci --ignore-scripts; npm rebuild esbuild; npm run check:site` | exit 0 |
| Image smoke | Run the existing production-image CI workflow/job | runtime health endpoint is healthy |

## Scope

**In scope**:

- `Cargo.toml`, crate manifests, and `Cargo.lock`
- targeted Rust compatibility tests for changed Discord/voice/TLS behaviour
- `.github/workflows/ci.yml` only to preserve or strengthen existing audit and
  voice-driver gates
- `package.json` and `package-lock.json` only if `npm audit` reports a
  high/critical build-time issue during this work

**Out of scope**:

- New bot features, command behaviour, or public UI redesign.
- Disabling TLS, voice-driver, or dependency audits to get a green build.
- Production deployment before the staging image/health and voice tests pass.

## Git workflow

- Branch: `advisor/017-tts-dependency-advisories`.
- Make separate commits per compatibility boundary, for example
  `chore(deps): update TLS advisory chain` then
  `chore(deps): replace obsolete chess dependency`.
- Do not deploy a partial dependency graph. Merge/push only after every gate
  below passes.

## Steps

### Step 1: Capture a reproducible advisory/provenance baseline

Run `cargo audit` and record advisory IDs, affected versions, fixes, and
`cargo tree --all-features -i` paths for `rustls-webpki`, `libcrux-*`,
`failure`, and `rand@0.7.3`. Use the Linux production target if the host's
target graph hides an optional voice dependency. Classify each path as runtime,
test-only, build-only, or unreachable in the production image.

**Verify**: a checked-in issue/PR description (not a secret file) names every
remaining advisory and its exact root. Do not proceed if a path cannot be
reproduced.

### Step 2: Resolve the TLS and voice crypto advisories through supported roots

Consult Serenity and Songbird release notes/changelogs and choose the smallest
mutually compatible supported upgrade that removes the vulnerable
`rustls-webpki` and `libcrux-*` branches. Update direct root versions and the
lockfile together; never use arbitrary `[patch.crates-io]` overrides for a
major voice stack change without upstream compatibility confirmation.

Add/adjust targeted tests only where an API or behaviour changes. Preserve
`rustls_backend`, Songbird `gateway`/`rustls`/`serenity`, and runtime
voice-driver feature coverage.

**Verify**: `npm run check:rust; npm run check:rust-voice; cargo test --release
-p vozen-runtime --features voice-driver; cargo audit` → all exit 0 or an
explicitly documented non-reachable exception remains.

### Step 3: Remove or replace the obsolete chess dependency path

Find every use of the `chess` crate in `crates/`. Prefer a maintained,
compatible crate or a small local implementation limited to the actually used
chess functionality; do not carry `failure 0.1.8` merely for convenience.
Preserve user-visible command semantics and add regression tests for every
supported chess input/output currently covered by the bot.

If no replacement can meet the API/maintenance requirement, isolate the chess
feature behind a non-production flag and report it rather than shipping known
unsound dependencies in the default runtime.

**Verify**: `cargo tree -i failure` and `cargo tree -i 'rand@0.7.3'` have no
production path; workspace, voice, and release tests all pass.

### Step 4: Prove the production image before rollout

Build the production container using the existing CI recipe and run it with
non-production configuration. Confirm only the documented loopback health
endpoint and voice/gateway startup checks; do not submit a real Discord token
to test output. Deploy first to the documented staging path, observe health and
gateway reconnect behaviour, then promote through the established production
workflow.

**Verify**: CI image smoke passes, staging health is HTTP 200, no startup
panic/reconnect loop appears during the agreed observation window, and the
post-deploy `cargo audit` baseline is clean.

## Test plan

- Run provenance trees for every advisory before and after changes.
- Exercise TTS runtime/voice-driver tests and the release voice test.
- Keep site checks green, because the repository CI publishes/validates legacy
  static artifacts too.
- Validate production image health in staging before any production restart.

## Done criteria

- [ ] `cargo audit` reports no high/critical advisory reachable from the
  production runtime, or every non-reachable exception is documented with a
  deterministic reproduction command and owner.
- [ ] `failure 0.1.8` and `rand 0.7.3` have no production path.
- [ ] The selected Serenity/Songbird/TLS graph passes standard, voice-driver,
  release-voice, and image-smoke gates.
- [ ] No security gate or runtime feature was disabled to pass CI.
- [ ] Production promotion occurs only after staging health/observation.

## STOP conditions

- Upstream offers no compatible fixed Serenity/Songbird chain.
- An upgrade changes Discord gateway or voice behaviour and no staging canary
  is available.
- A vulnerable dependency is required by a crate with no maintained
  replacement, while the feature is production-reachable.
- The production image health/voice smoke cannot be reproduced without real
  user credentials.

## Maintenance notes

- Keep `cargo audit` in CI and make advisory remediation a separate scoped
  change from feature work.
- Review direct `serenity`, `songbird`, `reqwest`, and `chess` updates together;
  their transitive TLS/voice graph is intentionally coupled.
