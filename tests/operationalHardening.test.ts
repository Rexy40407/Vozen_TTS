import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), { encoding: 'utf8' });

// The site's assets are cache-busted by FILENAME (never a query string), so every rename churns
// these tests too. One constant each: the rename is then a one-line edit here, not a hunt.
const SITE_JS = 'site/js/main-v43.js';
const SITE_I18N = 'site/js/i18n-v40.js';
const SITE_CSS = 'site/css/main-v42.css';
const ACCOUNT_CSS = 'site/css/account-v6.css';

/** Body of a top-level function in the site bundle, comments stripped. Comments are dropped
 *  because these assertions are about the markup a function RENDERS — a comment explaining why
 *  some wiring is avoided must not read as using it. */
const fnSource = (script: string, signature: string): string => {
  const start = script.indexOf(signature);
  if (start < 0) throw new Error(`not found in site bundle: ${signature}`);
  const rest = script.slice(start + 1);
  const end = rest.indexOf('\n  function ');
  return (end < 0 ? rest : rest.slice(0, end)).replace(/^\s*\/\/.*$/gm, '');
};

const claimCardSource = (): string => fnSource(source(SITE_JS), 'function claimCard()');
const helpModalSource = (): string => fnSource(source(SITE_JS), 'function claimHelpModal()');

const i18nBundle = (): Record<string, Record<string, string>> => {
  const sandbox: { window: { VOZEN_I18N?: Record<string, Record<string, string>> } } = {
    window: {},
  };
  new Function('window', source(SITE_I18N))(sandbox.window);
  return sandbox.window.VOZEN_I18N ?? {};
};

