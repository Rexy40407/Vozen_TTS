import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// --- @discordjs/voice mock ----------------------------------------------------
// A fake AudioPlayer (EventEmitter) whose play() records the resource played and
// schedules the Idle emission to drain the next queue item, mimicking the real
// cycle (play -> finish -> Idle -> playNext). createAudioResource returns the
// path itself so we can read the playback identity/order.
// NOTE: vi.mock is hoisted to the top of the file, so the factory CANNOT
// reference top-level variables — everything it needs lives in here.
vi.mock('@discordjs/voice', async () => {
  const { EventEmitter: EE } = await import('node:events');
  const IDLE = 'idle';
  class FakeAudioPlayer extends EE {
    play(resource: { path: string }): void {
      // Records the real playback order.
      (globalThis as Record<string, unknown>).__playOrder ??= [];
      ((globalThis as Record<string, unknown>).__playOrder as string[]).push(resource.path);
      // Ends the "audio" on the next tick -> fires the player's Idle handler,
      // which calls playNext() to drain the next item.
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
  };
});

import { GuildVoicePlayer } from '../src/voice/player';
import type { TTSEngine, SynthRequest } from '../src/tts/engine';

function makeConnection() {
  const conn = new EventEmitter() as EventEmitter & {
    subscribe: () => void;
    destroy: () => void;
  };
  conn.subscribe = () => {};
  conn.destroy = () => {};
  return conn;
}

describe('GuildVoicePlayer FIFO (synth in the worker)', () => {
  it('plays in say() arrival order, not in synthesis completion order', async () => {
    (globalThis as Record<string, unknown>).__playOrder = [];

    // Fake engine: the FIRST request takes LONGER to synthesize than the second.
    // If synthesis happened before enqueue (bug), 'segundo' would enqueue
    // first and play ahead. With synth-in-the-worker, the order is preserved.
    const delays: Record<string, number> = { primeiro: 40, segundo: 5, terceiro: 5 };
    const engine: TTSEngine = {
      synth: (req: SynthRequest) =>
        new Promise((resolve) => setTimeout(() => resolve(req.text), delays[req.text] ?? 0)),
    };

    const conn = makeConnection() as any;
    const player = new GuildVoicePlayer(conn, engine, 20, () => {});

    // Three CONCURRENT say() calls, in call order: primeiro, segundo, terceiro.
    // We do NOT await individually — they fire almost simultaneously, like real
    // concurrent messages. In the old bug (synth BEFORE enqueue) the request with
    // faster synthesis ('segundo') would enqueue ahead of 'primeiro' (slower) and
    // play out of order. With synth-in-the-worker, the enqueue is synchronous in
    // call order and the order is preserved.
    const pending = [
      player.say({ text: 'primeiro', model: 'm', speed: 1 }),
      player.say({ text: 'segundo', model: 'm', speed: 1 }),
      player.say({ text: 'terceiro', model: 'm', speed: 1 }),
    ];
    await Promise.all(pending);

    // Wait for the queue to drain completely.
    await vi.waitFor(
      () => {
        const order = (globalThis as Record<string, unknown>).__playOrder as string[];
        expect(order).toHaveLength(3);
      },
      { timeout: 1000 },
    );

    const order = (globalThis as Record<string, unknown>).__playOrder as string[];
    // The proof: playback order == say() order, even though 'primeiro' has the
    // slower synthesis.
    expect(order).toEqual(['primeiro', 'segundo', 'terceiro']);

    player.destroy();
  });

  it('skips an item whose synthesis rejects and continues the queue (without stalling or unhandledRejection)', async () => {
    (globalThis as Record<string, unknown>).__playOrder = [];

    // Fake engine: the 1st request REJECTS synthesis, the 2nd resolves normally.
    // If the error stalled the queue (bug), the 2nd would never play. With the
    // worker's skip, the 1st is skipped and the 2nd plays — the proof is __playOrder === ['ok'].
    const engine: TTSEngine = {
      synth: (req: SynthRequest) =>
        req.text === 'falha' ? Promise.reject(new Error('synth boom')) : Promise.resolve(req.text),
    };

    // Captures unhandledRejection during the test — none should occur:
    // playNext's catch handles the rejection.
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);

    const conn = makeConnection() as any;
    const player = new GuildVoicePlayer(conn, engine, 20, () => {});

    await Promise.all([
      player.say({ text: 'falha', model: 'm', speed: 1 }),
      player.say({ text: 'ok', model: 'm', speed: 1 }),
    ]);

    await vi.waitFor(
      () => {
        const order = (globalThis as Record<string, unknown>).__playOrder as string[];
        expect(order).toHaveLength(1);
      },
      { timeout: 1000 },
    );

    // Give an extra event-loop turn to catch any late rejection.
    await new Promise((r) => setTimeout(r, 0));
    process.off('unhandledRejection', onUnhandled);

    const order = (globalThis as Record<string, unknown>).__playOrder as string[];
    // The failed item was skipped; the next one played — the queue did not stall.
    expect(order).toEqual(['ok']);
    expect(unhandled).toEqual([]);

    player.destroy();
  });

  it('assetPath plays the file DIRECTLY (/rizz sound effect), without calling engine.synth', async () => {
    (globalThis as Record<string, unknown>).__playOrder = [];
    const dir = mkdtempSync(join(tmpdir(), 'player-asset-'));
    const asset = join(dir, 'sfx.wav');
    writeFileSync(asset, 'RIFFfake-wav');

    // Spy engine: must NOT be called for the asset item (only for 'normal').
    const synth = vi.fn((req: SynthRequest) => Promise.resolve(req.text));
    const engine: TTSEngine = { synth };
    const conn = makeConnection() as any;
    const player = new GuildVoicePlayer(conn, engine, 20, () => {});

    await Promise.all([
      player.say({ text: 'normal', model: 'm', speed: 1 }),
      player.say({ text: '', model: 'm', speed: 1, assetPath: asset }),
    ]);

    await vi.waitFor(
      () => {
        const order = (globalThis as Record<string, unknown>).__playOrder as string[];
        expect(order).toHaveLength(2);
      },
      { timeout: 1000 },
    );

    const order = (globalThis as Record<string, unknown>).__playOrder as string[];
    // The asset played via the DIRECT path; the engine only synthesized the 'normal' item.
    expect(order).toEqual(['normal', asset]);
    expect(synth).toHaveBeenCalledTimes(1);
    expect(synth.mock.calls[0][0].text).toBe('normal');

    player.destroy();
    rmSync(dir, { recursive: true, force: true });
  });

  it('nonexistent assetPath is skipped (does not crash, drains the next one)', async () => {
    (globalThis as Record<string, unknown>).__playOrder = [];
    const engine: TTSEngine = { synth: (req: SynthRequest) => Promise.resolve(req.text) };
    const conn = makeConnection() as any;
    const player = new GuildVoicePlayer(conn, engine, 20, () => {});

    await Promise.all([
      player.say({ text: '', model: 'm', speed: 1, assetPath: '/nao/existe/rizz.wav' }),
      player.say({ text: 'ok', model: 'm', speed: 1 }),
    ]);

    await vi.waitFor(
      () => {
        const order = (globalThis as Record<string, unknown>).__playOrder as string[];
        expect(order).toHaveLength(1);
      },
      { timeout: 1000 },
    );

    expect((globalThis as Record<string, unknown>).__playOrder).toEqual(['ok']);
    player.destroy();
  });
});
