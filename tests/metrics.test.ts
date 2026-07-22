// tests/metrics.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { messageText } from './messagePayload';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';

// @discordjs/voice mock needed to import player.ts and commands/index.ts
vi.mock('@discordjs/voice', async () => {
  const { EventEmitter: EE } = await import('node:events');
  const IDLE = 'idle';
  class FakeAudioPlayer extends EE {
    play(_resource: { path: string }): void {
      setTimeout(() => this.emit(IDLE), 0);
    }
    stop(): void {
      this.emit(IDLE);
    }
  }
  return {
    AudioPlayerStatus: { Idle: IDLE },
    VoiceConnectionStatus: {
      Disconnected: 'disconnected',
      Signalling: 'signalling',
      Connecting: 'connecting',
      Ready: 'ready',
    },
    StreamType: { Arbitrary: 'arbitrary' },
    createAudioPlayer: () => new FakeAudioPlayer(),
    createAudioResource: (path: string) => ({ path }),
    entersState: () => Promise.resolve(),
    joinVoiceChannel: () => ({}),
    getVoiceConnection: () => undefined,
  };
});

import { metrics } from '../src/metrics';
import { AudioCache } from '../src/tts/cache';
import type { TTSEngine, SynthRequest } from '../src/tts/engine';
import { GuildVoicePlayer } from '../src/voice/player';
import { handleInteraction } from '../src/commands/index';
import type { BotDeps } from '../src/bot/deps';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeConnection() {
  const conn = new EventEmitter() as EventEmitter & {
    subscribe: () => void;
    destroy: () => void;
    rejoin: () => void;
  };
  conn.subscribe = () => {};
  conn.destroy = () => {};
  conn.rejoin = () => {};
  return conn;
}

function makeStatsDeps(overrides: Partial<BotDeps> = {}): BotDeps {
  return {
    client: { user: { id: 'bot-1' }, guilds: { cache: { size: 3 } } },
    players: new Map(),
    db: {} as BotDeps['db'],
    config: {},
    availableModels: [],
    limiters: new Map(),
    engine: { synth: async () => '' },
    ...overrides,
  } as unknown as BotDeps;
}

interface FakeInteraction {
  commandName: string;
  guildId: string;
  locale?: string;
  replies: string[];
  reply: (opts: {
    content?: string;
    embeds?: { data?: { description?: string } }[];
    flags?: number;
  }) => Promise<void>;
  isRepliable: () => boolean;
  replied: boolean;
  deferred: boolean;
  member: unknown;
  guild: unknown;
  options: unknown;
  user: { id: string };
}

function makeStatsInteraction(isAdmin = true, locale?: string): FakeInteraction {
  const replies: string[] = [];
  return {
    commandName: 'stats',
    guildId: 'g-stats-test',
    locale,
    replies,
    replied: false,
    deferred: false,
    isRepliable: () => true,
    reply: async (o: { content?: string; embeds?: { data?: { description?: string } }[] }) => {
      // /stats moved to an embed — record the text OR the embed description.
      const fromEmbeds = (o.embeds ?? []).map((e) => e?.data?.description ?? '').join('\n');
      replies.push(messageText(o) || fromEmbeds);
    },
    member: {
      permissions: { has: () => isAdmin },
    },
    guild: null,
    options: {
      getSubcommandGroup: () => null,
      getSubcommand: () => '',
      getString: () => null,
      getBoolean: () => null,
      getInteger: () => null,
      getChannel: () => null,
      getRole: () => null,
    },
    user: { id: 'u1' },
  };
}

// ── 1. Metrics module: basic API ─────────────────────────────────────────

