# Compliance matrix — Vozen

> Requirement → status → evidence, across every platform and jurisdiction Vozen touches.
> Written 2026-07-15 during the mega-audit; updated 2026-07-19 for instant activation. This is **honest technical diligence, not legal
> advice** — it maps what the code and docs actually do to each policy's requirements. It does
> not replace review by a qualified lawyer. Vozen is **self-hosted** (AGPL-3.0): each instance
> operator is the data controller for their instance; this matrix describes the reference/
> official instance (`vozen.org` + the hosted bot).
>
> Legend: ✅ met · ⚠️ met with a caveat / operator action · ➖ not applicable.

## 1. Discord — Developer ToS + Developer Policy

| # | Requirement | Status | Evidence |
| - | ----------- | ------ | -------- |
| 1.1 | API data used ONLY for the declared functionality; no profiling, no sale, no undisclosed sharing | ✅ | Data flows disclosed in `PRIVACY.md`; no analytics/ad SDKs; `CONTRIBUTING.md` hard rule. Disclosed engines (Google/OpenAI) are the only third parties, and only for synthesis. |
| 1.2 | No AI training on message content | ✅ | No training pipeline exists; message text is transient (not stored in a table). Official Google Cloud TTS / OpenAI API used under their no-training API terms (see §8, §9). |
| 1.3 | Privileged intents minimised + justified before verification (100-guild gate) | ✅ | Intents: `Guilds`, `GuildVoiceStates`, `GuildMessages`, `MessageContent` (`src/bot/client.ts:31-34`). Only **MessageContent** is privileged; `GuildMembers` is **not** requested. See `docs/COMPLIANCE-DISCORD.md §4`. |
| 1.4 | Consent-first for anything acting on/about a user (recording) | ✅ | STT (`/transcribe`): per-speaker consent gate (`transcriptionSession.ts` `hasConsent`), un-deafen only during a session, audio never persisted. |
| 1.5 | Every stored user datum disclosed AND has a deletion/retention path | ✅ | `PRIVACY.md` discloses every datum, including `talk_usage` counters by language and engine shown in the operator console. `/privacy erase` removes user-scoped `talk_usage` and other erasable personal data; the server purge removes server-scoped rows. Active entitlements and minimum payment/activation-consent records may be retained only for disclosed accounting, fraud, dispute, and legal purposes. |
| 1.6 | No unsolicited DMs; no contacting users outside Discord with API data | ✅ | No DM-send code path; `CONTRIBUTING.md` hard rule. Support is pull-only (support server link). |
| 1.7 | Default-safe output (no mass mentions/ban-risk) | ✅ | Client default `allowedMentions: { parse: [] }` (`client.ts:39`); opt-in per call site only. |
| 1.8 | Paid features support Discord Premium Apps with price parity (≤ other channels) where available | ⚠️ | Entitlement sync shipped (`premium/entitlements*`), price-parity copy on site. **Operator action:** create SKUs in the Developer Portal post-verification and set `PREMIUM_*_SKU_ID` (external, not code). |
| 1.9 | Report/appeal channel for users | ✅ | Support server linked in `/help`, site, `TERMS.md`. |
| 1.10 | Incident response for suspected unauthorized access | ✅ | `docs/INCIDENT-RESPONSE.md` exists (COMPL·5). |

## 2. EU — GDPR

