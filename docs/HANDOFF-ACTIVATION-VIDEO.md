# Handoff — "Activate your pass" demo video

Self-contained brief. You have not seen the conversation this came from; everything
needed is below. Written 2026-07-17.

## 1. What Vozen is

Vozen is a Text-to-Speech bot for Discord: it reads chat messages out loud in voice
channels with neural voices (Piper), in ~34 languages. The core is free forever. It is
open source (AGPL-3.0) at `github.com/Rexy40407/discord-bot-Vozen`, hosted in production
on a Hetzner VPS, with a static marketing site at **vozen.org** (GitHub Pages) and an API
at **api.vozen.org**.

Paid tiers:

| Tier | Price | What it is |
| ---- | ----- | ---------- |
| Vozen Plus | €1.99/month or €18.99/year | Personal pass — perks follow the user on any server |
| Vozen Premium (3 servers) | €3.99/month or €37.99/year | Server pass, up to 3 servers |
| Vozen Premium (8 servers) | €7.99/month or €75.99/year | Server pass, up to 8 servers |

Payments go through **Ko-fi**. Monthly tiers are Ko-fi memberships; the annual passes are
Ko-fi **Shop items** (Ko-fi memberships can only bill monthly).

## 2. The problem this video exists to solve

**The buyer cannot find their activation code.** This is not hypothetical — the site owner
hit it himself, minutes after a real test purchase on 2026-07-17.

Here is the whole issue:

- Ko-fi does not send the product name in a Shop Order webhook, and its checkout has no
  field for a Discord ID. So a purchase arrives at the bot with no way to know *who* bought
  it. The bot stores it as a **pending grant**, which the buyer then claims on the site.
- To claim it, the buyer needs the **transaction code**.
- **The Ko-fi receipt does not display that code anywhere.** There is no field called
  "transaction code" or anything like it.
