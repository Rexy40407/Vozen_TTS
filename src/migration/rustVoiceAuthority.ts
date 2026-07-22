/**
 * Transitional ownership boundary for the first Rust gateway slice.
 *
 * Discord sends an interaction to every active gateway session for the same bot. During the
 * migration, Node must therefore yield an explicitly promoted command instead of racing Rust to
 * answer it. This stays OFF unless the operator has deliberately started the Rust voice runtime.
 */
const RUST_CORE_VOICE_COMMANDS = new Set(['join', 'leave', 'tts', 'skip', 'shut-up']);

export function rustVoiceOwnsCommand(
  commandName: string,
  enabled = process.env.RUST_CORE_VOICE_ENABLED,
): boolean {
  return enabled?.trim().toLowerCase() === 'true' && RUST_CORE_VOICE_COMMANDS.has(commandName);
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
    coreEnabled?.trim().toLowerCase() === 'true' &&
    messageEnabled?.trim().toLowerCase() === 'true'
  );
}
