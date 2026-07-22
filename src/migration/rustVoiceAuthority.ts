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

export function rustVoiceOwnsCommand(
  commandName: string,
  coreEnabled = process.env.RUST_CORE_VOICE_ENABLED,
  privateFileEnabled = process.env.RUST_TTS_FILE_ENABLED,
): boolean {
  return (
    (coreEnabled?.trim().toLowerCase() === 'true' && RUST_CORE_VOICE_COMMANDS.has(commandName)) ||
    (privateFileEnabled?.trim().toLowerCase() === 'true' &&
      RUST_PRIVATE_TTS_FILE_COMMANDS.has(commandName))
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
): boolean {
  return (
    coreEnabled?.trim().toLowerCase() === 'true' && messageEnabled?.trim().toLowerCase() === 'true'
  );
}