| # | Requirement | Status | Evidence |
| - | ----------- | ------ | -------- |
| 2.1 | Controller identity + contact (Art. 13) | ✅ | `site/privacy.html §1`, `PRIVACY.md`; contact via support server. **Operator action (optional):** add a named controller + `privacy@` address for a hosted commercial instance. |
| 2.2 | Lawful basis per purpose (Art. 6) | ✅ | `site/privacy.html §3`: 6(1)(b)/(f) service and one-time activation match, (f) legitimate interests, (a) consent for STT, (c)/(f) financial and activation-consent records. |
| 2.3 | Transparency of processing + third parties (Art. 13/14) | ✅ | `PRIVACY.md` and `site/privacy.html` disclose the Discord `email` scope, uncached one-time verified-email/HMAC processing, `talk_usage` language/engine counters visible to the operator, consent evidence, and providers (Google/Discord/Ko-fi/top.gg/GitHub Pages/Hetzner). |
| 2.4 | Right of access, rectification, erasure, restriction, portability, objection (Art. 15-21) | ✅ | Access/other rights via operator (support server); erasure self-service via `/privacy erase`, including user-scoped `talk_usage`; per-datum rectification/removal commands (`PRIVACY.md` table). The policy clearly separates erasable personal data from paid entitlements and minimum financial records retained for disclosed legal purposes. `/privacy view` claim removed from docs (audit fix — access is via operator, satisfying Art. 15). |
| 2.5 | Consent is explicit + withdrawable (Art. 7) for special-category-adjacent data (voice) | ✅ | STT consent per speaker; withdrawal: `/transcribe revoke`. |
| 2.6 | Storage limitation / retention (Art. 5(1)(e)) | ✅ | 30-day guild-departure purge (`store/guildDeparted`), ~3-month `gcloud_usage` purge, 90-day unclaimed `kofi_pending` purge, bounded LRU audio cache, and STT temp-WAV sweep. Minimum `kofi_activation_consent` evidence follows the disclosed payment-record retention and contains no email/hash. |
| 2.7 | International transfers safeguarded (Ch. V) | ✅ | Hetzner DE (EU); GitHub Pages US via DPF+SCC; Google/OpenAI US via DPF/API terms (`site/privacy.html §9`). |
| 2.8 | No cookies/trackers without consent (ePrivacy) | ✅ | Site: zero cookies/analytics; `sessionStorage` holds the OAuth token and at most a five-minute one-shot activation intent; `localStorage` holds language. These are strictly necessary; fonts are self-hosted and CSP is tight. |
| 2.9 | Right to lodge a complaint (Art. 77) | ✅ | `site/privacy.html §11` names the Portuguese CNPD (cnpd.pt). |
| 2.10 | No solely-automated decisions with legal effect (Art. 22) | ✅ | None; disclosed in `site/privacy.html §12`. |

## 3. United States

| # | Requirement | Status | Evidence |
| - | ----------- | ------ | -------- |
| 3.1 | COPPA — not directed to under-13; enforce Discord's 13+ minimum | ✅ | `TERMS.md`/site Terms require ≥13 (or higher local minimum); not directed at children; no age-gated data collection beyond Discord's own. |
| 3.2 | CCPA/CPRA — disclosure + deletion + no-sale | ✅ | No sale of personal information; `talk_usage` and operator-console use are disclosed in `PRIVACY.md`; erasable personal data is deleted via `/privacy erase`, while minimum financial records follow the disclosed retention rule. Given self-host scale, most CCPA business thresholds do not apply, but the mechanisms exist regardless. |

## 4. Ko-fi (payments)

| # | Requirement | Status | Evidence |
| - | ----------- | ------ | -------- |
| 4.1 | Seller identity + honest description of the digital reward | ✅ | `TERMS.md §Premium & payments`: Vozen operator is the seller, Ko-fi is the platform; Premium is a digital perk. |
| 4.2 | Webhook secure + idempotent (no double-grant) | ✅ | `premium/kofiWebhook.ts`: SHA-256 + `timingSafeEqual` on the token, `kofi_transaction` ledger inside the grant transaction, 503-on-persist-failure for safe Ko-fi retry (audit-confirmed clean). |
| 4.3 | Refunds / non-delivery handling | ✅ | `TERMS.md`: Ko-fi refunds handled by the operator; consumer withdrawal (EU 14-day) preserved. |
| 4.4 | Claim binds a payment to the right Discord user without an arbitrary ID | ✅ | Legacy receipt claim remains single-use. Instant activation validates the bearer token's Discord application audience, `identify email` scopes, matching user IDs, and a verified account email before matching its transient HMAC to all unclaimed purchases. |
| 4.5 | Immediate delivery is explicit and auditable | ⚠️ | The site requires an explicit, versioned checkbox; the grant and one consent row per transaction commit atomically; the user can download a confirmation. **Production gate:** qualified legal review must confirm that this confirmation is adequate durable-medium evidence; otherwise HOLD production. |

## 5. top.gg

