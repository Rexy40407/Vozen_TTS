// src/commands/transcribeGate.ts
//
// PURE gates for /transcribe (Phase 4): they decide WITHOUT IO whether transcription can
// start and when it should auto-stop. The handler (integration) translates the verdict into
// a response/action. Keeping it here makes the sensitive logic (authz + entitlement +
// availability) testable without depending on discord.js.

export interface TranscribeStartInput {
  /** Has the Manage Guild permission (only admins start the server's transcription). */
  canManage: boolean;
  /** The server is Premium (STT is gated to Premium — see spike: little concurrency on the VPS). */
  isPremium: boolean;
  /** The Whisper sidecar is installed on this instance (resolveWhisperCmd != null). */
  sidecarAvailable: boolean;
  /** The bot is in a call in this server (there is a voice connection). */
  botInVoice: boolean;
  /** A transcription session is already running in this server. */
  alreadyRunning: boolean;
  /**
   * The GLOBAL cap of concurrent STT sessions (all guilds, whole process) has already been
   * reached — plan 029/ABUSE-01. Each session starts a dedicated Python process with its
   * own Whisper model in RAM (unlike Kokoro, which is a shared singleton); without a cap,
   * N Premium guilds transcribing at the same time could OOM the whole process (all guilds
   * lose TTS, not just STT degrading).
   */
  atCapacity: boolean;
}

export type TranscribeStartVerdict =
  'ok' | 'noManage' | 'notPremium' | 'unavailable' | 'notInVoice' | 'alreadyRunning' | 'atCapacity';

/**
 * Gate order: authz (Manage-Guild) BEFORE entitlement (Premium) — to whoever cannot manage
 * the server we say "you don't have permission", not "buy Premium". Then availability
 * (sidecar), presence in the call, a session already running IN THIS guild, and only last the
 * GLOBAL cap (atCapacity). The per-guild states come BEFORE the global one on purpose: they
 * are more specific and more useful to the caller ("it's already running here" > "the system
 * is full") — and it avoids showing "system full" to someone who would in fact just be
 * "already running".
 */
export function evaluateTranscribeStart(i: TranscribeStartInput): TranscribeStartVerdict {
  if (!i.canManage) return 'noManage';
  if (!i.isPremium) return 'notPremium';
  if (!i.sidecarAvailable) return 'unavailable';
  if (!i.botInVoice) return 'notInVoice';
  if (i.alreadyRunning) return 'alreadyRunning';
  if (i.atCapacity) return 'atCapacity';
  return 'ok';
}

/**
 * Should the session auto-stop? It stops when the call has no HUMANS left, or — after there
 * has already been at least one consent in this session (`everConsented`) — when no consented
 * person remains in the call. `everConsented` avoids the insta-stop at startup (before anyone
 * presses the button, nobody is consented, but that is not a reason to stop).
 */
export function shouldAutoStop(
  humanIdsInChannel: string[],
  hasConsent: (userId: string) => boolean,
  everConsented: boolean,
): boolean {
  if (humanIdsInChannel.length === 0) return true;
  if (!everConsented) return false;
  return humanIdsInChannel.every((id) => !hasConsent(id));
}

/**
 * Language to FORCE on transcription: the one chosen in the command (`/transcribe start
 * language:…`) wins; without a choice, it falls back to the server locale. Normalizes to
 * lowercase without spaces (a clean ISO code for the Whisper sidecar).
 */
export function resolveTranscribeLang(
  chosen: string | null | undefined,
  guildLocale: string,
): string {
  const c = (chosen ?? '').trim().toLowerCase();
  return c || guildLocale;
}
