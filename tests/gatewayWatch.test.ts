// tests/gatewayWatch.test.ts — pure decision of the gateway watchdog.
import { describe, it, expect } from 'vitest';
import { evaluateGateway } from '../src/bot/gatewayWatch';

const MAX = 120_000; // 120s

describe('evaluateGateway', () => {
  it('Ready -> healthy, no restart, clears unhealthySince', () => {
    const d = evaluateGateway(true, 5000, 10_000, MAX);
    expect(d).toEqual({ healthy: true, unhealthySince: null, downMs: 0, shouldRestart: false });
  });

  it('first non-Ready check -> anchors unhealthySince at `now`, does not restart yet', () => {
    const d = evaluateGateway(false, null, 10_000, MAX);
    expect(d.healthy).toBe(false);
    expect(d.unhealthySince).toBe(10_000);
    expect(d.downMs).toBe(0);
    expect(d.shouldRestart).toBe(false);
  });

  it('non-Ready WITHIN the limit -> does not restart', () => {
    const d = evaluateGateway(false, 10_000, 10_000 + 119_000, MAX); // 119s < 120s
    expect(d.shouldRestart).toBe(false);
    expect(d.downMs).toBe(119_000);
    expect(d.unhealthySince).toBe(10_000); // preserves the anchor
  });

  it('non-Ready BEYOND the limit -> restarts', () => {
    const d = evaluateGateway(false, 10_000, 10_000 + 121_000, MAX); // 121s > 120s
    expect(d.shouldRestart).toBe(true);
    expect(d.downMs).toBe(121_000);
  });

  it('recovering (Ready after non-Ready) clears the state -> the next drop re-anchors', () => {
    const down = evaluateGateway(false, null, 1000, MAX);
    expect(down.unhealthySince).toBe(1000);
    const up = evaluateGateway(true, down.unhealthySince, 2000, MAX);
    expect(up.unhealthySince).toBeNull();
    // A new drop later anchors at the NEW instant (does not drag the old 1000).
    const down2 = evaluateGateway(false, up.unhealthySince, 500_000, MAX);
    expect(down2.unhealthySince).toBe(500_000);
    expect(down2.shouldRestart).toBe(false);
  });
});
