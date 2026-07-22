# Compliance audit — admin console (plan 037)

> Scope: the Vozen admin console added in plan 037 — the page `vozen.html` (in the
> `vozen-helper-bot` site repo) and its backend `src/premium/adminApi.ts` +
> `src/premium/adminAuth.ts`. Question asked: does anything the console shows —
> notably the per-server and per-user message tracking — comply with the Discord
> Developer ToS/Policy, EU GDPR, and US state privacy law, and does it create any
> new exposure? Date: 2026-07-17.

## What the console exposes

Owner-only (Discord identity `== OWNER_ID` + HMAC-signed session; every method fails
closed when unconfigured — `adminApi.ts:120,126-128,134-141`). Two tabs:

| Tab | Data shown | Source | New collection? |
|---|---|---|---|
| Passes | active Plus/Premium (Discord ID + expiry), Ko-fi pending | `premium_*`, `kofi_pending` | No — existing entitlement/financial records |
| Servers | per guild: name, icon, member count, **total messages read**, **active speakers**, **top 5 speakers (ID + count)** | `talk_stats` via `buildServerStats` | **No** — see below |

Only `id/name/icon/memberCount` leave the bot's guild cache; every statistic is
computed from `talk_stats` already in the DB (`adminApi.ts:41-43,155-157`).
`serverStats.ts:52-57` proves the figures are **counts only** — `totalMessages` is a
sum of per-user counts, `topSpeakers` is `(userId, count)`. **No message content,
text, or body is read or exposed anywhere in this surface.**

## Verdict by framework

### Discord Developer ToS / Developer Policy — ✅ PASS
- **Limited use / declared functionality:** the data operates the operator's own
  bot (grant/revoke entitlements, see where the bot is used). No profiling, no ad
  targeting, no sale, no sharing with third parties.
- **No message content:** the console handles message *counts* for the disclosed
  `/top-speakers` feature, never content. Content restrictions do not apply to this
  aggregate metadata.
- **Access control:** single-owner gate (Discord OAuth identity == `OWNER_ID`) + a
  server-only HMAC session; the public page shows nothing without it.
- **No new exposure to members' peers:** the top-speaker list is already public
  in-server via the `/top-speakers` command; the console shows the operator nothing
  a member cannot already see for their own server.

### EU GDPR — ✅ PASS (one transparency nit, closed in this change)
- **Lawful basis:** legitimate interest (operating/administering the service);
  the identifiers are Discord snowflakes (pseudonyms), not civil names.
- **Data minimisation:** raw user IDs in the top-speaker chips are necessary to
  identify who to grant/revoke and who the top talkers are; capped at 5 per server
  (`adminApi.ts:111`). Only counts, never content.
- **Same controller, no new recipient:** the instance operator already controls the
  SQLite file directly (PRIVACY.md §3). The console is a *view* over data the
  operator already holds — it is **not** a new third party or a new disclosure.
- **Retention:** `talk_stats` is deleted 30 days after the bot leaves a server
  (`dataLifecycle.ts:28`, `purgeGuild`) and by `/privacy erase` (`dataLifecycle.ts:51`);
  a rot-guard test fails if any `guild_id`/`user_id` table is left unclassified.
- **Rights:** access/erase already served by `/privacy erase` (PRIVACY.md §3),
  which explicitly lists `talk_stats`.
- **Nit → fixed:** PRIVACY.md disclosed the *collection* of `talk_stats` and the
  `/top-speakers` feature, but not that the **operator** can view aggregate stats +
  top speakers across servers via an admin console. Added as a transparency note
  (PRIVACY.md §1.2) — no new data, just naming the access path.

### US state privacy law (CCPA/CPRA, VCDPA, etc.) — ✅ PASS
- PRIVACY.md already grants access/correction/deletion/portability + appeal, and
  states Vozen does **not** sell data, share for cross-context behavioural ads, or
  run targeted advertising. The console changes none of that — it is internal,
  owner-only administration.

## Findings

| # | Severity | Finding | Action |
|---|---|---|---|
| 1 | Low (transparency) | The operator admin console (cross-server aggregates + top speakers) was not named in PRIVACY.md as an access path. | **Fixed:** PRIVACY.md §1.2 note. No data/behaviour change. |

No high/medium findings. No message content is exposed; auth is owner-only and
fails closed; the tracked data is disclosed, deletable, and time-limited.

## Conclusion

The console is compliant. It introduces **no new data collection and no new
third-party disclosure** — it is an owner-only view over counts (not content) that
are already disclosed, already public in-server via `/top-speakers`, already deletable
via `/privacy erase`, and already auto-purged 30 days after the bot leaves. The only
gap was a documentation one, closed by the PRIVACY.md §1.2 note.

## Addendum — plan 038 (server streak + global top talkers), 2026-07-18

Two owner-only additions to the Servers tab; verdict unchanged (**compliant**).

| Surface | Data | Source | New collection? |
|---|---|---|---|
| **Server streak** (per guild) | consecutive-day counter: how many days in a row ≥1 person spoke | new table `guild_talk_streak` (`guild_id`, `streak`, `best_streak`, `last_date`) | **No personal data** — a server-level aggregate derived from the same activity as `talk_stats`. Same Duolingo rules as the per-user streak (shared `nextStreak`). No `user_id`, no content. |
| **Global top 10** | the 10 users with the most messages read **across all servers**, with username + avatar | `SUM(spoken_count)` over `talk_stats` (already stored); username/avatar fetched **live** from Discord | **No new stored data** — the counts already exist; identity is public profile data resolved on demand for display and **never persisted**. |

- **GDPR / Discord ToS:** unchanged posture. Counts, never content; owner-only
  (same `authorize()` gate); the global list is the same "chatterboxes" data already
  public via `/top-speakers`, only summed across the operator's own servers. Username
  and avatar are the person's **public** Discord profile, shown to the operator only,
  fetched live and not stored (a 10-min in-memory cache, no DB write).
- **Retention / erasure:** `guild_talk_streak` is registered in `GUILD_PURGE_TABLES`
  (`dataLifecycle.ts`) — it dies with the server, and the rot-guard test enforces the
  classification. It has no `user_id`, so `/privacy erase` (personal data) does not
  apply; the underlying `talk_stats` a user's totals are computed from is still erased.
- **Site CSP note (conscious):** the top-talkers avatars load from
  `cdn.discordapp.com`, which is **already** in the page's `img-src` (the server
  icons use it) — no CSP change was needed. This is an owner-only page and the owner
  reaches it through a Discord-authenticated session, so no third-party visitor IP is
  exposed that Discord does not already see. Verified in-browser: zero CSP console
  errors with the avatars rendering.
- **Async route safety:** `GET /api/admin/toptalkers` resolves identities over the
  Discord REST and is therefore async; it carries its own `.then/.catch` (not the
  sibling synchronous `try`) so a rejected promise becomes a clean 500 instead of
  crashing the bot (BUG-01 hazard). Pinned by `adminRouter.test.ts`.

No new findings. No message content is exposed; the streak holds no personal data;
identities are public and live-only.
