import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../src/moderation/rateLimiter';

describe('RateLimiter', () => {
  it('allows up to perMin requests at the same instant', () => {
    const rl = new RateLimiter(3);
    const now = 1_000_000;
    expect(rl.allow('u1', now)).toBe(true);
    expect(rl.allow('u1', now)).toBe(true);
    expect(rl.allow('u1', now)).toBe(true);
  });

  it('blocks the next request when it exceeds perMin', () => {
    const rl = new RateLimiter(3);
    const now = 1_000_000;
    rl.allow('u1', now);
    rl.allow('u1', now);
    rl.allow('u1', now);
    expect(rl.allow('u1', now)).toBe(false);
  });

  it('refills a token after 60s/perMin elapses', () => {
    const rl = new RateLimiter(3);
    const now = 1_000_000;
    rl.allow('u1', now);
    rl.allow('u1', now);
    rl.allow('u1', now);
    expect(rl.allow('u1', now)).toBe(false);
    // 60000ms / 3 = 20000ms per refilled token
    const later = now + 20_000;
    expect(rl.allow('u1', later)).toBe(true);
    // no more tokens available at the same instant
    expect(rl.allow('u1', later)).toBe(false);
  });

  it('refills up to the perMin maximum after a full minute', () => {
    const rl = new RateLimiter(3);
    const now = 1_000_000;
    rl.allow('u1', now);
    rl.allow('u1', now);
    rl.allow('u1', now);
    const fullMinute = now + 60_000;
    expect(rl.allow('u1', fullMinute)).toBe(true);
    expect(rl.allow('u1', fullMinute)).toBe(true);
    expect(rl.allow('u1', fullMinute)).toBe(true);
    expect(rl.allow('u1', fullMinute)).toBe(false);
  });

  it('does not accumulate tokens above the limit even after a long time', () => {
    const rl = new RateLimiter(2);
    const now = 1_000_000;
    // a long idle time gives no more than perMin
    const farFuture = now + 10_000_000;
    expect(rl.allow('u1', farFuture)).toBe(true);
    expect(rl.allow('u1', farFuture)).toBe(true);
    expect(rl.allow('u1', farFuture)).toBe(false);
  });

  it('isolates buckets per userId', () => {
    const rl = new RateLimiter(1);
    const now = 1_000_000;
    expect(rl.allow('u1', now)).toBe(true);
    expect(rl.allow('u1', now)).toBe(false);
    expect(rl.allow('u2', now)).toBe(true);
    expect(rl.allow('u2', now)).toBe(false);
  });

  describe('several users simultaneously', () => {
    it('each user has an independent counter (3 users, perMin=2)', () => {
      const rl = new RateLimiter(2);
      const now = 1_000_000;
      // u1 drains the bucket
      expect(rl.allow('u1', now)).toBe(true);
      expect(rl.allow('u1', now)).toBe(true);
      expect(rl.allow('u1', now)).toBe(false);
      // u2 starts with a full bucket
      expect(rl.allow('u2', now)).toBe(true);
      expect(rl.allow('u2', now)).toBe(true);
      expect(rl.allow('u2', now)).toBe(false);
      // u3 also starts with an independent full bucket
      expect(rl.allow('u3', now)).toBe(true);
      expect(rl.allow('u3', now)).toBe(true);
      expect(rl.allow('u3', now)).toBe(false);
    });

    it('draining u1 does not affect u2', () => {
      const rl = new RateLimiter(3);
      const now = 1_000_000;
      rl.allow('u1', now);
      rl.allow('u1', now);
      rl.allow('u1', now);
      // u1 drained, but u2 still has tokens
      expect(rl.allow('u1', now)).toBe(false);
      expect(rl.allow('u2', now)).toBe(true);
    });
  });

  describe('pruning of inactive buckets (memory)', () => {
    // Pruning can only remove buckets that are "full" (effective tokens at the
    // maximum at nowMs) — equivalent to not existing, since a recreated bucket
    // is born full. It NEVER changes the observable allow/deny semantics.

    it('sweep removes a full+inactive bucket (recomputes tokens at nowMs)', () => {
      const rl = new RateLimiter(3);
      const t0 = 1_000_000;
      // creates the bucket and consumes 1 token => stored tokens = 2 (< perMin=3)
      expect(rl.allow('u1', t0)).toBe(true);
      expect(rl.bucketCount).toBe(1);
      // 10 minutes later the bucket has already refilled to the maximum (effective >= perMin).
      const later = t0 + 10 * 60_000;
      const removed = rl.sweep(later, 60_000);
      expect(removed).toBe(1);
      expect(rl.bucketCount).toBe(0);
    });

    it('sweep does NOT remove a bucket still partially spent (effective < perMin)', () => {
      const rl = new RateLimiter(3);
      const t0 = 1_000_000;
      rl.allow('u1', t0); // effective tokens = 2 at t0
      // at the SAME instant it has not refilled yet => must not prune even with idle 0.
      const removed = rl.sweep(t0, 0);
      expect(removed).toBe(0);
      expect(rl.bucketCount).toBe(1);
    });

    it('sweep does NOT remove a full but recent bucket (idle gate protects it)', () => {
      const rl = new RateLimiter(3);
      const t0 = 1_000_000;
      // fills u_old at an old instant
      rl.allow('u_old', t0);
      // u_active touched now (recent lastRefillMs) — full but not inactive.
      const later = t0 + 10 * 60_000;
      rl.allow('u_active', later);
      expect(rl.bucketCount).toBe(2);
      // maxIdle = 60s: u_old (idle 10min) is pruned; u_active (idle 0) survives.
      const removed = rl.sweep(later, 60_000);
      expect(removed).toBe(1);
      expect(rl.bucketCount).toBe(1);
      // u_active still has its quota intact (semantics untouched).
      expect(rl.allow('u_active', later)).toBe(true);
      expect(rl.allow('u_active', later)).toBe(true);
      expect(rl.allow('u_active', later)).toBe(false);
    });

    it('allow() prunes automatically when buckets.size exceeds MAX_BUCKETS', () => {
      const rl = new RateLimiter(1);
      const t0 = 1_000_000;
      // Fills > MAX_BUCKETS users at an old instant (each consumes its 1 token).
      for (let i = 0; i <= 5000; i++) {
        rl.allow(`u${i}`, t0);
      }
      expect(rl.bucketCount).toBeGreaterThan(5000);
      // Much later, all have refilled to the maximum => allow() of a new user
      // triggers the lazy pruning and the count drops.
      const later = t0 + 10 * 60_000;
      rl.allow('novo', later);
      expect(rl.bucketCount).toBeLessThan(5000);
    });

    it('the allow/deny decision remains correct after pruning', () => {
      const rl = new RateLimiter(2);
      const t0 = 1_000_000;
      rl.allow('u1', t0); // 1 spent
      const later = t0 + 10 * 60_000;
      rl.sweep(later, 60_000); // u1 pruned (full+inactive)
      // u1 recreated full => same behavior as if it had never existed.
      expect(rl.allow('u1', later)).toBe(true);
      expect(rl.allow('u1', later)).toBe(true);
      expect(rl.allow('u1', later)).toBe(false);
    });
  });

  describe('exact refill boundary (1 token)', () => {
    // perMin=3 => refillIntervalMs = 60000/3 = 20000ms
    // Uses separate instances to prevent the "before" call from changing
    // lastRefillMs and perturbing the "at boundary" call's computation.

    it('does not refill a token 1ms before the interval (nowMs = now + 19999)', () => {
      const rl = new RateLimiter(3);
      const now = 1_000_000;
      rl.allow('u1', now);
      rl.allow('u1', now);
      rl.allow('u1', now);
      // 19999ms < 20000ms => refilled = 19999/20000 < 1 => no new token
      expect(rl.allow('u1', now + 19_999)).toBe(false);
    });

    it('refills exactly 1 token at the interval boundary (nowMs = now + 20000)', () => {
      const rl = new RateLimiter(3);
      const now = 1_000_000;
      rl.allow('u1', now);
      rl.allow('u1', now);
      rl.allow('u1', now);
      // 20000ms == 20000ms => refilled = 1.0 => exactly 1 token restored
      expect(rl.allow('u1', now + 20_000)).toBe(true);
      // but there is no second token at that same instant
      expect(rl.allow('u1', now + 20_000)).toBe(false);
    });
  });
});
