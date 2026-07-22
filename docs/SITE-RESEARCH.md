# Vozen Site — Improvement Research (full)

> Sources: (1) competitor teardown — QuantumBot, TTS Bot (top.gg), MEE6, Craig, Dyno,
> SeaVoice; (2) growth/CRO/SEO research with citations; (3) hands-on technical audit of
> the current site (measured in preview). Date: 2026-07-06.
> **Reality check first: the site is not deployed and the bot is on ~2 servers.**
> Everything below is ranked with that in mind — distribution beats decoration.

---

## The 3 findings that matter most

1. **For Discord bots, installs come from top.gg + word of mouth, not from the site.**
   A documented indie case attributes ~90% of installs to top.gg + Product Hunt. The
   site's real jobs: (a) look great when pasted INTO Discord (og:image!), (b) rank for
   "discord tts bot", (c) convert directory visitors who click through.
2. **Nobody in the TTS niche lets you HEAR the product on their site.** Not even the
   1.49M-server incumbent (which has NO site and a weak 3.37★/46 reviews on top.gg —
   a visible vulnerability). A row of play-button voice samples would beat everyone.
3. **The incumbent's weakness is satisfaction, not reach.** "TTS Bot" wins on servers
   (1,493,295) but its rating and review count are attackable. Vozen's site should farm
   top.gg reviews from happy users and ship a factual comparison table.

---

## P0 — before/at deploy (distribution + first impression)

| # | Item | Why / spec |
|---|------|-----------|
| 1 | **Deploy to GitHub Pages** | A local site converts nobody. Everything else depends on this. |
| 2 | **og:image 1200×630** + og:url + twitter:card | Links get shared IN Discord — the embed IS the ad. Discord-dark background, waveform + "Discord TTS in 34 languages — free". Currently: none (bare embeds, same flaw as QuantumBot). |
| 3 | **Title with the keyword** | Now: "Vozen — Type it. Hear it." (zero SEO). Change to: `Discord TTS Bot — 34 Languages, Free | Vozen` (44 chars). Meta description: "Vozen reads your chat aloud in any voice channel. Text to speech in 34 languages, 13 minigames, core free forever. Add to Discord in 30 seconds." |
| 4 | **Favicon** | Missing entirely. Waveform mark, SVG + PNG fallback. |
| 5 | **🔊 AUDIO DEMO in the hero** | The #1 conversion lever for a TTS product (video-demo studies show +69–100% lifts; every big TTS company converged on sample cards). 5–8 pre-rendered clips (EN/PT/ES/FR/JA…), native `<audio preload="none">` behind play buttons. We can generate the clips with the bot itself. |
| 6 | **top.gg listing** (site-adjacent) | Submit NOW (review queue can take weeks). <140-char description leading with the problem; tags: text-to-speech, tts, fun, games. |
| 7 | **Privacy Policy + ToS pages** | Required by directories and (later) Discord App Directory. Footer links. |

## P1 — first week after deploy (conversion + trust)

| # | Item | Why / spec |
|---|------|-----------|
| 8 | **Honest social proof strip** | Zero-user menu: live product stats ("34 languages · 38 voices · <1s latency"), GitHub stars badge, public changelog with dated weekly entries ("actively maintained" kills the #1 bot fear: abandonment), builder line ("Built by Diogo because…"). NO fake testimonials/counts. |
| 9 | **CTA microcopy** | Keep "Add to Discord" (recognized convention) + under it: "Free · No signup · Talking in your server in 30 seconds". Repeat CTA after each section. |
| 10 | **Comparison table section** | "Vozen vs TTS Bot vs Discord /tts" — factual rows (languages 34 vs ~20 vs 1; games 13 free vs 0; price €4 vs $4.99; rating). The incumbent's 3.37★ makes it write itself. Highest-converting BOFU pattern in SaaS (~5%+). |
| 11 | **Screenshot/GIF of Vozen in Discord** | Real Discord-window styling; show /join + a message being spoken. |
| 12 | **FAQ schema (JSON-LD)** | FAQ content already exists; none of the 6 competitors uses FAQPage markup — free rich-results win. |
| 13 | **Support server + widget** | Create the real Discord support server (link is still `discord.gg/` placeholder!), embed widget with live online count. |
| 14 | **:focus-visible styles** | Currently none — keyboard a11y + Lighthouse. |

## P2 — weeks 2–4 (SEO surface + growth loops)

| # | Item | Why / spec |
|---|------|-----------|
| 15 | **/vs/tts-bot page** | "Vozen vs TTS Bot (2026)" — honest, admits where the incumbent wins. Targets "tts bot alternative" + brand bleed. |
| 16 | **/best-discord-tts-bots listicle** | The format that actually ranks in this SERP (all current page-1 results are vendor listicles). |
| 17 | **Per-language pages ×34** | "Portuguese TTS Bot for Discord" etc. — nobody targets non-English TTS queries; the 34 languages are an SEO moat. Localized H1. |
| 18 | **Commands docs page** | SEO surface + reassurance (Dyno/Craig both have one). |
| 19 | **Vote-reward loop** | Signed top.gg webhook → 48h Vozen Plus on the first eligible vote, once per Discord account ever (votes may be rewarded; reviews are never rewarded). |
| 20 | **Live top.gg widget + "leave a review" nudge** | QuantumBot's pattern; attacks incumbent's weak rating where discovery happens. |
| 21 | **Product Hunt + community launch** | Tue–Thu, demo video ≤90s; r/Discord_Bots showcase (read rules first); accessibility framing ("lets people without mics talk") — it's true and it performs. |
| 22 | **Analytics** | Privacy-friendly (Plausible/GoatCounter) — can't improve what isn't measured. |

## Technical debt found in audit (quick fixes, fold into P1)

- No canonical URL; no hreflang (EN/PT).
- Hero canvas uses shadowBlur ×3 layers — consider disabling blur <720px (battery).
- Google Fonts loads 9 weights — trim to 5–6.
- `price.pro` could show **€3.99** (charm pricing lifts low-ticket conversion ~8–12%) — decide vs. clean "€4" branding.
- Premium card has no purchase CTA (needs Ko-fi/Stripe link when ready).

## Copy formulas that repeat across winners (for reference)

- Headline molds: "The **#1/best** [category]" (Quantum/MEE6) · "does it all. **Automatically**" (Dyno) · **"[Name] is the [niche] bot for Discord"** (Craig — best fit for Vozen).
- Subcopy: *[Name] is a [adj] Discord bot with [3–4 features] that [outcome]* + trust stat welded in.
- CTAs: always "Add to Discord" + "Join the Support Server". Never SaaS verbs.
- Free framing: FAQ #1 is always "Is it free?"; SeaVoice's "core functionality will remain free" = our "core free forever".
- TTS value language the market responds to (from the incumbent): "lets people without mics talk in voice channels", "no prefix — just type normally".
