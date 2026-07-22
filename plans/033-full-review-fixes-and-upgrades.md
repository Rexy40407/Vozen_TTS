# 033 — Full-repo review: fixes & upgrades (4th audit round)

**Date:** 2026-07-16 · **Audited at:** commit `407503c` **plus** the uncommitted (and
verified-green) Components V2 UI refactor in the working tree.
**Baseline:** `npm run check` exit 0 on the dirty tree (build + typecheck + lint +
format:check + vitest, 184 files / 1876+ tests).
**Method:** 4 parallel read-only auditors (correctness · security · performance ·
debt/tests/docs) → findings hand-vetted against the cited code before planning.
**Security verdict:** CLEAN — zero HIGH/MED findings; injection, HTTP surface, money
path, GDPR lifecycle and workflow pinning all verified strong (see §Not-planned for
the LOW hygiene leftovers).

**Executor rules:** TDD per CONTRIBUTING.md (RED test first). Finish every workstream with
`npm run check` green. Commit authorship is limited to the human author
(CONTRIBUTING.md hard rule). Conventional short English commit messages.

---

## P0 — Land the pending session state (DO FIRST, in this order)

### P0.1 Commit the Components V2 refactor (it is already green)
The working tree has a ~79-file migration of bot replies to Discord Components V2
cards (`src/ui/messages.ts`: `replyCard`/`editCard`/`updateCard`/`channelCard`/
`messageEditCard` + `tests/uiMessages.test.ts` + `tests/messagePayload.ts`).
`npm run check` passed on this exact tree (exit 0). The audit confirmed call sites
are consistently migrated, mention-suppressing sends keep `allowedMentions:{parse:[]}`,
and the global `allowedMentions` default on the Client covers the rest.
- [ ] `git status` review → `git add -A` → commit `feat(ui): migrate replies to Components V2 cards`.
- [ ] Do NOT rewrite/reformat the refactor's code — commit as-is (it is verified).
- Verification: `git status` clean; `npm run check` still green.

### P0.2 Confirm the auto-deploy is green
- [ ] `gh run watch <id> --exit-status` on the deploy triggered by the release push.
- This ships to production: Components V2 UI + `KOFI_SHOP_MAP` support (inert until
  env set) + `/voice config` panel fixes when they land later.

### P0.3 [needs Diogo] Ko-fi end-to-end validation + annual passes
- [ ] Diogo: Ko-fi → Webhooks → **Send Test** → confirm HTTP 200 in the panel.
- [ ] Diogo: create the 3 annual Shop items (names MUST contain the plan word):
      `Vozen Plus — 1 year` €19.99 · `Vozen Premium (3 servers) — 1 year` €39.99 ·
      `Vozen Premium (8 servers) — 1 year` €79.99, each with the Discord-ID
      instruction in the description; send the 3 `direct_link_code`s (from
      `ko-fi.com/s/<code>`).
- [ ] Set `KOFI_SHOP_MAP=<code1>:plus:365, <code2>:premium:365:3, <code3>:premium:365:8`
      in the VPS `.env` + `systemctl restart vozen`.
- Verification: a test webhook with a mapped `direct_link_code` grants 365 days
  (visible in logs / `/premium info`).

---

## P1 — Confirmed bugs (all hand-vetted; TDD each; ordered by severity)

### B1 · Clone recording silently kills a live `/transcribe` session [CONFIRMED]
`src/commands/handlers/voice.ts:410` — the clone recorder's `finally` unconditionally
`connection.rejoin({ selfDeaf: true })`. A live STT session (transcribe.ts keeps
`selfDeaf: false`) loses all audio and never knows. Also both features subscribe the
same per-user receiver stream (shared-stream hazard already documented in voice.ts).
- Fix: mutual exclusion both ways — `/voice clone record` refuses to start while the
  guild has an active transcription session (friendly i18n message), and `/transcribe
  start` refuses while a clone recording is active. Simplest shared signal: export a
  per-guild check from the transcribe module (it already tracks `activeSessions`) and
  a per-guild view of `activeCloneRecordings`.
- RED tests: (a) clone record during active session → refusal, session untouched;
  (b) transcribe start during clone recording → refusal.
