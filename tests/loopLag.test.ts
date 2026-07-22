// tests/loopLag.test.ts — event-loop stall monitor (health/loopLag).
import { describe, it, expect, vi } from 'vitest';
import { createLagTracker, startLoopLagMonitor } from '../src/health/loopLag';
import { metrics } from '../src/metrics';

describe('createLagTracker — pure lag calculation', () => {
  it('on-time tick -> lag 0', () => {
    let now = 1000;
    const tr = createLagTracker(500, () => now);
    now = 1500; // exactly at the expected instant
    expect(tr.tick()).toBe(0);
    now = 2000;
    expect(tr.tick()).toBe(0);
  });

  it('late tick -> lag = delay; the tracker re-anchors (does not accumulate)', () => {
    let now = 1000;
    const tr = createLagTracker(500, () => now);
    now = 2200; // expected at 1500 -> 700ms of stall
    expect(tr.tick()).toBe(700);
    // Re-anchored at 2200+500=2700: an on-time tick gives 0 again (does not carry the 700).
    now = 2700;
    expect(tr.tick()).toBe(0);
  });

  it('early tick (timer drift) -> negative lag, never a false positive', () => {
    let now = 1000;
    const tr = createLagTracker(500, () => now);
    now = 1490;
    expect(tr.tick()).toBeLessThan(0);
  });
});

describe('startLoopLagMonitor — wiring (short real timers)', () => {
  it('detects a synchronous stall and counts it in metrics.loopStalls + onStall', async () => {
    metrics.reset();
    const onStall = vi.fn();
    const stop = startLoopLagMonitor({ intervalMs: 20, warnMs: 30, onStall });
    // Blocks the event-loop ~80ms (synchronous busy-wait): the next tick arrives late.
    const t0 = Date.now();
    while (Date.now() - t0 < 80) {
      /* deliberate busy-wait */
    }
    await vi.waitFor(() => expect(onStall).toHaveBeenCalled(), { timeout: 1000 });
    expect(metrics.snapshot().loopStalls).toBeGreaterThanOrEqual(1);
    const lag = onStall.mock.calls[0][0] as number;
    expect(lag).toBeGreaterThanOrEqual(30);
    stop();
    metrics.reset();
  });

  it('no stalls: does not fire (short window of healthy ticks)', async () => {
    metrics.reset();
    const onStall = vi.fn();
    const stop = startLoopLagMonitor({ intervalMs: 10, warnMs: 200, onStall });
    await new Promise((r) => setTimeout(r, 60)); // ~5 healthy ticks
    stop();
    expect(onStall).not.toHaveBeenCalled();
    expect(metrics.snapshot().loopStalls).toBe(0);
    metrics.reset();
  });
});
