# 039 — Split `kofiWebhook.ts` (1235 lines) into `src/http/` route modules

**Source:** 5th audit (2026-07-18), finding DEBT-04 (revisit of the deferred D2). **Written against:**
commit `a9ca723`. **Priority:** P3 · **Effort:** M · **Risk:** MED (money path) · **Confidence:** HIGH.

## Why now (the deferral premise changed)

`src/premium/kofiWebhook.ts` was 765 lines when plan 033 deferred the split (D2) as "P3, only with
explicit appetite". It is now **1235 lines** — it grew 61% in 48h (admin console `handleAdminRequest`
~+250, claim-help route ~+250). It is now the single file that co-locates the **Ko-fi money webhook**,
the top.gg webhook, the Premium status API, the dashboard API, the claim/claim-help routes, AND the
**owner-admin auth wiring** — so a merge mistake in an unrelated route edits the security/money
boundary. The de-risking condition D2 cited (excellent route tests) still holds, so the tests are the
safety net for a behavior-preserving move.

## The change (pure refactor — ZERO behavior change)

`startKofiWebhook` should become a thin router that dispatches to `handle*Request` functions living in
`src/http/`. Extract, one module per handler (names indicative — match the existing function names):

- `src/http/apiRoute.ts` — `handleApiRequest` (`/api/me/premium`).
- `src/http/claimRoute.ts` — `handleClaimRequest` (`/api/link`).
- `src/http/claimHelpRoute.ts` — `handleClaimHelpRequest` (`/api/claim-help`).
- `src/http/dashboardRoute.ts` — `handleDashboardRequest` (`/api/dashboard/*`).
- `src/http/adminRoute.ts` — `handleAdminRequest` (`/api/admin/*`).
- `src/http/kofiRoute.ts` — the Ko-fi webhook + top.gg handler (the money path).
- `src/http/shared.ts` — the shared helpers the routes use: `readBody`, `isRateLimited`/`pruneRateMap`,
  `clientIp`, the `API_SECURITY_HEADERS`/CORS builders, `MAX_ADMIN_BODY` and the rate constants. Move
  these ONCE; import them into each route module.

`kofiWebhook.ts` keeps only `startKofiWebhook` (the `createServer` dispatch + wiring of deps) and
re-exports what other modules import from it, so **no import elsewhere breaks**.

## Boundaries

- Behavior-preserving MOVE ONLY. Do NOT change any route logic, header, status code, rate value, or the
  dispatch order (the comment at the top-level handler notes `/webhook/topgg` MUST be matched before the
  Ko-fi catch-all — preserve exactly).
- Do NOT rename the public `startKofiWebhook` export or its `KofiWebhookDeps` type (widely imported).
- Keep `src/index.ts`'s call site unchanged.

## Verification (the tests ARE the safety net — a pure refactor must not move any of them red)

- `npm run check` exit 0 — build + typecheck + lint + format + **all** vitest. The money/auth tests
  that pin behavior: `tests/kofi.test.ts`, `tests/adminRouter.test.ts`, `tests/perUserRouter.test.ts`,
  `tests/operationalHardening.test.ts`, `tests/serverHardening.test.ts` — every one must stay green
  with NO edits (if a test needs editing to pass, the move changed behavior → STOP).
- `rg "startKofiWebhook|KofiWebhookDeps" src tests` — all references still resolve.

## STOP conditions

- If any money/auth test needs a change to pass, STOP — you changed behavior, revert and re-extract.
- If a shared helper has subtle per-route differences (e.g. a route uses a different rate window), do
  NOT unify it — keep the per-route value; the shared module exposes the primitive, the route passes
  its own constants.
- Land this on its OWN branch/commit, run the deploy gate, and watch the deploy — it edits the money
  path, so verify a Ko-fi test webhook still grants after deploy.