describe('metrics — basic API', () => {
  beforeEach(() => metrics.reset());

  it('starts at zero after reset()', () => {
    const snap = metrics.snapshot();
    expect(snap).toEqual({
      messagesSpoken: 0,
      cacheHits: 0,
      cacheMisses: 0,
      synthErrors: 0,
      messagesRateLimited: 0,
      voiceDrops: 0,
      voiceReconnects: 0,
      votes: 0,
      loopStalls: 0,
      synthCount: 0,
      synthP50Ms: 0,
      synthP95Ms: 0,
      gcloudSynths: 0,
      gcloudChars: 0,
      gcloudFallbacks: 0,
      sttOverloads: 0,
    });
  });

  it('recordSynthMs feeds synthCount + p50/p95; reset clears', () => {
    // Samples 10..100 (10 values). p50 -> idx floor(0.5*10)=5 -> 60; p95 -> idx 9 -> 100.
    for (let v = 10; v <= 100; v += 10) metrics.recordSynthMs(v);
    const snap = metrics.snapshot();
    expect(snap.synthCount).toBe(10);
    expect(snap.synthP50Ms).toBe(60);
    expect(snap.synthP95Ms).toBe(100);
    // Invalid values are ignored (do not count).
    metrics.recordSynthMs(-5);
    metrics.recordSynthMs(NaN);
    expect(metrics.snapshot().synthCount).toBe(10);
    metrics.reset();
    const z = metrics.snapshot();
    expect(z.synthCount).toBe(0);
    expect(z.synthP50Ms).toBe(0);
    expect(z.synthP95Ms).toBe(0);
  });

  it('inc("cacheHits") increments only cacheHits', () => {
    metrics.inc('cacheHits');
    metrics.inc('cacheHits');
    const snap = metrics.snapshot();
    expect(snap.cacheHits).toBe(2);
    expect(snap.cacheMisses).toBe(0);
    expect(snap.messagesSpoken).toBe(0);
    expect(snap.synthErrors).toBe(0);
  });

  it('inc("cacheMisses") increments only cacheMisses', () => {
    metrics.inc('cacheMisses');
    expect(metrics.snapshot().cacheMisses).toBe(1);
    expect(metrics.snapshot().cacheHits).toBe(0);
  });

  it('inc("messagesSpoken") increments only messagesSpoken', () => {
    metrics.inc('messagesSpoken');
    metrics.inc('messagesSpoken');
    metrics.inc('messagesSpoken');
    expect(metrics.snapshot().messagesSpoken).toBe(3);
  });

  it('inc("synthErrors") increments only synthErrors', () => {
    metrics.inc('synthErrors');
    expect(metrics.snapshot().synthErrors).toBe(1);
  });

  it('snapshot() returns a copy (not the internal reference)', () => {
    metrics.inc('cacheHits');
    const s1 = metrics.snapshot();
    metrics.inc('cacheHits');
    const s2 = metrics.snapshot();
    // s1 must not have been affected by the second inc
    expect(s1.cacheHits).toBe(1);
    expect(s2.cacheHits).toBe(2);
  });

  it('reset() sets all counters back to zero', () => {
    metrics.inc('cacheHits');
    metrics.inc('cacheMisses');
    metrics.inc('messagesSpoken');
    metrics.inc('synthErrors');
    metrics.inc('voiceDrops');
    metrics.inc('voiceReconnects');
    metrics.recordSynthMs(42);
    metrics.reset();
    expect(metrics.snapshot()).toEqual({
      messagesSpoken: 0,
      cacheHits: 0,
      cacheMisses: 0,
      synthErrors: 0,
      messagesRateLimited: 0,
      voiceDrops: 0,
      voiceReconnects: 0,
      votes: 0,
      loopStalls: 0,
      synthCount: 0,
      synthP50Ms: 0,
      synthP95Ms: 0,
      gcloudSynths: 0,
      gcloudChars: 0,
      gcloudFallbacks: 0,
      sttOverloads: 0,
    });
  });

  it('inc("voiceDrops") increments only voiceDrops', () => {
    metrics.inc('voiceDrops');
    metrics.inc('voiceDrops');
    const snap = metrics.snapshot();
    expect(snap.voiceDrops).toBe(2);
    expect(snap.voiceReconnects).toBe(0);
    expect(snap.messagesSpoken).toBe(0);
    expect(snap.synthErrors).toBe(0);
  });

  it('inc("voiceReconnects") increments only voiceReconnects', () => {
    metrics.inc('voiceReconnects');
    const snap = metrics.snapshot();
    expect(snap.voiceReconnects).toBe(1);
    expect(snap.voiceDrops).toBe(0);
  });
});

// ── 2. Wiring: AudioCache.get → cacheHits / cacheMisses ─────────────────────

