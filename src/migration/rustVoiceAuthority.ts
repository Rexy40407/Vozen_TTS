/**
 * Transitional ownership boundary for the first Rust gateway slice.
 *
 * Discord sends an interaction to every active gateway session for the same bot. During the
 * migration, Node must therefore yield an explicitly promoted command instead of racing Rust to
 * answer it. Each promoted slice stays OFF unless the operator deliberately starts its matching
 * Rust runtime configuration.
 */
const RUST_CORE_VOICE_COMMANDS = new Set(['join', 'leave', 'tts', 'skip', 'shut-up']);
const RUST_PRIVATE_TTS_FILE_COMMANDS = new Set(['tts-file']);

/** Queue controls share the Rust Songbird ledger with core voice, so they have their own
 * canary. Without this second flag Node must retain `/queue`; otherwise a Rust process that has
 * not built the voice driver could leave users without a response. */
export function rustQueueOwnsCommand(
  commandName: string,
  coreEnabled = process.env.RUST_CORE_VOICE_ENABLED,
  enabled = process.env.RUST_QUEUE_ENABLED,
  ttsEngine = process.env.TTS_ENGINE,
): boolean {
  return (
    coreEnabled?.trim().toLowerCase() === 'true' &&
    enabled?.trim().toLowerCase() === 'true' &&
    rustPiperCompatible(ttsEngine) &&
    commandName === 'queue'
  );
}

/** Rust only has a production Piper adapter today. Node must retain an interaction if Rust would
 * reject startup because the shared default engine is gTTS, neural or a router. */
function rustPiperCompatible(ttsEngine = process.env.TTS_ENGINE): boolean {
  const normalized = ttsEngine?.trim().toLowerCase();
  return !normalized || normalized === 'piper';
}

/**
 * Translation promotion is leaf-level: `/translate` also contains server mappings, opt-outs
 * and automatic-translation settings which remain Node-owned. Rust may only claim the private
 * `text` leaf after its matching runtime adapter is intentionally started.
 */
export function rustTranslationOwnsCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_TRANSLATE_TEXT_ENABLED,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' && commandName === 'translate' && subcommand === 'text'
  );
}

/** Individual preference leaves use a second flag so `/translate text` can canary separately. */
export function rustTranslationPreferencesOwnCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_TRANSLATION_PREFERENCES_ENABLED,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' &&
    commandName === 'translate' &&
    (subcommand === 'language' || subcommand === 'speak-language' || subcommand === 'opt-out')
  );
}

/** Automatic mapped-channel translation uses a third, independent opt-in boundary. */
export function rustTranslationOwnsAutomaticMessages(
  enabled = process.env.RUST_AUTOMATIC_TRANSLATION_ENABLED,
): boolean {
  return enabled?.trim().toLowerCase() === 'true';
}

export function rustVoiceOwnsCommand(
  commandName: string,
  coreEnabled = process.env.RUST_CORE_VOICE_ENABLED,
  privateFileEnabled = process.env.RUST_TTS_FILE_ENABLED,
  ttsEngine = process.env.TTS_ENGINE,
): boolean {
  return (
    (coreEnabled?.trim().toLowerCase() === 'true' &&
      rustPiperCompatible(ttsEngine) &&
      RUST_CORE_VOICE_COMMANDS.has(commandName)) ||
    (privateFileEnabled?.trim().toLowerCase() === 'true' &&
      rustPiperCompatible(ttsEngine) &&
      RUST_PRIVATE_TTS_FILE_COMMANDS.has(commandName))
  );
}

/**
 * `/voice` is a mixed surface.  Rust may claim only the preference leaves with a complete
 * localised response contract; the model picker, browser, preview and interactive panel stay
 * Node-owned until their display and playback contracts have parity.
 */
export function rustVoicePreferencesOwnCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_VOICE_PREFERENCES_ENABLED,
  ttsEngine = process.env.TTS_ENGINE,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' &&
    rustPiperCompatible(ttsEngine) &&
    commandName === 'voice' &&
    (subcommand === 'set' ||
      subcommand === 'favorite' ||
      subcommand === 'unfavorite' ||
      subcommand === 'favorites' ||
      subcommand === 'recent' ||
      subcommand === 'reset' ||
      subcommand === 'detection' ||
      subcommand === 'opt-out' ||
      subcommand === 'opt-in' ||
      subcommand === 'nickname' ||
      subcommand === 'effect')
  );
}

/**
 * Message ownership is deliberately separate from slash-command ownership. Rust can only take
 * auto-read after its same-call pipeline has been shadow-tested; requiring both exact flags
 * prevents a typo from making Node drop messages while Rust is inactive.
 */
export function rustVoiceOwnsAutoRead(
  coreEnabled = process.env.RUST_CORE_VOICE_ENABLED,
  messageEnabled = process.env.RUST_MESSAGE_AUTOREAD_ENABLED,
  ttsEngine = process.env.TTS_ENGINE,
): boolean {
  return (
    coreEnabled?.trim().toLowerCase() === 'true' &&
    messageEnabled?.trim().toLowerCase() === 'true' &&
    rustPiperCompatible(ttsEngine)
  );
}