- New i18n keys (en+pt minimum): `clone.busyStt`, `stt.busyClone`.
- Effort M · Risk MED (do not leave the bot un-deafened on any exit path — keep the
  existing `finally` semantics when no session is active).

### B2 · Consent timeout shows "declined" instead of "didn't answer" [CONFIRMED]
`voice.ts:263-275` renders `clone.consentRefused` for the 60s timeout; the fully
translated `clone.consentTimeout` key (catalog.ts:374 + 30+ locales) is dead code.
- Fix: on collector end with reason ≠ 'answered', use `clone.consentTimeout`.
- RED test: timeout path asserts the timeout copy, not the refusal copy.
- Effort S · Risk LOW.

### B3 · Recorded target can never press the ⏹️ Stop button [CONFIRMED]
`voice.ts` posts the stop button on the invoker's EPHEMERAL reply (deferReply
ephemeral), yet authorizes `targetId` to click it and the copy promises both can stop.
- Fix: for non-self recordings, put the stop button on a PUBLIC channel message (the
  consent message channel), delete/disable it on stop; keep the ephemeral progress
  for the invoker.
- RED test: non-self recording → the component with `clonestop:` custom id is sent
  via `channel.send` (public), and a click by the target stops the recording.
- Effort S-M · Risk LOW.

### B4 · `/voice config` collector leaks rejections [CONFIRMED — code added 2026-07-16]
`voice.ts` `collector.on('collect', (ci) => void onCollect(ci))` — `onCollect` awaits
`ci.update/reply` without try/catch; a double-click (40060) or expired ack (10062)
becomes an unhandledRejection.
- Fix: `void onCollect(ci).catch(() => {})` (or try/catch inside), matching the
  file's own `.catch(() => {})` convention.
- RED test: onCollect with an `update` that rejects → no unhandled rejection.
- Effort S · Risk LOW.

### B5 · Engine labels: 4 copies, 2 already diverged [CONFIRMED]
`voice.ts:460` default label is `t('voice.config.engDefault')` while `voice.ts:711`
returns literal `'Google'`; more copies at voice.ts:515-522 and definitions.ts:243-246.
- Fix: single `engineLabel(engine, locale)` helper (e.g. in `src/tts/engineLabels.ts`
  or voiceConfigPanel.ts) used by `/voice set` reply, the panel select, and the panel
  summary. definitions.ts choices stay literal (command registration has no locale).
- RED test: `/voice set` with engine omitted+default and the panel summary render the
  SAME default label.
- Effort S · Risk LOW.

### B6 · Deploy gate is a subset of CI [CONFIRMED]
`.github/workflows/deploy-bot.yml:65-66` runs only `npm run build` + `npx vitest run`;
CI enforces `npm run check`. A push failing lint/format/test-typecheck still restarts
production.
- Fix: replace the two lines with `npm run check` in the VPS script step.
- Verification: next deploy log shows the full gate.
- Effort S · Risk LOW.

### B7 · SQLite `synchronous` left at FULL → fsync per spoken message [CONFIRMED]
`src/store/db.ts:11` sets only WAL. `bumpTalk` writes on every read message.
- Fix: after the WAL pragma add `db.pragma('synchronous = NORMAL')` and
  `db.pragma('busy_timeout = 5000')`. NORMAL+WAL is the documented crash-safe combo.
- RED test: initDb → `db.pragma('synchronous', {simple:true}) === 1`.
- Effort S · Risk LOW.

### B8 · Store cache evicts by wiping the whole table map [CONFIRMED]
`src/store/cache.ts:77` — `map.clear()` at 10k entries → periodic latency sawtooth
exactly under load (every other map in the repo evicts oldest-first).
- Fix: delete oldest key(s) via insertion order instead of clear().
- RED test: fill to cap, add one → size stays ≤ cap AND previously-hot recent keys
  still cached; oldest gone.
- Effort S · Risk LOW.

---

## P2 — Performance & robustness — DONE 2026-07-16 (P2.1 and P2.2 REJECTED with data)

