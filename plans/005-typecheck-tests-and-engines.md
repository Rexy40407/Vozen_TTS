# Plan 005: Type-check the test suite in CI and declare the Node engines floor

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat fb7f916..HEAD -- tsconfig.json package.json .github/workflows/ci.yml vitest.config.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (the first typecheck run may surface latent type errors in 114 test files)
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `fb7f916`, 2026-07-07

## Why this matters

The root `tsconfig.json` explicitly excludes `tests/`, and `vitest.config.ts` performs no type-checking (vitest transpiles tests with esbuild, which strips types without checking them). The result: the repo's 114 test files are **never type-checked** — not locally, not in CI. Type drift between `src/` and the tests (stale mock shapes, renamed fields) only shows up as confusing runtime failures, or never. Adding a dedicated test tsconfig plus a CI step closes this hole. Separately, `package.json` declares no `engines`, so nothing warns a contributor running Node 18 that CI's floor is Node 20.

## Current state

- `tsconfig.json` — root TS config; compiles only `src/`, excludes `tests/`:

  ```json
  // tsconfig.json:2-19 (excerpt)
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    ...
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
  ```

  Two inheritance traps for the new test config:
  1. `rootDir: "src"` — files under `tests/` are outside it; must be overridden to `"."`.
  2. `exclude: [..., "tests"]` is **inherited** by any config that extends this one and would silently filter the `tests/**` include glob; must be overridden too.

- `vitest.config.ts` — full contents today (no typecheck option):

  ```ts
  // vitest.config.ts:1-9
  import { defineConfig } from 'vitest/config';

  export default defineConfig({
    test: {
      include: ['tests/**/*.test.ts'],
      environment: 'node',
      setupFiles: ['./tests/setup.ts'],
    },
  });
  ```

- `package.json` — `scripts` block today (no `typecheck`, no `engines` key anywhere in the file):

  ```json
  // package.json:7-16
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "start:prod": "npm run build && node scripts/start-prod.mjs",
    "start:sharded": "node dist/shard.js",
    "test": "vitest run",
    "register": "tsx src/bot/registerCommands.ts",
    "build:site": "node tools/minify-site.mjs"
  },
  ```

- `.github/workflows/ci.yml` — single `test` job, Node 20.x/22.x matrix; steps today end with:

  ```yaml
  # .github/workflows/ci.yml:25-27
  - run: npm ci
  - run: npm run build
  - run: npx vitest run
  ```

- Tests live flat in `tests/` (114 `*.test.ts` files) and import production code via relative paths like `../src/voice/player`. Many use `as unknown as BotDeps` casts on stub objects (see `tests/commandsJoin.test.ts:66-73`), which type-check fine; the risk is tests that got out of sync with `src/` types.
- Repo convention: code comments are written in Portuguese — any new comment you add must be in Portuguese.

## Commands you will need

| Purpose   | Command             | Expected on success                 |
| --------- | ------------------- | ----------------------------------- |
| Install   | `npm install`       | exit 0                              |
| Build     | `npm run build`     | exit 0                              |
| Typecheck | `npm run typecheck` | exit 0, no errors (after this plan) |
| Tests     | `npx vitest run`    | all pass                            |

## Scope

**In scope** (the only files you should modify/create):

- `tsconfig.test.json` (create)
- `package.json` (add `typecheck` script + `engines` key only)
- `.github/workflows/ci.yml` (add one step)
- `tests/**/*.test.ts` — ONLY trivial type fixes surfaced by the new typecheck (wrong mock shapes, missing casts), and only within the limits in "STOP conditions"

**Out of scope** (do NOT touch, even though they look related):

- Any file under `src/` — if a test type error can only be fixed by changing a `src/` type, that is a STOP condition, not a fix.
- `tsconfig.json` (root) — the build config must not change; `dist/` output shape is load-bearing for `npm start` and `start:prod`.
- `vitest.config.ts` — do not enable vitest's built-in `typecheck` mode; the plan uses a plain `tsc` pass instead (faster, no test re-run).
- `package-lock.json` beyond what `npm install` regenerates (this plan adds no dependencies, so it should not change at all).

## Git workflow

- Branch: `advisor/005-typecheck-tests-and-engines`
- Commit style: conventional-ish one-liners in Portuguese, matching `git log` (e.g. `fix(games): apagar da thread nunca falha às escuras (log + fallback arquivar)`). Suggested: `dx: typecheck dos testes (tsconfig.test.json + CI) e engines node>=20`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `tsconfig.test.json`

Create `tsconfig.test.json` at the repo root with exactly this content:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": "."
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

Why each override exists (do not drop any):

