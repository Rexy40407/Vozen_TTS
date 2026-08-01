# Plan 008: Repair the self-host esbuild check recipe

> **Drift check**: `git diff --stat 99eef7d..HEAD -- docs/SELF-HOST.md .github/workflows/ci.yml package.json`

> **Reconciliation (2026-08-01)**: The main working tree already contains the intended
> `npm rebuild esbuild` documentation change plus package-script edits. Preserve those user changes;
> execute and review the minimal documentation delta from the clean baseline in isolation.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `99eef7d`, 2026-08-01

## Why this matters

`docs/SELF-HOST.md:56-57` runs `npm ci --ignore-scripts` and immediately starts site checks. CI runs
`npm rebuild esbuild` first because the blocked install script leaves Vitest's native binary absent.
Fresh self-hosters therefore receive a misleading failure.

## Scope and steps

Update the copy-paste recipe to match CI, or add a single wrapper command that performs the rebuild.
Do not loosen the intentionally blocked install-script security posture.

**Verify**: `npm ci --ignore-scripts; npm rebuild esbuild; npm run check:site` exits 0 on a clean checkout.

## Done criteria

- [ ] Documentation includes the esbuild rebuild step or an equivalent wrapper.
- [ ] The install-script hardening comment remains accurate.
- [ ] `npm run check:site` passes after the documented sequence.

## STOP conditions

- Stop if the fix requires enabling all dependency install scripts.

## Maintenance notes

Keep the self-host recipe synchronized with `.github/workflows/ci.yml` whenever native tooling changes.
