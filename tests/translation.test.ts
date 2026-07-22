import { describe, expect, it, vi } from 'vitest';
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { initDb } from '../src/store/db';
import { setGuildConfig } from '../src/store/guildConfig';
import {
  addTranslationMapping,
  getTranslationMapping,
  getTranslationPreference,
  refundTranslationChars,
  reserveTranslationChars,
  resolveTranslationLimits,
  setTranslationPreference,
} from '../src/store/translation';
import {
  minimiseTranslationText,
  TRANSLATION_MARKER,
  handleTranslationMessage,
} from '../src/translation/messageListener';
import {
  AzureTranslationProvider,
  DisabledTranslationProvider,
  parseTranslationProviderConfig,
  TranslationError,
} from '../src/translation/provider';
import type { BotDeps } from '../src/bot/deps';
import { canMapChannel } from '../src/commands/handlers/translation';
import { translateExplicitText, translateTextForSpeech } from '../src/translation/explicit';

const GUILD = 'guild-1';
const SOURCE = 'source-1';
const DESTINATION = 'destination-1';
const USER = 'user-1';
const BOT = 'bot-1';

function db() {
  return initDb(':memory:');
}

describe('translation provider privacy boundary', () => {
  it('is disabled unless complete HTTPS Azure settings are explicitly selected', async () => {
    expect(parseTranslationProviderConfig({})).toEqual({ kind: 'disabled' });
    expect(parseTranslationProviderConfig({ TRANSLATION_PROVIDER: 'azure' })).toEqual({
      kind: 'disabled',
    });
    expect(
      parseTranslationProviderConfig({
        TRANSLATION_PROVIDER: 'azure',
        TRANSLATION_AZURE_ENDPOINT: 'http://insecure.example',
        TRANSLATION_AZURE_KEY: 'key',
      }),
    ).toEqual({ kind: 'disabled' });
    await expect(new DisabledTranslationProvider().translate()).rejects.toMatchObject({
      code: 'disabled',
    });
  });

  it('sends Azure only the current text and target locale', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ translations: [{ text: 'olá' }] }],
    });
    const provider = new AzureTranslationProvider('https://translator.example', 'secret', fetch);
    await expect(provider.translate({ text: 'hello', targetLocale: 'pt' })).resolves.toBe('olá');
    expect(fetch).toHaveBeenCalledWith(
      'https://translator.example/translate?api-version=3.0&to=pt',
      expect.objectContaining({ body: JSON.stringify([{ Text: 'hello' }]) }),
    );
  });

  it('strips Discord mentions, URLs and its own marker before provider admission', () => {
    expect(
      minimiseTranslationText(
        `<@${USER}> <#${SOURCE}> @everyone https://discord.com/channels/1/2/3?token=nope hi ${TRANSLATION_MARKER}`,
      ),
    ).toBe('[member] [channel] [mention] [link] hi');
  });
});

