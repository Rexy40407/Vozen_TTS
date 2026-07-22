import { describe, expect, it, vi } from 'vitest';
import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { handleQueue } from '../src/commands/handlers/queue';

function interaction(action: string, admin = true) {
  const replies: unknown[] = [];
  return {
    guildId: 'g',
    user: { id: 'u' },
    member: { permissions: new PermissionsBitField(admin ? PermissionFlagsBits.ManageGuild : 0n) },
    guild: {
      members: {
        me: { voice: { channelId: 'voice' } },
        cache: new Map([['u', { voice: { channelId: 'voice' } }]]),
      },
    },
    options: { getSubcommand: () => action, getString: () => 'opaque-id' },
    reply: vi.fn(async (payload) => replies.push(payload)),
    replies,
  };
}

function deps(player: Record<string, unknown>) {
  return { players: new Map([['g', player]]) } as any;
}

describe('/queue', () => {
  it('renders only public metadata, never queue text or author identity', async () => {
    const player = {
      queueSnapshot: () => [{ id: 'opaque-id', source: 'message', lane: 'standard', ageMs: 2500 }],
    };
    const i = interaction('show');
    await handleQueue(i as any, deps(player));
    expect(JSON.stringify(i.replies)).toContain('opaque-id');
    expect(JSON.stringify(i.replies)).toContain('- `opaque-id`');
    expect(JSON.stringify(i.replies)).not.toContain('secret text');
    expect(JSON.stringify(i.replies)).not.toContain('author-id');
  });

  it('lets a regular author remove only their opaque item', async () => {
    const player = {
      removeQueuedByAuthorId: vi.fn(() => true),
      removeQueuedById: vi.fn(() => true),
    };
    const i = interaction('remove', false);
    await handleQueue(i as any, deps(player));
    expect(player.removeQueuedByAuthorId).toHaveBeenCalledWith('u', 'opaque-id');
    expect(player.removeQueuedById).not.toHaveBeenCalled();
  });

  it('requires Manage Server and the same call for playback controls', async () => {
    const player = { pause: vi.fn(() => true), isActive: () => true, skip: vi.fn() };
    const notAdmin = interaction('pause', false);
    await handleQueue(notAdmin as any, deps(player));
    expect(player.pause).not.toHaveBeenCalled();

    const outOfCall = interaction('skip', true);
    outOfCall.guild.members.cache.set('u', { voice: { channelId: 'other' } });
    await handleQueue(outOfCall as any, deps(player));
    expect(player.skip).not.toHaveBeenCalled();
  });

  it('calls pause and resume only after the moderator and same-call gates', async () => {
    const player = { pause: vi.fn(() => true), resume: vi.fn(() => true) };
    await handleQueue(interaction('pause') as any, deps(player));
    await handleQueue(interaction('resume') as any, deps(player));
    expect(player.pause).toHaveBeenCalledOnce();
    expect(player.resume).toHaveBeenCalledOnce();
  });
});
