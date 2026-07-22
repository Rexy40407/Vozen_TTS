// tests/startProd.test.ts — PURE policy of the production supervisor (start-prod.mjs).
// Covers backoff, exit classification and the prewarm loop without
// real processes (start-prod injects spawn/log).
import { describe, it, expect, vi } from 'vitest';
import {
  backoffDelayMs,
  decideOnExit,
  prewarmNative,
  PREWARM_MAX_TRIES,
} from '../scripts/supervisorPolicy.mjs';

describe('supervisorPolicy — backoff', () => {
  it('sequence: doubles from 2s and caps at 60s', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(backoffDelayMs)).toEqual([
      2000, 4000, 8000, 16000, 32000, 60000, 60000,
    ]);
  });
});

describe('supervisorPolicy — decideOnExit', () => {
  it('exit code 0 -> stop (attempt is irrelevant)', () => {
    expect(decideOnExit(0, false, 3)).toEqual({ action: 'stop' });
  });

  it('crash -> restart with the CURRENT attempt delay and nextAttempt+1', () => {
    expect(decideOnExit(1, false, 0)).toEqual({ action: 'restart', delayMs: 2000, nextAttempt: 1 });
    // null exit code (killed by signal) also restarts (mirrors the `=== 0` check).
    expect(decideOnExit(null, false, 2)).toEqual({
      action: 'restart',
      delayMs: 8000,
      nextAttempt: 3,
    });
  });

  it('stopping -> ignore (any exit code)', () => {
    expect(decideOnExit(1, true, 0)).toEqual({ action: 'ignore' });
    expect(decideOnExit(0, true, 0)).toEqual({ action: 'ignore' });
  });
});

describe('supervisorPolicy — prewarmNative', () => {
  it('success midway: stops trying and returns true', () => {
    const logs: string[] = [];
    let calls = 0;
    const tryLoad = vi.fn(() => {
      calls++;
      return calls === 3; // fails 2x, succeeds on the 3rd
    });
    expect(prewarmNative(tryLoad, (m) => logs.push(m))).toBe(true);
    expect(tryLoad).toHaveBeenCalledTimes(3);
    expect(logs[logs.length - 1]).toMatch(/pronta \(tentativa 3\)/);
  });

  it('exhausts the attempts: returns false and warns', () => {
    const logs: string[] = [];
    const tryLoad = vi.fn(() => false);
    expect(prewarmNative(tryLoad, (m) => logs.push(m))).toBe(false);
    expect(tryLoad).toHaveBeenCalledTimes(PREWARM_MAX_TRIES);
    expect(logs.some((l) => l.startsWith('AVISO:'))).toBe(true);
  });
});
