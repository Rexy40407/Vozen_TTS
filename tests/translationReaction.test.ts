import { describe, expect, it, vi } from 'vitest';
import { initDb } from '../src/store/db';
import { flagLocale, handleTranslationReaction } from '../src/translation/reaction';
import type { BotDeps } from '../src/bot/deps';

describe('explicit flag-reaction translation', () => {
  it('maps only the documented flag shortcuts', () => {
    expect(flagLocale('🇬🇧')).toBe('en');
    expect(flagLocale('🇵🇹')).toBe('pt');
    expect(flagLocale('🇪🇸')).toBe('es');
    expect(flagLocale('🏴‍☠️')).toBeNull();
  });

  it('translates once into the source channel and never enters voice', async () => {
    const db = initDb(':memory:');
    const reply = vi.fn(async () => undefined);
    const translate = vi.fn(async () => 'olá');
    const reaction = {
      emoji: { name: '🇵🇹' },
      partial: false,
      message: {
        partial: false,
        guildId: 'guild-1',
        content: 'hello',
        author: { bot: false },
        webhookId: null,
        reply,
      },
    };
    const deps = {
      db,
      translationProvider: { kind: 'azure', enabled: true, translate },
    } as unknown as BotDeps;
    await handleTranslationReaction(reaction as never, { id: 'user-1', bot: false } as never, deps);
    expect(translate).toHaveBeenCalledWith({ text: 'hello', targetLocale: 'pt' });
    expect(reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('olá'),
        allowedMentions: { parse: [] },
      }),
    );
    db.close();
  });

  it('ignores unsupported flags, bots, webhooks and empty messages', async () => {
    const db = initDb(':memory:');
    const translate = vi.fn();
    const deps = {
      db,
      translationProvider: { kind: 'azure', enabled: true, translate },
    } as unknown as BotDeps;
    const base = {
      partial: false,
      message: {
        partial: false,
        guildId: 'guild-1',
        content: '',
        author: { bot: false },
        webhookId: null,
        reply: vi.fn(),
      },
    };
    await handleTranslationReaction(
      { ...base, emoji: { name: '🏴‍☠️' } } as never,
      { id: 'user-1', bot: false } as never,
      deps,
    );
    await handleTranslationReaction(
      { ...base, emoji: { name: '🇵🇹' } } as never,
      { id: 'bot', bot: true } as never,
      deps,
    );
    expect(translate).not.toHaveBeenCalled();
    db.close();
  });
});
