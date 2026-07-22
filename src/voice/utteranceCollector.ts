// src/voice/utteranceCollector.ts
//
// UTTERANCE segmenter for the STT (Phase 4). Receives PCM frames (decoded from the Opus
// of ONE speaker — see recorder.ts) and groups them into utterances: closes one when there is
// a silence GAP after speech (`silenceGapMs`) OR when the cap (`maxUtteranceMs`) is reached.
// Pre-speech silence is ignored; blips that are too short (< `minUtteranceMs` of SPEECH) are
// discarded (noise rejection). PURE/testable (fed with buffers), no IO nor network.
//
// This collector preserves the INTERNAL silence of the utterance (natural boundaries for
// Whisper) and emits per-utterance instead of a single buffer.

export interface Utterance {
  /** PCM of the utterance (from the 1st voiced frame to the gap that closed it). */
  pcm: Buffer;
  /** Total duration (ms), including internal silence. */
  ms: number;
  /** Only the SPEECH ms (RMS above the floor) — used to reject blips and for diagnostics. */
  voicedMs: number;
}

export interface UtteranceOpts {
  /** Bytes per ms of the PCM format (48kHz stereo s16le = 192; tests use 2). Default 192. */
  bytesPerMs?: number;
  /** RMS floor (int16) above which a frame counts as SPEECH. Default 350 (≈ recorder). */
  rmsThreshold?: number;
  /** Continuous silence (ms) after speech that CLOSES the utterance. Default 800. */
  silenceGapMs?: number;
  /** Minimum SPEECH (ms) for an utterance to count — below this it is discarded. Default 300. */
  minUtteranceMs?: number;
  /** Cap (ms) that forces the close of a long monologue. Default 20000. */
  maxUtteranceMs?: number;
}

export class UtteranceCollector {
  private readonly bytesPerMs: number;
  private readonly rmsThreshold: number;
  private readonly silenceGapMs: number;
  private readonly minUtteranceMs: number;
  private readonly maxUtteranceMs: number;

  private chunks: Buffer[] = [];
  private totalMs = 0;
  private voicedMs = 0;
  private silenceRunMs = 0;
  private inUtterance = false;

  constructor(opts: UtteranceOpts = {}) {
    this.bytesPerMs = opts.bytesPerMs ?? 192;
    this.rmsThreshold = opts.rmsThreshold ?? 350;
    this.silenceGapMs = opts.silenceGapMs ?? 800;
    this.minUtteranceMs = opts.minUtteranceMs ?? 300;
    this.maxUtteranceMs = opts.maxUtteranceMs ?? 20000;
  }

  /**
   * Feeds a PCM frame. Returns an Utterance when one has just closed (silence gap
   * or cap reached), otherwise null. A short blip that reaches the gap is discarded (null).
   */
  push(frame: Buffer): Utterance | null {
    const frameMs = frame.length / this.bytesPerMs;
    const voiced = this.rmsOf(frame) >= this.rmsThreshold;

    if (voiced) {
      this.inUtterance = true;
      this.chunks.push(frame);
      this.totalMs += frameMs;
      this.voicedMs += frameMs;
      this.silenceRunMs = 0;
      // Long monologue: force-close (even without a gap) so it doesn't grow without limit.
      return this.totalMs >= this.maxUtteranceMs ? this.close() : null;
    }

    // Silence before any speech: ignore (does not start an utterance).
    if (!this.inUtterance) return null;

    this.chunks.push(frame);
    this.totalMs += frameMs;
    this.silenceRunMs += frameMs;
    if (this.silenceRunMs >= this.silenceGapMs) {
      // End of the utterance: emit if it had enough speech, otherwise discard (noise/blip).
      if (this.voicedMs >= this.minUtteranceMs) return this.close();
      this.reset();
    }
    return null;
  }

  /** Closes and returns the pending utterance (if valid) — call when the recording stops. */
  flush(): Utterance | null {
    if (this.inUtterance && this.voicedMs >= this.minUtteranceMs) return this.close();
    this.reset();
    return null;
  }

  private close(): Utterance {
    const u: Utterance = {
      pcm: Buffer.concat(this.chunks),
      ms: Math.round(this.totalMs),
      voicedMs: Math.round(this.voicedMs),
    };
    this.reset();
    return u;
  }

  private reset(): void {
    this.chunks = [];
    this.totalMs = 0;
    this.voicedMs = 0;
    this.silenceRunMs = 0;
    this.inUtterance = false;
  }

  private rmsOf(buf: Buffer): number {
    const n = Math.floor(buf.length / 2);
    if (n === 0) return 0;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const s = buf.readInt16LE(i * 2);
      sum += s * s;
    }
    return Math.sqrt(sum / n);
  }
}
