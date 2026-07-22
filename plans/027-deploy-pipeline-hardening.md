# Plan 027: Harden the auto-deploy pipeline (test gate, `set -e`, `scripts/**`+`tools/**` triggers)

> **Executor instructions**: CI/workflow edits only. No source changes. You cannot
> run the deploy from here — verify by reading the YAML and (optionally) `act`/lint.
> Update this plan's row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat f1a1ac1..HEAD -- .github/workflows/deploy-bot.yml .github/workflows/ci.yml`

## Status

- **Priority**: P1 (availability — a bad deploy takes down the live 24/7 bot)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: ops / CI-CD
- **Planned at**: commit `f1a1ac1`, audit findings OPS-01, OPS-02, OPS-03 (+ the pre-existing `tools/**` deploy-filter gap)

## Why this matters

`.github/workflows/deploy-bot.yml` SSHes into the production VPS and runs
`git pull; npm ci; npm run build; systemctl restart` on every qualifying push to
`main`. Three gaps make it unsafe:

1. **No test gate** (OPS-02): it runs `npm run build` (typecheck+emit) but never
   `npx vitest run`, and has no `needs:`/`workflow_run` dependency on CI. CI runs
   the tests but **concurrently and independently** — the deploy does not wait for
   it. A commit that compiles but fails tests (a regressed backoff, a broken lock,
   a fail-open control) ships and restarts production.
2. **No `set -e`** (OPS-03): the SSH `script:` has no `set -euo pipefail`. If
   `git pull --ff-only` or `npm ci` fails midway (conflict, network, native build,
   disk pressure), execution still reaches `systemctl restart`, tearing down the
   working bot to boot against a half-installed tree → `npm run build` in ExecStart
   fails → `Restart=always` crash-loops the service. An abort-before-restart would
   instead leave the old, working service untouched.
3. **Trigger omits `scripts/**` and `tools/**`** (OPS-01 + known gap): the
   production entrypoint is `scripts/start-prod.mjs` (+`supervisorPolicy.mjs`), and
   the STT/clone/kokoro sidecars live in `tools/`. A change touching ONLY the
   supervisor (the availability-critical single-instance lock / backoff / log
   rotation) or ONLY a sidecar merges to `main` and does **not** deploy — the fix
   silently never lands until an unrelated `src/**` change piggybacks a deploy.

## Current state (`.github/workflows/deploy-bot.yml`)

- `paths:` (lines 11-16): `src/**`, `package.json`, `package-lock.json`,
  `tsconfig.json`, `.github/workflows/deploy-bot.yml`. **Missing**: `scripts/**`,
  `tools/**`.
- `script:` (lines 34-41): `cd ~/discord-bot-Vozen; git pull --ff-only; npm ci;
  npm run build; sudo -n systemctl restart vozen.service; sleep 20;
  systemctl is-active vozen.service`. **No** `set -euo pipefail`, **no** `vitest`.
- `.github/workflows/ci.yml` runs `npx vitest run` on the same push, independently.

## Scope

**In scope**: `.github/workflows/deploy-bot.yml` only.
**Out of scope**: `ci.yml` (unless you choose the `workflow_run` gating approach —
then you touch triggers, see below); any `src/` code; the site pipeline.

## Steps

### Step 1: add the missing trigger paths

Add to the `paths:` list:
```yaml
      - 'scripts/**'
      - 'tools/**'
```
(`tools/**` closes the pre-existing gap where a sidecar/tooling change never
auto-deployed.)

### Step 2: add `set -euo pipefail` + a test gate to the deploy script

Rewrite the SSH `script:` so it aborts on any failure AND runs the test suite
before touching the running service:
```bash
set -euo pipefail
cd ~/discord-bot-Vozen
git pull --ff-only
npm ci
npm run build
npx vitest run            # test gate: a red suite aborts BEFORE restart
sudo -n systemctl restart vozen.service
sleep 20
systemctl is-active vozen.service
```
With `set -e`, a failing `npm ci`/`build`/`vitest` aborts the script and the
**already-running** bot stays up (no restart into a broken tree).

**Alternative (cleaner, more work — choose one):** convert the deploy to
`on: workflow_run` gated on the CI workflow's success instead of running vitest on
the VPS. This keeps the VPS deploy fast (no test run on the small box) and only
deploys commits CI already blessed. If you take this path, the trigger becomes
`workflow_run: { workflows: ["CI"], types: [completed], branches: [main] }` with a
job-level `if: ${{ github.event.workflow_run.conclusion == 'success' }}`, and you
still add `set -euo pipefail`. Document which approach you chose in the workflow
comment.

### Step 3: strengthen the smoke check (optional, recommended)

`sleep 20; systemctl is-active` only proves the unit is up (process running), not
that the bot reached the Discord gateway or that the HTTP server bound. If cheap,
add a probe of the loopback `HEALTH_PORT` endpoint (curl `127.0.0.1:$HEALTH_PORT`
expecting `{"status":"ok"}`) after the restart. Skip if `HEALTH_PORT` isn't
reliably set in prod — note it as a follow-up rather than guessing the port.

## Test plan

No automated test (workflow file). Verification:
- YAML is valid (the `appleboy/ssh-action` block parses; keep the pinned SHA at
  line 29 — do NOT switch to a mutable tag).
- Re-read the final `script:` to confirm `set -euo pipefail` is the FIRST line and
  `npx vitest run` precedes `systemctl restart`.

## Done criteria

- [ ] `paths:` includes `scripts/**` and `tools/**`
- [ ] The SSH `script:` starts with `set -euo pipefail`
- [ ] The suite runs (`npx vitest run`) before `systemctl restart` — OR deploy is `workflow_run`-gated on CI success
- [ ] The pinned action SHA (line 29) is unchanged
- [ ] Only `deploy-bot.yml` (and `ci.yml` only if you chose the `workflow_run` gate) changed

## STOP conditions

- If the VPS is too small to run `npx vitest run` in the deploy window (the suite
  spawns processes), prefer the `workflow_run`-gating alternative and note why.
- Do NOT remove the `concurrency` group or the pinned action SHA.

## Maintenance notes

- The test gate means a red suite now blocks production deploys — that is the
  intended behavior; do not add `|| true` to silence it.
- When a new top-level dir becomes runtime-relevant (e.g. a new sidecar dir), add
  it to `paths:` or it won't auto-deploy.
