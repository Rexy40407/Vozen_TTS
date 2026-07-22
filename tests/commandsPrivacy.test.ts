// tests/commandsPrivacy.test.ts
import { describe, it, expect, vi } from 'vitest';
import { messageText } from './messagePayload';
import { handlePrivacy } from '../src/commands/handlers/privacy';
import { initDb } from '../src/store/db';
import type { BotDeps } from '../src/bot/deps';

function seedUserData(db: ReturnType<typeof initDb>, u: string): void {
  db.prepare('INSERT INTO user_voice (guild_id, user_id, voice_model, speed) VALUES (?,?,?,?)').run(
    'G',
    u,
    'en_US-amy-medium',
    1,
  );
  db.prepare('INSERT INTO talk_stats (guild_id, user_id) VALUES (?,?)').run('G', u);
  db.prepare('INSERT INTO user_abbreviation (user_id, term, replacement) VALUES (?,?,?)').run(
    u,
    'idk',
    'i dont know',
  );
}

function fakeInteraction(opts: { awaitResult: unknown; update?: () => Promise<void> }): {
  interaction: Record<string, unknown>;
  editReply: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
} {
  const update = vi.fn().mockResolvedValue(undefined);
  const editReply = vi.fn().mockResolvedValue(undefined);
  const response = {
    awaitMessageComponent: () =>
      opts.awaitResult instanceof Error
        ? Promise.reject(opts.awaitResult)
        : Promise.resolve(opts.awaitResult),
  };
  const interaction = {
    options: { getSubcommand: () => 'erase' },
    user: { id: 'U' },
    guildId: 'G',
    locale: 'en',
    reply: vi.fn().mockResolvedValue(response),
    editReply,
  };
  return { interaction, editReply, update };
}

describe('/privacy erase', () => {
  it('cancela (timeout do botão) sem apagar nada', async () => {
    const db = initDb(':memory:');
    try {
      seedUserData(db, 'U');
      const { interaction, editReply } = fakeInteraction({ awaitResult: new Error('timeout') });
      await handlePrivacy(interaction as never, { db } as BotDeps);

      // Nada apagado.
      expect(db.prepare("SELECT COUNT(*) AS n FROM user_voice WHERE user_id='U'").get()).toEqual({
        n: 1,
      });
      // Mostrou a mensagem de cancelamento.
      expect(editReply).toHaveBeenCalledOnce();
      expect(messageText(editReply.mock.calls[0][0])).toMatch(/Cancel/i);
    } finally {
      db.close();
    }
  });

  it('confirma (botão "Apagar tudo") e apaga todos os dados do utilizador', async () => {
    const db = initDb(':memory:');
    try {
      seedUserData(db, 'U');
      const update = vi.fn().mockResolvedValue(undefined);
      const { interaction } = fakeInteraction({
        awaitResult: { customId: 'privEraseYes', update },
      });
      await handlePrivacy(interaction as never, { db } as BotDeps);

      // Dados apagados.
      expect(db.prepare("SELECT COUNT(*) AS n FROM user_voice WHERE user_id='U'").get()).toEqual({
        n: 0,
      });
      expect(db.prepare("SELECT COUNT(*) AS n FROM talk_stats WHERE user_id='U'").get()).toEqual({
        n: 0,
      });
      expect(
        db.prepare("SELECT COUNT(*) AS n FROM user_abbreviation WHERE user_id='U'").get(),
      ).toEqual({ n: 0 });
      // Confirmou ao utilizador.
      expect(update).toHaveBeenCalledOnce();
    } finally {
      db.close();
    }
  });
});
