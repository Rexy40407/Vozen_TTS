// src/voice/transcriptionSession.ts
//
// Orchestrates the live TRANSCRIPTION of a voice channel (Phase 4). For each speaker who
// starts talking: (1) consent-first GATE — only those who consented on this server are
// captured; (2) captures the utterance (800ms of silence closes it); (3) WAV -> Whisper
// sidecar -> text; (4) posts "**Name:** text" in the channel (if it isn't empty noise). The
// CAPTURE itself (the receiver's Opus plumbing) lives in a separate helper
// (`makeReceiverCapture`) — integration glue mirrored from the recorder — so the
// ORCHESTRATION above is pure and testable with fakes.
//
// Transcription serialization = that of WhisperTranscriber itself (cap=1); here we only avoid
// capturing the SAME speaker twice at once.

import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { rmSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import type { Readable, Duplex } from 'node:stream';
import { EndBehaviorType, type VoiceConnection } from '@discordjs/voice';
import prism from 'prism-media';
import { UtteranceCollector, type UtteranceOpts } from './utteranceCollector';
import { isTranscribable, formatTranscript } from './transcriptRouting';
import type { Transcript } from './whisperTranscriber';
import { log } from '../logging/logger';

/** Captures ONE speaking turn from a speaker; calls `onUtterance` for each closed utterance. */
export type CaptureFn = (
  userId: string,
  onUtterance: (pcm: Buffer) => void,
  isStopped: () => boolean,
) => Promise<void>;

export interface TranscriptionSessionDeps {
  /** GATE: did the person consent to being transcribed on this server? (hasSttConsent for the guild) */
  hasConsent: (userId: string) => boolean;
  /** Name to display in the channel for a speaker. */
  displayName: (userId: string) => string;
  /** Transcribes a WAV (WhisperTranscriber.transcribe). */
  transcribe: (wavPath: string) => Promise<Transcript>;
  /** Posts the line in the channel (must use allowedMentions:{parse:[]}). */
  post: (text: string) => Promise<void>;
  /** Raw PCM -> WAV file (pcmToWavFile). */
  toWav: (pcm: Buffer, outPath: string) => Promise<string>;
  /** Captures a speaker's speech (default: makeReceiverCapture; tests inject a fake). */
  capture: CaptureFn;
  /** Identity-free aggregate duration hook. PCM is fixed at 48 kHz, stereo, signed 16-bit. */
  recordAudioMs?: (value: number) => void;
  /** Temp dir for the ephemeral WAVs (default: os.tmpdir()). */
  tmpDir?: string;
}

export class TranscriptionSession {
  private stopped = false;
  private readonly active = new Set<string>();
  private seq = 0;
  // Per-instance random component: without this, two concurrent sessions (different
  // guilds) generated the SAME temporary file name (only pid+seq varied, and each
  // instance's seq restarts at 0) and could clobber each other writing the WAV.
  // randomUUID (not Math.random) so the ephemeral WAV name is unguessable — a local co-tenant
  // can't pre-create or read it during its brief life (SEC audit S8, defence-in-depth).
  private readonly id = randomUUID();

  constructor(private readonly deps: TranscriptionSessionDeps) {}

  /** Reacts to a speaker who started talking. Applies the gate and captures+transcribes the turn. */
  async onSpeakingStart(userId: string): Promise<void> {
    if (this.stopped) return;
    if (!this.deps.hasConsent(userId)) return; // consent-first: non-consented is never captured
    if (this.active.has(userId)) return; // already capturing this speaker
    this.active.add(userId);
    const pending: Promise<void>[] = [];
    try {
      await this.deps.capture(
        userId,
        (pcm) => pending.push(this.handleUtterance(userId, pcm)),
        () => this.stopped,
      );
      await Promise.allSettled(pending);
    } catch (err) {
      log.warn(`[stt] capture failed (user ${userId}):`, err);
    } finally {
      this.active.delete(userId);
    }
  }

  /** Marks the session as stopped: new speaking-starts are now ignored. */
  stop(): void {
    this.stopped = true;
  }

  private async handleUtterance(userId: string, pcm: Buffer): Promise<void> {
    if (this.stopped) return;
    this.deps.recordAudioMs?.(Math.round((pcm.length / (48_000 * 2 * 2)) * 1_000));
    const out = join(
      this.deps.tmpDir ?? tmpdir(),
      `vozen-stt-${process.pid}-${this.id}-${this.seq++}.wav`,
    );
    try {
      const wav = await this.deps.toWav(pcm, out);
      const { text } = await this.deps.transcribe(wav);
      if (!this.stopped && isTranscribable(text)) {
        await this.deps.post(formatTranscript(this.deps.displayName(userId), text));
      }
    } catch (err) {
      log.warn(`[stt] transcription failed (user ${userId}):`, err);
    } finally {
      try {
        rmSync(out, { force: true });
      } catch {
        // best-effort
      }
    }
  }
}

/** Name of the STT temporary WAVs: the bot's own prefix -> safe to sweep by pattern. */
const STT_TMP_RE = /^vozen-stt-[\w-]+\.wav$/;
/** Minimum age to consider a temp orphaned (a live WAV is deleted in ~2s). */
const STT_ORPHAN_MIN_AGE_MS = 5 * 60_000;

/**
 * Startup reconciliation (DATA-hygiene): deletes STT temporary WAVs that were left
 * ORPHANED in the tmpdir. handleUtterance deletes each WAV in the `finally`, but a SIGKILL
 * (OOM/deploy) between `toWav` and the `finally`, or an `rmSync` blocked on Windows, leaves
 * consented recording on disk beyond the "deleted immediately" promised in PRIVACY §2.3 —
 * which this startup sweep reconciles.
 *
 * Safe for two reasons: (1) the `vozen-stt-` prefix is the bot's own; (2) the age guard
 * (>5 min) never catches a live WAV, even if another Vozen process shares the tmpdir.
 * Runs on ClientReady (before any STT session), best-effort. Returns the number deleted.
 */
export function sweepOrphanSttTemps(dir: string = tmpdir(), now: number = Date.now()): number {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return 0; // tmpdir inaccessible — no-op
  }
  let removed = 0;
  for (const f of entries) {
    if (!STT_TMP_RE.test(f)) continue;
    const p = join(dir, f);
    try {
      if (now - statSync(p).mtimeMs < STT_ORPHAN_MIN_AGE_MS) continue; // recent -> may be alive
      unlinkSync(p);
      removed++;
    } catch {
      // best-effort: already removed / blocked
    }
  }
  return removed;
}

