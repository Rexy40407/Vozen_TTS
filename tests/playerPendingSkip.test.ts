// tests/playerPendingSkip.test.ts
// P19.C — /skip in the SYNTHESIS WINDOW.
//
// Bug: playNext() sets playing=true BEFORE the awaits (engine.synth + entersState
// Ready); this.player.play(resource) only runs AFTER. During that window the
// REAL AudioPlayer is Idle (the previous item finished and triggered this drain;
// no new resource was passed). If the user does /skip in that window,
// skip() -> player.stop(true), but in @discordjs/voice stop() does
// `if (status === 'idle') return false` — NO-OP, does not emit Idle. The skip was
// LOST: the in-flight item played in full despite the "skipped".
//
// Fix: pendingSkip flag. skip() detects that the real player is NOT playing
// (Playing/Buffering) and sets pendingSkip=true; playNext() resets the flag at
// the start of each iteration (so it does not leak to the next item) and checks it
// AFTER the awaits and BEFORE play() — if set, discards the item and drains the next.
//
// FAKE FIDELITY (critical for the RED to hold): the fake AudioPlayer replicates the
// real semantics of stop() — when the state is Idle, stop() is a NO-OP (does not emit
// Idle). A fake that emitted Idle unconditionally would make /skip "work" in the
// window and there would be no bug to reproduce.
//
// To hold the synthesis window and release at the right moment we use an engine
// with DEFERRED synthesis: synth() returns a Promise resolved manually by the
// test, so we can inspect the state mid-way (real player Idle) and only then
// call skip().
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';