describe('translation persistence and quota', () => {
  it('requires GuildText plus View at the source, and Send only at the destination', () => {
    const me = { id: BOT };
    const all = { has: () => true };
    const noSend = { has: (permission: bigint) => permission !== PermissionFlagsBits.SendMessages };
    expect(
      canMapChannel({ type: ChannelType.GuildText, permissionsFor: () => all }, me, true),
    ).toBe(true);
    expect(
      canMapChannel({ type: ChannelType.GuildText, permissionsFor: () => noSend }, me, true),
    ).toBe(false);
    expect(
      canMapChannel({ type: ChannelType.GuildText, permissionsFor: () => noSend }, me, false),
    ).toBe(true);
    expect(
      canMapChannel({ type: ChannelType.GuildVoice, permissionsFor: () => all }, me, true),
    ).toBe(false);
  });

  it('rejects self-targeting and cycles, but stores no message text', () => {
    const database = db();
    expect(() =>
      addTranslationMapping(database, {
        guildId: GUILD,
        sourceChannelId: SOURCE,
        destinationChannelId: SOURCE,
        targetLocale: 'pt',
      }),
    ).toThrow(/Invalid/);
    addTranslationMapping(database, {
      guildId: GUILD,
      sourceChannelId: SOURCE,
      destinationChannelId: DESTINATION,
      targetLocale: 'pt',
    });
    expect(() =>
      addTranslationMapping(database, {
        guildId: GUILD,
        sourceChannelId: DESTINATION,
        destinationChannelId: SOURCE,
        targetLocale: 'en',
      }),
    ).toThrow(/cycle/);
    expect(getTranslationMapping(database, GUILD, SOURCE)).toMatchObject({ targetLocale: 'pt' });
    const columns = database.pragma('table_info(translation_mapping)') as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).not.toContain('text');
  });

  it('atomically enforces guild and per-user quotas and refunds only failures', () => {
    const database = db();
    const first = reserveTranslationChars(database, {
      guildId: GUILD,
      userId: USER,
      chars: 4,
      guildLimit: 5,
      userLimit: 4,
      day: '2026-07-22',
    });
    expect(first).toMatchObject({ ok: true });
    expect(
      reserveTranslationChars(database, {
        guildId: GUILD,
        userId: USER,
        chars: 1,
        guildLimit: 5,
        userLimit: 4,
        day: '2026-07-22',
      }),
    ).toEqual({ ok: false, reason: 'user_quota' });
    refundTranslationChars(database, first as Extract<typeof first, { ok: true }>, GUILD, USER);
    expect(
      reserveTranslationChars(database, {
        guildId: GUILD,
        userId: USER,
        chars: 5,
        guildLimit: 5,
        userLimit: 5,
        day: '2026-07-22',
      }),
    ).toMatchObject({ ok: true });
  });

  it('enforces a rolling 30-day window instead of resetting the allowance every day', () => {
    const database = db();
    expect(
      reserveTranslationChars(database, {
        guildId: GUILD,
        userId: USER,
        chars: 7,
        guildLimit: 10,
        userLimit: 10,
        day: '2026-07-01',
      }),
    ).toMatchObject({ ok: true });
    expect(
      reserveTranslationChars(database, {
        guildId: GUILD,
        userId: USER,
        chars: 4,
        guildLimit: 10,
        userLimit: 10,
        day: '2026-07-22',
      }),
    ).toEqual({ ok: false, reason: 'guild_quota' });
    expect(
      reserveTranslationChars(database, {
        guildId: GUILD,
        userId: USER,
        chars: 10,
        guildLimit: 10,
        userLimit: 10,
        day: '2026-08-01',
      }),
    ).toMatchObject({ ok: true });
  });

  it('uses the published free, Plus and Premium 30-day caps', () => {
    const database = db();
    expect(resolveTranslationLimits(database, GUILD, USER, Date.now())).toEqual({
      guildLimit: 100_000,
      userLimit: 10_000,
    });
    database
      .prepare('INSERT INTO premium_user (user_id, expires_at) VALUES (?, ?)')
      .run(USER, Date.now() + 60_000);
    expect(resolveTranslationLimits(database, GUILD, USER, Date.now()).userLimit).toBe(100_000);
    database
      .prepare('INSERT INTO premium_guild (guild_id, expires_at) VALUES (?, ?)')
      .run(GUILD, Date.now() + 60_000);
    expect(resolveTranslationLimits(database, GUILD, USER, Date.now()).guildLimit).toBe(500_000);
  });

  it('stores a member target locale independently from their automatic opt-out', () => {
    const database = db();
    setTranslationPreference(database, {
      guildId: GUILD,
      userId: USER,
      optedOut: true,
      locale: 'pt',
      speakLocale: 'es',
    });
    setTranslationPreference(database, { guildId: GUILD, userId: USER, optedOut: false });
    expect(getTranslationPreference(database, GUILD, USER)).toEqual({
      guildId: GUILD,
      userId: USER,
      optedOut: false,
      locale: 'pt',
      speakLocale: 'es',
    });
  });

  it('keeps translate-before-speaking disabled until the member explicitly selects a locale', () => {
    const database = db();
    expect(getTranslationPreference(database, GUILD, USER).speakLocale).toBeNull();
    setTranslationPreference(database, {
      guildId: GUILD,
      userId: USER,
      optedOut: false,
      speakLocale: 'fr',
    });
    expect(getTranslationPreference(database, GUILD, USER).speakLocale).toBe('fr');
    setTranslationPreference(database, {
      guildId: GUILD,
      userId: USER,
      optedOut: false,
      speakLocale: null,
    });
    expect(getTranslationPreference(database, GUILD, USER).speakLocale).toBeNull();
  });
});

function makeDeps(
  database: ReturnType<typeof initDb>,
  provider?: BotDeps['translationProvider'],
): BotDeps {
  return {
    db: database,
    translationProvider: provider,
    client: { user: { id: BOT } },
    players: new Map(),
    limiters: new Map(),
    availableModels: [],
    config: {},
  } as unknown as BotDeps;
}

function makeMessage(send: ReturnType<typeof vi.fn>, content = 'hello'): any {
  const can = { has: () => true };
  const source = { id: SOURCE, type: 0, permissionsFor: () => can };
  const destination = { id: DESTINATION, type: 0, permissionsFor: () => can, send };
  return {
    guildId: GUILD,
    guild: {
      channels: {
        cache: new Map([
          [SOURCE, source],
          [DESTINATION, destination],
        ]),
      },
    },
    channelId: SOURCE,
    content,
    author: { id: USER, bot: false },
    webhookId: null,
    react: vi.fn(),
  };
}

