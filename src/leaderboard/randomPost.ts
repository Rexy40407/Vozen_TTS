// src/leaderboard/randomPost.ts — automatic leaderboard that "shows up every now and then".
//
// From time to time, Vozen posts the top chatters (the same as /top-speakers) in the /setup
// channel. It's triggered by ACTIVITY (messages read), NOT by a timer — this way it never
// posts in dead channels and the tests are deterministic (injectable clock + randomness).
// In-memory per-guild state (reset on restart is acceptable; the message threshold avoids
// a re-post right after a deploy). Cap + evict, like GreetCooldown.

import type { TalkRow } from '../store/talkStats';
import { t } from '../i18n/index';

/** Minimum messages read (accumulated since the last post) before it can appear. */
export const MIN_MESSAGES = 30;
/** Minimum interval between posts in the same guild. */
export const COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12h
/** Probability of appearing on an ALREADY-eligible message — gives the "random" effect. */
export const POST_PROBABILITY = 0.15;
/** Cap of guilds in memory (anti-growth); evict the oldest when exceeded. */
const MAX_ENTRIES = 10_000;

interface GuildState {
  count: number;
  lastPostAt: number;
}

/**
 * Per-guild decider for the automatic leaderboard. Clock (`now`) and randomness (`rand`,
 * 0..1) injectable for tests. A shared instance lives in BotDeps (like GreetCooldown /
 * lastSpeaker).
 */
export class LeaderboardPoster {
  // Map preserves insertion order → the 1st key is the oldest (simple evict).
  private readonly state = new Map<string, GuildState>();

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly rand: () => number = Math.random,
  ) {}

  /**
   * Records a message read in the guild and decides whether the leaderboard should appear
   * NOW: true when there have been ≥ MIN_MESSAGES since the last post, the COOLDOWN has
   * passed, and a draw (POST_PROBABILITY) comes up — and in that case ZEROES the counter
   * and marks the instant. False otherwise (keeps accumulating). Call only when the message
   * was ACTUALLY read (otherwise it would count unspoken messages).
   */
  record(guildId: string): boolean {
    const s = this.state.get(guildId) ?? { count: 0, lastPostAt: 0 };
    s.count++;
    // re-insert at the end (MRU) so the evict hits the oldest guild
    this.state.delete(guildId);
    this.state.set(guildId, s);
    if (this.state.size > MAX_ENTRIES) {
      const oldest = this.state.keys().next().value as string | undefined;
      if (oldest !== undefined) this.state.delete(oldest);
    }
    if (s.count < MIN_MESSAGES) return false;
    if (this.now() - s.lastPostAt < COOLDOWN_MS) return false;
    if (this.rand() >= POST_PROBABILITY) return false; // not this time — keep accumulating
    s.count = 0;
    s.lastPostAt = this.now();
    return true;
  }
}

/**
 * Renders the automatic leaderboard (title + top lines) to send in the channel. PURE.
 * Reuses the SAME line as /top-speakers (topspeakers.line). The caller sends with mentions
 * SUPPRESSED (empty allowedMentions) — it's an unsolicited post, it shouldn't ping.
 */
export function renderLeaderboard(rows: TalkRow[], locale: string): string {
  const title = t('leaderboard.autoTitle', locale);
  const lines = rows.map((r, idx) =>
    t('topspeakers.line', locale, {
      rank: idx + 1,
      user: r.userId,
      count: r.count,
      streak: r.streak,
    }),
  );
  return `${title}\n${lines.join('\n')}`;
}
