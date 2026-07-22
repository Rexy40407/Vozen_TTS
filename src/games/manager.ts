import type { Game, GameContext, GameEnv, GameMessage, Sendable, TimerHandle } from './types';

/** Internal state of an active match (one per guild). */
interface Session {
  guildId: string;
  channelId: string;
  /** User who started the game, used for scoped stop authorization. */
  starterId?: string;
  game: Game;
  timers: Set<TimerHandle>;
  /** Points accumulated in this match (userId -> points), persisted at the end. */
  points: Map<string, number>;
  ended: boolean;
  seed: number;
  /** Does the game use the call (voice games)? Decides whether a VOICE EXIT should end it. */
  needsVoice: boolean;
  /** Game locale (that of WHOEVER started it) — decides the language of the text AND the content. */
  locale: string;
  /**
   * PARENT channel when the game runs in a disposable THREAD (channelId = the thread's id).
   * undefined = game in the channel itself (no thread). On end, the winner summary
   * goes to the parent (survives) and the thread is deleted 5s later.
   */
  parentChannelId?: string;
}

/** Delay (ms) between the game ending and deleting the thread — gives time to see the result. */
const THREAD_DELETE_DELAY_MS = 5000;

/** Raw message that reaches the manager from the message handler. */
export interface IncomingMessage {
  guildId: string;
  channelId: string;
  authorId: string;
  authorName: string;
  content: string;
  /** Whether this message's author may make the bot speak in its current voice channel. */
  canTriggerSpeech: boolean;
}

export type StartResult = 'started' | 'already-active';

/**
 * GameManager — the heart of /game. Ensures ONE active game per GUILD (not per channel):
 * there is a single voice connection per guild (deps.players is keyed by guildId), and voice
 * games speak over that connection — two games in different channels of the same guild
 * would scramble the audio. Board games (pure text, future Wave 3) may
 * relax to per-channel, but the base lock is per-guild.
 *
 * Responsibilities:
 *  - per-guild lock (start refuses if there is already a game);
 *  - route messages from the game's CHANNEL to the match (and signal "consumed"
 *    to the handler, which then does NOT read the message aloud);
 *  - own the session's timers and ALWAYS CANCEL THEM at the end (the classic
 *    ghost-timer bug: the AloneWatcher now leaves immediately when the channel empties,
 *    so a match can be aborted mid-way — endGuild handles that);
 *  - persist the points on a NORMAL end (end); discard on a FORCED end (stop/endGuild).
 *
 * Nothing here touches discord.js/SQLite directly: everything goes through the injected GameEnv.
 */
