/**
 * Transitional ownership boundary for the first Rust gateway slice.
 *
 * Discord sends an interaction to every active gateway session for the same bot. During the
 * migration, Node must therefore yield an explicitly promoted command instead of racing Rust to
 * answer it. Each promoted slice stays OFF unless the operator deliberately starts its matching
 * Rust runtime configuration.
 */
const RUST_CORE_VOICE_COMMANDS = new Set([
  'join',
  'leave',
  'tts',
  'laugh',
  'joke',
  'rizz',
  'sound',
  '8-ball',
  'fortune',
  'fact',
  'wyr',
  'skip',
  'shut-up',
]);
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

/** Pronunciation mutations share SQLite with the message pipeline, but add without both values
 * opens a Node modal. Rust may only claim the direct list/remove/add leaves behind its own flag. */
export function rustPronunciationOwnsCommand(
  commandName: string,
  subcommand: string | null,
  hasCompleteAdd = false,
  enabled = process.env.RUST_PRONUNCIATION_ENABLED,
): boolean {
  if (enabled?.trim().toLowerCase() !== 'true') return false;
  if (commandName !== 'pronunciation' && commandName !== 'server-pronunciation') return false;
  if (subcommand === 'add') return hasCompleteAdd;
  return subcommand === 'list' || subcommand === 'remove';
}

/** `/config` is a broad admin surface; only its validated language leaf is promoted here. */
export function rustConfigLanguageOwnsCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_CONFIG_LANGUAGE_ENABLED,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' &&
    commandName === 'config' &&
    subcommand === 'language'
  );
}

const RUST_CONFIG_TOGGLE_SUBCOMMANDS = new Set([
  'auto-read',
  'enabled',
  'x-said',
  'auto-join',
  'always-on',
  'read-bots',
  'text-in-voice',
  'anti-spam',
  'streaks',
  'soundboard',
  'vote-reminders',
  'greet',
]);

export function rustConfigTogglesOwnCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_CONFIG_TOGGLES_ENABLED,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' &&
    commandName === 'config' &&
    subcommand !== null &&
    RUST_CONFIG_TOGGLE_SUBCOMMANDS.has(subcommand)
  );
}

/** Numeric configuration leaves keep Node's existing range validation and storage shape while
 * using a separate canary from the boolean controls. */
export function rustConfigNumericOwnsCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_CONFIG_NUMERIC_ENABLED,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' &&
    commandName === 'config' &&
    (subcommand === 'max-chars' || subcommand === 'rate-limit')
  );
}

/** The simple auto-read role restriction is promoted separately; priority/blocked roles remain
 * Node-owned until their cross-field validation and localized responses have parity. */
export function rustConfigRoleOwnsCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_CONFIG_ROLE_ENABLED,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' && commandName === 'config' && subcommand === 'role'
  );
}

/** Guild default voice uses the same installed-model catalogue as Rust voice preferences. */
export function rustConfigDefaultVoiceOwnsCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_CONFIG_DEFAULT_VOICE_ENABLED,
  ttsEngine = process.env.TTS_ENGINE,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' &&
    rustPiperCompatible(ttsEngine) &&
    commandName === 'config' &&
    subcommand === 'default-voice'
  );
}

/** Auto-read channel selection remains independent from the auto-read boolean toggle. */
export function rustConfigChannelOwnsCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_CONFIG_CHANNEL_ENABLED,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' &&
    commandName === 'config' &&
    subcommand === 'tts-channel'
  );
}

/** Priority and blocked role leaves share a cross-field conflict check and one canary. */
export function rustConfigQueueRolesOwnCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_CONFIG_QUEUE_ROLES_ENABLED,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' &&
    commandName === 'config' &&
    (subcommand === 'priority-role' || subcommand === 'blocked-role')
  );
}

/** Join greeting language uses its own 19-locale catalogue and canary. */
export function rustConfigGreetLanguageOwnsCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_CONFIG_GREET_LANGUAGE_ENABLED,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' &&
    commandName === 'config' &&
    subcommand === 'greet-language'
  );
}

/** Blocklist mutations are grouped under their own canary; reset stays Node-owned. */
export function rustConfigBlockwordOwnsCommand(
  commandName: string,
  subcommandGroup: string | null,
  subcommand: string | null,
  enabled = process.env.RUST_CONFIG_BLOCKWORD_ENABLED,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' &&
    commandName === 'config' &&
    subcommandGroup === 'block-word' &&
    (subcommand === 'add' || subcommand === 'remove')
  );
}

/** Read-only configuration output has its own canary and never claims reset or mutations. */
export function rustConfigShowOwnsCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_CONFIG_SHOW_ENABLED,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' && commandName === 'config' && subcommand === 'show'
  );
}

/** Reset clears the guild config plus translation scope only behind an explicit canary. */
export function rustConfigResetOwnsCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_CONFIG_RESET_ENABLED,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' && commandName === 'config' && subcommand === 'reset'
  );
}

/** Public uptime has no guild or payment state and can be enabled independently. */
export function rustUptimeOwnsCommand(
  commandName: string,
  enabled = process.env.RUST_UPTIME_ENABLED,
): boolean {
  return enabled?.trim().toLowerCase() === 'true' && commandName === 'uptime';
}

