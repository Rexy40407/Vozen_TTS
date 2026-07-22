import { describe, it, expect, vi } from 'vitest';
import { CircuitBreakerEngine } from '../src/tts/circuitBreaker';
import type { SynthRequest, TTSEngine } from '../src/tts/engine';

const REQ = { text: 'olá', model: 'pt_BR-faber-medium', speed: 1 } as SynthRequest;

/** Controllable fake engine: returns `path` or throws, counting the calls. */
function fakeEngine(path: string) {
  let fail = false;
  const calls = { n: 0 };
  const engine: TTSEngine = {
    synth: vi.fn(async () => {
      calls.n++;
      if (fail) throw new Error('boom');
      return path;
    }),
  };
  return { engine, calls, setFail: (v: boolean) => (fail = v) };
}

function make(threshold = 3, cooldownMs = 60_000) {
  const primary = fakeEngine('/gtts.wav');
  const fallback = fakeEngine('/piper.wav');
  let t = 0;
  const breaker = new CircuitBreakerEngine(primary.engine, fallback.engine, {
    threshold,
    cooldownMs,
    now: () => t,
    label: 'gtts',
  });
  return {
    breaker,
    primary,
    fallback,
    advance: (ms: number) => (t += ms),
    setTime: (v: number) => (t = v),
  };
}

describe('CircuitBreakerEngine — gTTS cooldown', () => {
  it('CLOSED + success: uses the primary, does not touch the fallback', async () => {
    const { breaker, primary, fallback } = make();
    await expect(breaker.synth(REQ)).resolves.toBe('/gtts.wav');
    expect(primary.calls.n).toBe(1);
    expect(fallback.calls.n).toBe(0);
    expect(breaker.isOpen()).toBe(false);
  });

  it('CLOSED + failure (below threshold): degrades to the fallback and stays closed', async () => {
    const { breaker, primary, fallback } = make(3);
    primary.setFail(true);
    await expect(breaker.synth(REQ)).resolves.toBe('/piper.wav'); // does not go mute
    expect(primary.calls.n).toBe(1);
    expect(fallback.calls.n).toBe(1);
    expect(breaker.isOpen()).toBe(false); // 1 < 3
  });

  it('after N consecutive failures it OPENS: stops trying the primary and goes straight to the fallback', async () => {
    const { breaker, primary, fallback } = make(3);
    primary.setFail(true);
    for (let i = 0; i < 3; i++) await breaker.synth(REQ); // 3 failures -> opens
    expect(breaker.isOpen()).toBe(true);
    expect(primary.calls.n).toBe(3);

    // While open, the primary is NOT called (avoids the 15s stall).
    await expect(breaker.synth(REQ)).resolves.toBe('/piper.wav');
    await breaker.synth(REQ);
    expect(primary.calls.n).toBe(3); // unchanged
    expect(fallback.calls.n).toBe(5); // 3 (degradation) + 2 (open)
  });

  it('HALF-OPEN after the cooldown: re-probes the primary; success CLOSES', async () => {
    const { breaker, primary, advance } = make(3, 60_000);
    primary.setFail(true);
    for (let i = 0; i < 3; i++) await breaker.synth(REQ); // opens
    expect(breaker.isOpen()).toBe(true);

    advance(60_000); // cooldown expires
    expect(breaker.isOpen()).toBe(false);
    primary.setFail(false); // Google recovered
    await expect(breaker.synth(REQ)).resolves.toBe('/gtts.wav'); // probes and closes
    expect(primary.calls.n).toBe(4);
    // Already closed: keeps using the primary.
    await breaker.synth(REQ);
    expect(primary.calls.n).toBe(5);
    expect(breaker.isOpen()).toBe(false);
  });

  it('HALF-OPEN with failure REOPENS for another cooldown', async () => {
    const { breaker, primary, advance } = make(3, 60_000);
    primary.setFail(true);
    for (let i = 0; i < 3; i++) await breaker.synth(REQ); // opens
    advance(60_000);
    await breaker.synth(REQ); // probes, fails -> reopens
    expect(breaker.isOpen()).toBe(true);
    expect(primary.calls.n).toBe(4); // one probe
  });

  it('HALF-OPEN: concurrent requests only probe the primary ONCE (the rest go to the fallback)', async () => {
    const { breaker, primary, fallback, advance } = make(3, 60_000);
    primary.setFail(true);
    for (let i = 0; i < 3; i++) await breaker.synth(REQ); // opens
    advance(60_000); // cooldown expires -> half-open
    primary.calls.n = 0;
    fallback.calls.n = 0;
    // Google still down. 5 concurrent requests arrive before the 1st probe
    // resolves: only ONE should touch the primary; the other 4 go straight to the fallback.
    const results = await Promise.all(Array.from({ length: 5 }, () => breaker.synth(REQ)));
    expect(primary.calls.n).toBe(1); // a single probe, not 5 stalls
    expect(results.every((r) => r === '/piper.wav')).toBe(true); // all served fallback
    expect(breaker.isOpen()).toBe(true); // the probe failed -> reopened
  });

  it('a success resets the failure counter (does not open with scattered failures)', async () => {
    const { breaker, primary } = make(3);
    primary.setFail(true);
    await breaker.synth(REQ); // failure 1
    await breaker.synth(REQ); // failure 2
    primary.setFail(false);
    await breaker.synth(REQ); // success -> resets
    primary.setFail(true);
    await breaker.synth(REQ); // failure 1 (not 3)
    expect(breaker.isOpen()).toBe(false);
  });
});
