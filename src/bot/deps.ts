import type Database from 'better-sqlite3';
import type { Client } from 'discord.js';
import type { AppConfig } from '../config/index';
import type { TTSEngine } from '../tts/engine';
import { GuildVoicePlayer } from '../voice/player';
import { RateLimiter } from '../moderation/rateLimiter';
import type { AloneWatcher } from '../voice/aloneWatcher';
import type { GreetCooldown } from '../voice/greetCooldown';
import type { LeaderboardPoster } from '../leaderboard/randomPost';
import type { VotePromoPoster } from '../votePromo';
import type { DuplicateTracker } from '../moderation/antispam';
import type { CountGate } from '../moderation/countGate';
import type { GameManager } from '../games/manager';
import { invalidateGuild } from '../store/cache';
import { forgetVoicePresence } from '../store/voicePresence';
import { stopTranscriptionForGuild } from '../commands/handlers/transcribe';
import { log } from '../logging/logger';
import type { TranslationProvider } from '../translation/provider';

export interface BotDeps {
  client: Client;
  db: Database.Database;
  engine: TTSEngine;
  config: AppConfig;
  availableModels: string[];
  players: Map<string, GuildVoicePlayer>;
  limiters: Map<string, { limiter: RateLimiter; perMin: number }>;
  /** Watches "alone in the call for 5 min" -> leaves. Injected at bootstrap; optional for tests. */
  aloneWatcher?: AloneWatcher;
  /**
   * Last author Vozen read OUT LOUD, per guild (guildId -> userId). Used by xsaid to
   * NOT repeat "{name} said" on CONSECUTIVE messages from the same author. Cleared when
   * the bot leaves (removePlayer) so it announces again on return. Optional: without the
   * map (e.g. old tests) there's no suppression (always announces).
   */
  lastSpeaker?: Map<string, string>;
  /**
   * 5-min cooldown on the join greeting, per (guild, user). Prevents call join/leave
   * spam from making Vozen repeat "Hello {name}"/birthday wishes. Injected at bootstrap;
   * optional (without it, always greets — old behavior). See greetCooldown.
   */
  greetCooldown?: GreetCooldown;
  /**
   * Decider for the automatic leaderboard (F2): every now and then posts the top chatters
   * in the /setup channel. In-memory per-guild state. Injected at bootstrap; optional
   * (without it, never appears). See leaderboard/randomPost.
   */
  leaderboardPoster?: LeaderboardPoster;
  /** Alternating Top.gg/support notices, persisted so restarts cannot bypass their cooldowns. */
  votePromoPoster?: VotePromoPoster;
  /**
   * Duplicate-message tracker (anti-spam), per (guild, author). Detects the same person
   * repeating the same large message within a short window. Only consulted when the guild
   * has `antispam` ON. Injected at bootstrap; optional (without it, only the intra-message
   * repetition heuristic applies). See src/moderation/antispam.
   */
  dupTracker?: DuplicateTracker;
  /**
   * Anti-spam gate for the /top-speakers message COUNT (NOT for reading). Decides whether a
   * read message counts toward the speaker stats — throttles bursts, drops repetitions and
   * caps per minute so a flood cannot inflate the leaderboard. ALWAYS injected in production;
   * optional so old tests that don't inject it count every read message (previous behavior).
   * See src/moderation/countGate.
   */
  countGate?: CountGate;
  /**
   * Manager for the minigames (/game). One active game per guild. Optional (old tests
   * don't inject it; without it there are no games, just normal TTS). See src/games.
   */
  games?: GameManager;
  /**
   * IDs of the bot OWNER(S), resolved at ClientReady via client.application (User or Team
   * members) + OWNER_ID. Source of truth for the /vozen-grant gate (owner-only) — not
   * spoofable via env. Empty/absent => no grant is authorized.
   */
  ownerIds?: Set<string>;
  /** Optional external text translation provider. Absent has the same safe behaviour as disabled. */
  translationProvider?: TranslationProvider;
}

