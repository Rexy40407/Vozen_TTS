import { describe, it, expect } from 'vitest';
import { t, SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_DISPLAY_NAMES } from '../src/i18n/index';
import { locales } from '../src/i18n/locales/index';
import { catalog } from '../src/i18n/catalog';

describe('i18n — t(key, locale, params)', () => {
  it('DEFAULT_LOCALE is "en" and "en" is a supported locale', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(SUPPORTED_LOCALES).toContain('en');
    expect(SUPPORTED_LOCALES).toContain('pt');
  });

  it('returns the EN string by default (locale="en")', () => {
    // help.title exists in the catalog with a known EN value.
    expect(t('help.title', 'en')).toContain('Vozen');
  });

  it('returns the PT string when locale="pt"', () => {
    // help.groupStarted has distinct translations EN vs PT.
    const en = t('help.groupStarted', 'en');
    const pt = t('help.groupStarted', 'pt');
    expect(en).toBe('Getting started');
    expect(pt).toBe('Primeiros passos');
  });

  it('game.wordle.guess has an explicit VERB (does not read as a loss, even with nick "Perdeste")', () => {
    // Regression of the reported bug: with the nick "Perdeste", "**Perdeste** — faltam 4" read
    // as a result. The copy MUST have a verb (tentou/guessed) between the name and the rest.
    for (const [loc, verb] of [
      ['pt', 'tentou'],
      ['en', 'guessed'],
    ] as const) {
      const s = t('game.wordle.guess', loc, { user: 'Perdeste', left: 4 });
      expect(s).toContain(verb);
      expect(s).toContain('Perdeste');
      expect(s).toContain('4');
      // The name is never stuck to "faltam/left" without the verb in between.
      expect(s).not.toMatch(/Perdeste\*?\*? — (faltam|4)/);
    }
  });

  it('a nonexistent key returns the key itself (never crashes)', () => {
    expect(t('nao.existe.esta.chave', 'en')).toBe('nao.existe.esta.chave');
    expect(t('nao.existe.esta.chave', 'pt')).toBe('nao.existe.esta.chave');
  });

  it('interpolates {param} parameters', () => {
    // help.recommend uses {command}. We confirm that the placeholder is substituted.
    const out = t('help.footer', 'en', { command: '/setup' });
    expect(out).toContain('/setup');
    expect(out).not.toContain('{command}');
  });

  it('an unsupported locale falls back to EN', () => {
    expect(t('help.groupStarted', 'xx')).toBe('Getting started');
  });

  // Phase B: 'es' ALREADY has a translation (locales/es.ts) -> t() serves Spanish, not EN.
  it('a translated locale (es) serves the translation, not the EN fallback', () => {
    expect(t('help.groupStarted', 'es')).not.toBe('Getting started');
    expect(t('help.title', 'es')).not.toBe('');
  });

  it('states the Piper/Kokoro plan boundary in bot copy', () => {
    for (const locale of ['en', 'pt', 'es']) {
      expect(t('welcome.enginePlans', locale), locale).toContain('Piper');
      expect(t('welcome.enginePlans', locale), locale).toContain('Kokoro');
      expect(t('premium.enginePerks', locale), locale).toContain('Google HD');
      expect(t('voice.engine.kokoroLocked', locale), locale).toContain('Kokoro');
    }
  });

  // Proves the PHASE B architecture: when there is a locales/<code>.ts file with the
  // key, t() serves that translation (branch 1 of the chain). In Phase A the registry is
  // empty, so NO other test exercises this branch — without this, a bug in
  // `locales[locale]?.[key]` would only appear in Phase B. We register/clean up in-line.
  it('uses the per-locale registry translation when present (branch 1)', () => {
    locales['zz'] = { 'help.groupStarted': 'REG-WIN' };
    try {
      expect(t('help.groupStarted', 'zz')).toBe('REG-WIN');
    } finally {
      delete locales['zz'];
    }
  });

  it('the per-locale registry takes precedence over the catalog inline value (pt)', () => {
    // 'help.groupStarted' has `pt` inline ("Primeiros passos"); an override in the
    // registry for pt should WIN over that inline (branch 1 > branch 2).
    locales['pt'] = { 'help.groupStarted': 'OVERRIDE-PT' };
    try {
      expect(t('help.groupStarted', 'pt')).toBe('OVERRIDE-PT');
    } finally {
      delete locales['pt'];
    }
  });
});

