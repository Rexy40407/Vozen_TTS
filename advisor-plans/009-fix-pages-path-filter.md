# Plan 009: Fix the Pages workflow path filter

> **Drift check**: `git diff --stat 99eef7d..HEAD -- .github/workflows/pages.yml site-tests package.json`

> **Reconciliation (2026-08-01)**: The main working tree already contains the corrected `site/**`
> test glob and related Pages changes. Preserve those user changes; execute the minimal stale-path
> replacement from the clean baseline and verify the workflow references only existing paths/globs.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `99eef7d`, 2026-08-01

## Why this matters

`.github/workflows/pages.yml:14` watches `tests/operationalHardening.test.ts`, but the current test is
`site-tests/operationalHardening.test.mjs`. A test-only change can therefore fail to trigger the Pages
workflow.

## Steps

Replace the stale path with `site-tests/**` or remove test-only paths if the intended policy is to deploy
only on artifact changes. Add a small static check that every workflow path exists or uses a directory
glob.

**Verify**: `npm run check:site`; inspect the workflow with `Get-Content .github/workflows/pages.yml`; the stale path must be absent.

## Done criteria

- [ ] Workflow triggers for current site acceptance-test changes.
- [ ] No nonexistent test path remains.
- [ ] Site checks pass.

## STOP conditions

- Stop if changing the trigger would deploy unrelated files; document the intended trigger policy.

## Maintenance notes

Keep workflow paths aligned with the actual `site-tests/` layout when tests are renamed.
