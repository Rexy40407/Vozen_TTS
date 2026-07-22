// src/moderation/countGate.ts — anti-spam gate for the /top-speakers message COUNT.
//
// The leaderboard ranks by how many messages Vozen read for each person, so a burst of
// spam would inflate the ranking. This gate decides whether a read message COUNTS toward
// that total — it never affects whether the message is READ (voice output is unchanged).
// It is ALWAYS on (no per-guild config) and deliberately lenient so normal chat is never
// penalized; only floods and repetition are dropped.
//
// Three PURE heuristics per (guild, user), all measured against the LAST COUNTED message:
//  - COOLDOWN: at most one counted message every COUNT_COOLDOWN_MS.
//  - DEDUP: the same normalized content as the last counted one never counts again.
//  - CAP: at most COUNT_MAX_PER_MIN counted messages per rolling COUNT_WINDOW_MS.
// In-memory state with cap + evict (the DuplicateTracker pattern); clock injected per call.

import { normalizeForDuplicate } from './antispam';

/** Minimum gap between two COUNTED messages of the same person (burst throttle). */
export const COUNT_COOLDOWN_MS = 5000;
/** Rolling window for the per-person cap. */
export const COUNT_WINDOW_MS = 60_000;
/** Max messages counted per person within COUNT_WINDOW_MS. */
export const COUNT_MAX_PER_MIN = 10;
/** Cap on tracked (guild,user) entries (anti-growth); evicts the oldest when exceeded. */
const MAX_ENTRIES = 10_000;

interface GateEntry {
  /** Timestamp of the last COUNTED message. */
  lastTs: number;
  /** Normalized content of the last COUNTED message (for dedup). */
  lastContent: string;
  /** Timestamps of the counted messages still inside the rolling window (ascending). */
  window: number[];
}

/**
 * Per-(guild,user) gate deciding whether a read message counts toward /top-speakers.
 * Only messages that PASS update the state — a dropped (spam) message leaves the cooldown
 * and window anchored to the last legitimate message, so a flood cannot walk the window
 * forward. Mirrors DuplicateTracker: insertion-ordered Map, oldest-first eviction.
 */
export class CountGate {
  // Insertion order → the first key is the oldest (simple LRU-ish evict on the count path).
  private readonly state = new Map<string, GateEntry>();

  private static keyOf(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
  }

  /** Number of tracked entries (for tests / introspection). */
  size(): number {
    return this.state.size;
  }

  /**
   * Should this read message COUNT toward the speaker stats? Returns true and records the
   * message when it passes all heuristics; returns false (without counting) on cooldown,
   * repetition, or the per-minute cap. `content` is the cleaned message body; `nowMs` is the
   * clock (injected). PURE relative to its own state — no I/O.
   */
  shouldCount(guildId: string, userId: string, content: string, nowMs: number): boolean {
    const key = CountGate.keyOf(guildId, userId);
    const norm = normalizeForDuplicate(content);
    const entry = this.state.get(key);

    if (!entry) {
      this.state.set(key, { lastTs: nowMs, lastContent: norm, window: [nowMs] });
      this.evictIfNeeded();
      return true;
    }

    // COOLDOWN — too soon since the last counted message.
    if (nowMs - entry.lastTs < COUNT_COOLDOWN_MS) return false;
    // DEDUP — identical to the last counted message.
    if (norm === entry.lastContent) return false;
    // CAP — prune the window to the last COUNT_WINDOW_MS, then check the count.
    const cutoff = nowMs - COUNT_WINDOW_MS;
    const recent = entry.window.filter((t) => t > cutoff);
    if (recent.length >= COUNT_MAX_PER_MIN) {
      entry.window = recent; // keep the pruned window; do not count
      return false;
    }

    // Passes — record and move the entry to the end (MRU) so eviction hits the oldest.
    recent.push(nowMs);
    entry.lastTs = nowMs;
    entry.lastContent = norm;
    entry.window = recent;
    this.state.delete(key);
    this.state.set(key, entry);
    return true;
  }

  private evictIfNeeded(): void {
    if (this.state.size > MAX_ENTRIES) {
      const oldest = this.state.keys().next().value as string | undefined;
      if (oldest !== undefined) this.state.delete(oldest);
    }
  }
}
