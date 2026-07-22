import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const source = (path: string): string => readFileSync(resolve(ROOT, path), { encoding: 'utf8' });
const LANGS = ['en', 'pt', 'fr', 'es', 'de', 'tr', 'ar', 'zh', 'ru', 'ko'] as const;

const mainRuntime = (): string => {
  const files = readdirSync(resolve(ROOT, 'site/js')).filter((name) =>
    /^main-v\d+\.js$/.test(name),
  );
  expect(files).toHaveLength(1);
  return source(`site/js/${files[0]}`);
};

const mainStyles = (): string => {
  const files = readdirSync(resolve(ROOT, 'site/css')).filter((name) =>
    /^main-v\d+\.css$/.test(name),
  );
  expect(files).toHaveLength(1);
  return source(`site/css/${files[0]}`);
};

describe('full product audit regressions', () => {
  it('switches the document direction when Arabic is selected', () => {
    expect(mainRuntime()).toContain(
      'document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";',
    );
    const css = mainStyles();
    expect(css).toMatch(/\.skip-link\s*\{[^}]*inset-inline-start:\s*12px;/s);
    expect(css).toMatch(/\.skip-link\s*\{[^}]*transform:\s*translateY\(-200%\);/s);
    expect(css).not.toContain('left: -999px');
    expect(css).toContain(':not(.ppmodal):not(.skip-link)');
    expect(css).toMatch(/\.lang__panel\s*\{[^}]*inset-inline-end:\s*0;/s);
    expect(css).not.toMatch(/\.lang__panel\s*\{[^}]*\bright:\s*0;/s);
  });

  it('lets keyboard users close the mobile navigation with Escape', () => {
    const runtime = mainRuntime();
    expect(runtime).toContain('function closeMobileNav(restoreFocus)');
    expect(runtime).toMatch(/document\.addEventListener\("keydown",[\s\S]*e\.key === "Escape"/);
    expect(runtime).toContain('closeMobileNav(true)');
  });

  it('ships a branded recovery page for unknown URLs', () => {
    expect(existsSync(resolve(ROOT, 'site/404.html'))).toBe(true);
    const page = source('site/404.html');
    expect(page).toContain('<title>Page not found — Vozen</title>');
    expect(page).toContain('href="/"');
    expect(page).toContain('https://discord.gg/4kYw2WUbNN');
    expect(page).not.toContain('<script');
  });

  it('keeps the public plan matrix aligned with the real entitlement gates', () => {
    const page = source('site/index.html');
    const transcriptionGate = source('src/commands/handlers/transcribe.ts');
    const paidEngineGate = source('src/tts/resolveEngine.ts');

    expect(paidEngineGate).toContain('isUserPremium(db, userId, now) || isGuildPremium');
    expect(transcriptionGate).toContain('isPremium: isGuildPremium');
    expect(transcriptionGate).not.toContain('isUserPremium');

    expect(page).toMatch(
      /data-i18n="price\.m\.22"[^>]*>Google HD voices<\/th><td[^>]*class="has-not">—<\/td><td[^>]*class="has">✓<\/td><td[^>]*class="has">✓<\/td>/,
    );
    expect(page).toMatch(
      /data-i18n="price\.m\.23"[^>]*>Live voice transcription<\/th><td[^>]*class="has-not">—<\/td><td[^>]*class="has-not">—<\/td><td[^>]*class="has has--premium">✓<\/td>/,
    );
  });

  it('describes optional language detection and paid features accurately in every locale', () => {
    for (const lang of LANGS) {
      const data = JSON.parse(source(`tools/i18n-src/${lang}.json`)) as {
        ui: Record<string, string>;
        faq: string[][];
        commands: Record<string, string[][]>;
      };
      expect(data.ui['price.m.22'], `${lang}: Google HD`).toBeTruthy();
      expect(data.ui['price.m.23'], `${lang}: transcription`).toBeTruthy();
      expect(data.ui['feat.3.d'], `${lang}: feature copy`).toContain('/voice detection');
      expect(data.faq[5]?.[1], `${lang}: detection FAQ`).toContain('/voice detection on');
      expect(data.faq[1]?.[1], `${lang}: Premium FAQ`).toMatch(
        /transcri|transkr|تحويل|轉錄|расшиф|텍스트|döküm/i,
      );
      const adminCommands = data.commands.admin.map(([command]) => command);
      expect(adminCommands, `${lang}: command catalog`).not.toContain('/config pronunciation');
      expect(adminCommands, `${lang}: command catalog`).toContain('/server-pronunciation');
    }
  });

  it('keeps README and architecture claims aligned with the implementation', () => {
    const readme = source('README.md');
    const architecture = source('docs/ARCHITECTURE.md');

    expect(readme).toContain('Live voice transcription is a server Premium feature');
    expect(readme).not.toMatch(/Plus[^\n]*and[^\n]*Premium[^\n]*\n?[^\n]*transcription/i);
    expect(architecture).toContain('default OFF; opt-in via `/voice detection on`');
    expect(architecture).toContain('cap 3 Free / 50 com Premium da guild');
    expect(architecture).not.toContain('A deteção automática de língua foi **removida**');
    expect(architecture).not.toContain('cap fixo 3');
  });
});
