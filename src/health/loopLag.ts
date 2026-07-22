// src/health/loopLag.ts
//
// Event-loop BLOCKING monitor. A setInterval tick that arrives late means
// something held the loop (large synchronous I/O, saturated machine CPU,
// long GC). That delays ALL the bot's responses — especially AUTOCOMPLETE,
// which has a ~3s total budget and cannot be deferred ("Failed to load
// options" on the client). This monitor turns those invisible episodes into
// log lines + a counter (metrics.loopStalls), so diagnosis stops being
// guesswork.
//
// The lag computation lives in a pure tracker (createLagTracker) so it is
// testable without real timers.

import { log } from '../logging/logger';
import { metrics } from '../metrics';

export interface LagTracker {
  /** Called on each tick; returns the lag (ms) relative to the expected instant. */
  tick(): number;
}

/** Pure tracker: `expected` re-anchors on each tick so drift does not accumulate. */
export function createLagTracker(intervalMs: number, now: () => number): LagTracker {
  let expected = now() + intervalMs;
  return {
    tick(): number {
      const t = now();
      const lag = t - expected;
      expected = t + intervalMs;
      return lag;
    },
  };
}

export interface LoopLagOptions {
  /** Tick cadence (default 500ms — granular enough for 400ms stalls). */
  intervalMs?: number;
  /** Lag at or above which it counts as a stall (default 400ms). */
  warnMs?: number;
  /** Test/extension hook; called with the measured lag. */
  onStall?: (lagMs: number) => void;
}

/** Starts the monitor; returns a stop function. The timer is unref'd. */
export function startLoopLagMonitor(opts: LoopLagOptions = {}): () => void {
  const intervalMs = opts.intervalMs ?? 500;
  const warnMs = opts.warnMs ?? 400;
  const tracker = createLagTracker(intervalMs, Date.now);
  const timer = setInterval(() => {
    const lag = tracker.tick();
    if (lag >= warnMs) {
      metrics.inc('loopStalls');
      log.warn(
        `[loop] event-loop esteve bloqueado ~${Math.round(lag)}ms — respostas (autocomplete incluído) atrasaram este intervalo.`,
      );
      opts.onStall?.(lag);
    }
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
