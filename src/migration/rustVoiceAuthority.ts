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
