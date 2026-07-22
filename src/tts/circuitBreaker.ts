// src/tts/circuitBreaker.ts
//
// CircuitBreakerEngine — a TTSEngine decorator that protects against a PRIMARY engine
// that becomes slow/unavailable (the typical case: Google's gTTS timing out at
// ~15s per request when it blocks/throttles). After N CONSECUTIVE failures, it "opens" and
// serves the `fallback` (e.g. Piper, local) DIRECTLY during a cooldown — without even
// trying the primary — to avoid stacking 15s stalls on every message. A successful
// primary synthesis closes the breaker and resets the counter.
//
// States:
//   CLOSED    -> tries the primary; success resets, failure counts.
//   OPEN      -> (now < openUntil) does not even touch the primary; goes straight to the fallback.
//   HALF-OPEN -> (cooldown expired) one probe to the primary; success closes, failure reopens.
//
// Graceful degradation: even in the CLOSED state, a primary failure falls back to the fallback
// for THAT message (does not leave it without audio) besides counting toward opening.

import type { SynthRequest, TTSEngine } from './engine';
import { log } from '../logging/logger';

export interface CircuitBreakerOpts {
  /** CONSECUTIVE primary failures to open the breaker. */
  threshold: number;
  /** Time (ms) the breaker stays open (using the fallback) before re-probing. */
  cooldownMs: number;
  /** Injectable clock (tests). Default: Date.now. */
  now?: () => number;
  /** Short name for logs (e.g. 'gtts'). */
  label?: string;
  /** Hook called when the breaker OPENS (metrics/observability). */
  onOpen?: () => void;
}

export class CircuitBreakerEngine implements TTSEngine {
  private failures = 0;
  private openUntil = 0;
  private probing = false; // HALF-OPEN: is there a primary probe in progress?
  private readonly now: () => number;
  private readonly label: string;

  constructor(
    private readonly primary: TTSEngine,
    private readonly fallback: TTSEngine,
    private readonly opts: CircuitBreakerOpts,
  ) {
    this.now = opts.now ?? Date.now;
    this.label = opts.label ?? 'primary';
  }

  /** Is the breaker OPEN right now (skipping the primary)? Observability/tests. */
  isOpen(): boolean {
    return this.now() < this.openUntil;
  }

  async synth(req: SynthRequest): Promise<string> {
    // OPEN: does not even try the primary — straight to the fallback (avoids the ~15s stall).
    if (this.now() < this.openUntil) {
      return this.fallback.synth(req);
    }
    // HALF-OPEN if it was ALREADY open and the cooldown expired (openUntil>0). In that state,
    // a SINGLE probe failure reopens immediately (it does not wait to accumulate `threshold`
    // again — otherwise each cooldown expiry would re-trigger N 15s stalls in a long outage).
    const halfOpen = this.openUntil > 0;
    // HALF-OPEN: lets ONE probe through at a time. Without this latch, all requests
    // arriving in the window after the cooldown expires (and before the ~15s probe resolves)
    // would probe the primary in parallel — N 15s stalls per cooldown in a long outage. The
    // concurrent ones serve the fallback directly; the latch is set before the await and cleared
    // in the finally.
    if (halfOpen && this.probing) {
      return this.fallback.synth(req);
    }
    if (halfOpen) this.probing = true;
    try {
      const out = await this.primary.synth(req);
      this.failures = 0; // success -> CLOSES and resets
      this.openUntil = 0;
      return out;
    } catch (err) {
      if (halfOpen || ++this.failures >= this.opts.threshold) {
        this.openUntil = this.now() + this.opts.cooldownMs;
        this.failures = 0;
        log.warn(
          `[breaker] '${this.label}' OPEN for ${this.opts.cooldownMs}ms (${halfOpen ? 'probe failed' : `${this.opts.threshold} failures`}); serving the fallback`,
        );
        this.opts.onOpen?.();
      } else {
        log.warn(
          `[breaker] '${this.label}' failed (${this.failures}/${this.opts.threshold}): ${(err as Error).message}`,
        );
      }
      // Graceful degradation: uses the fallback for THIS message too (does not leave it mute).
      return this.fallback.synth(req);
    } finally {
      if (halfOpen) this.probing = false;
    }
  }
}
