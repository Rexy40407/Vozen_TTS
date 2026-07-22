import { describe, it, expect } from 'vitest';
import { GreetCooldown, GREET_COOLDOWN_MS } from '../src/voice/greetCooldown';

const G = 'guild-1';
const U = 'user-1';

/** GreetCooldown with a controlled clock: the test moves `t` and injects () => t. */
function makeClock(start = 0): { cd: GreetCooldown; set: (ms: number) => void } {
  let t = start;
  const cd = new GreetCooldown(() => t);
  return { cd, set: (ms: number) => (t = ms) };
}

describe('GreetCooldown', () => {
  it('the 1st entry is always greeted', () => {
    const { cd } = makeClock();
    expect(cd.shouldGreet(G, U)).toBe(true);
  });

  it('re-entry WITHIN the window (2 min) is suppressed', () => {
    const { cd, set } = makeClock(0);
    expect(cd.shouldGreet(G, U)).toBe(true);
    set(2 * 60 * 1000);
    expect(cd.shouldGreet(G, U)).toBe(false);
  });

  it('re-entry AFTER the window (6 min) greets again', () => {
    const { cd, set } = makeClock(0);
    expect(cd.shouldGreet(G, U)).toBe(true);
    set(6 * 60 * 1000);
    expect(cd.shouldGreet(G, U)).toBe(true);
  });

  it('exactly at the boundary (== cooldown) already greets (non-inclusive limit)', () => {
    const { cd, set } = makeClock(0);
    expect(cd.shouldGreet(G, U)).toBe(true);
    set(GREET_COOLDOWN_MS);
    expect(cd.shouldGreet(G, U)).toBe(true);
  });

  it('FIXED window: a suppressed request does not extend the window', () => {
    const { cd, set } = makeClock(0);
    expect(cd.shouldGreet(G, U)).toBe(true); // t=0, records 0
    set(4 * 60 * 1000);
    expect(cd.shouldGreet(G, U)).toBe(false); // suppressed, does NOT record 4min
    set(5 * 60 * 1000);
    expect(cd.shouldGreet(G, U)).toBe(true); // 5min since t=0 (not since the 4min mark)
  });

  it('different users and guilds are independent', () => {
    const { cd } = makeClock(0);
    expect(cd.shouldGreet(G, U)).toBe(true);
    expect(cd.shouldGreet(G, 'user-2')).toBe(true); // another user, same guild
    expect(cd.shouldGreet('guild-2', U)).toBe(true); // same user, another guild
    expect(cd.shouldGreet(G, U)).toBe(false); // the original pair is still in cooldown
  });

  it('does not blow up with many keys (pruning keeps the map bounded)', () => {
    const { cd } = makeClock(0);
    for (let i = 0; i < 12_000; i++) expect(cd.shouldGreet(G, `user-${i}`)).toBe(true);
    // sanity: a recent key still responds correctly
    expect(cd.shouldGreet(G, 'user-11999')).toBe(false);
  });
});
