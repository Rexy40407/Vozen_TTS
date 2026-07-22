# Plan 013: Add ESLint (flat config), Prettier, and .editorconfig, wired into CI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat fb7f916..HEAD -- package.json .github/workflows/ci.yml eslint.config.mjs .prettierrc .prettierignore .editorconfig`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (the one-time format pass touches many files; mitigated by a separate mechanical commit)
- **Depends on**: none — but MUST land BEFORE plan 015 (god-module split), so moved code gets formatted exactly once instead of producing noisy mixed diffs. State this in `plans/README.md` dependency notes.
- **Category**: dx
- **Planned at**: commit `fb7f916`, 2026-07-07

## Why this matters

The repo has no linter, no formatter, no `.editorconfig`; CI runs only build + tests (`.github/workflows/ci.yml:25-27`). Style is currently consistent only by discipline, and classes of bugs ESLint catches statically (unused vars, unsafe patterns) go unflagged. Notably, the codebase ALREADY contains `// eslint-disable-next-line @typescript-eslint/no-explicit-any` directives (e.g. `tests/playerCrossKill.test.ts:118,125`) written in anticipation of exactly this toolchain. Landing it now — before the planned god-module split (plan 015) — means moved code is formatted once, not churned twice.

## Current state

- No `eslint.config.*`, `.eslintrc*`, `.prettierrc*`, or `.editorconfig` anywhere (verified at planning time).
- `package.json` — no lint/format scripts (`scripts` at lines 7-16: dev/build/start/start:prod/start:sharded/test/register/build:site). **No `"type": "module"` field** — the package defaults to CommonJS, so the flat config must be `eslint.config.mjs` (ESM `import` syntax in a `.js` file at root would fail to load).
- `.github/workflows/ci.yml:25-27` — steps end with `npm ci` → `npm run build` → `npx vitest run`.
- **Observed code style** (inferred from `src/voice/session.ts`, `src/voice/player.ts`, `src/bot/deps.ts`, `scripts/start-prod.mjs`, `tests/playerCrossKill.test.ts`):
  - single quotes everywhere;
  - semicolons everywhere;
  - trailing commas in multiline literals/params (e.g. `src/voice/player.ts:41` — `private readonly onIdle: () => void,`);
  - practical line width ~100: measured max line lengths are 95 (`src/voice/player.ts`), 92 (`src/bot/deps.ts`); `src/commands/index.ts` has outliers up to 155 that Prettier will wrap.
  - Conclusion: Prettier config = `singleQuote: true, printWidth: 100`, plus `endOfLine: "auto"`; Prettier 3 defaults already give `semi: true` and `trailingComma: "all"`. `endOfLine: "auto"` is deliberate: this is a Windows working tree and `.gitattributes` only forces LF for `*.sh` — forcing global LF would churn every file's EOLs.
- `.gitattributes` (verbatim, line 10): `*.sh text eol=lf` — the only EOL rule; docker/healthcheck.sh breaks under CRLF.
- Directories that must never be linted/formatted: `dist/`, `site-dist/`, `logs/`, `node_modules/`, `tools/clone-venv/` (Python venv, ~6GB), `audio-cache/`, `voice-clones/`, `site/` (minified by `npm run build:site`), `package-lock.json`.
- Repo conventions: comments in Portuguese; commits are PT one-liners.

## Commands you will need

| Purpose             | Command                                                                              | Expected on success                 |
| ------------------- | ------------------------------------------------------------------------------------ | ----------------------------------- |
| Install new devDeps | `npm install -D eslint @eslint/js typescript-eslint prettier eslint-config-prettier` | exit 0                              |
| Lint                | `npm run lint`                                                                       | exit 0 (after Step 5)               |
| Lint autofix        | `npm run lint:fix`                                                                   | exit 0                              |
| Format count        | `npx prettier --check .`                                                             | lists files needing format (Step 4) |
| Format              | `npm run format`                                                                     | exit 0                              |
| Tests               | `npx vitest run`                                                                     | all pass                            |
| Build               | `npm run build`                                                                      | exit 0                              |

## Scope

**In scope**:

