import { describe, it, expect } from 'vitest';
import { raceStates } from '../src/voice/raceStates';

/** Waits N ms (to give the loser time to reject and Node to emit the event). */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('raceStates — Promise.race without unhandledRejection from the loser', () => {
  it('resolves with the winner; the loser rejecting LATER does not emit unhandledRejection', async () => {
    // Note: vitest FAILS the test file if there is an unhandled unhandledRejection
    // — so if this helper regressed to plain Promise.race, the late loser would
    // blow up the file. Passing is already half the proof; the listener below
    // makes it explicit.
    const seen: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      seen.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const winner = Promise.resolve('ok');
      const loser = new Promise<string>((_, rej) =>
        setTimeout(() => rej(new Error('perdedora tardia')), 10),
      );
      await expect(raceStates([winner, loser])).resolves.toBe('ok');
      // Window for the loser to reject and Node to process the rejection queue.
      await sleep(50);
      expect(seen).toEqual([]); // this is where the bug used to show up
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('all reject -> rejects with the first (race semantics preserved)', async () => {
    const a = new Promise<string>((_, rej) => setTimeout(() => rej(new Error('a')), 5));
    const b = new Promise<string>((_, rej) => setTimeout(() => rej(new Error('b')), 15));
    await expect(raceStates([a, b])).rejects.toThrow('a');
    await sleep(30); // b rejects later — must not leak either
  });

  it('propagates the resolution value as-is', async () => {
    await expect(raceStates([Promise.resolve(42)])).resolves.toBe(42);
  });
});