// ── Real capture (integration — the receiver's Opus plumbing, mirrored from the recorder) ──────────
export interface ReceiverCaptureDeps {
  subscribe?: (connection: VoiceConnection, userId: string) => Readable;
  makeDecoder?: () => Duplex;
  collectorOpts?: UtteranceOpts;
}

function defaultSubscribe(connection: VoiceConnection, userId: string): Readable {
  return connection.receiver.subscribe(userId, {
    end: { behavior: EndBehaviorType.AfterSilence, duration: 800 },
  });
}
function defaultMakeDecoder(): Duplex {
  return new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 }) as unknown as Duplex;
}

/**
 * Builds the production CaptureFn over a VoiceConnection: subscribes to the speaker's SSRC
 * (AfterSilence 800ms), decodes opus->PCM 48k stereo, groups into utterances with the
 * UtteranceCollector and emits each one. Resolves when Discord closes the stream (the speaker
 * stopped). The next speaking-start re-subscribes.
 */
export function makeReceiverCapture(
  connection: VoiceConnection,
  deps: ReceiverCaptureDeps = {},
): CaptureFn {
  const subscribe = deps.subscribe ?? defaultSubscribe;
  const makeDecoder = deps.makeDecoder ?? defaultMakeDecoder;
  return (_userId, onUtterance, isStopped) =>
    new Promise<void>((resolve) => {
      const opus = subscribe(connection, _userId);
      const decoder = makeDecoder();
      const collector = new UtteranceCollector(deps.collectorOpts);
      const stopBoth = (): void => {
        opus.destroy();
        decoder.destroy();
      };
      const poll = setInterval(() => {
        if (isStopped()) stopBoth();
      }, 200);
      opus.pipe(decoder);
      decoder.on('data', (chunk: Buffer) => {
        const u = collector.push(chunk);
        if (u) onUtterance(u.pcm);
      });
      const finish = (): void => {
        clearInterval(poll);
        const last = collector.flush();
        if (last) onUtterance(last.pcm);
        decoder.removeAllListeners();
        // ALWAYS destroy the source: an error on the decoder side reaches here without going
        // through stopBoth, and without this the receiver subscription (opus) stayed alive (leak).
        opus.destroy();
        resolve();
      };
      decoder.once('end', finish);
      decoder.once('close', finish);
      decoder.once('error', finish);
      opus.once('error', stopBoth);
    });
}
