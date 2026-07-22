import { describe, it, expect, vi } from 'vitest';

// Mock minimo de @discordjs/voice (handleInteraction importa o modulo de comandos,
// que importa @discordjs/voice no topo). Nenhuma destas funcoes e chamada no caminho
// de erro do /tts, mas o import precisa de resolver.
vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: () => ({}),
  getVoiceConnection: () => undefined,
}));

import { handleInteraction } from '../src/commands/index';
import type { BotDeps } from '../src/bot/deps';
import { messageText } from './messagePayload';

describe('handleInteraction — catch com interacao deferida', () => {
  it('usa editReply (nao reply) quando o /tts ja foi deferido e ocorre um erro', async () => {
    const calls: string[] = [];
    const i = {
      commandName: 'tts',
      guildId: 'g1',
      deferred: false,
      replied: false,
      isRepliable: () => true,
      deferReply: vi.fn(async () => {
        i.deferred = true;
      }),
      // Forca o erro DEPOIS do defer: getString rebenta dentro de handleTts.
      options: {
        getString: () => {
          throw new Error('boom apos defer');
        },
      },
      reply: vi.fn(async () => {
        calls.push('reply');
      }),
      editReply: vi.fn(async () => {
        calls.push('editReply');
      }),
    };

    // Player existe para passar o guard `if (!player)` e chegar ao getString.
    const deps = {
      players: new Map([['g1', {}]]),
      db: {},
    } as unknown as BotDeps;

    await handleInteraction(i as any, deps);

    expect(i.deferReply).toHaveBeenCalled();
    expect(i.editReply).toHaveBeenCalledTimes(1);
    expect(i.reply).not.toHaveBeenCalled();
    expect(calls).toEqual(['editReply']);
  });

  it('usa reply quando a interacao NAO foi deferida e ocorre um erro', async () => {
    const calls: string[] = [];
    const replies: string[] = [];
    const i = {
      commandName: 'skip',
      guildId: 'g1',
      locale: 'pt-BR',
      deferred: false,
      replied: false,
      isRepliable: () => true,
      reply: vi.fn(async (payload: unknown) => {
        calls.push('reply');
        replies.push(messageText(payload));
        i.replied = true;
      }),
      editReply: vi.fn(async () => {
        calls.push('editReply');
      }),
    };

    // getPlayer lanca -> cai no catch SEM defer (skip nao defere).
    const deps = {
      players: {
        get: () => {
          throw new Error('boom sem defer');
        },
      },
    } as unknown as BotDeps;

    await handleInteraction(i as any, deps);

    expect(i.reply).toHaveBeenCalledTimes(1);
    expect(i.editReply).not.toHaveBeenCalled();
    expect(calls).toEqual(['reply']);
    expect(replies.join(' ')).toMatch(/ocorreu um erro|tenta outra vez/i);
    expect(replies.join(' ')).not.toMatch(/something went wrong/i);
  });
});
