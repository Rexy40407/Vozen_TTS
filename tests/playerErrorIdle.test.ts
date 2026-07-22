// Regression P19.A: in the real @discordjs/voice player, a stream error emits
// `error` and then transitions the same resource to Idle synchronously. Calling
// playNext() from both handlers used to drain twice and corrupt the single-worker
// state while the next item was still being synthesized.
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';

vi.mock('@discordjs/voice', async () => {
  const { EventEmitter: EE } = await import('node:events');
  const IDLE = 'idle';
  class FakeAudioPlayer extends EE {
    // The test controls Idle explicitly to avoid racing the injected error.
    constructor() {
      super();
      (globalThis as Record<string, unknown>).__fakePlayer = this;
    }
    play(resource: { path: string }): void {
      (globalThis as Record<string, unknown>).__playOrder ??= [];
      ((globalThis as Record<string, unknown>).__playOrder as string[]).push(resource.path);
    }
    stop(): void {
      this.emit(IDLE);
    }
    // Mirrors onStreamError: synchronous `error`, then Idle for the same resource.
    simulateStreamError(): void {
      this.emit('error', new Error('stream boom'));
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

describe('GuildVoicePlayer synchronous error and Idle handling (P19.A)', () => {
  it('drains exactly once and keeps the worker active while synthesizing the next item', async () => {
    (globalThis as Record<string, unknown>).__playOrder = [];
    (globalThis as Record<string, unknown>).__fakePlayer = undefined;

    // Hold B's synthesis promise so the worker can be inspected mid-synthesis.
    let resolveB!: (value: string) => void;
    const bPending = new Promise<string>((resolve) => {
      resolveB = resolve;
    });
    const engine: TTSEngine = {
      synth: (req: SynthRequest) => (req.text === 'B' ? bPending : Promise.resolve(req.text)),
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let onIdleCalls = 0;
    const player = new GuildVoicePlayer(makeConnection() as any, engine, 20, () => {
      onIdleCalls++;
    });

    await player.say({ text: 'A', model: 'm', speed: 1 });
    await vi.waitFor(
      () => {
        const order = (globalThis as Record<string, unknown>).__playOrder as string[];
        expect(order).toEqual(['A']);
      },
      { timeout: 1000 },
    );

    await player.say({ text: 'B', model: 'm', speed: 1 });
    const fake = (globalThis as Record<string, unknown>).__fakePlayer as {
      simulateStreamError: () => void;
    };
    fake.simulateStreamError();

    // Flush the playNext() microtasks while B remains mid-synthesis.
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(player.isActive()).toBe(true);
    expect(onIdleCalls).toBe(0);
    expect(errorSpy).toHaveBeenCalled();

    resolveB('B');
    await vi.waitFor(
      () => {
        const order = (globalThis as Record<string, unknown>).__playOrder as string[];
        expect(order).toEqual(['A', 'B']);
      },
      { timeout: 1000 },
    );

    errorSpy.mockRestore();
    player.destroy();
  });
});
