import { describe, it, expect, vi } from 'vitest';
import { messageText } from './messagePayload';

// Mock minimo de @discordjs/voice — nao e usado no caminho do /shut-up (o player e
// injectado nas deps), mas o import de index.ts precisa de resolver.
vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: () => ({}),
  getVoiceConnection: () => undefined,
}));

import { handleInteraction } from '../src/commands/index';
import type { BotDeps } from '../src/bot/deps';

const GUILD = 'g-shutup';

function makeDeps(player?: unknown): BotDeps {
  const deps = { players: new Map<string, unknown>(), db: {} } as unknown as BotDeps;
  if (player) (deps.players as Map<string, unknown>).set(GUILD, player);
  return deps;
}

function makeShutupInteraction() {
  const replies: string[] = [];
  return {
    commandName: 'shut-up',
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

describe('/shut-up — cala tudo, distingue "nada a tocar" de "calei"', () => {
  it('sem player -> shutup.notInVoice, nunca chama silence()', async () => {
    const i = makeShutupInteraction();

    await handleInteraction(i as any, makeDeps());
    expect(i.replies.some((r) => /voice channel/i.test(r))).toBe(true);
  });

  it('isActive()===false -> shutup.nothing e NAO chama silence()', async () => {
    const silence = vi.fn();
    const player = { isActive: () => false, silence };
    const i = makeShutupInteraction();

    await handleInteraction(i as any, makeDeps(player));
    expect(i.replies.some((r) => /nothing/i.test(r))).toBe(true);
    expect(silence).not.toHaveBeenCalled();
  });

  it('isActive()===true -> chama player.silence() e confirma', async () => {
    const silence = vi.fn();
    const player = { isActive: () => true, silence };
    const i = makeShutupInteraction();

    await handleInteraction(i as any, makeDeps(player));
    expect(silence).toHaveBeenCalledTimes(1);
    // t('shutup.done','en') tem o emoji 🤐 e "cleared".
    expect(i.replies.some((r) => /cleared|stop/i.test(r))).toBe(true);
  });
});
