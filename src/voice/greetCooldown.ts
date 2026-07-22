// src/voice/greetCooldown.ts — cooldown for the call-join greeting (plan 017).
//
// PROBLEM: without a cooldown, anyone who spams JOIN/LEAVE of the bot's channel makes
// Vozen say "Hello {name}" (or the birthday wish) non-stop — annoying and noisy.
// SOLUTION: per (guild, user), greet only once every GREET_COOLDOWN_MS. It's a FIXED
// WINDOW: a suppressed request does NOT extend the window (otherwise a continuous
// spammer would never be greeted again), so the timestamp is only renewed when the
// greeting ACTUALLY goes out.
//
// In-memory state (does not persist; a reset on restart is acceptable). Cap + evict of
// the oldest entry (anti-growth), same pattern as langMemory.

/** Cooldown window: 5 minutes. Constant — not configurable (Diogo's decision). */
export const GREET_COOLDOWN_MS = 5 * 60 * 1000;
/** Entry ceiling (anti-growth); evict the oldest one when exceeded. */
const MAX_ENTRIES = 10_000;

/**
 * Per (guild, user) cooldown for the join greeting. Injectable clock for tests.
 * A shared instance lives in BotDeps (like lastSpeaker).
 */
export class GreetCooldown {
  // Map preserves insertion order → the 1st key is the oldest (simple evict).
  private readonly last = new Map<string, number>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  private static keyOf(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
  }

  /**
   * Should the greeting to (guild, user) go out NOW? True if never greeted or if
   * ≥ GREET_COOLDOWN_MS have already passed since the last greeting — and in that case
   * it RECORDS the instant (consumes the window). False within the window, WITHOUT
   * renewing the timestamp (fixed window: join/leave spam doesn't extend it). Call it
   * only when there really is a greeting to say (otherwise it would waste the window).
   */
  shouldGreet(guildId: string, userId: string): boolean {
    const key = GreetCooldown.keyOf(guildId, userId);
    const nowMs = this.now();
    const prev = this.last.get(key);
    if (prev !== undefined && nowMs - prev < GREET_COOLDOWN_MS) return false;
    this.last.delete(key); // reinsert at the end (MRU) so the evict hits the oldest
    this.last.set(key, nowMs);
    if (this.last.size > MAX_ENTRIES) {
      const oldest = this.last.keys().next().value as string | undefined;
      if (oldest !== undefined) this.last.delete(oldest);
    }
    return true;
  }
}
