# Plan 014: Reconcile the monetization policy document

> **Drift check**: `git diff --stat 99eef7d..HEAD -- docs/MONETIZATION.md crates/vozen-api/src/stripe_api.rs .github/workflows/deploy-bot.yml site`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 001
- **Category**: docs
- **Planned at**: commit `99eef7d`, 2026-08-01

## Why this matters

`docs/MONETIZATION.md` presents itself as the implemented policy but describes obsolete payment flow
and feature counts. Current code/deploy/site use Stripe Checkout and the current product inventory,
so maintainers could make entitlement or pricing decisions from contradictory documentation.

## Steps

Compare `docs/MONETIZATION.md:1-30` with `README.md:37,43-44`, `crates/vozen-api/src/stripe_api.rs`,
`.github/workflows/deploy-bot.yml`, and current site pricing. Update only factual policy statements;
retain explicit caveats for external Discord Premium Apps. Add a lightweight check or generated source
for game/language counts if a stable source exists.

**Verify**: `rg -n "34|35|13|16|Stripe|Ko-fi|Patreon" docs/MONETIZATION.md README.md site/index.html`; `npm run check:site`; `node tools/check-rust-contracts.mjs` — all exit 0.

## Done criteria

- [ ] Payment path, game counts, language counts and free/Premium split agree with code/site.
- [ ] No unsupported product promise is introduced.
- [ ] Site and contract checks pass.

## STOP conditions

- Stop if the current count cannot be derived unambiguously from the contract/catalog.

## Maintenance notes

Treat this document as policy; update it in the same change as future pricing/entitlement behavior.
