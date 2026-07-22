import {
  AudioPlayer,
  AudioPlayerStatus,
  StreamType,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
} from '@discordjs/voice';
import { existsSync } from 'node:fs';
import type { TTSEngine, SynthRequest } from '../tts/engine';
import { emphasisGain } from '../tts/emphasis';
import { splitForFastPlayback } from '../tts/sentenceChunks';
import {
  PlayQueue,
  type PublicQueueItem,
  type QueueEnqueueOptions,
  type QueueWorkItem,
} from './queue';
import { raceStates } from './raceStates';
import { log } from '../logging/logger';
import { metrics } from '../metrics';
import {
  providerForEngine,
  type OperationalMetric,
  type OperationalProvider,
} from '../store/operationalMetrics';

// Maximum time to wait for the VoiceConnection to become Ready before playing. On a
// slow connection / 1st speech the connection may be in signalling/connecting; playing
// at that instant sends the audio into the void (no sound and no error).
const CONNECTION_READY_TIMEOUT_MS = 10_000;
const FAST_PLAYBACK_CHUNK_CHARS = 220;

export class GuildVoicePlayer {
  private readonly player: AudioPlayer;
  private readonly queue: PlayQueue;
  private playing = false;
  private destroyed = false;
  // /skip fired DURING the synthesis window (synth + entersState Ready), when
  // the real AudioPlayer is still Idle and player.stop() is a no-op. Signals that the
  // in-flight item must be DISCARDED before playing. See skip()/playNext().
  private pendingSkip = false;
  private reconnecting = false;
  private paused = false;
  // An item that was already dequeued when an admin paused during synthesis/readiness.
  // It stays private and is resumed before later queue items, preserving FIFO.
  private held: QueueWorkItem | null = null;

  constructor(
    private readonly connection: VoiceConnection,
    private readonly engine: TTSEngine,
    queueCap: number,
    private readonly onIdle: () => void,
    private readonly recordOperational?: (
      metric: OperationalMetric,
      provider: OperationalProvider,
      value: number,
    ) => void,
  ) {
    this.queue = new PlayQueue(queueCap);
    this.player = createAudioPlayer();
    this.connection.subscribe(this.player);

    this.player.on(AudioPlayerStatus.Idle, () => {
      void this.playNext();
    });

    this.player.on('error', (err) => {
      // Just logs. Does NOT drain the queue here: in @discordjs/voice a stream error of
      // the playing resource emits 'error' AND THEN transitions to idle (the setter
      // emits Idle) — synchronous, for the SAME resource. Having playNext() here AND in
      // Idle drained the queue 2x (double-fire), collapsing the `playing` flag (breaks
      // single-worker/FIFO) and potentially firing onIdle() mid-speech. Idle
      // does the only drain. Also does NOT set current=null here: on an error of an
      // already-replaced (stale) resource there is no Idle following (guard resource ===
      // this.state.resource in onStreamError), so current points at the NEW resource
      // and nulling it here would break playback; the reset of current stays only in
      // Idle, which only occurs for the current resource.
      log.error('[player] AudioPlayer error:', err);
    });

    this.connection.on(VoiceConnectionStatus.Disconnected, () => {
      void this.handleDisconnect();
    });
  }

  async say(req: SynthRequest, options: QueueEnqueueOptions = {}): Promise<boolean> {
    // Returns the SYNCHRONOUS RESULT of enqueuing: true if the request entered the queue,
    // false if it was discarded (player destroyed OR queue at cap). The explicit
    // commands (/tts, /voice preview) use this boolean to not lie "queued"
    // when NOTHING entered the queue. NB: only the SYNCHRONOUS full-queue signal — synth-skip
    // / connection-not-Ready happen LATER in the worker (playNext), so they are NOT
    // reflected here (by design; see comments in playNext).
    if (this.destroyed) return false;
    // Enqueues SYNCHRONOUSLY in arrival order (preserves the FIFO of spec §7).
    // The synthesis happens in the worker (playNext), not here, so as not to reorder
    // concurrent requests by the synthesis duration/cache-hit.
    const chunks =
      req.streamSentences && !req.assetPath && !req.segments
        ? splitForFastPlayback(req.text, FAST_PLAYBACK_CHUNK_CHARS)
        : [req.text];
    const requests = chunks.map((text, index) => ({
      req: {
        ...req,
        text,
        emphasisSource: text,
        leadSilenceMs: index === 0 ? req.leadSilenceMs : undefined,
        streamSentences: false,
      },
    }));
    const ok = this.queue.enqueueMany(requests, options);
    if (!ok) {
      log.warn('[player] queue is full; request dropped');
      this.recordOperational?.('queue_drop', providerForEngine(req.engine), 1);
      return false;
    }
    if (!this.playing) {
      void this.playNext();
    }
    return true;
  }

