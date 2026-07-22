import { describe, it, expect, vi } from 'vitest';
import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { messageText } from './messagePayload';

// Minimal mock of @discordjs/voice — /invite doesn't touch voice, but the commands
// module imports it at the top, so the import needs to resolve.
vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: () => ({}),
  getVoiceConnection: () => undefined,
}));

import { handleInteraction, commandDefs } from '../src/commands/index';
import type { BotDeps } from '../src/bot/deps';

const GUILD = 'g-invite-test';

// The "true" permissions value, recomputed HERE from the 5 named bits
// (NOT imported from the implementation, NOT a loose literal). If the
// implementation drops a bit, this value diverges and test (c) fails —
// that is exactly the guard the contract asks for.
const EXPECTED_PERMISSIONS = new PermissionsBitField([
  PermissionFlagsBits.Connect,
  PermissionFlagsBits.Speak,
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.EmbedLinks,
  // Game threads (/game): create/write/delete the disposable per-match thread.
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.ManageThreads,
]).bitfield.toString();

interface FakeInteraction {
  commandName: string;
  guildId: string;
  replies: string[];
  reply: (opts: { content: string; flags?: number }) => Promise<void>;
  isRepliable: () => boolean;
  replied: boolean;
  deferred: boolean;
}

function makeInviteInteraction(): FakeInteraction {
  const replies: string[] = [];
  return {
    commandName: 'invite',
    guildId: GUILD,
    replies,
    replied: false,
    deferred: false,
    isRepliable: () => true,
    reply: async (o: unknown) => {
      replies.push(messageText(o));
    },
  };
}

// deps with a clientId present (happy path)
function makeDeps(clientId: string | undefined): BotDeps {
  return {
    client: { user: { id: 'bot-1' } },
    players: new Map(),
    config: clientId === undefined ? {} : { clientId },
    availableModels: [],
  } as unknown as BotDeps;
}

const CLIENT_ID = '123456789012345678';

describe('/invite — generates the OAuth2 invite link', () => {
  it('(a) the reply contains the expected CLIENT_ID', async () => {
    const i = makeInviteInteraction();
    await handleInteraction(i as any, makeDeps(CLIENT_ID));
    const text = i.replies.join('\n');
    expect(text).toContain(`client_id=${CLIENT_ID}`);
  });

  it('(b) contains the bot and applications.commands scopes', async () => {
    const i = makeInviteInteraction();
    await handleInteraction(i as any, makeDeps(CLIENT_ID));
    const text = i.replies.join('\n');
    // The scope travels as "bot applications.commands"; the space may be
    // encoded (+/%20) depending on how the URL is built, so we assert each
    // token independently instead of a literal with a raw space.
    expect(text).toMatch(/scope=/);
    expect(text).toContain('bot');
    expect(text).toContain('applications.commands');
  });

  it('(c) permissions matches the integer derived from the INVITE_PERMISSIONS bits', async () => {
    const i = makeInviteInteraction();
    await handleInteraction(i as any, makeDeps(CLIENT_ID));
    const text = i.replies.join('\n');
    expect(text).toContain(`permissions=${EXPECTED_PERMISSIONS}`);
  });

  it('and the URL is the Discord oauth2/authorize endpoint', async () => {
    const i = makeInviteInteraction();
    await handleInteraction(i as any, makeDeps(CLIENT_ID));
    const text = i.replies.join('\n');
    expect(text).toContain('https://discord.com/oauth2/authorize');
    // brand message
    expect(text).toMatch(/Vozen/);
  });

  it('(d) missing CLIENT_ID → clear message, no broken link', async () => {
    const i = makeInviteInteraction();
    await handleInteraction(i as any, makeDeps(undefined));
    const text = i.replies.join('\n');
    expect(i.replies.length).toBeGreaterThan(0);
    // clear message (not a broken link)
    expect(text).not.toContain('discord.com/oauth2');
    expect(text).not.toContain('client_id=');
    // explains that configuration is missing
    expect(text).toMatch(/nao.*configurad|configurad.*nao|indisponivel|CLIENT_ID/i);
  });
});

describe('/invite — command definition', () => {
  it('is registered in commandDefs as a top-level command (NOT admin-only)', () => {
    const def = commandDefs.find((c) => c.name === 'invite');
    expect(def).toBeDefined();
    // top-level, any user: no permission restriction by default
    expect(def?.default_member_permissions ?? undefined).toBeUndefined();
  });
});
