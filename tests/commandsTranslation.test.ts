import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';
import { commandDefs } from '../src/commands/definitions';
import { handleMessageContextMenu } from '../src/commands/handlers/core';
import { handleTranslate } from '../src/commands/handlers/translation';
import { handleTranslateMessage } from '../src/commands/handlers/messageTools';
import { initDb } from '../src/store/db';
import { getTranslationPreference } from '../src/store/translation';
import { setGuildConfig } from '../src/store/guildConfig';
import type { BotDeps } from '../src/bot/deps';

function interaction(
  subcommand: string,
  values: Record<string, string | null>,
  guildId: string | null = null,
) {
  const replies: unknown[] = [];
  return {
    commandName: 'translate',
    guildId,
    guild: null,
    locale: 'en-US',
    user: { id: 'u1' },
    member: null,
    options: {
      getSubcommand: () => subcommand,
      getString: (name: string, required?: boolean) => {
        const value = values[name] ?? null;
        if (required && value === null) throw new Error(`missing ${name}`);
        return value;
      },
      getBoolean: () => null,
      getChannel: () => null,
    },
    reply: vi.fn(async (payload: unknown) => {
      replies.push(payload);
    }),
    replies,
  };
}

describe('/translate explicit actions', () => {
  let db: Database.Database;
  let deps: BotDeps;

  beforeEach(() => {
    db = initDb(':memory:');
    deps = {
      db,
      translationProvider: {
        kind: 'azure',
        enabled: true,
        translate: vi.fn(async () => 'olÃ¡'),
      },
    } as unknown as BotDeps;
  });

  afterEach(() => db.close());

  it('registers public text and personal language subcommands', () => {
    const definition = commandDefs.find((entry) => entry.name === 'translate');
    expect(definition?.options?.some((option) => option.name === 'text')).toBe(true);
    expect(definition?.options?.some((option) => option.name === 'language')).toBe(true);
    expect(definition?.options?.some((option) => option.name === 'speak-language')).toBe(true);
  });

  it('lets a member opt in and back out of translating their text before speech', async () => {
    const enabled = interaction('speak-language', { locale: 'es' }, 'guild-1');
    await handleTranslate(enabled as never, deps);
    expect(getTranslationPreference(db, 'guild-1', 'u1').speakLocale).toBe('es');

    const disabled = interaction('speak-language', { locale: 'off' }, 'guild-1');
    await handleTranslate(disabled as never, deps);
    expect(getTranslationPreference(db, 'guild-1', 'u1').speakLocale).toBeNull();
  });

  it('translates explicit text in a DM without enabling automatic translation', async () => {
    const i = interaction('text', { text: 'hello', locale: 'pt' });
    await handleTranslate(i as never, deps);
    expect(JSON.stringify(i.replies)).toContain('olÃ¡');
  });

  it('saves a personal default target language in a privacy-erasable preference', async () => {
    const i = interaction('language', { locale: 'pt' });
    await handleTranslate(i as never, deps);
    expect(getTranslationPreference(db, '@user-app', 'u1').locale).toBe('pt');
  });

  it('uses the shared rolling quota path for an administrator preview', async () => {
    // A stale legacy daily cap must not override the published rolling entitlement.
    setGuildConfig(db, 'guild-1', {
      translationDailyCharLimit: 4,
      translationPerUserDailyCharLimit: 4,
    });
    const i = interaction('preview', { text: 'hello', locale: 'pt' }, 'guild-1');
    i.member = { permissions: { has: () => true } } as never;
    await handleTranslate(i as never, deps);
    expect(JSON.stringify(i.replies)).toContain('olÃ¡');
    expect(deps.translationProvider?.translate).toHaveBeenCalledTimes(1);
    const usage = db
      .prepare('SELECT chars FROM translation_daily_usage WHERE guild_id = ?')
      .get('guild-1') as { chars: number };
    expect(usage.chars).toBe(5);
  });

  it('registers and executes the Translate message action without speaking', async () => {
    const definition = commandDefs.find((entry) => entry.name === 'Translate');
    expect(definition?.type).toBe(3);
    const edits: unknown[] = [];
    const i = {
      commandName: 'Translate',
      guildId: null,
      locale: 'pt-PT',
      user: { id: 'u1' },
      targetMessage: { content: 'hello' },
      deferReply: vi.fn(async () => {}),
      editReply: vi.fn(async (payload: unknown) => edits.push(payload)),
    };
    await handleTranslateMessage(i as never, deps);
    expect(JSON.stringify(edits)).toContain('olÃ¡');
    expect(deps.translationProvider?.translate).toHaveBeenCalledWith({
      text: 'hello',
      targetLocale: 'pt',
    });
  });

  it('contains an unexpected message-action failure and replaces the deferred response', async () => {
    const brokenDeps = {
      ...deps,
      db: {},
    } as BotDeps;
    const edits: unknown[] = [];
    const i = {
      commandName: 'Translate',
      guildId: null,
      locale: 'en-US',
      user: { id: 'u1' },
      targetMessage: { content: 'hello' },
      deferred: false,
      replied: false,
      isRepliable: () => true,
      deferReply: vi.fn(async function (this: { deferred: boolean }) {
        this.deferred = true;
      }),
      editReply: vi.fn(async (payload: unknown) => edits.push(payload)),
      reply: vi.fn(async (payload: unknown) => edits.push(payload)),
    };

    await expect(handleMessageContextMenu(i as never, brokenDeps)).resolves.toBeUndefined();
    expect(JSON.stringify(edits)).toMatch(/wrong|try again|error/i);
  });
});
