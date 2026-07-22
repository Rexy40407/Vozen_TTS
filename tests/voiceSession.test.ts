// tests/voiceSession.test.ts — the IDENTITY-AWARE onIdle guard in createVoiceSession.
//
// Scenario (a variant of P19.B at the createVoiceSession level): when a player is
// REPLACED (a new /join or autojoin in the same guild), the OLD player's onIdle can
// fire late. That stale callback must NOT take down the NEW player. The guard is the
// line `if (deps.players.get(guildId) !== player) return;`. No test exercised the
// REAL closure built here (one mocked the whole module, another tested a replica).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChannelType } from 'discord.js';

// Mock of @discordjs/voice — only what session.ts calls at runtime.
const h = vi.hoisted(() => ({
  joinVoiceChannel: vi.fn((_opts: unknown) => ({ fake: 'connection' })),
  connDestroy: vi.fn(),
}));
vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: (opts: unknown) => h.joinVoiceChannel(opts),
  getVoiceConnection: () => ({ destroy: h.connDestroy }),
}));

// Fake GuildVoicePlayer that CAPTURES the onIdle (5th ctor arg) and exposes destroy.
const captured = vi.hoisted(() => ({
  players: [] as Array<{ onIdle: () => void; destroy: ReturnType<typeof vi.fn> }>,
}));
vi.mock('../src/voice/player', () => ({
  GuildVoicePlayer: class {
    onIdle: () => void;
    destroy = vi.fn();
    constructor(_conn: unknown, _engine: unknown, _cap: number, onIdle: () => void) {
      this.onIdle = onIdle;
      captured.players.push(
        this as unknown as { onIdle: () => void; destroy: ReturnType<typeof vi.fn> },
      );
    }
  },
}));

import { createVoiceSession, becomeSpeakerIfStage } from '../src/voice/session';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import { listVoicePresence } from '../src/store/voicePresence';

function makeDeps(): BotDeps {
  return {
    players: new Map(),
    engine: {},
    config: { queueCap: 20 },
  } as unknown as BotDeps;
}

describe('createVoiceSession — identity-aware onIdle guard', () => {
  beforeEach(() => {
    captured.players.length = 0;
    h.joinVoiceChannel.mockClear();
    h.connDestroy.mockClear();
  });

  it('(a) normal idle: removes the player and destroys the connection', () => {
    const deps = makeDeps();
    const player = createVoiceSession(deps, 'G', 'C', {} as never) as unknown as {
      onIdle: () => void;
      destroy: ReturnType<typeof vi.fn>;
    };
    expect(deps.players.get('G')).toBe(player);
    expect(h.joinVoiceChannel).toHaveBeenCalledWith({
      channelId: 'C',
      guildId: 'G',
      adapterCreator: {},
      selfDeaf: true,
      selfMute: false,
    });
    player.onIdle();
    expect(deps.players.has('G')).toBe(false);
    expect(player.destroy).toHaveBeenCalled();
    expect(h.connDestroy).toHaveBeenCalledTimes(1);
  });

  it("(b) REGRESSION: the OLD player's onIdle does not take down the REPLACEMENT", () => {
    const deps = makeDeps();
    const a = createVoiceSession(deps, 'G', 'C1', {} as never) as unknown as {
      onIdle: () => void;
      destroy: ReturnType<typeof vi.fn>;
    };
    const b = createVoiceSession(deps, 'G', 'C2', {} as never) as unknown as {
      onIdle: () => void;
      destroy: ReturnType<typeof vi.fn>;
    };
    expect(deps.players.get('G')).toBe(b);
    h.connDestroy.mockClear(); // isolates the stale callback (the replace already called removePlayer)
    // Fires A's STALE closure:
    a.onIdle();
    // The guard held: B stays registered and intact.
    expect(deps.players.get('G')).toBe(b);
    expect(b.destroy).not.toHaveBeenCalled();
    expect(h.connDestroy).not.toHaveBeenCalled();
  });

  it('(c) becomeSpeakerIfStage is a no-op in a NORMAL voice channel (non-stage)', () => {
    const setSuppressed = vi.fn();
    const channel = {
      type: ChannelType.GuildVoice,
      guild: { members: { me: { voice: { setSuppressed } } } },
    } as never;
    expect(() => becomeSpeakerIfStage(channel)).not.toThrow();
    expect(setSuppressed).not.toHaveBeenCalled();
  });

  it('(d) records every live call and clears it on a normal exit', () => {
    const db = initDb(':memory:');
    try {
      const deps = { ...makeDeps(), db };
      const player = createVoiceSession(deps, 'G', 'C', {} as never) as unknown as {
        onIdle: () => void;
      };

      expect(listVoicePresence(db)).toHaveLength(1);
      expect(listVoicePresence(db)[0]).toMatchObject({ guildId: 'G', channelId: 'C' });

      player.onIdle();
      expect(listVoicePresence(db)).toEqual([]);
    } finally {
      db.close();
    }
  });
});