  // LIGHT predicate: is something going on? It is playing (playing) OR has items in the
  // queue. /skip reads this BEFORE skip() to distinguish "nothing playing" from
  // "I skipped" — instead of always pretending it skipped. Does NOT change state.
  isActive(): boolean {
    return this.playing || this.held !== null || this.queue.size() > 0;
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** Pauses current audio or holds the next item before it can start; never drops work. */
  pause(): boolean {
    if (this.destroyed || !this.isActive() || this.paused) return false;
    this.paused = true;
    try {
      this.player.pause(true);
    } catch {
      // A synthesis/readiness window has no native resource to pause; playNext holds it safely.
    }
    return true;
  }

  /** Continues native paused audio or restarts the single worker for a held/pending item. */
  resume(): boolean {
    if (this.destroyed || !this.paused) return false;
    this.paused = false;
    try {
      if (this.player.state.status === AudioPlayerStatus.Paused) {
        this.player.unpause();
        return true;
      }
    } catch {
      // Worker restart below remains safe if the native player was replaced/destroyed.
    }
    if (!this.playing) void this.playNext();
    return true;
  }

  /** Privacy-safe pending work only. The current private request is never exposed. */
  queueSnapshot(now: number = Date.now()): PublicQueueItem[] {
    return this.queue.snapshot(now);
  }

  /** Removes the invoking author's queued work only; never interrupts the current item. */
  removeQueuedByAuthor(authorId: string): number {
    return this.queue.removeByAuthor(authorId);
  }

  /** Moderator-only caller must enforce permission before using this opaque id action. */
  removeQueuedById(id: string): boolean {
    return this.queue.removeById(id);
  }

  removeQueuedByAuthorId(authorId: string, id: string): boolean {
    return this.queue.removeByAuthorId(authorId, id);
  }

  skip(): void {
    if (this.destroyed) return;
    // Normal case (playing): stop() emits Idle -> the handler calls playNext() and
    // advances to the next item.
    //
    // SYNTHESIS WINDOW case: when /skip arrives during synth()/entersState
    // (playing=true but play() has not run yet), the REAL AudioPlayer is Idle and
    // stop() is a no-op (in @discordjs/voice, stop() does `if (idle) return false` —
    // does not emit Idle). The skip would be LOST and the speech would play in full. We detect
    // that: it is REALLY playing only if the player's state is Playing or Buffering.
    // If it is not -> we are in the window -> we mark pendingSkip so that playNext()
    // discards the in-flight item before playing it.
    const wasPlaying =
      this.player.state.status === AudioPlayerStatus.Playing ||
      this.player.state.status === AudioPlayerStatus.Buffering ||
      this.player.state.status === AudioPlayerStatus.Paused;
    this.player.stop(true);
    if (!wasPlaying) {
      this.pendingSkip = true;
    }
  }

  /**
   * "Shut up now": empties the WHOLE queue and stops what is playing, but STAYS in the call
   * (unlike destroy(), which leaves). /shut-up uses this. After stop(), the
   * player emits Idle -> playNext() finds the queue empty -> goes to rest. Handles the
   * same synthesis window as skip(): if the real AudioPlayer is still Idle (the speech
   * is being synthesized), stop() is a no-op, so we mark pendingSkip for the
   * in-flight item to be discarded instead of played.
   */
  silence(): void {
    if (this.destroyed) return;
    this.paused = false;
    this.queue.clear();
    this.held = null;
    const wasPlaying =
      this.player.state.status === AudioPlayerStatus.Playing ||
      this.player.state.status === AudioPlayerStatus.Buffering ||
      this.player.state.status === AudioPlayerStatus.Paused;
    this.player.stop(true);
    if (!wasPlaying) this.pendingSkip = true;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.queue.clear();
    this.held = null;
    this.playing = false;
    try {
      this.player.stop(true);
    } catch {
      // ignore
    }
    try {
      this.connection.destroy();
    } catch {
      // may already be destroyed
    }
  }

  private async playNext(): Promise<void> {
    if (this.destroyed) return;
    if (this.paused) {
      this.playing = false;
      return;
    }
    const next = this.held ?? this.queue.dequeue();
    this.held = null;
    if (!next) {
      this.playing = false;
      return;
    }
    // RESET pendingSkip at the START of each iteration (right after the dequeue, BEFORE
    // the awaits). Guarantees a /skip only affects the CURRENT item and never leaks to the
    // next one: if B's synthesis window was skipped (or B's synthesis failed and
    // drained C), C's iteration clears the flag and C plays normally. Anti-leak
    // INVARIANT.
    this.pendingSkip = false;
    // IMPORTANT: set `playing` BEFORE the synthesis await. This prevents a
    // concurrent `say()` (which sees `!this.playing`) from starting a second drain
    // worker during the synthesis, which would break the FIFO order.
    this.playing = true;

    let audioPath: string;
    const synthStart = process.hrtime.bigint();
    const provider = providerForEngine(next.req.engine);
    if (next.req.assetPath) {
      // Fixed ASSET (e.g. the /rizz sound effect): WAV already ready on disk, played DIRECTLY —
      // no engine/cache/effects (none of that applies to a fixed clip). Missing file =
      // treated as a synthesis failure (skips the item, does not crash).
      if (!existsSync(next.req.assetPath)) {
        log.error('[player] audio asset is missing; item skipped:', next.req.assetPath);
        metrics.inc('synthErrors');
        this.recordOperational?.('synth_failure', 'internal', 1);
        void this.playNext();
        return;
      }
      audioPath = next.req.assetPath;
    } else {
      try {
        audioPath = await this.engine.synth(next.req);
        // Effective synthesis latency (includes fast cache hit and slow miss/spawn).
        const synthMs = Number(process.hrtime.bigint() - synthStart) / 1e6;
        metrics.recordSynthMs(synthMs);
        this.recordOperational?.('synth_latency_ms', provider, Math.round(synthMs));
        this.recordOperational?.('synth_success', provider, 1);
      } catch (err) {
        log.error('[player] synthesis error; item skipped:', err);
        metrics.inc('synthErrors');
        this.recordOperational?.('synth_failure', provider, 1);
        // Skip this item and continue the queue without crashing (no stack growth:
        // we are after the await).
        void this.playNext();
        return;
      }
    }

    // The synthesis may have taken a while; the player may have been destroyed in the meantime.
    if (this.destroyed) return;

    // Pause may happen during synthesis. Hold the private item rather than speaking it or
    // losing FIFO; resume will process this exact item before the rest of the queue.
    if (this.paused) {
      this.held = next;
      this.playing = false;
      return;
    }

    // Ensure the connection is Ready BEFORE playing. If it is in
    // signalling/connecting (slow connection / 1st speech), playing now would send the
    // audio into the void. entersState resolves immediately if it is already Ready. Done
    // AFTER the synthesis on purpose: the connection establishes IN PARALLEL with the
    // synthesis, so waiting here approaches max(ready, synth) instead of
    // summing them.
    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, CONNECTION_READY_TIMEOUT_MS);
    } catch (err) {
      // The rejection may have been caused by destroy() (which destroys the connection).
      if (this.destroyed) return;
      log.warn('[player] voice connection did not become Ready; speech skipped:', err);
      // Same handling as the synthesis skip: we do not play into the void; we skip
      // this item and continue the queue (no stack growth — we are
      // after an await; no tight loop — each iteration is gated by the
      // timeout). Preserves the single drain worker and the FIFO.
      void this.playNext();
      return;
    }