/** Invite generation is public and isolated from OAuth/payment authority. */
export function rustInviteOwnsCommand(
  commandName: string,
  enabled = process.env.RUST_INVITE_ENABLED,
): boolean {
  return enabled?.trim().toLowerCase() === 'true' && commandName === 'invite';
}

/** Help is a static discovery surface and has no payment or authentication authority. */
export function rustHelpOwnsCommand(
  commandName: string,
  enabled = process.env.RUST_HELP_ENABLED,
): boolean {
  return enabled?.trim().toLowerCase() === 'true' && commandName === 'help';
}

/** Vote links are public growth copy; rewards remain read-only and fail closed in Rust. */
export function rustVoteOwnsCommand(
  commandName: string,
  enabled = process.env.RUST_VOTE_ENABLED,
): boolean {
  return enabled?.trim().toLowerCase() === 'true' && commandName === 'vote';
}

/** Public, read-only ranking; stored aggregates remain the only data source. */
export function rustTopSpeakersOwnsCommand(
  commandName: string,
  enabled = process.env.RUST_TOP_SPEAKERS_ENABLED,
): boolean {
  return enabled?.trim().toLowerCase() === 'true' && commandName === 'top-speakers';
}

/** Destructive privacy erase remains behind a dedicated canary and explicit confirmation. */
export function rustPrivacyOwnsCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_PRIVACY_ENABLED,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' && commandName === 'privacy' && subcommand === 'erase'
  );
}

/** Personal birthday storage remains behind its own canary during migration. */
export function rustBirthdayOwnsCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_BIRTHDAY_ENABLED,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' &&
    commandName === 'birthday' &&
    (subcommand === 'set' || subcommand === 'clear' || subcommand === 'show')
  );
}

/** Aggregated server statistics remain behind an explicit canary during migration. */
export function rustServerStatsOwnsCommand(
  commandName: string,
  enabled = process.env.RUST_SERVER_STATS_ENABLED,
): boolean {
  return enabled?.trim().toLowerCase() === 'true' && commandName === 'server-stats';
}

/** Manage Guild process statistics use the Rust gateway's process-local metrics snapshot. */
export function rustStatsOwnsCommand(
  commandName: string,
  enabled = process.env.RUST_STATS_ENABLED,
): boolean {
  return enabled?.trim().toLowerCase() === 'true' && commandName === 'stats';
}

/** Public process statistics use the Rust gateway state behind their own canary. */
export function rustBotStatsOwnsCommand(
  commandName: string,
  enabled = process.env.RUST_BOT_STATS_ENABLED,
): boolean {
  return enabled?.trim().toLowerCase() === 'true' && commandName === 'bot-stats';
}

/** Read-only Premium status is promoted independently from activate/deactivate mutations. */
export function rustPremiumInfoOwnsCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_PREMIUM_ENABLED,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' && commandName === 'premium' && subcommand === 'info'
  );
}

/** Premium mutations use the same canary, but remain separate from read-only status checks. */
export function rustPremiumMutationOwnsCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_PREMIUM_ENABLED,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' &&
    commandName === 'premium' &&
    (subcommand === 'activate' || subcommand === 'deactivate')
  );
}

/** Gift-code redemption is transactional in SQLite and stays behind its own canary. */
export function rustRedeemOwnsCommand(
  commandName: string,
  enabled = process.env.RUST_REDEEM_ENABLED,
): boolean {
  return enabled?.trim().toLowerCase() === 'true' && commandName === 'redeem';
}

/** The read-only `/game list` leaf is promoted independently from the live game manager. */
export function rustGameListOwnsCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_GAME_LIST_ENABLED,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' && commandName === 'game' && subcommand === 'list'
  );
}

/** Read-only game scores are promoted independently from the live game manager. */
export function rustGameScoresOwnsCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_GAME_SCORES_ENABLED,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' &&
    commandName === 'game' &&
    (subcommand === 'leaderboard' || subcommand === 'stats')
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
 * `/voice` is a mixed surface. Rust's audio core owns `preview` only when the same Piper voice
 * runtime that owns `/tts` is explicitly enabled; the remaining preference leaves use their own
 * canary. The interactive panel stays Node-owned.
 */
export function rustVoicePreferencesOwnCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_VOICE_PREFERENCES_ENABLED,
  ttsEngine = process.env.TTS_ENGINE,
  coreEnabled = process.env.RUST_CORE_VOICE_ENABLED,
): boolean {
  const previewEnabled =
    coreEnabled?.trim().toLowerCase() === 'true' && rustPiperCompatible(ttsEngine);
  return (
    commandName === 'voice' &&
    ((previewEnabled && subcommand === 'preview') ||
      (enabled?.trim().toLowerCase() === 'true' &&
        rustPiperCompatible(ttsEngine) &&
        (subcommand === 'list' ||
          subcommand === 'browse' ||
          subcommand === 'set' ||
          subcommand === 'favorite' ||
          subcommand === 'unfavorite' ||
          subcommand === 'favorites' ||
          subcommand === 'recent' ||
          subcommand === 'reset' ||
          subcommand === 'detection' ||
          subcommand === 'opt-out' ||
          subcommand === 'opt-in' ||
          subcommand === 'nickname' ||
          subcommand === 'effect')))
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