> **Measured before acting — and the numbers killed the headline item.**
> Production `/stats`, 2026-07-16 (uptime 1539s, 15 guilds): **cache hits 1, misses 24
> (4% hit rate)**, 25 messages spoken, synth p50 **207ms** / p95 378ms, 0 synth errors,
> 0 voice drops.
>
> **P2.1 (Opus fast-path) — REJECTED.** The finding assumed a warm cache ("on a warm
> cache this transcode is the dominant per-message CPU cost"). The audio cache is on
> DISK and survives restarts, so 4% is a warm-cache number: TTS phrases are almost
> always unique, so the cache barely fires. The win is `hit_rate × ~40ms` plus the Opus
> encode saved on every play ≈ **3-4ms against ~250ms/message (~1.4%)** — not worth MED
> risk on the player, which is the product's core path. Revisit ONLY if the hit rate
> ever climbs (re-check `/stats`).
>
> **Bigger takeaway: there is no performance problem at this scale.** 25 messages in 26
> minutes across 15 guilds, zero synth errors, zero voice drops — the box is idle. If
> speed ever matters, the lever is the 207ms synthesis, not the ~3ms playback.
>
> **P2.2 (TTL cache for premium lookups) — REJECTED.** Indexed single-row reads + one
> small JOIN ≈ 20µs against a 207ms synthesis (~0.01%). The audit's own playbook
> dismissed the sibling `db.prepare` finding on exactly those grounds. Caching the
> boolean would also let an EXPIRED Plus keep spending paid Google HD quota for the TTL.
>
> **P2.3/P2.4/P2.5 — DONE** (commit `1669816`): coverage gate made honest (93.73% ->
> 85.97% by excluding ~22k statements of pure locale/content data; threshold unchanged
> and still green), cards/embeds policy documented (embeds deliberately kept for rich
> lists; `EmbedLinks` still required), hygiene bundle (returnTo `//` guard + main-v27 ->
> v28 cache-bust, pages.yml Node 22, kofi JSDoc seat count).

### P2.1 Opus fast-path: stop paying ffmpeg on every playback [REJECTED — see box above]
`src/voice/player.ts:248-251` — `StreamType.Arbitrary` spawns ffmpeg to transcode the
cached WAV on EVERY play, including cache hits. Dominant per-message CPU on 2 vCPU.
- Design constraints (from the auditor, validated): `inlineVolume` (emphasis gain ≠ 1)
  and the EffectEngine need PCM — the Opus path only covers the no-gain/no-effect
  majority; keep today's path as fallback.
- Approach: cache an Ogg/Opus variant alongside the WAV (new cache namespace), play
  via `StreamType.OggOpus` when gain==1 and no effect.
- Bench before/after with tools/bench.ts. Effort M · Risk MED · Payoff HIGH.

### P2.2 TTL cache for premium lookups on the gcloud hot path
`resolveUserEngine` → `isUserPremium`/`resolveGuildPassOwner`/`isGuildPremium` hit
SQLite per message for gcloud users (only uncached hot-path reads left).
- Fix: 60s TTL cache mirroring the `user_clone` CLONE_TTL_MS pattern; invalidate on
  grant/deactivate writes. Effort S-M · Risk LOW.

### P2.3 Coverage thresholds are gamed by data files [CONFIRMED]
`vitest.config.ts:13-18` global-only; handlers sit at 27-54% while locales/data (100%)
inflate the average.
- Fix: exclude pure data catalogs (i18n/locales, content banks) from coverage include,
  which makes the 85% global honest; then backfill the worst handlers (voice.ts panel
  glue, personal.ts, games.ts) to clear the bar. Do NOT lower thresholds.
- Effort M · Risk LOW (tests only).

### P2.4 Finish the cards migration policy
Residual `brandEmbed()/embeds:` in config.ts, voice.ts:723, meta.ts + stale comment
(`helpers.ts:76` claims "almost everything in EMBEDS").
- Decide: cards-only (migrate the 3 sites) or cards+embeds-for-rich-fields (annotate).
  Either way fix the helpers.ts comment. Effort S · Risk LOW.

### P2.5 Hygiene bundle (one commit)
- `site/js/main-v27.js:373` — returnTo regex: reject leading `//` (anchor `^\/(?!\/)`).
- `.github/workflows/pages.yml:37` — Node 20 → 22 (engines floor).
- `src/premium/kofi.ts` JSDoc still says max ⇒ "10 licenses" (constant is 8).
- Two plan files share the 020 prefix (020-audiocache / 020-kofi-claim) — note only,
  do not rename (links elsewhere).
- Effort S · Risk LOW.

### P2.6 `getTopSpeakers` full-table fetch+JS sort (defer OK)
`talkStats.ts:121-142` O(n) per auto-leaderboard post. Low frequency (12h/15%);
only matters at large-guild scale. Fix = SQL pre-rank `spoken_count DESC LIMIT k`,
live-streak only for candidates. Effort M · Risk LOW · Priority LOW.

---

## P3 — Structural debt (only with explicit appetite; refactors, MED risk)

- **D1 · Split `handlers/voice.ts` (836 lines, ~27% covered):** extract the
  `/voice config` panel controller and the `/voice clone` group into their own
  modules; characterize with tests FIRST (P2.3 backfill is the prerequisite).
- **D2 · Split `premium/kofiWebhook.ts` (765 lines):** it is the whole public HTTP
  server, not a webhook. Move each `handle*Request` into `src/http/`; keep
  `startKofiWebhook` as a thin router. Its excellent route tests de-risk the move.
- **D3 · `isPremiumContext(deps, i, now)` helper:** the `isUserPremium || isGuildPremium`
  gate is copy-pasted at ~10 sites with two null-handling idioms.
- **D4 · ARCHITECTURE.md sync:** the `commands/index.ts` row describes the pre-015
  world; missing rows for definitions.ts, handlers/*, ui/theme, http/serverHardening,
  premium/dashboardApi+claim; games row lists 15 of 16 (missing wordChain).
- **D5 · English-only rule enforcement:** ARCHITECTURE.md is PT; PT log strings in
  kofiWebhook.ts:678/722/763 + config/index.ts:275; PT comments in workflows.
  Decide: translate (M) or scope the rule in CONTRIBUTING.md (S). Recommend: translate the
  LOG STRINGS now (operator-facing), decide the docs language explicitly.

---

## Features — upgrades (direction; pick with Diogo, each becomes its own spec)

- **F1 · Slash-command localization** (`setNameLocalizations`/`setDescriptionLocalizations`
  on the builders in definitions.ts, sourced from the existing 35-locale catalog).
  Discord renders command descriptions in the user's client language — the single
  biggest visible-UX win available with zero new content. Effort M.
- **F2 · Dashboard Phase 3b (carry-over DIRECTION-01):** let the web dashboard write
  `tts_channel_id` + `default_voice` (DASHBOARD_FIELDS has 9 toggles but not these
  two). Architecture already supports it. Effort M.
- **F3 · i18n polish:** translate the 12 `voice.config.*` keys to the other 33
  locales; add the missing `dash.eyebrow/title/sub` keys to the site i18n (the
  dashboard heading currently shows English in every language). Effort S-M.
- **F4 · STT: delete posted transcripts on consent revoke (carry-over DIRECTION-02):**
  natural privacy expectation + differentiator; needs a message-id table (rot-guard +
  PRIVACY update). Effort M.
- **F5 · (external, Diogo)** Premium Apps onboarding at ~75 servers; annual passes
  launch (P0.4); top.gg webhook already live.

## Not planned this round (recorded so the next audit doesn't re-raise)

- SEC-01 webhook-route rate limiting: by-design (Ko-fi/top.gg retry on non-2xx; edge
  throttling belongs to Caddy; loopback bind + 64KB cap + constant-time auth hold).
- SEC-02 error-reporter PII scrub: LOW/opt-in; revisit with D2.
- SEC-04 OAuth implicit flow: forced by the backendless site; mitigations verified
  (CSPRNG state, history.replaceState, sessionStorage, server-side validation).
- PERF-06 site i18n bundle lazy-load: auditor did NOT confirm it's render-blocking —
  verify before acting.
- PERF-07 per-guild countGate caps · TEST-03 bootstrap extraction: fold into D1/D2 wave.

## Suggested execution order

P0.1 → P0.2 → P0.3 (one sitting) · P0.4 in parallel (Diogo) · then B1-B8 (B2/B4/B5/B7/B8
are quick wins; B1 is the careful one) · then P2.1-P2.5 · P3/F-items only on request.
**MVP = P0 + P1.**
