// tests/localeResolution.test.ts — pins the per-user localization CONTRACT: each user
// sees the bot in the language of THEIR Discord client. Discord sends real locale
// strings ('pt-BR', 'es-419', 'zh-CN'); we key catalogs by the base code ('pt', 'es',
// 'zh'). This proves the mapping (kills the "pt -> English is a mapping bug" theory) and
// guards it against regression.
import { describe, it, expect } from 'vitest';
import { normalizeLocale, SUPPORTED_LOCALES } from '../src/i18n/index';
import { localeForUser } from '../src/commands/helpers';
import { initDb } from '../src/store/db';
import { setGuildConfig } from '../src/store/guildConfig';
import type { BotDeps } from '../src/bot/deps';

describe('normalizeLocale — real Discord locale strings map to the base catalog code', () => {
  const CASES: Array<[string, string]> = [
    ['pt-BR', 'pt'], // Discord has no pt-PT; a Portugal user is pt-BR -> pt (the reported case)
    ['en-US', 'en'],
    ['en-GB', 'en'],
    ['es-ES', 'es'],
    ['es-419', 'es'], // Latin-American Spanish
    ['fr', 'fr'],
    ['de', 'de'],
    ['zh-CN', 'zh'],
    ['zh-TW', 'zh'],
    ['ru', 'ru'],
    ['uk', 'uk'],
    ['ja', 'ja'],
  ];
  for (const [raw, base] of CASES) {
    it(`${raw} -> ${base}`, () => {
      expect(normalizeLocale(raw)).toBe(base);
      expect((SUPPORTED_LOCALES as readonly string[]).includes(base)).toBe(true);
    });
  }

  it('an unsupported Discord language (or empty) -> null so the caller can fall back', () => {
    expect(normalizeLocale('ko')).toBeNull(); // Korean: a real Discord language we do not translate yet
    expect(normalizeLocale('th-TH')).toBeNull();
    expect(normalizeLocale(null)).toBeNull();
    expect(normalizeLocale(undefined)).toBeNull();
    expect(normalizeLocale('')).toBeNull();
  });
});

describe('localeForUser — each user gets THEIR Discord client language', () => {
  // A db that throws if read: proves the supported-locale path never even consults the guild.
  const throwingDb = {
    prepare() {
      throw new Error('guild config must not be read when the client locale is supported');
    },
  };
  const depsThrowing = { db: throwingDb } as unknown as BotDeps;

  it('a supported client locale wins outright — the guild config is never read', () => {
    expect(localeForUser(depsThrowing, { locale: 'pt-BR', guildId: 'g1' })).toBe('pt');
    expect(localeForUser(depsThrowing, { locale: 'ru', guildId: 'g1' })).toBe('ru');
    expect(localeForUser(depsThrowing, { locale: 'zh-TW', guildId: 'g1' })).toBe('zh');
  });

  it('an UNSUPPORTED client locale falls back to the guild-configured language', () => {
    const db = initDb(':memory:');
    setGuildConfig(db, 'g1', { locale: 'fr' });
    const deps = { db } as unknown as BotDeps;
    // Korean client (we don't translate ko) -> the guild's configured 'fr', not English.
    expect(localeForUser(deps, { locale: 'ko', guildId: 'g1' })).toBe('fr');
    db.close();
  });

  it('no client locale + no guild -> English default (DMs / missing)', () => {
    expect(localeForUser(depsThrowing, { locale: null, guildId: null })).toBe('en');
  });
});
