import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  buildGreeting,
  isJoinIntoChannel,
  GREETINGS,
  GREET_LOCALES,
  GREET_LANGUAGE_CHOICES,
} from '../src/voice/greeting';
import { initDb } from '../src/store/db';
import { getGuildConfig, setGuildConfig } from '../src/store/guildConfig';

const MODELS = ['en_US-amy-medium', 'pt_BR-faber-medium', 'de_DE-thorsten-medium'];

describe('isJoinIntoChannel — detecting a JOIN into the bot channel', () => {
  it('true when joining the bot channel (was not there before)', () => {
    expect(isJoinIntoChannel(null, 'voz-1', 'voz-1')).toBe(true); // connected
    expect(isJoinIntoChannel('voz-2', 'voz-1', 'voz-1')).toBe(true); // switched channel
  });
  it('false when already in the channel (e.g. mute/deafen — channel does not change)', () => {
    expect(isJoinIntoChannel('voz-1', 'voz-1', 'voz-1')).toBe(false);
  });
  it('false when joining ANOTHER channel, or the bot is not in a call', () => {
    expect(isJoinIntoChannel(null, 'voz-2', 'voz-1')).toBe(false); // another channel
    expect(isJoinIntoChannel(null, 'voz-1', null)).toBe(false); // bot not in a call
    expect(isJoinIntoChannel('voz-1', null, 'voz-1')).toBe(false); // left (not a join)
  });
});

describe('buildGreeting — greeting text + voice', () => {
  it('English by default: "Hello {name}" in an English voice', () => {
    const req = buildGreeting({
      locale: 'en',
      name: 'Ana',
      availableModels: MODELS,
      defaultVoice: 'en_US-amy-medium',
      defaultSpeed: 1,
    });
    expect(req.text).toBe('Hello Ana');
    expect(req.model).toBe('en_US-amy-medium');
    expect(req.singleVoice).toBe(true);
  });
  it('uses the chosen language (pt -> "Olá") and a voice of that language', () => {
    const req = buildGreeting({
      locale: 'pt-BR',
      name: 'Rui',
      availableModels: MODELS,
      defaultVoice: 'en_US-amy-medium',
      defaultSpeed: 1,
    });
    expect(req.text).toBe('Olá Rui');
    expect(req.model).toBe('pt_BR-faber-medium'); // PT voice, not the default EN
  });
  it('language without a greeting -> falls back to English (text AND voice)', () => {
    const req = buildGreeting({
      locale: 'ja',
      name: 'Yuki',
      availableModels: MODELS,
      defaultVoice: 'en_US-amy-medium',
      defaultSpeed: 1,
    });
    expect(req.text).toBe('Hello Yuki');
    expect(req.model).toBe('en_US-amy-medium');
  });
  it('without a name -> just the greeting, no extra space', () => {
    expect(
      buildGreeting({
        locale: 'en',
        name: '',
        availableModels: MODELS,
        defaultVoice: 'en_US-amy-medium',
        defaultSpeed: 1,
      }).text,
    ).toBe('Hello');
    expect(
      buildGreeting({
        locale: 'pt',
        name: '',
        availableModels: MODELS,
        defaultVoice: 'en_US-amy-medium',
        defaultSpeed: 1,
      }).text,
    ).toBe('Olá');
  });
  it('language without an installed voice -> text in the language, default voice', () => {
    const req = buildGreeting({
      locale: 'fr',
      name: 'Léa',
      availableModels: MODELS,
      defaultVoice: 'en_US-amy-medium',
      defaultSpeed: 1,
    });
    expect(req.text).toBe('Bonjour Léa');
    expect(req.model).toBe('en_US-amy-medium'); // there is no FR voice in MODELS
  });
});

describe('GREET_LANGUAGE_CHOICES / GREET_LOCALES', () => {
  it('each choice has a greeting and the code is in the valid set', () => {
    expect(GREET_LANGUAGE_CHOICES.length).toBeLessThanOrEqual(25); // Discord cap
    for (const c of GREET_LANGUAGE_CHOICES) {
      expect(GREETINGS[c.value]).toBeDefined();
      expect(GREET_LOCALES.has(c.value)).toBe(true);
    }
    expect(GREET_LOCALES.has('en')).toBe(true);
  });
});

describe('guildConfig — greet fields', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });
  it('default: greetOnJoin enabled, greetLocale "en"', () => {
    const cfg = getGuildConfig(db, 'g1');
    expect(cfg.greetOnJoin).toBe(true);
    expect(cfg.greetLocale).toBe('en');
  });
  it('persists toggle and language without losing other fields', () => {
    setGuildConfig(db, 'g1', { greetOnJoin: false, greetLocale: 'pt' });
    const cfg = getGuildConfig(db, 'g1');
    expect(cfg.greetOnJoin).toBe(false);
    expect(cfg.greetLocale).toBe('pt');
    expect(cfg.enabled).toBe(true); // other defaults intact
  });
});
