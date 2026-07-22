// tests/rateLimitFeedbackCooldown.test.ts — pure tests for RateLimitFeedbackCooldown
// (plan 030, ABUSE-02). Same structure as greetCooldown.test.ts: injectable clock,
// FIXED window, pruning by MAX_ENTRIES.
import { describe, it, expect } from 'vitest';
import {
  RateLimitFeedbackCooldown,
  RATE_LIMIT_FEEDBACK_WINDOW_MS,
} from '../src/commands/messageHandler';

const G = 'guild-1';
const U = 'user-1';

/** RateLimitFeedbackCooldown with a controlled clock: the test moves `t` and injects () => t. */
function makeClock(start = 0): { cd: RateLimitFeedbackCooldown; set: (ms: number) => void } {
  let t = start;
  const cd = new RateLimitFeedbackCooldown(() => t);
  return { cd, set: (ms: number) => (t = ms) };
}

describe('RateLimitFeedbackCooldown', () => {
  it('the 1st dropped message from a (guild,user) always notifies', () => {
    const { cd } = makeClock();
    expect(cd.shouldNotify(G, U)).toBe(true);
  });

  it('next drop WITHIN the window is suppressed (does not notify again)', () => {
    const { cd, set } = makeClock(0);
    expect(cd.shouldNotify(G, U)).toBe(true);
    set(1000);
    expect(cd.shouldNotify(G, U)).toBe(false);
  });

  it('drop AFTER the window notifies again', () => {
    const { cd, set } = makeClock(0);
    expect(cd.shouldNotify(G, U)).toBe(true);
    set(RATE_LIMIT_FEEDBACK_WINDOW_MS + 1);
    expect(cd.shouldNotify(G, U)).toBe(true);
  });

  it('exactly at the boundary (== window) already notifies (non-inclusive limit)', () => {
    const { cd, set } = makeClock(0);
    expect(cd.shouldNotify(G, U)).toBe(true);
    set(RATE_LIMIT_FEEDBACK_WINDOW_MS);
    expect(cd.shouldNotify(G, U)).toBe(true);
  });

  it('FIXED window: a suppressed drop does not extend the window', () => {
    const { cd, set } = makeClock(0);
    expect(cd.shouldNotify(G, U)).toBe(true); // t=0, records 0
    set(RATE_LIMIT_FEEDBACK_WINDOW_MS - 1000);
    expect(cd.shouldNotify(G, U)).toBe(false); // suppressed, does NOT record this instant
    set(RATE_LIMIT_FEEDBACK_WINDOW_MS);
    expect(cd.shouldNotify(G, U)).toBe(true); // window since t=0 (not since the suppressed one)
  });

  it('different users and guilds are independent', () => {
    const { cd } = makeClock(0);
    expect(cd.shouldNotify(G, U)).toBe(true);
    expect(cd.shouldNotify(G, 'user-2')).toBe(true); // another user, same guild
    expect(cd.shouldNotify('guild-2', U)).toBe(true); // same user, another guild
    expect(cd.shouldNotify(G, U)).toBe(false); // the original pair is still on cooldown
  });

  it('does not blow up with many keys (pruning keeps the map bounded)', () => {
    const { cd } = makeClock(0);
    for (let i = 0; i < 12_000; i++) expect(cd.shouldNotify(G, `user-${i}`)).toBe(true);
    // sanity: a recent key still responds correctly
    expect(cd.shouldNotify(G, 'user-11999')).toBe(false);
  });
});