describe('operational security configuration', () => {
  it('gates pull requests and GitHub Pages with the same site verification command', () => {
    const pkg = JSON.parse(source('package.json')) as {
      scripts?: Record<string, string>;
    };
    const ci = source('.github/workflows/ci.yml');
    const pages = source('.github/workflows/pages.yml');

    expect(pkg.scripts?.['check:site']).toBe(
      'vitest run tests/operationalHardening.test.ts tests/siteTrust.test.ts tests/siteI18n.test.ts tests/dashboardCoreSettings.test.ts tests/siteUxPolish.test.ts tests/fullAuditRegression.test.ts && npm run check:i18n && npm run check:site-copy && npm run build:site',
    );
    expect(ci).toMatch(/\n {2}site:\s*\n/);
    expect(ci).toMatch(/\n\s+- run: npm run check:site\s*\n/);
    expect(pages).toMatch(/\n\s+run: npm run check:site\s*\n/);
    expect(pages).not.toMatch(/\n\s+run: npm run build:site\s*\n/);
  });

  it('keeps the Night Signal treatment scoped to Discord entry points', () => {
    const css = source(SITE_CSS);
    const index = source('site/index.html');
    const account = source('site/account.html');
    const dashboard = source('site/dashboard.html');

    for (const pagePath of [
      'site/index.html',
      'site/account.html',
      'site/dashboard.html',
      'site/privacy.html',
      'site/terms.html',
    ]) {
      const page = source(pagePath);
      expect(page, pagePath).toContain('css/main-v42.css');
      expect(page, pagePath).not.toContain('css/main-v41.css');
    }
    expect(existsSync(resolve(process.cwd(), 'site/css/main-v41.css'))).toBe(false);

    for (const [pagePath, page] of [
      ['site/index.html', index],
      ['site/account.html', account],
      ['site/dashboard.html', dashboard],
    ] as const) {
      const navLoginClasses = page.match(
        /<button class="([^"]+)" id="navLogin" type="button">/,
      )?.[1];
      expect(navLoginClasses, pagePath).toContain('btn--discord-cta');
    }

    const inviteClasses = [...index.matchAll(/<a class="([^"]*\bjs-invite\b[^"]*)"/g)].map(
      (match) => match[1],
    );
    expect(inviteClasses).toHaveLength(3);
    for (const classes of inviteClasses) expect(classes).toContain('btn--discord-cta');

    expect(css).toMatch(
      /\.btn--discord-cta\s*\{[^}]*color:\s*#fff;[^}]*linear-gradient\(115deg,\s*#4f46e5 0%,\s*#365bc9 52%,\s*#0f766e 100%\)/s,
    );
    expect(css).toContain('.btn--discord-cta:hover');
    expect(css).toContain('.btn--discord-cta:active');
    expect(css).toContain('.btn--discord-cta:focus-visible');
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.btn--discord-cta/);

    const dashboardScript = source('site/js/dashboard-v7.js');
    expect(dashboardScript).toContain('var BTN = "btn btn--primary";');
    expect(dashboardScript).not.toContain('var BTN = "btn btn--primary btn--discord-cta";');
  });

  it('keeps the account redesign isolated, responsive, and wired to the versioned runtime', () => {
    const page = source('site/account.html');
    const css = source(ACCOUNT_CSS);

    expect(page).toContain('css/account-v6.css');
    expect(page).not.toContain('css/account-v5.css');
    expect(css).toMatch(/body\.page-account \.ppanel__av\s*\{\s*border-radius:\s*50%;\s*\}\s*$/);
    expect(page).toContain('<header class="nav" id="nav">');
    expect(page).toContain('class="account-workspace"');
    expect(page).toContain('class="account-membership"');
    expect(page).toContain('class="account-tasklist"');
    expect(page).toContain('id="accountActivateOpen"');
    expect(page).toContain('js/main-v43.js');
    expect(css).toContain('body.page-account');
    expect(css).toMatch(/@media\s*\(max-width:\s*760px\)/);
    expect(css).toMatch(/@media\s*\(min-width:\s*1280px\)\s*and\s*\(min-height:\s*800px\)/);
    expect(css).toContain('clamp(430px, 33.333%, 520px)');
    expect(css).not.toMatch(/body\.page-account\s+\.nav\s*\{[^}]*display:\s*none;?[^}]*\}/s);
  });

  it('keeps the account journey focused and the session exit visible', () => {
    const script = source(SITE_JS);
    const claim = claimCardSource();

    expect(claim).toContain('id="activate-purchase"');
    expect(claim).toContain('role="dialog"');
    expect(claim).toContain('id="ppClaimClose"');
    expect(claim).toContain('<details class="ppanel__receipt"');
    expect(claim).toContain('class="ppanel__activatebtn"');
    expect(script).toContain('class="ppanel__logout-icon"');
    expect(script).toContain('function openPurchaseActivation()');
    expect(script).toContain('function mountPurchaseActivation(el)');
  });

  it('keeps the Cloudflare CSP aligned with the self-hosted-font privacy promise', () => {
    const script = source('tools/cf-security-headers.mjs');
    expect(script).not.toContain('fonts.googleapis.com');
    expect(script).not.toContain('fonts.gstatic.com');
    expect(script).toContain("style-src 'self' 'unsafe-inline'");
    expect(script).toContain("font-src 'self'");
  });

  it('verifies both downloaded Kokoro model assets against pinned SHA-256 hashes', () => {
    const script = source('tools/setup-kokoro.ps1');
    expect(script).toContain('7D5DF8ECF7D4B1878015A32686053FD0EEBE2BC377234608764CC0EF3636A6C5');
    expect(script).toContain('BCA610B8308E8D99F32E6FE4197E7EC01679264EFED0CAC9140FE9C29F1FBF7D');
    expect(script).toContain('Get-FileHash');
  });

  it('does not ship byte-identical font files under duplicate names', () => {
    const fontDir = resolve(process.cwd(), 'site/assets/fonts');
    const byHash = new Map<string, string>();
    for (const name of readdirSync(fontDir)) {
      const bytes = readFileSync(resolve(fontDir, name));
      const hash = createHash('sha256').update(bytes).digest('hex');
      expect(byHash.get(hash), `${name} duplicates ${byHash.get(hash)}`).toBeUndefined();
      byHash.set(hash, name);
    }
  });

  it('keeps every font URL in the site stylesheet resolvable', () => {
    const css = source(SITE_CSS);
    const urls = [...css.matchAll(/url\("\.\.\/assets\/fonts\/([^"?]+)"\)/g)].map(
      (match) => match[1],
    );
    expect(urls.length).toBeGreaterThan(0);
    for (const name of urls) {
      expect(existsSync(resolve(process.cwd(), 'site/assets/fonts', name)), name).toBe(true);
    }
  });

  it('localizes account accessibility labels from the canonical dictionary', () => {
    const script = source(SITE_JS);
    expect(script).toContain('t("account.copyDiscordId")');
    expect(script).toContain('t("account.closeActivation")');
    expect(script).not.toContain('aria-label="Copy Discord ID"');
  });

  // Delivery happens when the buyer activates here, so the checkbox itself must explicitly name
  // immediate performance and the applicable loss of the withdrawal right before either path.
  it('gates pass activation behind an express consent checkbox', () => {
    const script = source(SITE_JS);
    expect(script).toContain('id="ppClaimConsent"');
    expect(script).toContain('claim.consent');
    // The guard must refuse when unticked — failing open would activate the pass with no
    // acknowledgement at all.
    expect(script).toMatch(/if \(!consent \|\| !consent\.checked\)/);
    expect(script).toContain('claim.consentRequired');
  });

  it('renders explicit immediate-delivery consent with a real terms link', () => {
    const card = fnSource(source(SITE_JS), 'function claimCard()');
    expect(card).toContain('claim.consent');
    expect(card).toContain('claim.consentTerms');
    expect(card).toMatch(/<a href="\/terms"/);
    // The <a> is injected in place of the {terms} placeholder inside the trusted consent copy.
    expect(card).toContain('.replace("{terms}"');
    const english = i18nBundle().en['claim.consent'];
    expect(english).toMatch(/immediate activation/i);
    expect(english).toMatch(/withdrawal right/i);
  });

  it('implements instant activation with strict success parsing and one-shot OAuth resume', () => {
    const script = source(SITE_JS);
    const card = claimCardSource();
    const activation = fnSource(script, 'async function doInstantActivation(');
    expect(card).toContain('id="ppActivateBtn"');
    expect(card).toContain('claim.giftNote');
    expect(card.indexOf('ppActivateBtn')).toBeLessThan(card.indexOf('ppClaimCode'));
    expect(script).toContain('const ACTIVATION_TERMS_VERSION = "2026-07-19"');
    expect(script).toContain('u.searchParams.set("scope", "identify email")');
    expect(activation).toContain('PREMIUM_API_BASE + "/api/activate"');
    expect(activation).toContain('termsAccepted: true');
    expect(activation).toMatch(/res\.status === 200 && body\.ok === true/);
    expect(script).toContain('const ACTIVATION_INTENT_TTL_MS = 5 * 60 * 1000');
    expect(script).toContain('sessionStorage.removeItem(ACTIVATION_INTENT_KEY)');
    expect(script).toContain('allowRelogin: false');
    expect(script).toContain('downloadActivationConfirmation');
    expect(script).toContain('acceptedAtIso');
  });

  // The claim field takes the whole receipt URL now (extractReceiptCode, src/premium/claim.ts),
  // so the copy must stop teaching people to perform surgery on an address bar — "the code
  // after txid=" was never a reasonable thing to ask, and on the monthly receipt it actively
  // misled: the code sits mid-URL, so selecting to the end drags &mode=g along.
  //
  // Asserted as an absence, deliberately. Checking that ten languages each "say to paste the
  // link" is not something a string match can honestly do — but the surgical instruction is
  // one literal token, and its absence is checkable in every language.
  it('no longer asks buyers to extract the code from the URL', () => {
    const bundle = source(SITE_I18N);
    const sandbox: { window: { VOZEN_I18N?: Record<string, Record<string, string>> } } = {
      window: {},
    };
    new Function('window', bundle)(sandbox.window);
    const all = sandbox.window.VOZEN_I18N ?? {};
    const langs = Object.keys(all);
    expect(langs.length).toBeGreaterThan(0);
    for (const lang of langs) {
      for (const key of [
        'claim.hint',
        'claim.placeholder',
        'claim.useReceiptCode',
        'claim.notfound',
      ]) {
        expect(all[lang][key], `${lang} ${key} exists`).toBeTruthy();
        expect(all[lang][key], `${lang} ${key} still says txid=`).not.toContain('txid=');
      }
    }
  });

  // Closing the receipt tab is not a dead end — Ko-fi emails the buyer a receipt — but the card
  // never said so, which made it one in practice. The line has to name the email first (the copy
  // every buyer has), and hand the genuinely-stuck tail to the help modal (plan 036) rather than
  // dumping them straight on support.
  it('offers a way back when the buyer no longer has the receipt', () => {
    const card = claimCardSource();
    expect(card).toContain('claim.lost');
    expect(card).toContain('claim.lostHelp');
    // The modal is the escape hatch now; support lives inside it, one step further in.
    expect(card).toContain('ppClaimHelpOpen');
  });

  // The `.js-support` wiring at the top of the file runs ONCE over the document at load, and both
  // the claim card and the help modal are injected later, after OAuth. An anchor leaning on that
  // wiring would render with no href at all — so the markup must carry the URL itself. A silent
  // hrefless link is exactly the failure the recovery path exists to prevent.
  it('renders the support link with a real href, not the one-time wiring', () => {
    const modal = helpModalSource();
    expect(modal).toContain('${SUPPORT_URL}');
    expect(modal, 'must not rely on the one-time .js-support wiring').not.toContain('js-support');
  });

  // The Ko-fi email receipt shows `Ref: S-M1X823C9FW` — the only code-looking string in the whole
  // email, and one we can NEVER accept: the webhook payload has no such field, so no pending row
  // carries it. Someone hunting for a code finds that, pastes it, and gets a flat "no purchase
  // found" for a purchase they really made. Catch the shape before the request leaves the browser
  // and send them somewhere useful instead.
  it('catches the Ko-fi order Ref before it reaches the server', () => {
    const script = source(SITE_JS);
    expect(script).toMatch(/REF_RE\s*=/);
    const claim = fnSource(script, 'async function doClaim(');
    expect(claim).toContain('REF_RE');
    expect(claim).toContain('claim.help.refPasted');
    // Must be decided BEFORE the fetch: reaching the server means a 404 the buyer cannot act on.
    const refAt = claim.indexOf('REF_RE');
    const fetchAt = claim.indexOf('fetch(');
    expect(refAt, 'Ref check must precede the fetch').toBeLessThan(fetchAt);
  });

  // Every dismissal a modal can offer, because someone who cannot close it is trapped on the one
  // page they went to for help. Esc is the one most often forgotten.
  it('makes the help modal dismissable and announced', () => {
    const modal = helpModalSource();
    expect(modal).toContain('role="dialog"');
    expect(modal).toContain('aria-modal="true"');
    expect(modal).toContain('aria-labelledby');
    const script = source(SITE_JS);
    expect(script).toContain('ppClaimHelpClose'); // the X
    expect(script).toMatch(/Escape/); // keyboard
    expect(script).toContain('ppClaimHelpBackdrop'); // click-outside
  });

  // The help request carries the EMAIL, not the Ref: Ko-fi's transaction search matches by email,
  // so the Ref is useless to the owner (verified against the live seller panel, 2026-07-17). The
  // email is a lookup hint, not proof — the owner still confirms the paid order and grants by hand.
  it('collects the Ko-fi email in the help modal and posts it, not the Ref', () => {
    const modal = helpModalSource();
    expect(modal).toContain('id="ppClaimHelpEmail"');
    expect(modal).toContain('type="email"');
    expect(modal).toContain('claim.help.emailPlaceholder');
    const script = source(SITE_JS);
    // The POST body must send { email: ... } — a lingering { ref } would reach the endpoint's
    // bad_email guard and the buyer would get nothing.
    expect(script).toMatch(/body:\s*JSON\.stringify\(\{\s*email:/);
  });

  it('translates the recovery and help copy into every advertised site language', () => {
    const all = i18nBundle();
    const langs = Object.keys(all);
    expect(langs.length).toBeGreaterThan(0);
    for (const lang of langs) {
      // Split into separate keys on purpose: no translation has to carry markup through esc().
      for (const key of [
        'claim.lost',
        'claim.lostHelp',
        'claim.help.title',
        'claim.help.step1',
        'claim.help.step2',
        'claim.help.emailPlaceholder',
        'claim.help.send',
        'claim.help.refPasted',
        'claim.help.notEmail',
        'claim.help.sent',
        'claim.help.stillStuck',
      ]) {
        expect(all[lang][key], `${lang} ${key}`).toBeTruthy();
      }
    }
  });

  it('translates the consent copy into every advertised site language', () => {
    const bundle = source(SITE_I18N);
    const sandbox: { window: { VOZEN_I18N?: Record<string, Record<string, string>> } } = {
      window: {},
    };
    new Function('window', bundle)(sandbox.window);
    const all = sandbox.window.VOZEN_I18N ?? {};
    const langs = Object.keys(all);
    expect(langs.length).toBeGreaterThan(0);
    for (const lang of langs) {
      // Untranslated consent text is not a cosmetic gap: someone who cannot read what they
      // are accepting has not knowingly accepted it.
      expect(all[lang]['claim.consent'], `${lang} claim.consent`).toBeTruthy();
      expect(all[lang]['claim.consentRequired'], `${lang} claim.consentRequired`).toBeTruthy();
      expect(all[lang]['claim.consentTerms'], `${lang} claim.consentTerms`).toBeTruthy();
      // Every consent string must keep the {terms} placeholder — that is where the clickable
      // terms link is injected. A translation that drops it would render a linkless sentence.
      expect(all[lang]['claim.consent'], `${lang} keeps the {terms} slot`).toContain('{terms}');
      for (const key of [
        'claim.instantBtn',
        'claim.instantWorking',
        'claim.giftNote',
        'claim.orReceipt',
        'claim.activationOk',
        'claim.downloadConfirmation',
        'claim.emailMissing',
        'claim.emailUnverified',
        'claim.serviceUnavailable',
        'claim.loginAgain',
        'claim.resumeExpired',
      ]) {
        expect(all[lang][key], `${lang} ${key}`).toBeTruthy();
      }
    }
  });

  // The terms link inside the consent line must look clickable — a distinct colour, not the dim
  // body colour it would inherit from .ppanel__claimconsent. Without it the only affordance is the
  // cursor, which nobody sees; the buyer never realises the terms are a link.
  it('styles the consent terms link as clickable', () => {
    const css = source(SITE_CSS);
    expect(css).toMatch(/\.ppanel__claimconsent a\s*\{[^}]*var\(--aqua\)/);
  });

  // The terms accepted by the checkbox must identify both activation methods, the same stable
  // version sent to the API, and the confirmation the buyer can keep.
  it('keeps the versioned immediate-delivery acknowledgement in the accepted terms', () => {
    const terms = source('site/terms.html');
    expect(terms).toMatch(/14-day withdrawal right/i);
    expect(terms).toContain('activation-terms version <code>2026-07-19</code>');
    expect(terms).toMatch(/activate a Ko-fi purchase by verified Discord email or receipt/i);
    expect(terms).toMatch(/downloadable confirmation/i);
  });
});