describe('AudioCache.get — metrics wiring', () => {
  let dir: string;
  let srcDir: string;
  let cache: AudioCache;

  beforeEach(() => {
    metrics.reset();
    dir = mkdtempSync(join(tmpdir(), 'metrics-cache-'));
    srcDir = mkdtempSync(join(tmpdir(), 'metrics-src-'));
    cache = new AudioCache(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(srcDir, { recursive: true, force: true });
  });

  it('get on a nonexistent key increments cacheMisses', () => {
    cache.get('nao-existe');
    expect(metrics.snapshot().cacheMisses).toBe(1);
    expect(metrics.snapshot().cacheHits).toBe(0);
  });

  it('get on an existing key increments cacheHits', () => {
    const src = join(srcDir, 'out.wav');
    writeFileSync(src, Buffer.from('wav'));
    cache.put('chave', src);

    cache.get('chave');
    expect(metrics.snapshot().cacheHits).toBe(1);
    expect(metrics.snapshot().cacheMisses).toBe(0);
  });

  it('multiple gets accumulate correctly (mix of hit+miss)', () => {
    const src = join(srcDir, 'out.wav');
    writeFileSync(src, Buffer.from('wav'));
    cache.put('k', src);

    cache.get('k'); // hit
    cache.get('k'); // hit
    cache.get('miss1'); // miss
    cache.get('miss2'); // miss
    cache.get('miss3'); // miss

    const snap = metrics.snapshot();
    expect(snap.cacheHits).toBe(2);
    expect(snap.cacheMisses).toBe(3);
  });
});

// ── 3. Wiring: GuildVoicePlayer → messagesSpoken + synthErrors ───────────────

describe('GuildVoicePlayer — metrics wiring', () => {
  beforeEach(() => metrics.reset());

  it('messagesSpoken increments when audio starts playing', async () => {
    const engine: TTSEngine = {
      synth: async (req: SynthRequest) => req.text,
    };

    const conn = makeConnection() as any;
    const player = new GuildVoicePlayer(conn, engine, 20, () => {});

    await player.say({ text: 'ola', model: 'm', speed: 1 });

    await vi.waitFor(() => expect(metrics.snapshot().messagesSpoken).toBe(1), { timeout: 1000 });

    player.destroy();
    expect(metrics.snapshot().synthErrors).toBe(0);
  });

  it('synthErrors increments when synthesis fails', async () => {
    const engine: TTSEngine = {
      synth: async () => {
        throw new Error('piper boom');
      },
    };

    const conn = makeConnection() as any;
    const player = new GuildVoicePlayer(conn, engine, 20, () => {});

    await player.say({ text: 'texto', model: 'm', speed: 1 });

    await vi.waitFor(() => expect(metrics.snapshot().synthErrors).toBe(1), { timeout: 1000 });

    player.destroy();
    expect(metrics.snapshot().messagesSpoken).toBe(0);
  });

  it('synthErrors does not increment when synthesis succeeds', async () => {
    const engine: TTSEngine = {
      synth: async (req: SynthRequest) => req.text,
    };

    const conn = makeConnection() as any;
    const player = new GuildVoicePlayer(conn, engine, 20, () => {});

    await player.say({ text: 'teste', model: 'm', speed: 1 });

    await vi.waitFor(() => expect(metrics.snapshot().messagesSpoken).toBeGreaterThanOrEqual(1), {
      timeout: 1000,
    });

    player.destroy();
    expect(metrics.snapshot().synthErrors).toBe(0);
  });

  it('emits provider, latency, TTFA and queue-drop aggregates without content', async () => {
    const recorded: Array<{ metric: string; provider: string; value: number }> = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const engine: TTSEngine = {
      synth: async () => {
        await gate;
        return 'audio.wav';
      },
    };
    const player = new GuildVoicePlayer(
      makeConnection() as any,
      engine,
      1,
      () => {},
      (metric, provider, value) => recorded.push({ metric, provider, value }),
    );

    await player.say(
      { text: 'private words', model: 'm', speed: 1, engine: 'piper' },
      { authorId: 'private-id', source: 'command', now: Date.now() - 50 },
    );
    await player.say({ text: 'dropped words', model: 'm', speed: 1, engine: 'piper' });
    await player.say({ text: 'also dropped', model: 'm', speed: 1, engine: 'piper' });
    release();

    await vi.waitFor(() =>
      expect(recorded.some((entry) => entry.metric === 'synth_success')).toBe(true),
    );
    expect(recorded.some((entry) => entry.metric === 'queue_drop')).toBe(true);
    expect(recorded.some((entry) => entry.metric === 'synth_latency_ms')).toBe(true);
    expect(recorded.some((entry) => entry.metric === 'ttfa_ms' && entry.value >= 50)).toBe(true);
    expect(recorded.every((entry) => entry.provider === 'piper')).toBe(true);
    expect(JSON.stringify(recorded)).not.toContain('private words');
    expect(JSON.stringify(recorded)).not.toContain('private-id');
    player.destroy();
  });
});

// ── 3b. Wiring: GuildVoicePlayer → voiceDrops + voiceReconnects ───────────────
// The shared @discordjs/voice mock (top of the file) has
// entersState: () => Promise.resolve(), so the "soft" recovery in
// handleDisconnect always resolves: one drop episode = 1 drop + 1 reconnect.

describe('GuildVoicePlayer — reconnection wiring (voiceDrops/voiceReconnects)', () => {
  beforeEach(() => metrics.reset());

  it('one drop (Disconnected) -> voiceDrops goes up 1 and the recovery -> voiceReconnects goes up 1', async () => {
    const engine: TTSEngine = { synth: async (req: SynthRequest) => req.text };

    const conn = makeConnection() as any;
    const player = new GuildVoicePlayer(conn, engine, 20, () => {});

    // Emit the drop: handleDisconnect counts the drop and, since entersState always
    // resolves (mock), the "soft" recovery returns to Ready -> counts the reconnect.
    conn.emit('disconnected');

    await vi.waitFor(() => expect(metrics.snapshot().voiceReconnects).toBe(1), { timeout: 1000 });
    expect(metrics.snapshot().voiceDrops).toBe(1);

    player.destroy();
  });

  it('repeated Disconnected in the same episode does not double-count (dedup per episode)', async () => {
    const engine: TTSEngine = { synth: async (req: SynthRequest) => req.text };

    const conn = makeConnection() as any;
    const player = new GuildVoicePlayer(conn, engine, 20, () => {});

    // Two SYNCHRONOUS Disconnected events in the same episode: the first enters
    // handleDisconnect, sets reconnecting=true and counts the drop before the 1st await;
    // the second hits the guard (reconnecting) and returns immediately, without counting.
    conn.emit('disconnected');
    conn.emit('disconnected');

    await vi.waitFor(() => expect(metrics.snapshot().voiceReconnects).toBe(1), { timeout: 1000 });
    // Single episode: exactly 1 drop and 1 reconnect, despite the 2 events.
    expect(metrics.snapshot().voiceDrops).toBe(1);
    expect(metrics.snapshot().voiceReconnects).toBe(1);

    player.destroy();
  });
});

// ── 4. /stats via handleInteraction ──────────────────────────────────────────

describe('/stats — handleInteraction', () => {
  beforeEach(() => metrics.reset());

  it('responds with the counters and bot info', async () => {
    metrics.inc('messagesSpoken');
    metrics.inc('messagesSpoken');
    metrics.inc('cacheHits');
    metrics.inc('cacheMisses');
    metrics.inc('synthErrors');
    metrics.inc('voiceDrops');
    metrics.inc('voiceDrops');
    metrics.inc('voiceReconnects');
    metrics.inc('votes');
    metrics.inc('votes');
    metrics.inc('votes');

    const deps = makeStatsDeps({
      players: new Map([['g1', {} as BotDeps['players'] extends Map<string, infer V> ? V : never]]),
    });

    const i = makeStatsInteraction(true);
    await handleInteraction(i as unknown as import('discord.js').ChatInputCommandInteraction, deps);

    expect(i.replies).toHaveLength(1);
    const reply = i.replies[0];
    // Migrated PT->EN (P16.2): /stats renders via t() in English by default.
    expect(reply).toContain('Messages spoken: 2');
    expect(reply).toContain('Cache hits: 1');
    expect(reply).toContain('Cache misses: 1');
    expect(reply).toContain('Synthesis errors: 1');
    expect(reply).toContain('Voice drops: 2');
    expect(reply).toContain('Reconnects: 1');
    expect(reply).toContain('top.gg votes: 3');
    expect(reply).toContain('Active players: 1');
    expect(reply).toContain('Servers: 3');
    expect(reply).toContain('Uptime:');
  });

  it('uses the invoking user Discord locale instead of the guild locale', async () => {
    const i = makeStatsInteraction(true, 'fr');

    await handleInteraction(
      i as unknown as import('discord.js').ChatInputCommandInteraction,
      makeStatsDeps(),
    );

    expect(i.replies.join(' ')).toMatch(/Messages prononcés|Serveurs|Disponibilité/i);
    expect(i.replies.join(' ')).not.toMatch(/Messages spoken|Servers:/i);
  });

  it('shows zeros when no event has occurred yet', async () => {
    const deps = makeStatsDeps();
    const i = makeStatsInteraction(true);
    await handleInteraction(i as unknown as import('discord.js').ChatInputCommandInteraction, deps);

    const reply = i.replies[0];
    // Migrated PT->EN (P16.2): /stats renders via t() in English by default.
    expect(reply).toContain('Messages spoken: 0');
    expect(reply).toContain('Cache hits: 0');
    expect(reply).toContain('Cache misses: 0');
    expect(reply).toContain('Synthesis errors: 0');
    expect(reply).toContain('Voice drops: 0');
    expect(reply).toContain('Reconnects: 0');
    expect(reply).toContain('top.gg votes: 0');
    expect(reply).toContain('Active players: 0');
  });

  it('blocks users without ManageGuild', async () => {
    const deps = makeStatsDeps();
    const i = makeStatsInteraction(false); // not an admin
    await handleInteraction(i as unknown as import('discord.js').ChatInputCommandInteraction, deps);

    expect(i.replies).toHaveLength(1);
    // Migrated PT->EN: "You need the **Manage Server** permission to do that."
    expect(i.replies[0]).toMatch(/permission|Manage Server/i);
  });
});