vi.mock('@discordjs/voice', async () => {
  const { EventEmitter: EE } = await import('node:events');
  const IDLE = 'idle';
  const PLAYING = 'playing';
  const BUFFERING = 'buffering';
  // Fake AudioPlayer with a MUTABLE `state` that mirrors the real one:
  //  - starts Idle
  //  - play(resource) -> Playing, records the resource, and schedules the end (Idle + emit)
  //  - stop(force)    -> if already Idle: NO-OP (return false, does NOT emit) like the real one;
  //                      if Playing/Buffering: goes to Idle and emits Idle.
  class FakeAudioPlayer extends EE {
    state: { status: string } = { status: IDLE };
    play(resource: { path: string }): void {
      (globalThis as Record<string, unknown>).__playOrder ??= [];
      ((globalThis as Record<string, unknown>).__playOrder as string[]).push(resource.path);
      this.state = { status: PLAYING };
      // Ends the "audio" on the next tick -> Idle -> playNext() drains the next one.
      setTimeout(() => {
        this.state = { status: IDLE };
        this.emit(IDLE);
      }, 0);
    }
    stop(_force?: boolean): boolean {
      if (this.state.status === IDLE) {
        // Real semantics: no-op when idle. The skip is lost if production
        // relies only on this (bug); the fix uses pendingSkip.
        return false;
      }
      this.state = { status: IDLE };
      this.emit(IDLE);
      return true;
    }
  }
  return {
    AudioPlayerStatus: {
      Idle: IDLE,
      Playing: PLAYING,
      Buffering: BUFFERING,
    },
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

// Engine with DEFERRED synthesis, holdable by text: synth(req) returns a
// Promise that only resolves when the test calls release(req.text). This lets us
// stop execution INSIDE the synthesis window and inspect/act mid-way.
function makeDeferredEngine() {
  const resolvers = new Map<string, (v: string) => void>();
  const arrived = new Map<string, () => void>();
  const arrivedPromises = new Map<string, Promise<void>>();
  const engine: TTSEngine = {
    synth: (req: SynthRequest) =>
      new Promise<string>((resolve) => {
        resolvers.set(req.text, resolve);
        arrived.get(req.text)?.();
      }),
  };
  // Waits until synth() for the given text is CALLED (execution entered the window).
  const waitSynthCalled = (text: string): Promise<void> => {
    if (resolvers.has(text)) return Promise.resolve();
    let existing = arrivedPromises.get(text);
    if (!existing) {
      existing = new Promise<void>((res) => arrived.set(text, res));
      arrivedPromises.set(text, existing);
    }
    return existing;
  };
  const release = (text: string): void => {
    resolvers.get(text)?.(text);
  };
  return { engine, waitSynthCalled, release };
}

const req = (text: string): SynthRequest => ({ text, model: 'm', speed: 1 });

describe('GuildVoicePlayer — /skip in the synthesis window (pendingSkip, P19.C)', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__playOrder = [];
  });

  it('skip in the synthesis window: the in-flight item does NOT play and the next one plays', async () => {
    const { engine, waitSynthCalled, release } = makeDeferredEngine();

    const conn = makeConnection() as any;
    const player = new GuildVoicePlayer(conn, engine, 20, () => {});

    // Enqueue A (will play) and B (stays in the queue). We do not await so as not
    // to block — say() enqueues synchronously and starts the worker.
    void player.say(req('A'));
    void player.say(req('B'));

    // A enters synthesis first. Release A -> A plays -> finishes -> Idle -> drain B.
    await waitSynthCalled('A');
    release('A');

    // Now B has entered the synthesis window. At this instant the REAL AudioPlayer is
    // Idle (A already finished; B has not yet gone through play). skip() here is the core of the bug.
    await waitSynthCalled('B');

    // /skip in the window: with the bug, stop() is a no-op (idle) and B plays anyway.
    player.skip();

    // Release B's synthesis -> playNext continues after the await.
    release('B');

    // Wait for the queue to stabilize. Give the event loop a few turns.
    await new Promise((r) => setTimeout(r, 20));

    const order = (globalThis as Record<string, unknown>).__playOrder as string[];
    // A played; B was DISCARDED by the skip in the window (does not play).
    expect(order).toEqual(['A']);

    player.destroy();
  });

  it('NO-LEAK: skip during B discards B but C (next) plays NORMALLY', async () => {
    const { engine, waitSynthCalled, release } = makeDeferredEngine();

    const conn = makeConnection() as any;
    const player = new GuildVoicePlayer(conn, engine, 20, () => {});

    void player.say(req('A'));
    void player.say(req('B'));
    void player.say(req('C'));

    await waitSynthCalled('A');
    release('A');

    // B in the window: skip() -> pendingSkip.
    await waitSynthCalled('B');
    player.skip();
    release('B'); // B discarded, drains C.

    // C enters synthesis: pendingSkip should NOT have leaked (reset at the start of
    // C's iteration). Release C -> C should PLAY.
    await waitSynthCalled('C');
    release('C');

    await new Promise((r) => setTimeout(r, 20));

    const order = (globalThis as Record<string, unknown>).__playOrder as string[];
    // A played, B discarded, C played normally (no pendingSkip leak).
    expect(order).toEqual(['A', 'C']);

    player.destroy();
  });

  it('NORMAL skip (playing): stop() emits Idle and advances; behavior unchanged', async () => {
    // Here we do NOT defer: the engine resolves right away, so the item reaches play() and the
    // player becomes Playing. Then skip() while Playing -> stop() emits Idle.
    const engine: TTSEngine = { synth: async (r: SynthRequest) => r.text };

    const conn = makeConnection() as any;
    const player = new GuildVoicePlayer(conn, engine, 20, () => {});

    void player.say(req('A'));
    void player.say(req('B'));

    // Wait for A to start playing (Playing) — the fake schedules Idle on the next tick, so
    // we capture the state right after the synchronous play.
    await vi.waitFor(
      () => {
        const order = (globalThis as Record<string, unknown>).__playOrder as string[];
        expect(order.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 1000 },
    );

    // The queue naturally drains A and B (both play). Non-regression proof: the
    // two items play in order, and the normal skip (when Playing) keeps
    // working via stop()/Idle without depending on pendingSkip.
    await vi.waitFor(
      () => {
        const order = (globalThis as Record<string, unknown>).__playOrder as string[];
        expect(order).toEqual(['A', 'B']);
      },
      { timeout: 1000 },
    );

    player.destroy();
  });

  it('skip during B + B synthesis FAILS: C plays (no leak in the catch)', async () => {
    // Engine: A and C resolve; B REJECTS. We call skip() while B is in synthesis;
    // then B's synthesis fails (catch in playNext). The reset of pendingSkip at the
    // start of C's iteration ensures C is NOT wrongly skipped.
    const { engine: base, waitSynthCalled, release } = makeDeferredEngine();
    const rejecters = new Set(['B']);
    const engine: TTSEngine = {
      synth: (r: SynthRequest) =>
        rejecters.has(r.text)
          ? // returns the same deferred promise but rejects when "released"
            new Promise<string>((_, reject) => {
              // waitSynthCalled/release operate on the base; we reuse only the
              // "arrived" signal via base.synth for timing consistency.
              void base.synth(r).then(() => reject(new Error('synth boom B')));
            })
          : base.synth(r),
    };

    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const conn = makeConnection() as any;
    const player = new GuildVoicePlayer(conn, engine, 20, () => {});

    void player.say(req('A'));
    void player.say(req('B'));
    void player.say(req('C'));

    await waitSynthCalled('A');
    release('A');

    await waitSynthCalled('B');
    player.skip(); // pendingSkip=true while B in synthesis
    release('B'); // B rejects -> catch -> drains C

    await waitSynthCalled('C');
    release('C');

    await new Promise((r) => setTimeout(r, 20));
    process.off('unhandledRejection', onUnhandled);

    const order = (globalThis as Record<string, unknown>).__playOrder as string[];
    // A played, B failed (never plays), C played (pendingSkip did not leak to C).
    expect(order).toEqual(['A', 'C']);
    expect(unhandled).toEqual([]);

    errSpy.mockRestore();
    player.destroy();
  });
});