describe('translation message listener', () => {
  it('is default-off and never asks the provider to translate', async () => {
    const database = db();
    addTranslationMapping(database, {
      guildId: GUILD,
      sourceChannelId: SOURCE,
      destinationChannelId: DESTINATION,
      targetLocale: 'pt',
    });
    const translate = vi.fn();
    await handleTranslationMessage(
      makeMessage(vi.fn()),
      makeDeps(database, { kind: 'azure', enabled: true, translate }),
    );
    expect(translate).not.toHaveBeenCalled();
  });

  it('honours the guild-wide disabled switch before provider admission', async () => {
    const database = db();
    setGuildConfig(database, GUILD, { enabled: false, translationEnabled: true });
    addTranslationMapping(database, {
      guildId: GUILD,
      sourceChannelId: SOURCE,
      destinationChannelId: DESTINATION,
      targetLocale: 'pt',
    });
    const translate = vi.fn();
    await handleTranslationMessage(
      makeMessage(vi.fn(), 'hello'),
      makeDeps(database, { kind: 'azure', enabled: true, translate }),
    );
    expect(translate).not.toHaveBeenCalled();
  });

  it('translates a configured message without enqueuing speech and ignores bot/marker messages', async () => {
    const database = db();
    setGuildConfig(database, GUILD, {
      translationEnabled: true,
      translationDailyCharLimit: 100,
      translationPerUserDailyCharLimit: 100,
    });
    addTranslationMapping(database, {
      guildId: GUILD,
      sourceChannelId: SOURCE,
      destinationChannelId: DESTINATION,
      targetLocale: 'pt',
    });
    const send = vi.fn().mockResolvedValue(undefined);
    const translate = vi.fn().mockResolvedValue('olá');
    await handleTranslationMessage(
      makeMessage(send),
      makeDeps(database, { kind: 'azure', enabled: true, translate }),
    );
    expect(translate).toHaveBeenCalledWith({ text: 'hello', targetLocale: 'pt' });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining(TRANSLATION_MARKER) }),
    );
    const botMessage = makeMessage(send, `ignored ${TRANSLATION_MARKER}`);
    botMessage.author.bot = true;
    await handleTranslationMessage(
      botMessage,
      makeDeps(database, { kind: 'azure', enabled: true, translate }),
    );
    expect(translate).toHaveBeenCalledTimes(1);
  });

  it('refunds a failed provider reservation without leaking a provider error to the channel', async () => {
    const database = db();
    setGuildConfig(database, GUILD, {
      translationEnabled: true,
      translationDailyCharLimit: 5,
      translationPerUserDailyCharLimit: 5,
    });
    addTranslationMapping(database, {
      guildId: GUILD,
      sourceChannelId: SOURCE,
      destinationChannelId: DESTINATION,
      targetLocale: 'pt',
    });
    const send = vi.fn();
    const translate = vi
      .fn()
      .mockRejectedValue(new TranslationError('transient', 'raw response should not leak'));
    await handleTranslationMessage(
      makeMessage(send, 'hello'),
      makeDeps(database, { kind: 'azure', enabled: true, translate }),
    );
    expect(send).not.toHaveBeenCalled();
    expect(
      reserveTranslationChars(database, {
        guildId: GUILD,
        userId: USER,
        chars: 5,
        guildLimit: 5,
        userLimit: 5,
        day: new Date().toISOString().slice(0, 10),
      }),
    ).toMatchObject({ ok: true });
  });
});

describe('explicit translation', () => {
  it('is available without automatic channel translation and applies the personal quota', async () => {
    const database = db();
    const translate = vi.fn(async () => 'olÃ¡');
    const result = await translateExplicitText({
      db: database,
      provider: { kind: 'azure', enabled: true, translate },
      guildId: null,
      userId: USER,
      text: 'hello',
      targetLocale: 'pt',
      now: Date.parse('2026-07-22T12:00:00Z'),
    });
    expect(result).toEqual({ ok: true, text: 'olÃ¡', sourceChars: 5 });
    expect(translate).toHaveBeenCalledWith({ text: 'hello', targetLocale: 'pt' });
  });

  it('refunds its reservation when the provider fails', async () => {
    const database = db();
    const input = {
      db: database,
      provider: {
        kind: 'azure' as const,
        enabled: true,
        translate: vi.fn(async () => {
          throw new TranslationError('transient', 'down');
        }),
      },
      guildId: GUILD,
      userId: USER,
      text: 'hello',
      targetLocale: 'pt',
      now: Date.parse('2026-07-22T12:00:00Z'),
    };
    await expect(translateExplicitText(input)).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    });
    input.provider.translate = vi.fn(async () => 'olÃ¡');
    await expect(translateExplicitText(input)).resolves.toMatchObject({ ok: true });
  });

  it('translates an opted-in speech body but safely falls back to the original', async () => {
    const database = db();
    const translated = await translateTextForSpeech({
      db: database,
      provider: { kind: 'azure', enabled: true, translate: vi.fn(async () => 'hola') },
      guildId: GUILD,
      userId: USER,
      text: 'hello',
      targetLocale: 'es',
    });
    expect(translated).toEqual({ text: 'hola', translated: true });

    const fallback = await translateTextForSpeech({
      db: database,
      provider: undefined,
      guildId: GUILD,
      userId: USER,
      text: 'hello',
      targetLocale: 'es',
    });
    expect(fallback).toEqual({ text: 'hello', translated: false });
  });
});
