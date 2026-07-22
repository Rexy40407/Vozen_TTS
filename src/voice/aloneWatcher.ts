// src/voice/aloneWatcher.ts
//
// Vozen's leave rule: it ONLY leaves the voice channel when it is ALONE — zero human
// members (non-bots) in its channel. By DEFAULT it leaves IMMEDIATELY (ALONE_LEAVE_MS=0).
// It NO LONGER leaves on TTS inactivity (that exit was removed from the player): however
// long it goes without speaking, it stays in the call as long as there is at least 1 human.
// Reacts to VoiceStateUpdate.
//
// Optional tolerance: with a `leaveMs` > 0 (injectable), it waits that window before
// leaving and RE-CHECKS on firing whether it is still alone (defense against leaving when
// someone re-enters at the last moment). With leaveMs <= 0 (default) it leaves right away —
// there is no window where someone could re-enter, so no timer or re-check is needed.
//
// Defense against the "ghost-timer kills the NEW session" bug: the timer (when it exists) is
// cleared in `removePlayer` (the funnel of ALL exits — /leave, guildDelete, reconnection
// giving up, and the alone-leave itself). PURE/testable: the human count, the leave, and the
// timers are injected (default = global setTimeout/clearTimeout).

/** Alone in the call -> leaves. 0 = immediate (default); > 0 = tolerance before leaving. */
export const ALONE_LEAVE_MS = 0;

export interface AloneWatcherDeps {
  /** ms alone until leaving (default ALONE_LEAVE_MS). */
  leaveMs?: number;
  /**
   * Number of humans (non-bots) in the bot's voice channel in this guild. `null` = the bot
   * is NOT in a voice channel (nothing to watch -> any timer is cancelled).
   */
  humansInBotChannel: (guildId: string) => number | null;
  /** Performs the guild leave (removePlayer + destroy the connection). */
  leave: (guildId: string) => void;
  /**
   * 24/7 in-call (Premium): true => the guild STAYS in the channel even when alone (never
   * kicked by the "alone" rule). Default = () => false (Free behavior unchanged; all
   * existing tests remain the same).
   */
  stayInCall?: (guildId: string) => boolean;
  /** Injectable for tests; default = global setTimeout/clearTimeout. */
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (t: ReturnType<typeof setTimeout>) => void;
}

export class AloneWatcher {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly leaveMs: number;
  private readonly set: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  private readonly clr: (t: ReturnType<typeof setTimeout>) => void;
  private readonly humans: (guildId: string) => number | null;
  private readonly doLeave: (guildId: string) => void;
  private readonly stayInCall: (guildId: string) => boolean;

  constructor(d: AloneWatcherDeps) {
    this.leaveMs = d.leaveMs ?? ALONE_LEAVE_MS;
    this.humans = d.humansInBotChannel;
    this.doLeave = d.leave;
    this.stayInCall = d.stayInCall ?? (() => false);
    this.set = d.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clr = d.clearTimer ?? ((t) => clearTimeout(t));
  }

  /**
   * Re-evaluates the guild after a voice-state change. Arms the timer if the bot became
   * ALONE; cancels it if there is someone (or if the bot is no longer in voice). Idempotent:
   * already counting does not re-arm (does not stretch the 5-min window on every mute/deafen).
   */
  evaluate(guildId: string): void {
    const n = this.humans(guildId);
    if (n === null || n > 0) {
      this.clear(guildId);
      return;
    }
    // n === 0 -> alone.
    // 24/7 in-call (Premium): the guild stays in the channel even when alone — NEVER leaves
    // by this rule. Cancels any pending timer (e.g. lost Premium and got it back) and returns
    // without kicking. Free keeps leaving as before.
    if (this.stayInCall(guildId)) {
      this.clear(guildId);
      return;
    }
    // IMMEDIATE leave (leaveMs <= 0, the default): we just READ 0 humans right now, so we
    // leave right away — no timer or re-check (there is no window for someone to re-enter).
    if (this.leaveMs <= 0) {
      this.clear(guildId); // cancels a pending timer from an earlier config (defensive)
      this.doLeave(guildId);
      return;
    }
    // leaveMs > 0: tolerance window with re-check on firing.
    if (this.timers.has(guildId)) return;
    const t = this.set(() => {
      this.timers.delete(guildId);
      // RE-CHECKS on firing: someone may have entered at the last moment (before the
      // corresponding VoiceStateUpdate cancels the timer). Only leaves if STILL alone.
      if (this.humans(guildId) === 0) this.doLeave(guildId);
    }, this.leaveMs);
    this.timers.set(guildId, t);
  }

  /**
   * Cancels a guild's "alone" timer. Called by `removePlayer` (all exit paths) so the timer
   * never survives into a new session. Idempotent.
   */
  clear(guildId: string): void {
    const t = this.timers.get(guildId);
    if (t !== undefined) {
      this.clr(t);
      this.timers.delete(guildId);
    }
  }

  /** Number of guilds with a leave timer armed (for tests/telemetry). */
  pendingCount(): number {
    return this.timers.size;
  }
}