| # | Requirement | Status | Evidence |
| - | ----------- | ------ | -------- |
| 5.1 | Vote webhook authenticated | ✅ | `src/vote.ts`: v1 raw-body HMAC-SHA256 with timestamp replay guard; legacy v0 uses `timingSafeEqual`; without a secret the public route does not start (SEC-01). |
| 5.2 | Vote rewards honest + non-deceptive | ✅ | First eligible verified vote → 48h Plus (`store/voteReward`), once per Discord account ever. A persistent HMAC redemption ledger prevents retries, restarts, deployments, or erasure from creating a second claim; the terms and both privacy policies disclose this. |
| 5.3 | Promotional notices bounded and controllable | ✅ | Activity-driven Top.gg/support cards alternate in the configured setup channel, off by default and enabled only by an admin via `/config vote-reminders active:true`. A persisted 24h shared slot plus the alternation keeps each kind at least 48h apart and prevents same-day collisions; every card includes the opt-out command and sends no DMs or pings. |

## 6. GitHub Pages / GitHub ToS

| # | Requirement | Status | Evidence |
| - | ----------- | ------ | -------- |
| 6.1 | Static content only, within usage limits | ✅ | `site-dist/` published by `pages.yml`; no server-side code on Pages. |
| 6.2 | Build job least-privilege | ✅ | `pages.yml` uses `npm ci --ignore-scripts` (audit fix) in the `pages:write`/`id-token:write` job. |
| 6.3 | US transfer for site visitors disclosed | ✅ | `site/privacy.html §9` (GitHub Pages US via DPF + SCC). |

## 7. AGPL-3.0 (license obligations)

| # | Requirement | Status | Evidence |
| - | ----------- | ------ | -------- |
| 7.1 | Distribute Corresponding Source; license notice | ✅ | Public repo, `LICENSE` (AGPL-3.0), README badge, site footer link. |
| 7.2 | §13 network-use: offer source to interacting users | ✅ | `/help` embed now links the exact source (audit fix `help.source`), for Discord users who never open the site. |
| 7.3 | No added restrictions; preserve notices | ✅ | No sublicensing; `TERMS.md` points to the AGPL. |

## 8. Google Cloud Text-to-Speech (Premium "Google HD")

| # | Requirement | Status | Evidence |
| - | ----------- | ------ | -------- |
| 8.1 | Official, supported API (not an unofficial endpoint) | ✅ | `src/tts/gcloud.ts` calls the official Cloud TTS REST API with a key; the unofficial gTTS path is a separate, operator-only opt-in and Piper is the default. |
| 8.2 | Cost/abuse controls | ✅ | Per-request cap, monthly pool per pass, daily backstop, reserve-before-await budgeting (`gcloud.ts` — audit-confirmed race-safe). |
| 8.3 | Key kept server-side only | ✅ | `GOOGLE_TTS_API_KEY` only in the VPS `.env`; never in the repo; present-but-empty clobber guard (audit fix). |

## 9. OpenAI (neural engine, opt-in)

| # | Requirement | Status | Evidence |
| - | ----------- | ------ | -------- |
| 9.1 | Official API, key server-side, no training on inputs (API default) | ✅ | `src/tts/neural.ts` (opt-in `TTS_ENGINE=neural`); `OPENAI_API_KEY` server-side only + clobber guard (audit fix). Not enabled on the default instance. |

---

## Open operator actions (not code — for the maintainer)

1. **Discord Portal:** fill Privacy/Terms URLs; confirm Premium Apps monetization eligibility and set `PREMIUM_*_SKU_ID` post-verification (COMPL·1, item 1.8).
2. **GDPR polish (optional):** named controller + `privacy@vozen.org` contact for a commercial hosted instance (item 2.1).
3. **journald retention (optional VPS hygiene):** cap system logs (one-liner handed over separately).
4. **Activation legal gate (required before production):** obtain qualified review of the immediate-delivery/withdrawal wording and downloadable confirmation; keep production on HOLD if a different durable-medium mechanism is required (item 4.5).

## Areas confirmed CLEAN by the 2026-07-15 deep audit (not gaps)

- HTTP/money surface: authz (no IDOR/mass-assignment), idempotency, timing-safe auth, body caps, loopback bind, CORS — re-verified, zero findings.
- Injection: SQL parametrized; sidecars `spawn` array-args + stdin, no `shell:true`; path allowlists/hashes.
- `npm audit`: 0 CVEs (overrides cover undici/trim/tar; opus decode DoS accepted on the encode-only path).