export function getPlayer(deps: BotDeps, guildId: string): GuildVoicePlayer | undefined {
  return deps.players.get(guildId);
}

export function removePlayer(
  deps: Pick<BotDeps, 'players' | 'aloneWatcher' | 'lastSpeaker' | 'games'> &
    Partial<Pick<BotDeps, 'db'>>,
  guildId: string,
): void {
  // Cancel the "alone" timer BEFORE anything else. This is the FUNNEL for all exits
  // (/leave, guildDelete, reconnection-giveup, alone-exit), so clearing here guarantees
  // an armed timer never survives to tear down a NEW session installed in the meantime
  // (the classic phantom-timer bug).
  deps.aloneWatcher?.clear(guildId);
  // Same reason for VOICE GAMES: if the bot leaves the call (e.g. AloneWatcher exits
  // immediately when the channel empties) mid voice match, the round timers must die
  // here — otherwise they'd stay alive calling player.say on a destroyed player.
  // `onVoiceLeft` only ends games that NEED voice: a board game (text) should not die
  // from an unrelated voice exit. The full teardown of any game (guild removed) lives
  // in handleGuildDelete.
  deps.games?.onVoiceLeft(guildId);
  // STT: if there was a transcription session, it dies with the call exit — otherwise
  // the Whisper sidecar, the speaking listener and the auto-stop interval would be orphaned.
  stopTranscriptionForGuild(guildId);
  // Forget the last speaker: on returning to the call, xsaid announces who spoke again.
  deps.lastSpeaker?.delete(guildId);
  // Planned deploy resume is only for calls that were live at shutdown. Any normal
  // leave (manual, alone, lost connection, guild removal) must clear the saved channel.
  if (deps.db) forgetVoicePresence(deps.db, guildId);
  const p = deps.players.get(guildId);
  if (p) {
    p.destroy();
    deps.players.delete(guildId);
  }
}

/**
 * Vozen left (or lost access to) a guild — Events.GuildDelete. Releases the resources
 * held by guildId to avoid monotonic heap growth over long uptime with many guilds:
 *  - deletes the `limiters` entry (and all the RateLimiter buckets inside);
 *  - removes/destroys the player (leaves the voice channel if still there).
 *
 * Pure/testable function (like shutdown): the event handler in client.ts just calls it.
 * try/catch to NEVER crash the gateway. Idempotent: if the guild no longer exists,
 * `.delete` and removePlayer are no-ops.
 */
export function handleGuildDelete(
  deps: Pick<BotDeps, 'players' | 'limiters' | 'aloneWatcher' | 'games'> &
    Partial<Pick<BotDeps, 'votePromoPoster'>> &
    Partial<Pick<BotDeps, 'db'>>,
  guildId: string,
): void {
  try {
    deps.limiters.delete(guildId);
    removePlayer(deps, guildId);
    // The guild is gone: end ANY active game (incl. board games), which
    // removePlayer/onVoiceLeft would leave alive if it didn't need voice — otherwise the
    // session stays stuck in the map (leak) after the guild leaves.
    deps.games?.endGuild(guildId);
    deps.votePromoPoster?.forget(guildId);
    // Release the store cache entries for this guild (memory bound).
    if (deps.db) invalidateGuild(deps.db, guildId);
    // 24/7 in-call: the guild is gone -> forget the presence (don't restore on startup).
    if (deps.db) forgetVoicePresence(deps.db, guildId);
  } catch (err) {
    log.warn('[client] failed to release guild resources on guildDelete (ignored)', err);
  }
}

export function getLimiter(deps: BotDeps, guildId: string, perMin: number): RateLimiter {
  let entry = deps.limiters.get(guildId);
  // Recreate the limiter when perMin changes (e.g. /config rate-limit at runtime).
  if (!entry || entry.perMin !== perMin) {
    entry = { limiter: new RateLimiter(perMin), perMin };
    deps.limiters.set(guildId, entry);
  }
  return entry.limiter;
}