describe('i18n — SUPPORTED_LOCALES + endonyms (35 voice languages)', () => {
  const EXPECTED = [
    'en',
    'pt',
    'es',
    'fr',
    'de',
    'nl',
    'pl',
    'tr',
    'cs',
    'sv',
    'fi',
    'da',
    'ro',
    'hu',
    'cy',
    'is',
    'lb',
    'lv',
    'sk',
    'sl',
    'sw',
    'vi',
    'ca',
    'it',
    'el',
    'ru',
    'uk',
    'kk',
    'sr',
    'ar',
    'fa',
    'ka',
    'ne',
    'zh',
    'ja',
  ];

  it('SUPPORTED_LOCALES has exactly the 35 voice languages', () => {
    expect([...SUPPORTED_LOCALES]).toEqual(EXPECTED);
    expect(SUPPORTED_LOCALES.length).toBe(35);
  });

  it('LOCALE_DISPLAY_NAMES has an endonym (name in its own language) for EACH locale', () => {
    for (const code of EXPECTED) {
      const name = (LOCALE_DISPLAY_NAMES as Record<string, string>)[code];
      expect(name, `missing endonym for ${code}`).toBeTruthy();
      expect(typeof name).toBe('string');
    }
  });

  it('key endonyms are in their OWN language (endonym, not in English)', () => {
    const N = LOCALE_DISPLAY_NAMES as Record<string, string>;
    expect(N.en).toBe('English');
    expect(N.pt).toBe('Português');
    expect(N.de).toBe('Deutsch');
    expect(N.zh).toBe('中文');
    expect(N.ru).toBe('Русский');
    expect(N.ar).toBe('العربية');
    expect(N.el).toBe('Ελληνικά');
    expect(N.uk).toBe('Українська');
  });
});

// Regression guard for SILENT locale drift — the class of bug that let a renamed or
// newly added key fall back to English forever without anyone noticing.
describe('i18n — locale integrity (per-locale registry vs catalog)', () => {
  const catalogKeys = new Set(Object.keys(catalog));
  const codes = Object.keys(locales);
  const tokensOf = (s: string): Set<string> => new Set(s.match(/\{[^}]+\}/g) ?? []);

  it('registers translations for the voice languages (sanity: the registry is populated)', () => {
    expect(codes.length).toBeGreaterThanOrEqual(30);
  });

  it('no locale has a key ABSENT from the catalog (a renamed/typo key silently falls back to EN forever)', () => {
    const offenders: string[] = [];
    for (const code of codes) {
      for (const key of Object.keys(locales[code])) {
        if (!catalogKeys.has(key)) offenders.push(`${code}:${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every locale value is a non-empty string', () => {
    const offenders: string[] = [];
    for (const code of codes) {
      for (const [key, value] of Object.entries(locales[code])) {
        if (typeof value !== 'string' || value.trim().length === 0)
          offenders.push(`${code}:${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every advertised interface locale translates every catalog key', () => {
    const keys = Object.keys(catalog);
    const offenders: string[] = [];

    for (const key of keys) {
      if (!catalog[key]?.pt) offenders.push(`pt:${key}`);
    }
    for (const code of Object.keys(locales)) {
      for (const key of keys) {
        if (!locales[code]?.[key]) offenders.push(`${code}:${key}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('join.joinedAutoread points at the read channel ({readChannel}) in EVERY locale — I18N-01', () => {
    // en/pt author it inline; the 33 recombined locales must ALSO surface the clickable channel,
    // else non-en/pt users get "type in the auto-read channel" with no pointer to WHICH channel —
    // the exact confusion the state-aware /join message exists to remove.
    const key = 'join.joinedAutoread';
    expect(catalog[key]?.en).toContain('{readChannel}');
    expect(catalog[key]?.pt).toContain('{readChannel}');
    const offenders = Object.keys(locales)
      .filter((code) => locales[code]?.[key] !== undefined)
      .filter((code) => !locales[code][key].includes('{readChannel}'));
    expect(offenders).toEqual([]);
  });

  it('no locale INVENTS a placeholder absent from its English source (catches {name} -> {nome} mangling)', () => {
    const offenders: string[] = [];
    for (const code of codes) {
      for (const [key, value] of Object.entries(locales[code])) {
        const en = catalog[key]?.en;
        if (typeof en !== 'string') continue; // key-not-in-catalog is covered by the test above
        const enTokens = tokensOf(en);
        for (const tok of tokensOf(value)) {
          if (!enTokens.has(tok)) offenders.push(`${code}:${key} ${tok}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
