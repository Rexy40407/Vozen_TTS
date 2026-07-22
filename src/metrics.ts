// src/metrics.ts
// Simple singleton of in-memory counters for observability.
// No external dependencies; reset() available for isolation in tests.

export interface MetricsSnapshot {
  messagesSpoken: number;
  cacheHits: number;
  cacheMisses: number;
  synthErrors: number;
  // Messages SKIPPED by rate-limit (N/min per-user limit). Previously the drop was
  // silent (no log, no metric) — it looked like "the bot doesn't speak". Now it's observable.
  messagesRateLimited: number;
  // Voice reconnection (P7.4): drops detected and successful reconnections.
  voiceDrops: number;
  voiceReconnects: number;
  // top.gg votes (P11.5): valid upvotes received via webhook. "test" pings from the
  // top.gg dashboard DON'T count (only type === "upvote").
  votes: number;
  // Event-loop stalls detected (health/loopLag). A loop blocked >~400ms delays
  // EVERYTHING — especially autocomplete, which has a ~3s budget without a defer.
  loopStalls: number;
  // Synthesis latency (T0.2): total number of syntheses measured + p50/p95 (ms) of the
  // LAST N samples (sliding window). p50/p95 = 0 if there are no samples yet.
  synthCount: number;
  synthP50Ms: number;
  synthP95Ms: number;
  // Google HD engine (gcloud, Premium perk): REAL syntheses done via Google (cache-miss),
  // total chars billed to Google, and how many times it fell back to gTTS due to
  // budget/limit (fallback). COST observability — every char counts ($4/1M).
  gcloudSynths: number;
  gcloudChars: number;
  gcloudFallbacks: number;
  /** Live-STT jobs rejected before sidecar execution because the bounded queue is saturated/expired. */
  sttOverloads: number;
}

/** Size of the sliding window of latencies kept in memory. */
const SYNTH_SAMPLE_WINDOW = 512;

/** Percentile `p` (0-100) of an ALREADY-sorted array; 0 if empty. */
function percentileOf(sortedMs: number[], p: number): number {
  if (sortedMs.length === 0) return 0;
  const idx = Math.min(sortedMs.length - 1, Math.floor((p / 100) * sortedMs.length));
  return sortedMs[idx];
}

class Metrics {
  messagesSpoken = 0;
  cacheHits = 0;
  cacheMisses = 0;
  synthErrors = 0;
  messagesRateLimited = 0;
  voiceDrops = 0;
  voiceReconnects = 0;
  votes = 0;
  loopStalls = 0;
  gcloudSynths = 0;
  gcloudChars = 0;
  gcloudFallbacks = 0;
  sttOverloads = 0;
  // Latency: total counter + sliding window of the last samples (ms).
  synthCount = 0;
  private synthMs: number[] = [];

  /**
   * Increments a scalar counter by name. NOTE: only the purely numeric-scalar counters
   * (not the latency ones) — latency uses recordSynthMs().
   */
  inc(counter: Exclude<keyof MetricsSnapshot, 'synthCount' | 'synthP50Ms' | 'synthP95Ms'>): void {
    (this[counter] as number)++;
  }

  /** Adds `amount` to a scalar counter (e.g. gcloudChars, which grows by N chars). */
  add(
    counter: Exclude<keyof MetricsSnapshot, 'synthCount' | 'synthP50Ms' | 'synthP95Ms'>,
    amount: number,
  ): void {
    (this[counter] as number) += amount;
  }

  /** Records the latency (ms) of ONE synthesis. Keeps a sliding window. */
  recordSynthMs(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) return;
    this.synthCount++;
    this.synthMs.push(ms);
    if (this.synthMs.length > SYNTH_SAMPLE_WINDOW) this.synthMs.shift();
  }

  /** Returns an instant copy of the counters (non-destructive read). */
  snapshot(): MetricsSnapshot {
    const sorted = [...this.synthMs].sort((a, b) => a - b);
    return {
      messagesSpoken: this.messagesSpoken,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      synthErrors: this.synthErrors,
      messagesRateLimited: this.messagesRateLimited,
      voiceDrops: this.voiceDrops,
      voiceReconnects: this.voiceReconnects,
      votes: this.votes,
      loopStalls: this.loopStalls,
      synthCount: this.synthCount,
      synthP50Ms: Math.round(percentileOf(sorted, 50)),
      synthP95Ms: Math.round(percentileOf(sorted, 95)),
      gcloudSynths: this.gcloudSynths,
      gcloudChars: this.gcloudChars,
      gcloudFallbacks: this.gcloudFallbacks,
      sttOverloads: this.sttOverloads,
    };
  }

  /** Resets all counters to zero. Used in tests to isolate cases. */
  reset(): void {
    this.messagesSpoken = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.synthErrors = 0;
    this.messagesRateLimited = 0;
    this.voiceDrops = 0;
    this.voiceReconnects = 0;
    this.votes = 0;
    this.loopStalls = 0;
    this.gcloudSynths = 0;
    this.gcloudChars = 0;
    this.gcloudFallbacks = 0;
    this.sttOverloads = 0;
    this.synthCount = 0;
    this.synthMs = [];
  }
}

export const metrics = new Metrics();
