// src/tts/engine.ts
export interface SynthRequest {
  text: string;
  model: string;
  speed: number;
  // Text from which the EMPHASIS is computed (shouting via `!`/UPPERCASE and the `?`
  // intonation) — must be ONLY what the USER typed, without what the bot injects (xsaid
  // prefix "{name} said", media suffix "a link"). Without this, a name/nickname in
  // UPPERCASE made ALL messages come out louder (false shout). Absent => falls back to
  // `text`. Does NOT enter the cacheKey (decided at playback/post-synthesis, doesn't
  // change the base audio).
  emphasisSource?: string;
  // Opt-in latency mode for normal spoken text. The player queues bounded sentence chunks
  // atomically, allowing the first part to synthesize and play before the full paragraph is
  // ready. File exports and already-segmented multilingual requests stay single jobs.
  streamSentences?: boolean;
  // Milliseconds of silence to PREPEND to the synthesized audio (default: none).
  // Used e.g. by /joke to create a real pause BEFORE the laughter (the laughter is a
  // separate utterance with leadSilenceMs). Optional: absent => output unchanged.
  leadSilenceMs?: number;
  // When true, TURNS OFF per-segment multi-language synthesis for THIS request: the
  // text is read verbatim with `model`, without being split by language. Used when the
  // voice was DELIBERATELY chosen (e.g. /voice preview, /joke, /laugh, or the per-user
  // detection toggle turned off) and detection must NOT override it.
  // Absent/false => normal behavior (splits per segment when there is >1 language).
  singleVoice?: boolean;
  // Parts (text, voice) ALREADY RESOLVED per-segment for the MIXED-language synthesis
  // (e.g. base in one language + EN slang in an English voice). When present and the
  // MultiSegmentEngine is active, each part is synthesized with its own `model` and the
  // WAVs are concatenated. The top-level `text`/`model` remain the single-voice fallback
  // (engine flag OFF) and the base of the cache key.
  segments?: { text: string; model: string }[];
  // ENGINE chosen BY THE USER for this utterance: 'google' (gTTS, default),
  // 'piper' (self-host), 'kokoro' (neural opt-in — falls back to gTTS for languages it
  // doesn't support / on failure) or 'gcloud' (Google Cloud TTS Standard, Premium perk —
  // falls back to gTTS without a key / on failure / on budget). Absent/undefined = 'google'.
  // The PerUserEngineRouter dispatches by this field; it enters the cache key (when
  // 'piper'/'kokoro'/'gcloud') so audio isn't crossed between users of different engines.
  engine?: 'google' | 'piper' | 'kokoro' | 'gcloud';
  // gcloud BUDGET (Premium): descriptor pre-resolved at build-time (where there is
  // identity+db) that travels with the request to the chokepoint (GCloudEngine), which
  // counts the chars ONLY on the real call to Google (cache-miss). `scope`/`key` identify
  // the pool to debit; `seats` (only for scope 'pass') sets the allowance tier (3->400k,
  // otherwise 1M). The concrete CAP is computed in the engine from the config (the resolver
  // has no config). Absent in an engine:'gcloud' request => fail-SAFE (the GCloudEngine
  // refuses and falls back to gTTS): a non-gated path never spends $ silently. Outside the
  // cacheKey (doesn't change the audio). See tts/gcloudUsage.ts + resolveUserEngine.
  gcloudBudget?: { scope: 'user' | 'pass' | 'guild'; key: string; seats?: number };
  // Voice EFFECT (premium) to apply to the WAV AFTER synthesis (robot/echo/deep...).
  // Absent/'none' => clean voice. Does NOT enter the cacheKey (the EffectEngine has its own
  // cache keyed by cacheKey+effect), so the clean audio remains shared between users.
  effect?: string;
  // Fixed audio ASSET: path of an ALREADY-ready WAV on disk (e.g. the sound effect of
  // /rizz). When present, the player plays it DIRECTLY — no engine, no cache, no effects
  // (none of that applies to a fixed clip). `text` is ignored for synthesis (but the
  // emphasis gain uses emphasisSource/text, so '' is passed to avoid shouting). The
  // startup silence must be EMBEDDED in the file (leadSilenceMs lives in the engines).
  assetPath?: string;
}

export interface TTSEngine {
  synth(req: SynthRequest): Promise<string>; // returns the absolute path of a .wav
}