- `noEmit: true` — this config only checks; it must never write to `dist/` (the root config's `outDir: "dist"` is inherited but inert with `noEmit`).
- `rootDir: "."` — the root's `rootDir: "src"` would reject every file under `tests/` with TS6059.
- `exclude` — the root's inherited `exclude` contains `"tests"`, which would silently empty the `tests/**` include; overriding with `["node_modules", "dist"]` restores it.

**Verify**: `npx tsc -p tsconfig.test.json --noEmit` → runs (exit 0 if there are no latent errors; if it reports errors, continue to Step 2's triage before editing anything).

### Step 2: Triage any surfaced errors

Expected outcome is zero errors, but this is the first time these 114 files are ever type-checked, so latent errors are possible.

- Count the errors: rerun and count lines matching `error TS`.
- If **0 errors**: skip to Step 3.
- If **1–20 errors**, and each is a trivial test-local fix (a mock object missing a field, an outdated field name in a stub, a cast that needs to become `as unknown as X`): fix them **in the test files only**, one logical fix per commit or one combined commit. New comments, if any, in Portuguese.
- If **more than 20 errors**, or ANY error can only be fixed by modifying a file under `src/` (including its exported types): STOP and report the full error list.

**Verify**: `npx tsc -p tsconfig.test.json --noEmit` → exit 0, no output.

### Step 3: Add the `typecheck` script and `engines` to `package.json`

In `package.json`:

1. Add to `"scripts"` (after `"test"` for readability):
   ```json
   "typecheck": "tsc -p tsconfig.test.json --noEmit",
   ```
2. Add a top-level `engines` key (place it after `"license": "AGPL-3.0-only",`):
   ```json
   "engines": {
     "node": ">=20"
   },
   ```
   `>=20` matches the CI matrix floor (`node-version: [20.x, 22.x]` in `.github/workflows/ci.yml:14`).

Do not touch anything else in the file — in particular the `"//overrides"`, `"overrides"` and `"allowScripts"` blocks.

**Verify**:

- `npm run typecheck` → exit 0.
- `node -e "console.log(require('./package.json').engines.node)"` → prints `>=20`.
- `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('json ok')"` → prints `json ok`.

### Step 4: Wire typecheck into CI

In `.github/workflows/ci.yml`, add one step between `npm run build` and `npx vitest run`:

```yaml
- run: npm ci
- run: npm run build
- run: npm run typecheck
- run: npx vitest run
```

(Keep the existing comment block above `npm ci` untouched.)

**Verify**: `git grep -n "npm run typecheck" -- .github/workflows/ci.yml` → exactly one match.

### Step 5: Full local gate

Run the same gate CI will run.

**Verify**:

- `npm run build` → exit 0
- `npm run typecheck` → exit 0
- `npx vitest run` → all tests pass (same count as before this plan; typecheck adds no tests)

## Test plan

No new runtime tests — this plan adds a static gate, not behavior. The gate itself is the test:

- `npm run typecheck` exits 0 over `src/**` + `tests/**` + `vitest.config.ts`.
- The full existing suite (`npx vitest run`) still passes, proving any test-file fixes in Step 2 were behavior-neutral.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `tsconfig.test.json` exists with the overrides from Step 1
- [ ] `npm run typecheck` exits 0
- [ ] `npx vitest run` exits 0
- [ ] `npm run build` exits 0 and `git status` shows no changes under `dist/` tracked files (there are none tracked; just confirm no new tracked files appear)
- [ ] `git grep -n "npm run typecheck" -- .github/workflows/ci.yml` → 1 match
- [ ] `node -e "console.log(require('./package.json').engines.node)"` → `>=20`
- [ ] Only in-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The root `tsconfig.json` no longer matches the excerpt in "Current state" (in particular `rootDir`, `include`, `exclude`) — the override recipe in Step 1 depends on it.
- Step 1's first typecheck run reports **more than 20 errors**.
- Any surfaced error requires changing a file under `src/` (types or code) to fix.
- After fixing trivial errors, `npx vitest run` fails on a test that passed before your edit (your "trivial" fix changed behavior).
- `npm install`/`npm ci` unexpectedly modifies `package-lock.json` (this plan adds no dependencies).

## Maintenance notes

- Plan 011 (supervisor tests) will add `tests/startProd.test.ts` importing `scripts/supervisorPolicy.mjs`; that plan ships a `.d.mts` declaration file precisely so THIS typecheck gate keeps passing. If you reorder the plans, 011 must still satisfy `npm run typecheck`.
- Reviewers should scrutinize any Step 2 test edits: each must be a pure type-level fix (the test's assertions and inputs unchanged).
- Deferred on purpose: vitest's `typecheck: { enabled: true }` mode (re-runs tests as type tests, slower and redundant with the `tsc -p` pass).
