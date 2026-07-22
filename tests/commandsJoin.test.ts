import { describe, it, expect, vi, beforeEach } from 'vitest';
import { messageText } from './messagePayload';
import { ComponentType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { COLORS } from '../src/ui/theme';

// Mock de @discordjs/voice: joinVoiceChannel/getVoiceConnection sao spies para
// podermos afirmar que NAO se tenta ligar quando faltam permissoes.
const joinVoiceChannel = vi.fn();
const getVoiceConnection = vi.fn();
vi.mock('@discordjs/voice', async () => {
  const { EventEmitter } = await import('node:events');
  // AudioPlayer falso (so o necessario para o construtor do GuildVoicePlayer real).
  class FakeAudioPlayer extends EventEmitter {
    play(): void {}
    stop(): void {}
  }
  return {
    joinVoiceChannel: (...args: unknown[]) => joinVoiceChannel(...args),
    getVoiceConnection: (...args: unknown[]) => getVoiceConnection(...args),
    createAudioPlayer: () => new FakeAudioPlayer(),
    createAudioResource: (path: string) => ({ path }),
    entersState: () => Promise.resolve(),
    AudioPlayerStatus: { Idle: 'idle' },
    VoiceConnectionStatus: {
      Disconnected: 'disconnected',
      Signalling: 'signalling',
      Connecting: 'connecting',
      Ready: 'ready',
    },
    StreamType: { Arbitrary: 'arbitrary' },
  };
});

import { handleInteraction } from '../src/commands/index';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import { setGuildConfig } from '../src/store/guildConfig';

interface FakeInteraction {
  commandName: string;
  guildId: string;
  locale?: string;
  replies: string[];
  rawReplies: unknown[];
  reply: (opts: unknown) => Promise<void>;
  isRepliable: () => boolean;
  replied: boolean;
  deferred: boolean;
  member: unknown;
  guild: unknown;
}

function makeJoinInteraction(opts: { channel: unknown; locale?: string }): FakeInteraction {
  const replies: string[] = [];
  const rawReplies: unknown[] = [];
  return {
    commandName: 'join',
    guildId: 'g1',
    locale: opts.locale,
    replies,
    rawReplies,
    replied: false,
    deferred: false,
    isRepliable: () => true,
    reply: async (o: unknown) => {
      rawReplies.push(o);
      replies.push(messageText(o));
    },
    member: { voice: { channel: opts.channel } },
    guild: { voiceAdapterCreator: {} },
  };
}

function makeDeps(): BotDeps {
  // Apenas os campos que handleJoin toca; o resto fica como stub minimo.
  // Real in-memory DB: handleJoin now reads getGuildConfig(deps.db) to decide
  // whether auto-read is configured (which changes the /join success message).
  return {
    client: { user: { id: 'bot-1' } },
    players: new Map(),
    config: { queueCap: 10 },
    db: initDb(':memory:'),
  } as unknown as BotDeps;
}

describe('handleJoin — permissoes Connect/Speak', () => {
  beforeEach(() => {
    joinVoiceChannel.mockReset();
    getVoiceConnection.mockReset();
  });

  it('responde com mensagem clara e NAO liga quando faltam Connect/Speak', async () => {
    const channel = {
      id: 'c1',
      name: 'Geral',
      permissionsFor: () => ({ has: () => false }),
    };
    const i = makeJoinInteraction({ channel, locale: 'pt-BR' });
    const deps = makeDeps();

    await handleInteraction(i as any, deps);

    expect(joinVoiceChannel).not.toHaveBeenCalled();
    expect(i.replies.some((r) => /permiss/i.test(r))).toBe(true);
    expect(i.replies.join(' ')).toContain('Geral');
  });

  it('liga quando tem Connect e Speak', async () => {
    const channel = {
      id: 'c1',
      name: 'Geral',
      permissionsFor: () => ({
        has: (flag: bigint) =>
          flag === PermissionFlagsBits.Connect || flag === PermissionFlagsBits.Speak,
      }),
    };
    const i = makeJoinInteraction({ channel, locale: 'pt-BR' });
    const deps = makeDeps();
    // Conexao falsa devolvida por joinVoiceChannel — so precisa de subscribe/on/destroy
    // porque o GuildVoicePlayer real e construido no handler.
    const fakeConn = {
      subscribe: () => {},
      on: () => {},
      destroy: () => {},
    };
    joinVoiceChannel.mockReturnValue(fakeConn);

    await handleInteraction(i as any, deps);

    expect(joinVoiceChannel).toHaveBeenCalledTimes(1);
    // The public success message follows the invoking user's Discord locale, not
    // the guild fallback. This is the exact regression reported from production.
    expect(i.replies.some((r) => /Geral/.test(r))).toBe(true);
    // A mensagem NAO deve prometer auto-leitura (so /setup a liga). Tem de sugerir
    // /setup (para auto-ler um canal) e /tts (para falar ja) — sem enganar o iniciante.
    const joinedText = i.replies.join(' ');
    expect(joinedText).toContain('/setup');
    expect(joinedText).toContain('/tts');
    expect(joinedText).toMatch(/Entrei|Próximo passo|diz/i);
    expect(joinedText).not.toMatch(/I'm in|Next step/i);

    // Regression guard for the screenshot that prompted the redesign: /join must render
    // as a green-accent Components V2 card, never regress to a loose one-line reply.
    const payload = i.rawReplies[0] as {
      flags?: unknown;
      components?: Array<{ toJSON?: () => { type?: number; accent_color?: number } }>;
    };
    expect(Number(payload.flags) & MessageFlags.IsComponentsV2).toBeTruthy();
    const container = payload.components?.[0]?.toJSON?.();
    expect(container).toMatchObject({
      type: ComponentType.Container,
      accent_color: COLORS.success,
    });

    // Limpeza: destruir o player criado para nao deixar timers pendurados.
    const player = deps.players.get('g1');
    player?.destroy();
  });

  it('quando o auto-read JA esta configurado, aponta para o canal e NAO menciona /tts', async () => {
    // Production feedback: on a server that already ran /setup, the bot reads on its
    // own, so telling the user to "say /tts hello" is wrong. The /join success must be
    // state-aware: configured -> "type in the channel and I read it out loud", no /tts.
    const channel = {
      id: 'c1',
      name: 'Geral',
      permissionsFor: () => ({
        has: (flag: bigint) =>
          flag === PermissionFlagsBits.Connect || flag === PermissionFlagsBits.Speak,
      }),
    };
    const i = makeJoinInteraction({ channel, locale: 'pt-BR' });
    const deps = makeDeps();
    // Auto-read ON + a configured read channel -> the "configured" branch.
    setGuildConfig(deps.db, 'g1', { ttsChannelId: 'read-1', autoread: true });
    const fakeConn = { subscribe: () => {}, on: () => {}, destroy: () => {} };
    joinVoiceChannel.mockReturnValue(fakeConn);

    await handleInteraction(i as any, deps);

    const joinedText = i.replies.join(' ');
    // Still confirms the voice channel it joined.
    expect(joinedText).toContain('Geral');
    // Points at the configured read channel (clickable mention) and describes auto-reading.
    expect(joinedText).toContain('<#read-1>');
    expect(joinedText).toMatch(/voz alta/i);
    // The whole point: it must NOT push /tts when the bot already reads on its own.
    expect(joinedText).not.toContain('/tts');

    // Still a green success card (no regression to a loose reply).
    const payload = i.rawReplies[0] as {
      flags?: unknown;
      components?: Array<{ toJSON?: () => { type?: number; accent_color?: number } }>;
    };
    expect(Number(payload.flags) & MessageFlags.IsComponentsV2).toBeTruthy();
    expect(payload.components?.[0]?.toJSON?.()).toMatchObject({
      type: ComponentType.Container,
      accent_color: COLORS.success,
    });

    deps.players.get('g1')?.destroy();
  });

  it('responde "Tens de estar num canal" quando o membro nao esta em voz', async () => {
    const i = makeJoinInteraction({ channel: null });
    const deps = makeDeps();

    await handleInteraction(i as any, deps);

    expect(joinVoiceChannel).not.toHaveBeenCalled();
    // Migrado PT->EN (P16.2): "Hop into a voice channel first, then run /join."
    expect(i.replies.some((r) => /voice channel/i.test(r))).toBe(true);
  });

  it('uses French when the invoking Discord client locale is French', async () => {
    const i = makeJoinInteraction({ channel: null, locale: 'fr' });

    await handleInteraction(i as any, makeDeps());

    expect(i.replies.join(' ')).toMatch(/salon vocal/i);
    expect(i.replies.join(' ')).not.toMatch(/voice channel/i);
  });
});
