// Startup voice rejoin — PURE planning. Decides, from the persisted
// presences (voice_presence), what to restore and what to forget, WITHOUT touching discord.js
// or the DB (the predicates are injected). The real wiring (createVoiceSession + DELETE) lives
// in ClientReady in index.ts; here only the policy, so it is testable.

import type { VoicePresenceRow } from '../store/voicePresence';

/**
 * State of the persisted channel, resolved against Discord at startup time:
 *  - 'ready'    -> the channel exists, is a voice channel and the bot has Connect+Speak -> restore.
 *  - 'no-perms' -> exists but permissions are missing -> do NOT restore, but KEEP the row (the
 *                  permissions may come back; it is retried on the next startup).
 *  - 'gone'     -> channel deleted / no longer a voice channel -> forget (dead row).
 */
export type ChannelState = 'ready' | 'no-perms' | 'gone';

export interface RejoinPolicyDeps {
  /** Should this guild be restored on this startup? (24/7 Premium or one-shot deploy recovery.) */
  stayInCall: (guildId: string) => boolean;
  /** Current state of this guild's persisted channel. */
  channelState: (guildId: string, channelId: string) => ChannelState;
}

export interface RejoinPlan {
  /** Guilds to restore into the call (createVoiceSession). */
  rejoin: VoicePresenceRow[];
  /** Guilds whose row should be deleted (not eligible for this startup or dead channel). */
  forget: string[];
}

/**
 * Decides the startup rejoin. Rules, per persisted row:
 *  - not eligible now       -> forget (safety net: cleans up stale rows).
 *  - eligible + 'gone'      -> forget (the channel disappeared).
 *  - eligible + 'no-perms'  -> nothing (keeps the row; retries on the next startup).
 *  - eligible + 'ready'     -> restore.
 */
export function planRejoin(rows: VoicePresenceRow[], deps: RejoinPolicyDeps): RejoinPlan {
  const rejoin: VoicePresenceRow[] = [];
  const forget: string[] = [];
  for (const row of rows) {
    if (!deps.stayInCall(row.guildId)) {
      forget.push(row.guildId);
      continue;
    }
    const state = deps.channelState(row.guildId, row.channelId);
    if (state === 'gone') {
      forget.push(row.guildId);
    } else if (state === 'ready') {
      rejoin.push(row);
    }
    // 'no-perms' -> neither restore nor forget.
  }
  return { rejoin, forget };
}
