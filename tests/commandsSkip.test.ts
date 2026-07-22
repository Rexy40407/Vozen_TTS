import { describe, it, expect, vi } from 'vitest';
import { messageText } from './messagePayload';

// Mock minimo de @discordjs/voice — nao e usado no caminho do /skip (o player e
// injectado nas deps), mas o import de index.ts precisa de resolver.
vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: () => ({}),
  getVoiceConnection: () => undefined,
}));

import { handleInteraction } from '../src/commands/index';
import type { BotDeps } from '../src/bot/deps';

const GUILD = 'g-skip';

function makeDeps(player?: unknown): BotDeps {
  const deps = {
    players: new Map<string, unknown>(),
    db: {},
  } as unknown as BotDeps;
  if (player) {
    (deps.players as Map<string, unknown>).set(GUILD, player);
  }
  return deps;
}

function makeSkipInteraction() {
  const replies: string[] = [];
  return {
    commandName: 'skip',
    guildId: GUILD,
    replies,
    replied: false,
    deferred: false,
    isRepliable: () => true,
    reply: async (o: string | { content: string }) => {
      replies.push(messageText(o));
    },
  };
}

describe('/skip — distingue "nada a tocar" de "saltei" (P18.3)', () => {
  it('isActive()===false -> responde skip.nothing e NAO chama player.skip()', async () => {
    const skip = vi.fn();
    const player = { isActive: () => false, skip };
    const deps = makeDeps(player);
    const i = makeSkipInteraction();

    await handleInteraction(i as any, deps);

    // t('skip.nothing','en') = "Nothing is playing right now."
    expect(i.replies.some((r) => /nothing/i.test(r))).toBe(true);
    // NAO deve fingir que saltou.
    expect(i.replies.some((r) => /skipped/i.test(r))).toBe(false);
    // Ordem/honestidade: le isActive() ANTES e nao chama skip() quando nada esta activo.
    expect(skip).not.toHaveBeenCalled();
  });

  it('isActive()===true -> chama player.skip() e responde skip.skipped', async () => {
    const skip = vi.fn();
    const player = { isActive: () => true, skip };
    const deps = makeDeps(player);
    const i = makeSkipInteraction();

    await handleInteraction(i as any, deps);

    expect(skip).toHaveBeenCalledOnce();
    // t('skip.skipped','en') = "Skipped."
    expect(i.replies.some((r) => /skipped/i.test(r))).toBe(true);
    expect(i.replies.some((r) => /nothing/i.test(r))).toBe(false);
  });

  // Beginner-friendly: sem player (bot fora da voz) a mensagem GUIA a correr /join
  // em vez de so constatar "not in a voice channel".
  it('sem player responde uma mensagem que GUIA a correr /join', async () => {
    const deps = makeDeps(); // sem player
    const i = makeSkipInteraction();

    await handleInteraction(i as any, deps);

    const text = i.replies.join('\n');
    expect(text).toMatch(/\/join/);
    expect(text).toMatch(/voice channel/i);
  });
});
