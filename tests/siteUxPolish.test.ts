import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), { encoding: 'utf8' });

const LANGS = ['en', 'pt', 'fr', 'es', 'de', 'tr', 'ar', 'zh', 'ru', 'ko'] as const;

describe('site UX polish contract', () => {
  it('requires a translated, accessible confirmation before logging out', () => {
    const script = source('site/js/main-v43.js');

    expect(script).toContain('function logoutConfirmModal()');
    expect(script).toContain('id="ppLogoutConfirm"');
    expect(script).toContain('role="dialog"');
    expect(script).toContain('id="ppLogoutConfirmCancel"');
    expect(script).toContain('id="ppLogoutConfirmAction"');
    expect(script).toContain('function openLogoutConfirm()');
    expect(script).toContain('function closeLogoutConfirm()');
    expect(script).toContain('byId("ppLogout")?.addEventListener("click", openLogoutConfirm)');
    expect(script).toContain(
      'document.getElementById("ppLogoutConfirmAction")?.addEventListener("click", logout)',
    );
  });

  it('shows a specific inline error before submitting an empty Ko-fi receipt', () => {
    const script = source('site/js/main-v43.js');
    const emptyGuard = script.indexOf('setMsg(t("claim.receiptRequired"), "err")');
    const linkRequest = script.indexOf('PREMIUM_API_BASE + "/api/link"');
    const instantMessage = script.indexOf('id="ppInstantMsg"');
    const receiptBody = script.indexOf('class="ppanel__receiptbody"');
    const receiptMessage = script.indexOf('id="ppClaimMsg"');

    expect(script).toContain('id="ppClaimForm"');
    expect(script).toContain('const msg = document.getElementById("ppInstantMsg")');
    expect(script).toContain('const input = document.getElementById("ppClaimCode")');
    expect(script).toContain('const btn = document.getElementById("ppClaimBtn")');
    expect(script).toContain('const button = document.getElementById("ppActivateBtn")');
    expect(emptyGuard).toBeGreaterThan(-1);
    expect(linkRequest).toBeGreaterThan(emptyGuard);
    expect(instantMessage).toBeGreaterThan(-1);
    expect(instantMessage).toBeLessThan(receiptBody);
    expect(receiptMessage).toBeGreaterThan(receiptBody);
  });

  it('fits translated hero lines without changing the shared visual footprint', () => {
    const script = source('site/js/main-v43.js');
    const css = source('site/css/main-v42.css');

    expect(script).toContain('function fitHeroTitle()');
    expect(script).toContain('fitHeroTitle();');
    expect(css).toMatch(/\.hero__title span\s*\{[^}]*white-space:\s*nowrap;/s);
    expect(css).toContain('--site-desktop-scale: 1.1');
    expect(css).toMatch(/@media\s*\(min-width:\s*1101px\)/);
    expect(css).toMatch(
      /@media\s*\(max-width:\s*1000px\)[\s\S]*?\.nav__links\s*\{\s*display:\s*none;/,
    );
    expect(css).not.toContain('width: calc(100% / var(--site-desktop-scale))');
  });

  it('has a short-desktop account layout and equal paid-plan CTA footers', () => {
    const accountCss = source('site/css/account-v6.css');
    const siteCss = source('site/css/main-v42.css');

    expect(accountCss).toMatch(/@media\s*\(min-width:\s*1021px\)\s*and\s*\(max-height:\s*699px\)/);
    expect(accountCss).toMatch(/\.ppanel__logoutconfirm\s*\{/);
    expect(siteCss).toMatch(/\.paid-plans\s+\.price-card__idnote\s*\{[^}]*min-height:/s);
  });

  it('provides the new account messages in every advertised language', () => {
    const required = [
      'account.logoutConfirmTitle',
      'account.logoutConfirmBody',
      'account.logoutCancel',
      'account.logoutConfirmAction',
      'claim.receiptRequired',
    ];

    for (const lang of LANGS) {
      const parsed = JSON.parse(source(`tools/i18n-src/${lang}.json`)) as {
        ui: Record<string, string>;
      };
      for (const key of required) expect(parsed.ui[key], `${lang}: ${key}`).toBeTruthy();
    }
  });
});