- The code exists only as the last segment of the receipt page's own **URL**:
  `ko-fi.com/summary/<code>` — e.g. `ko-fi.com/summary/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.

The site copy has since been corrected to say exactly that (it now reads "your code is the
last part of the page address, after ko-fi.com/summary/"). But a line of text asking people
to read a URL out of their address bar is a weak fix for the one step that stands between
taking someone's money and serving them. **The video is meant to carry that step.**

## 3. The flow the video must show

This is the real, current, deployed flow. Every string below is the actual UI text.

1. Buyer completes the purchase on Ko-fi. Ko-fi redirects them to `https://vozen.org/account`
   (set as the product's Redirect URL) and emails a receipt.
2. Buyer opens the Ko-fi receipt. **The code is the part of the page address after
   `ko-fi.com/summary/`.** They copy it.
3. Buyer goes to **`https://vozen.org/account`** (no trailing slash — `/account/` is a 404).
4. Buyer clicks **Log in with Discord** (OAuth2 implicit, scope `identify`).
5. The premium panel appears with a card titled **"Activate a purchase"**, whose hint reads:
   > Bought Plus or Premium on Ko-fi? Open your receipt — your code is the last part of the
   > page address, after ko-fi.com/summary/. Paste it below.
6. Buyer pastes the code into the field (placeholder: *"The code after ko-fi.com/summary/"*).
7. Buyer **must tick a consent checkbox** before it will activate:
   > Activate my pass now. I understand that once it is active I lose my 14-day right of
   > withdrawal.

   This is not decoration. Under EU law (Directive 2011/83/EU art. 16(m)) the 14-day
   withdrawal right on digital content only falls away if the buyer expressly asks for
   immediate delivery and acknowledges losing it. Ko-fi's checkout cannot collect that, but
   delivery happens *here*, at activation — so the checkbox lives here. **The video must show
   it being ticked, and must not hide or minimise it.** A buyer who cannot read what they are
   waiving has not waived it.
8. Buyer clicks **Activate**. Result: **"Done! Your purchase is now active on this account."**
   and the status row flips to active.
9. For **server** passes only, one extra step: run `/premium activate` in each server they
   want covered. (Plus is personal and needs nothing further.)

## 4. Storyboard (~33s, no narration, captions on screen)

The video plays muted and autoplaying on the site, so it must work with no sound.

| Time | Shot | Caption |
| ---- | ---- | ------- |
| 0–3s | The Ko-fi receipt, open | **You paid. Now activate it — 30 seconds.** |
| 3–9s | Zoom on the address bar; box/highlight the code after `/summary/`; select and copy it | **Your code is in the address, after /summary/** |
| 9–13s | Typing `vozen.org/account`, page loads | **Go to vozen.org/account** |
| 13–19s | Click "Log in with Discord" → Discord's OAuth screen → back to the panel | **Log in with Discord** |
| 19–26s | Paste into the field, tick the consent checkbox, click Activate | **Paste it. Tick the box. Activate.** |
| 26–31s | "Done! Your purchase is now active on this account." + status row active | **Active. That's it.** |
| 31–33s | End card, dark background, Vozen logo | **vozen.org/account** |

**The 3–9s shot is the entire point of the video.** It is the step that fails, the one no copy
solves well. Give it real screen time, a real zoom, and an unmistakable highlight on the code.
Everything else is filler by comparison.

## 5. Hard constraints

### 5.1 The site cannot embed YouTube

`site/*.html` ships this Content-Security-Policy:

```
default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self';
style-src 'self' 'unsafe-inline'; font-src 'self';
img-src 'self' data: https://cdn.discordapp.com;
connect-src 'self' https://api.vozen.org; media-src 'self'; form-action 'self'
```

There is no `frame-src`, so it falls back to `default-src 'self'` — **a YouTube iframe is
blocked by the site itself.** `media-src 'self'` means a self-hosted `<video>` works. There is
precedent: the "Hear it" section already uses a self-hosted `<audio>` element
(`site/index.html`, `#hearAudio`).

This is also a project rule, not just a technical one. From `CONTRIBUTING.md`:

> **Website GDPR rule: no unnecessary third parties without prior consent.** The site is
> self-contained: fonts are self-hosted, there are no analytics or tracking cookies, and CSP
> is restricted to the minimum runtime origins. Adding analytics, pixels, embeds, or other
> resources that disclose a visitor's IP requires an appropriate consent gate and matching
> privacy/CSP updates.

**Do not add a YouTube/Vimeo embed to the site.** Do not widen the CSP to allow one.

So the video is needed in two forms:

- **For vozen.org** — a self-hosted file committed under `site/assets/`.
- **For the Ko-fi product pages** — Ko-fi's "Embed media" field takes a URL (e.g. YouTube).
  That is Ko-fi's page, not ours, so an unlisted YouTube upload is fine *there*.

### 5.2 File specs

- 1280×720, 30fps, MP4 (H.264), **no audio track** (halves the size; it plays muted anyway).
- **Target under 3 MB.** It is served from the site on every visit that renders it.
- Provide a `poster` still as WebP/JPEG so nothing janks before playback.

### 5.3 Privacy — read this before recording

- **The buyer's email must not be visible.** The Ko-fi receipt shows it. Blur or crop it. A
  public video on the site means that address is exposed on every visit, permanently.
- **Only ever show a transaction code that has already been claimed.** The code *is* the
  bearer token for the grant: anyone who pauses the video on an unclaimed code can claim the
  purchase. The owner has a spent code available — ask him for it; do not invent one that
  looks real, and do not use a live one.

## 6. Repo conventions (if you touch code)

- TypeScript, `module: NodeNext`, `strict: true`. Tests are vitest, in `tests/`.
- **Full gate before anything ships:** `npm run check` (build + typecheck + lint +
  format:check + vitest). Site build: `npm run build:site`.
- **Site assets are cache-busted by filename**, not query string — e.g. `main-v30.js`,
  `i18n-v25.js`, `main-v32.css`. Changing a file means renaming it to the next version and
  updating every reference (`site/*.html` and `tests/operationalHardening.test.ts`).
- **Never edit file content with PowerShell** on this repo (Windows PowerShell 5.1 mangles
  UTF-8 into mojibake). `npm run build:site` has a guard that fails the build if it happens.
- Source, comments, docs, logs and test names are **English**. Only user-facing locale
  catalogs are multilingual.
- **Keep commit authorship limited to the human author.** The Contributors list must
  show real people only.
- Site JS has no unit harness — the acceptance test is the browser. There is also a
  source-assertion pattern in `tests/operationalHardening.test.ts` worth following.

## 7. Site integration spec (the part that is codeable)

Once an MP4 exists at `site/assets/activate-demo.mp4`:

- Add a `<video muted playsinline loop preload="none" poster="...">` — autoplay only if muted;
  give it an accessible label and a visible caption.
- Place it on `site/account.html` (where the confusion happens) and optionally near the
  pricing section on `site/index.html`.
- The caption needs translating into all **10 site languages** (`en, pt, fr, es, de, tr, ar,
  zh, ru, ko`) in `site/js/i18n-v25.js` → bump to `i18n-v26.js`. Every language must have
  every key; a test enforces parity.
- Cache-bust anything you touch, run `npm run check` and `npm run build:site`, verify in the
  browser, then deploy (push to `main` — `.github/workflows/pages.yml` publishes on changes
  under `site/**`).

## 8. Honest scoping

**The raw session must be recorded manually.** Capture a real Discord and Ko-fi session.
What can be automated: editing,
captioning, compressing, generating a synthetic/animated version, and the site integration in
§7.

**This video has a shelf life.** The proper fix for the underlying problem is to match the
purchase to the buyer's Discord-verified email so there is no code to copy at all — the store
lookup for it (`listUnclaimedPendingByEmailHash` in `src/store/kofiPending.ts`) and the hashing
(`hashKofiEmail` in `src/premium/kofi.ts`) already exist and are already used; the login would
only need Discord's `email` scope adding to the `identify` it requests today. If that ships,
this video is obsolete, because the step it teaches disappears. That is not a reason to skip
it — it is a reason not to spend a weekend on it.

## 9. Done means

- An MP4 under 3 MB at `site/assets/`, no audio track, no email visible, no live code visible.
- The 3–9s shot makes it obvious where the code is, to someone who has never seen Ko-fi.
- The consent checkbox is visibly ticked, and its text is legible at 720p.
- On the site: `npm run check` green, `npm run build:site` green, verified in a browser,
  deployed, and the new asset returns 200 on vozen.org while the old filename returns 404.
- The same video, uploaded unlisted to YouTube, with its URL in the "Embed media" field of all
  three annual Ko-fi products.