export class GameManager {
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly env: GameEnv) {}

  /** Is there an active game in this guild? */
  active(guildId: string): boolean {
    return this.sessions.has(guildId);
  }

  /** Channel where this guild's active game is running (null if there is no game). */
  channelOf(guildId: string): string | null {
    return this.sessions.get(guildId)?.channelId ?? null;
  }

  /** Whether `userId` started the active game in this guild. */
  isStarter(guildId: string, userId: string): boolean {
    return this.sessions.get(guildId)?.starterId === userId;
  }

  /**
   * Starts `game` in the given channel. Returns 'already-active' if there is already a game
   * in this guild (the caller translates that into a friendly message). `game.start` may
   * be async; an error in it is swallowed+logged (never crashes the command).
   */
  start(
    guildId: string,
    channelId: string,
    game: Game,
    needsVoice = true,
    locale?: string,
    parentChannelId?: string,
    starterId?: string,
  ): StartResult {
    if (this.sessions.has(guildId)) return 'already-active';
    const session: Session = {
      guildId,
      channelId,
      starterId,
      game,
      timers: new Set(),
      points: new Map(),
      ended: false,
      seed: this.env.clock.now(),
      needsVoice,
      // Locale of whoever started it (e.g. 'pt'); without it, falls back to the guild's locale.
      locale: locale || this.env.localeOf(guildId),
      // If channelId is a thread, parentChannelId is the channel where /game play was issued.
      parentChannelId,
    };
    this.sessions.set(guildId, session);
    const ctx = this.makeContext(session);
    Promise.resolve()
      .then(() => game.start(ctx))
      .catch((err) => this.env.logError(`[game] start ${game.id}`, err));
    return 'started';
  }

  /**
   * A message arrived. Returns TRUE if it was CONSUMED — i.e. there is an active game IN
   * ITS CHANNEL — in which case the message handler must NOT read it aloud (players'
   * answers are not TTS). Messages in other channels of the guild (or with no
   * game) return false and follow the normal auto-read flow.
   *
   * The manager must NOT receive the bot's own messages (the handler already filters them
   * before calling this), so any message arriving here in the right channel is
   * a potential guess.
   */
  handleMessage(msg: IncomingMessage): boolean {
    const session = this.sessions.get(msg.guildId);
    if (!session || session.ended) return false;
    if (session.channelId !== msg.channelId) return false;
    const ctx = this.makeContext(session, msg.canTriggerSpeech);
    const gm: GameMessage = {
      authorId: msg.authorId,
      authorName: msg.authorName,
      content: msg.content,
    };
    Promise.resolve()
      .then(() => session.game.onMessage(ctx, gm))
      .catch((err) => this.env.logError(`[game] onMessage ${session.game.id}`, err));
    return true;
  }

  /**
   * Stops the guild's active game (an admin's /game stop command). Discards the accumulated
   * points (aborted match, does not count). Returns false if there was no game.
   */
  stop(guildId: string): boolean {
    const s = this.sessions.get(guildId);
    if (!s) return false;
    this.teardown(s, false);
    return true;
  }

  /**
   * The bot LEFT THE CALL of this guild (exit funnel `removePlayer`: /leave, alone,
   * reconnection-giving-up). Only ends the game if IT NEEDS voice — a board
   * game (text) must not die because the call emptied. For voice games, it kills
   * the round timers so they don't keep calling `player.say` on a destroyed player (the
   * ghost-timer bug). Does not persist (interrupted match).
   */
  onVoiceLeft(guildId: string): void {
    const s = this.sessions.get(guildId);
    if (s && s.needsVoice) this.teardown(s, false);
  }

  /**
   * FORCED teardown of ANY active game: the guild was removed (kick/leave) or a
   * shutdown. Called from `handleGuildDelete`. Does not persist — interrupted match.
   */
  endGuild(guildId: string): void {
    const s = this.sessions.get(guildId);
    if (s) this.teardown(s, false);
  }

  private teardown(s: Session, persist: boolean): void {
    if (s.ended) return;
    s.ended = true;
    for (const h of s.timers) this.env.clock.clearTimeout(h);
    s.timers.clear();
    this.sessions.delete(s.guildId);
    if (persist && s.points.size > 0) {
      try {
        this.env.persistScores(s.guildId, s.points);
      } catch (err) {
        this.env.logError('[game] persistScores', err);
      }
    }
    // Game in a THREAD: the summary goes to the PARENT channel (the thread will disappear) and the
    // thread is deleted after a small delay, to give time to see the result.
    if (s.parentChannelId) this.finishThread(s, persist);
  }

  /**
   * Closing a game in a thread: announces in the parent channel (winner by points, or "ended"
   * if there were no points/it was aborted) and schedules the thread deletion. The delete timer is
   * DELIBERATELY independent of the session (which has already been removed and had its timers cleared):
   * a one-shot on the env's clock, not tracked. All best-effort — never throws.
   */
  private finishThread(s: Session, persist: boolean): void {
    const parent = s.parentChannelId!;
    const threadId = s.channelId;
    // Winner = whoever scored the most (the mention <@id> renders the name without us needing it).
    let summary: Sendable;
    if (persist && s.points.size > 0) {
      let winnerId = '';
      let best = -Infinity;
      for (const [id, pts] of s.points) if (pts > best) ((best = pts), (winnerId = id));
      summary = this.env.translate('game.thread.winner', s.locale, { winner: `<@${winnerId}>` });
    } else {
      summary = this.env.translate('game.thread.ended', s.locale);
    }
    void this.env.sendToChannel(parent, summary).catch(() => {});
    if (this.env.deleteChannel) {
      this.env.clock.setTimeout(() => {
        void this.env.deleteChannel!(threadId);
      }, THREAD_DELETE_DELAY_MS);
    }
  }

  private makeContext(s: Session, canTriggerSpeech = true): GameContext {
    const env = this.env;
    return {
      guildId: s.guildId,
      channelId: s.channelId,
      locale: s.locale,
      seed: s.seed,
      availableModels: env.availableModels,
      defaultVoice: env.defaultVoiceOf(s.guildId),
      say: async (text: string, opts): Promise<boolean> => {
        if (!canTriggerSpeech) return false;
        const player = env.getPlayer(s.guildId);
        if (!player) return false;
        try {
          return await player.say({
            text,
            model: opts?.model || env.defaultVoiceOf(s.guildId),
            speed: opts?.speed ?? env.defaultSpeed,
            // The language/voice of a game announcement is DELIBERATE — detection must never
            // override it (as in /joke, /laugh, /voice preview).
            singleVoice: true,
          });
        } catch (err) {
          env.logError('[game] say', err);
          return false;
        }
      },
      send: async (content: Sendable): Promise<void> => {
        try {
          await env.sendToChannel(s.channelId, content);
        } catch (err) {
          env.logError('[game] send', err);
        }
      },
      t: (key, params) => env.translate(key, s.locale, params),
      emoji: (name) => env.boardEmojis?.[name],
      after: (ms, fn): void => {
        if (s.ended) return;
        const handle = env.clock.setTimeout(() => {
          s.timers.delete(handle);
          if (s.ended) return;
          try {
            fn();
          } catch (err) {
            env.logError('[game] timer', err);
          }
        }, ms);
        s.timers.add(handle);
      },
      award: (userId, points): void => {
        s.points.set(userId, (s.points.get(userId) ?? 0) + points);
      },
      end: (): void => this.teardown(s, true),
    };
  }
}
