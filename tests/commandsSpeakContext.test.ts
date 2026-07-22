/**
 * Context-menu "Speak" (Wave 2·I): right-click on a message -> Apps -> Speak ->
 * Vozen reads that message with the clicker's voice (same pipeline as /tts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { messageText } from './messagePayload';

vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: () => ({}),
  getVoiceConnection: () => undefined,
}));

import { handleMessageContextMenu, commandDefs } from '../src/commands/index';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import { setGuildConfig } from '../src/store/guildConfig';

const GUILD = 'g-speak';

function makeDeps(
  db: Database.Database,
  say: ReturnType<typeof vi.fn>,
  withPlayer = true,
): BotDeps {
  const players = new Map<string, unknown>();
  if (withPlayer) players.set(GUILD, { say });
  return {
    client: { user: { id: 'bot-1' }, users: { cache: { get: () => undefined } } },
    db,
    players,
    limiters: new Map(),
    availableModels: ['en_US-amy-medium'],
    config: { defaultVoice: 'en_US-amy-medium', defaultSpeed: 1.0, messageLeadMs: 0 },
  } as unknown as BotDeps;
}

function makeInteraction(
  content: string,
  voice: { callerVoiceChannelId?: string; botVoiceChannelId?: string } = {},
) {
  const replies: string[] = [];
  const callerVoiceChannelId = voice.callerVoiceChannelId ?? 'vc-1';
  const botVoiceChannelId = voice.botVoiceChannelId ?? 'vc-1';
  return {
    commandName: 'Speak',
    guildId: GUILD,
    guild: {
      members: {
        cache: {
          get: (id: string) =>
            id === 'u-1'
              ? {
                  voice: { channelId: callerVoiceChannelId },
                  roles: { cache: new Map<string, unknown>() },
                }
              : undefined,
        },
        me: { voice: { channelId: botVoiceChannelId } },
      },
      channels: { cache: { get: () => undefined } },
    },
    user: { id: 'u-1' },
    locale: 'pt-BR',
    targetMessage: { content },
    replies,
    deferReply: async () => {},
    editReply: async (msg: unknown) => {
      replies.push(messageText(msg));
    },
  };
}

describe('context-menu "Speak"', () => {
  let db: Database.Database;
  let say: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    db = initDb(':memory:');
    say = vi.fn().mockResolvedValue(true);
    setGuildConfig(db, GUILD, { enabled: true });
  });
  afterEach(() => db.close());

  it('reads the target message with the user voice (player.say called)', async () => {
    const i = makeInteraction('olá pessoal isto é a mensagem');
    await handleMessageContextMenu(i as any, makeDeps(db, say));
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][0].text).toBe('olá pessoal isto é a mensagem');
  });

  it('message with no text -> warns, does not speak', async () => {
    const i = makeInteraction('   ');
    await handleMessageContextMenu(i as any, makeDeps(db, say));
    expect(say).not.toHaveBeenCalled();
    expect(i.replies.join('')).toMatch(/texto|read/i);
  });

  it('bot not in voice -> warns, does not speak', async () => {
    const i = makeInteraction('olá');
    await handleMessageContextMenu(i as any, makeDeps(db, say, false));
    expect(say).not.toHaveBeenCalled();
    expect(i.replies.length).toBe(1);
  });

  it('caller outside Vozen’s voice channel is not synthesized and receives the existing voice guidance', async () => {
    const i = makeInteraction('olá', {
      callerVoiceChannelId: 'vc-caller',
      botVoiceChannelId: 'vc-bot',
    });
    await handleMessageContextMenu(i as any, makeDeps(db, say));
    expect(say).not.toHaveBeenCalled();
    expect(i.replies.join('')).toMatch(/voice|call|voz|canal/i);
  });

  it('ignores other context-menu commands (name != Speak)', async () => {
    const i = makeInteraction('olá');
    (i as any).commandName = 'Outro';
    await handleMessageContextMenu(i as any, makeDeps(db, say));
    expect(say).not.toHaveBeenCalled();
  });

  it('is registered in commandDefs as a MESSAGE command (type 3)', () => {
    const def = commandDefs.find((c) => c.name === 'Speak');
    expect(def).toBeDefined();
    expect(def?.type).toBe(3); // ApplicationCommandType.Message
  });

  // Bug-hunt 2026-07: the context-menu handler is dispatched with `void ...` WITHOUT a
  // catch and had no try/catch of its own. A throw in speakRawText (e.g. player.say
  // rejects) left the user stuck in "Vozen is thinking…" forever + unhandledRejection.
  // Now it must catch the error and respond with the generic message.
  it('if synthesis/say throws, responds with error (not stuck in "thinking…") and does not reject', async () => {
    const boom = vi.fn().mockRejectedValue(new Error('synth boom'));
    // Interaction that records the defer/reply cycle to exercise the catch's editReply branch.
    const replies: string[] = [];
    const i = {
      commandName: 'Speak',
      guildId: GUILD,
      guild: {
        members: {
          cache: {
            get: (id: string) =>
              id === 'u-1'
                ? { voice: { channelId: 'vc-1' }, roles: { cache: new Map<string, unknown>() } }
                : undefined,
          },
          me: { voice: { channelId: 'vc-1' } },
        },
        channels: { cache: { get: () => undefined } },
      },
      user: { id: 'u-1' },
      locale: 'pt-BR',
      targetMessage: { content: 'lê isto por favor' },
      deferred: false,
      replied: false,
      isRepliable: () => true,
      deferReply: async function (this: { deferred: boolean }) {
        this.deferred = true;
      },
      editReply: async (msg: unknown) => {
        replies.push(messageText(msg));
      },
      reply: async (msg: unknown) => {
        replies.push(messageText(msg));
      },
    };

    // Must NOT reject (the catch swallows the error and responds).
    await expect(handleMessageContextMenu(i as any, makeDeps(db, boom))).resolves.toBeUndefined();
    expect(boom).toHaveBeenCalledTimes(1);
    // Received an error response (instead of being stuck).
    expect(replies.length).toBe(1);
    expect(replies[0]).toMatch(/erro|wrong|try/i);
  });
});
