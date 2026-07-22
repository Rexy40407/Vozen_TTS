# Plan 028: Supervisor mid-run log rotation (prevent disk-full outage)

> **Executor instructions**: Small change to `scripts/start-prod.mjs` + a test.
> Update this plan's row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat f1a1ac1..HEAD -- scripts/start-prod.mjs`

## Status

- **Priority**: P1 (a full disk = outage + breaks SQLite writes + breaks the next `npm ci` deploy)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: ops / availability
- **Planned at**: commit `f1a1ac1`, audit finding OPS-04

## Why this matters

`scripts/start-prod.mjs` rotates `logs/vozen.log` (>8 MB → `vozen.log.1`) **only
once, at supervisor startup**. During runtime every child stdout/stderr chunk is
appended with no further size check, and child restarts (the backoff loop) reuse
the same open stream and never re-trigger rotation. So rotation is disabled
exactly when it matters most: while the supervisor stays alive and the **child
crash-loops** (each restart floods logs), `vozen.log` grows unbounded → fills the
small Hetzner disk → outage. Even without a crash-loop, a stable 24/7 process
(`Restart=always`) runs for weeks between restarts, so the log grows unbounded
across that window. journald self-caps; this file sink is the uncapped one.

## Current state (`scripts/start-prod.mjs`)

- Lines ~30-32: `LOG_FILE = logs/vozen.log`, `LOG_MAX_BYTES = 8 * 1024 * 1024`.
- Lines ~34-44: startup-only rotation — `statSync(LOG_FILE).size > LOG_MAX_BYTES`
  then `rmSync(LOG_FILE.1)` + `renameSync(LOG_FILE → LOG_FILE.1)`, then
  `createWriteStream(LOG_FILE, { flags: 'a' })`.
- Lines ~51-53: `toFile(chunk)` = `if (logStream) logStream.write(chunk)` — **no
  size check on write**.
- The child restart loop (`startOnce`) reuses `logStream` and never re-rotates.

## Scope

**In scope**: `scripts/start-prod.mjs` (rotation logic), one test.
**Out of scope**: switching to journald-only / dropping the file sink (a larger
decision); logrotate config on the VPS (that's an infra alternative — mention but
don't implement here).

## Approach

Track bytes written and rotate mid-run. The cleanest minimal change:
1. Keep a running `bytesWritten` counter, seeded from the current file size at
   startup (`statSync(LOG_FILE).size` when it exists).
2. In `toFile(chunk)`, add the chunk's byte length to the counter; when it crosses
   `LOG_MAX_BYTES`, perform the same rotate (close current stream, `rm .1`, rename
   `LOG_FILE → .1`, reopen a fresh `LOG_FILE`, reset counter to 0). Guard the
   rotate so a rotate-in-progress or a `logStream === null` (disk-full degraded
   mode) is a no-op — never throw from a log write.
3. Keep the existing "degrade to console on stream error" behavior.

Extract the rotate into a small pure-ish helper so it can be unit-tested against a
temp dir. Keep the "keep exactly 1 generation (`.1`)" policy.

## Steps

1. **(RED)** Add `tests/logRotation.test.ts`. If the rotation logic is inline in
   `start-prod.mjs`, first extract it into a testable function (e.g.
   `makeRotatingWriter(dir, maxBytes)` returning `{ write, currentFile }`) in a
   small module (`scripts/logRotation.mjs`) or exported from the supervisor if the
   test harness can import `.mjs`. Test: write chunks totaling > `maxBytes` and
   assert (a) `vozen.log.1` now exists, (b) `vozen.log` size dropped below the
   threshold, (c) no throw when the target dir is briefly unwritable (simulate by
   passing a null stream / mocked fs) → degrades silently.
2. **(GREEN)** Implement the byte-counting rotate in `toFile`/the extracted writer.
3. Confirm the startup rotation still works (seed the counter from existing size).

## Test plan

- `tests/logRotation.test.ts` (uses a temp dir under `os.tmpdir()`; clean up in
  `afterEach`) — the RED→GREEN driver. Follow the style of an existing
  filesystem-touching test if one exists (grep `os.tmpdir` in `tests/`).
- `npm run check` green. Note: `start-prod.mjs` is `.mjs` and may be outside the
  `tsconfig`/vitest include — if so, extracting the helper into a testable module
  that vitest DOES pick up is required (state which you did).

## Done criteria

- [ ] Writing > `LOG_MAX_BYTES` mid-run rotates to `vozen.log.1` (proven by test)
- [ ] A log write never throws when the sink is unavailable (degrades to console)
- [ ] Startup rotation still functions
- [ ] `npm run check` exits 0
- [ ] Only `scripts/start-prod.mjs` (+ optional `scripts/logRotation.mjs`) + the new test changed

## STOP conditions

- If `start-prod.mjs` cannot be imported by vitest at all (ESM/tsconfig include
  boundary) and extraction is non-trivial, STOP and report — propose either the
  extraction module or delegating rotation to system `logrotate` (infra) as the
  two options, and let the maintainer pick.

## Maintenance notes

- The rotation keeps 1 generation (`.1`); if log volume grows, consider N
  generations or handing rotation to journald/logrotate.
- Any new high-volume log source (e.g. a chatty new subsystem) makes this rotation
  more load-bearing — keep `LOG_MAX_BYTES` sane relative to VPS disk headroom.