- `eslint.config.mjs`, `.prettierrc`, `.prettierignore`, `.editorconfig` (create)
- `package.json` + `package-lock.json` (devDeps + scripts)
- `.github/workflows/ci.yml` (add lint/format-check steps)
- The one-time mechanical reformat of `src/**`, `tests/**`, `scripts/**`, `tools/*.{ts,mjs}`, `vitest.config.ts` and root JSON/MD files (Step 6, separate commit)

**Out of scope** (do NOT touch):

- Any BEHAVIORAL change while fixing lint findings — autofix and formatting only; a lint error that needs a logic change is a STOP.
- `dist/`, `site/`, `site-dist/`, `logs/`, `tools/clone-venv/`, `audio-cache/`, `voice-clones/` — ignored, never reformatted.
- Type-checked (type-aware) ESLint rules — explicitly NOT enabled in this plan (keeps lint fast; can be a follow-up).
- `.gitattributes` — EOL policy stays as is.

## Git workflow

- Branch: `advisor/013-lint-format-toolchain`
- **Two commits, strictly separated** (this is load-bearing for reviewability):
  1. `dx: eslint flat config + prettier + editorconfig + scripts + CI` — configs, package.json, CI. NO reformatting.
  2. `style: passagem mecânica única de prettier + eslint --fix (sem alterações de lógica)` — the format pass only.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Install dev dependencies

```
npm install -D eslint @eslint/js typescript-eslint prettier eslint-config-prettier
```

(Latest majors as of planning: eslint 9, typescript-eslint 8, prettier 3 — all support the flat config + Prettier-3 defaults this plan relies on.)

**Verify**: `npx eslint --version` → v9.x; `npx prettier --version` → 3.x.

### Step 2: Create the four config files

`eslint.config.mjs` (`.mjs` because package.json has no `"type": "module"` — see Current state):

```js
// eslint.config.mjs — flat config. Regras recommended SEM type-checking
// (rápido; as type-aware ficam para depois). Prettier trata do estilo.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'site/',
      'site-dist/',
      'logs/',
      'node_modules/',
      'tools/clone-venv/',
      'audio-cache/',
      'voice-clones/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
);
```

`.prettierrc`:

```json
{
  "singleQuote": true,
  "printWidth": 100,
  "endOfLine": "auto"
}
```

`.prettierignore`:

```
dist/
site/
site-dist/
logs/
node_modules/
tools/clone-venv/
audio-cache/
voice-clones/
package-lock.json
```

`.editorconfig`:

```ini
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

# Espelha o .gitattributes: scripts shell TEM de ficar em LF (dash não tolera CRLF).
[*.sh]
end_of_line = lf
```

(No global `end_of_line` — deliberate; see Current state.)

**Verify**: `npx eslint --print-config src/index.ts > /dev/null` (or on Windows `npx eslint --print-config src/index.ts | Out-Null`) → exit 0 (config loads); `npx prettier --check .prettierrc` → exit 0.

### Step 3: Add scripts and CI steps

In `package.json` `scripts`, add:

```json
"lint": "eslint .",
"lint:fix": "eslint . --fix",
"format": "prettier --write .",
"format:check": "prettier --check ."
```

In `.github/workflows/ci.yml`, after `npm run build` (and after `npm run typecheck` if plan 005 already landed):

```yaml
- run: npm run lint
- run: npm run format:check
```

**Verify**: `git grep -n "npm run lint" -- .github/workflows/ci.yml` → 1 match; `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('json ok')"` → `json ok`.

**Commit now** (commit 1 — configs only, tree not yet reformatted; CI on this commit alone would fail format:check, which is why commit 2 follows immediately).

### Step 4: COUNT the damage before touching anything

Run and RECORD both numbers in your report:

- `npx prettier --check .` → note how many files need formatting (expect: most of `src/` + `tests/` — that's normal).
- `npx eslint . 2>&1 | tail -5` (PowerShell: `npx eslint .` and read the summary line) → note the error/warning count BEFORE autofix.

**Verify**: you have both counts written down. No file modified yet (`git status` clean).

### Step 5: Autofix pass and triage

1. `npm run lint:fix`
2. `npx eslint .` again and count remaining errors.
   - **0 errors**: proceed.
   - **1–100 errors**: inspect the rule breakdown. If they concentrate in 1-3 stylistic-ish rules (typical: `@typescript-eslint/no-unused-vars` on test stubs, `no-empty` on commented empty catches), you may add a MINIMAL rules block to `eslint.config.mjs` — e.g.:
     ```js
     {
       rules: {
         'no-empty': ['error', { allowEmptyCatch: true }],
         '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
       },
     },
     ```
     Only loosen; never fix errors by editing code logic. Re-run until 0.
   - **>100 errors after autofix**: STOP (see STOP conditions) — the config is likely too strict for this codebase; report the per-rule breakdown.
3. `npm run format`

**Verify**: `npm run lint` → exit 0; `npm run format:check` → exit 0.

### Step 6: Prove the pass was behavior-neutral, then commit it

- `npx vitest run` → all tests pass, same count as before Step 5.
- `npm run build` → exit 0.
- If plan 005 landed: `npm run typecheck` → exit 0.
- `git diff --stat` → large but confined to code files; confirm NOTHING under `site/`, `dist/`, `site-dist/` changed.

**Commit now** (commit 2 — the mechanical pass, message from Git workflow section).

**Verify**: `git log --oneline -2` shows the two commits in order; `git status` clean.

## Test plan

No new tests — the gates are the test:

- `npm run lint` exit 0 and `npm run format:check` exit 0 on the final tree.
- `npx vitest run` passes with the SAME test count before and after the mechanical pass (behavior-neutrality proof).
- `npm run build` exit 0 (Prettier didn't break any syntax).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `eslint.config.mjs`, `.prettierrc`, `.prettierignore`, `.editorconfig` exist
- [ ] `npm run lint` exits 0
- [ ] `npm run format:check` exits 0
- [ ] `npx vitest run` exits 0
- [ ] `npm run build` exits 0
- [ ] `.github/workflows/ci.yml` contains `npm run lint` and `npm run format:check` steps after the build step
- [ ] History shows the format pass as its OWN commit, separate from the config commit (`git log --oneline -2`)
- [ ] `git diff fb7f916..HEAD --stat -- site/ dist/ site-dist/` → empty
- [ ] `plans/README.md` status row updated, including the "must land before plan 015" dependency note

## STOP conditions

Stop and report back (do not improvise) if:

- ESLint reports **more than 100 errors after `lint:fix`** — report the per-rule breakdown (`npx eslint . --format json` piped to a count, or read the summary) and wait for a decision on loosening.
- Any remaining lint error requires a LOGIC change (not autofix, not a rules-block loosening) — e.g. a genuinely unused variable whose removal alters behavior, or an `eqeqeq`-style finding in live code.
- `npx vitest run` fails after the format pass (Prettier/autofix changed behavior — should be impossible; treat as drift and report).
- `npm run build` fails after Step 5.
- The existing `// eslint-disable-next-line @typescript-eslint/no-explicit-any` directives in tests start ERRORING as unused directives — don't delete them silently; report.
- Plan 015 (god-module split) has already been executed when you start — ordering assumption broken; ask before creating giant reformat diffs on freshly moved code.

## Maintenance notes

- **Ordering**: this plan is a prerequisite-by-convention for plan 015 (god-module split) — record in `plans/README.md`: "015 after 013 so moved code is formatted once."
- The format-pass commit SHA should be added to a `.git-blame-ignore-revs` file in a follow-up if blame noise becomes annoying (deferred — not in scope).
- Type-aware linting (`tseslint.configs.recommendedTypeChecked`) is deliberately deferred: it needs `parserOptions.project`, is ~10x slower, and would surface a different class of findings. Revisit after the suite is stable.
- Reviewer focus: commit 1 vs commit 2 separation; commit 2 must contain zero non-mechanical hunks (spot-check a few files — only quotes/wrapping/commas/whitespace may change).
- If `npm install` bumps `package-lock.json` beyond the five new devDeps' subtrees, mention it in the report (overrides in package.json can cascade).