    // entersState is one more await; re-check destroyed before playing.
    if (this.destroyed) return;

    if (this.paused) {
      this.held = next;
      this.playing = false;
      return;
    }

    // /skip fired DURING this item's synthesis/entersState (window in which the
    // AudioPlayer was Idle and stop() was a no-op): discard the in-flight item WITHOUT
    // playing and drain the next. Done BEFORE createAudioResource/messagesSpoken
    // so that a skipped item never counts as spoken. pendingSkip was set by
    // skip() and will be reset to false at the start of the next iteration (anti-leak).
    if (this.pendingSkip) {
      this.pendingSkip = false;
      void this.playNext();
      return;
    }

    // Guarded TAIL: createAudioResource()/play() can throw SYNCHRONOUSLY (e.g.:
    // transcoder/prism failing). Without this try/catch, a throw here left
    // `playing=true` FOREVER (the worker never reset -> guild goes mute until
    // restart) and rejected the call-site's `void playNext()` (unhandledRejection).
    // Handling identical to the synthesis error: skips the item and continues the queue.
    try {
      // EMPHASIS: "louder when there is ! or UPPERCASE". Gain computed from `emphasisSource`
      // (what the USER wrote) and not from the decorated req.text — otherwise a name/nickname in
      // UPPERCASE in the xsaid prefix made ALL messages shout (false shout). Falls back to
      // req.text when there is no source (games, /tts, preview — no decoration). inlineVolume
      // only when there is gain, so as not to pay for the VolumeTransformer on most speech.
      const gain = emphasisGain(next.req.emphasisSource ?? next.req.text);
      const resource = createAudioResource(audioPath, {
        inputType: StreamType.Arbitrary,
        inlineVolume: gain !== 1,
      });
      if (gain !== 1) resource.volume?.setVolume(gain);
      // play() FIRST: if it throws synchronously (transcoder/prism failing), the catch
      // counts synthErrors — and we do NOT want to count that message as "spoken". So
      // messagesSpoken increments ONLY AFTER play() has been called successfully (the
      // audio started playing), otherwise a failure counted 2× (messagesSpoken + synthErrors).
      this.player.play(resource);
      metrics.inc('messagesSpoken');
      this.recordOperational?.('ttfa_ms', provider, Math.max(0, Date.now() - next.createdAt));
    } catch (err) {
      log.error('[player] failed to create or play resource; item skipped:', err);
      metrics.inc('synthErrors');
      this.recordOperational?.('synth_failure', provider, 1);
      // No stack growth (we are after awaits); resets the worker via
      // the next iteration, which will set playing=false if the queue empties.
      void this.playNext();
    }
  }

  private async handleDisconnect(): Promise<void> {
    if (this.destroyed || this.reconnecting) return;
    this.reconnecting = true;
    // Voice metrics semantics (P7.4):
    //  - voiceDrops: counts the DROP once per episode. The guard above
    //    (destroyed || reconnecting) prevents repeated Disconnected events
    //    during the same reconnection episode from re-entering and double-counting.
    //  - voiceReconnects: counts the SUCCESS once, when the connection confirms
    //    it is back to Ready — whether by the "soft" recovery (entersState Ready
    //    resolves) or by a successful manual rejoin (tryRejoin returns true).
    //    Since tryRejoin returns a single boolean (the result of the backoff loop),
    //    the success counts on the RESULT, never per attempt — a backoff cycle
    //    never double-counts. An episode that fails for good: drops +1, reconnects +0.
    metrics.inc('voiceDrops');
    try {
      // "Soft" reconnection: the gateway is renegotiating the voice session.
      // raceStates (not the native race): the LOSING entersState rejects later
      // and without a handler generated a spurious unhandledRejection in the error webhook.
      await raceStates([
        entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
      // Recovered — wait for it to return to Ready.
      await entersState(this.connection, VoiceConnectionStatus.Ready, 20_000);
      metrics.inc('voiceReconnects');
    } catch {
      // Did not recover via soft — try a manual rejoin a few times.
      const recovered = await this.tryRejoin(3);
      if (!recovered) {
        // If we were already destroyed EXTERNALLY during the rejoin window (e.g.:
        // removePlayer via /join or /leave, which replaces this player with a new one
        // in the same guild slot), do NOT call destroy()/onIdle(): onIdle is keyed
        // by guild and would tear down the REPLACEMENT + kill the just-created session.
        // Exit silently — the new player is in charge now. Guard BEFORE
        // destroy() (destroy() sets destroyed=true; a guard after it would always
        // break the legitimate giving-up). tryRejoin->check->destroy->onIdle is
        // synchronous, so /join cannot slip in after this guard.
        if (this.destroyed) return;
        this.destroy();
        this.onIdle();
        return;
      }
      // Manual rejoin recovered the connection (returned to Ready) — counts ONE success.
      metrics.inc('voiceReconnects');
    } finally {
      this.reconnecting = false;
    }
  }

  private async tryRejoin(attempts: number): Promise<boolean> {
    for (let i = 0; i < attempts; i++) {
      if (this.destroyed) return false;
      try {
        this.connection.rejoin();
        await entersState(this.connection, VoiceConnectionStatus.Ready, 10_000);
        return true;
      } catch {
        await new Promise((r) => setTimeout(r, 1_000 * (i + 1)));
      }
    }
    return false;
  }
}
