import { describe, it, expect } from 'vitest';
import {
  CountGate,
  COUNT_COOLDOWN_MS,
  COUNT_MAX_PER_MIN,
  COUNT_WINDOW_MS,
} from '../src/moderation/countGate';

const G = 'g1';
const U = 'u1';

describe('CountGate — anti-spam gate for the /top-speakers COUNT (not for reading)', () => {
  it('the FIRST message of a (guild,user) always counts', () => {
    const gate = new CountGate();
    expect(gate.shouldCount(G, U, 'ola', 1000)).toBe(true);
  });

  it('COOLDOWN: a second (different) message within the window does NOT count; after it, counts', () => {
    const gate = new CountGate();
    expect(gate.shouldCount(G, U, 'a', 0)).toBe(true);
    expect(gate.shouldCount(G, U, 'b', COUNT_COOLDOWN_MS - 1)).toBe(false); // too soon
    expect(gate.shouldCount(G, U, 'c', COUNT_COOLDOWN_MS)).toBe(true); // cooldown elapsed
  });

  it('DEDUP: the same content as the last counted message never counts (even after cooldown)', () => {
    const gate = new CountGate();
    expect(gate.shouldCount(G, U, 'gg', 0)).toBe(true);
    // identical content, well past the cooldown -> still dropped (repetition)
    expect(gate.shouldCount(G, U, 'gg', 10 * COUNT_COOLDOWN_MS)).toBe(false);
    expect(gate.shouldCount(G, U, 'GG  ', 20 * COUNT_COOLDOWN_MS)).toBe(false); // normalized equal
    expect(gate.shouldCount(G, U, 'other', 30 * COUNT_COOLDOWN_MS)).toBe(true); // different -> counts
  });

  it('CAP: at most COUNT_MAX_PER_MIN counted within a single rolling minute', () => {
    const gate = new CountGate();
    let counted = 0;
    // 1s apart, unique content -> only the 5s cooldown + the per-minute cap gate them.
    for (let i = 0; i < 60; i++) {
      if (gate.shouldCount(G, U, `x-${i}`, i * 1000)) counted++;
    }
    // Cooldown lets ~1 per 5s through; the cap clamps the first minute to exactly the max.
    expect(counted).toBe(COUNT_MAX_PER_MIN);
  });

  it('the window slides: the cap blocks during the window and clears after it', () => {
    const gate = new CountGate();
    // COUNT_MAX_PER_MIN messages, cooldown-spaced with unique content -> fills the minute cap.
    for (let i = 0; i < COUNT_MAX_PER_MIN; i++) {
      expect(gate.shouldCount(G, U, `a-${i}`, i * COUNT_COOLDOWN_MS)).toBe(true);
    }
    // One more, cooldown-clear but still inside the same minute -> capped.
    const over = COUNT_MAX_PER_MIN * COUNT_COOLDOWN_MS;
    expect(gate.shouldCount(G, U, 'over', over)).toBe(false);
    // Jump past the window from the LAST counted (t=(max-1)*cooldown) -> all expired -> counts.
    const cleared = (COUNT_MAX_PER_MIN - 1) * COUNT_COOLDOWN_MS + COUNT_WINDOW_MS + 1;
    expect(gate.shouldCount(G, U, 'fresh', cleared)).toBe(true);
  });

  it('is independent per (guild,user)', () => {
    const gate = new CountGate();
    expect(gate.shouldCount(G, U, 'same', 0)).toBe(true);
    expect(gate.shouldCount(G, U, 'same', 100)).toBe(false); // u1 cooldown/dedup
    expect(gate.shouldCount(G, 'u2', 'same', 100)).toBe(true); // other user unaffected
    expect(gate.shouldCount('g2', U, 'same', 100)).toBe(true); // other guild unaffected
  });

  it('does not grow unbounded: evicts oldest entries past the cap', () => {
    const gate = new CountGate();
    // Fill well past the internal cap with distinct keys.
    for (let i = 0; i < 12_000; i++) gate.shouldCount('g', `user-${i}`, 'hi', i);
    expect(gate.size()).toBeLessThanOrEqual(10_000);
  });
});
