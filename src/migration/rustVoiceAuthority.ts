/**
 * Transitional ownership boundary for the first Rust gateway slice.
 *
 * Discord sends an interaction to every active gateway session for the same bot. During the
 * migration, Node must therefore yield an explicitly promoted command instead of racing Rust to
 * answer it. Each promoted slice stays OFF unless the operator deliberately starts its matching
 * Rust runtime configuration.
 */
/**
 * The final cutover is intentionally stricter than any individual canary. Keeping this list in
 * the Node boundary as well as the Rust startup validator means a legacy process can refuse to
 * become a second gateway only after the exact same operator contract is satisfied.
 */
export const FULL_RUST_RUNTIME_FLAGS = [
  'RUST_RUNTIME_READY',
  'RUST_REGISTER_COMMANDS_ENABLED',
  'RUST_CORE_VOICE_ENABLED',
  'RUST_QUEUE_ENABLED',
  'RUST_PRONUNCIATION_ENABLED',
  'RUST_CONFIG_LANGUAGE_ENABLED',
  'RUST_CONFIG_TOGGLES_ENABLED',
  'RUST_CONFIG_NUMERIC_ENABLED',
  'RUST_CONFIG_ROLE_ENABLED',
  'RUST_CONFIG_DEFAULT_VOICE_ENABLED',
  'RUST_CONFIG_CHANNEL_ENABLED',
  'RUST_CONFIG_QUEUE_ROLES_ENABLED',
  'RUST_CONFIG_GREET_LANGUAGE_ENABLED',
  'RUST_CONFIG_BLOCKWORD_ENABLED',
  'RUST_CONFIG_SHOW_ENABLED',
  'RUST_CONFIG_RESET_ENABLED',
  'RUST_UPTIME_ENABLED',
  'RUST_INVITE_ENABLED',
  'RUST_HELP_ENABLED',
  'RUST_VOTE_ENABLED',
  'RUST_TOP_SPEAKERS_ENABLED',
  'RUST_BIRTHDAY_ENABLED',
  'RUST_BOT_STATS_ENABLED',
  'RUST_SERVER_STATS_ENABLED',
  'RUST_STATS_ENABLED',
  'RUST_PREMIUM_ENABLED',
  'RUST_REDEEM_ENABLED',
  'RUST_PRIVACY_ENABLED',
  'RUST_GAME_LIST_ENABLED',
  'RUST_GAME_SCORES_ENABLED',
  'RUST_GAME_PLAY_ENABLED',
  'RUST_PUBLIC_COMMANDS_ENABLED',
  'RUST_TTS_FILE_ENABLED',
  'RUST_TRANSCRIBE_MESSAGE_ENABLED',
  'RUST_TRANSCRIBE_LIVE_ENABLED',
  'RUST_TRANSCRIBE_CONTROL_ENABLED',
  'RUST_SPEAK_CONTEXT_ENABLED',
  'RUST_VOICE_PREFERENCES_ENABLED',
  'RUST_TRANSLATE_TEXT_ENABLED',
  'RUST_TRANSLATE_CONTEXT_ENABLED',
  'RUST_TRANSLATION_ADMIN_ENABLED',
  'RUST_TRANSLATION_PREFERENCES_ENABLED',
  'RUST_AUTOMATIC_TRANSLATION_ENABLED',
  'RUST_WELCOME_ENABLED',
  'RUST_MESSAGE_AUTOREAD_ENABLED',
  'RUST_RANDOMIZER_ENABLED',
  'RUST_CAST_ENABLED',
  'RUST_SETUP_ENABLED',
  'RUST_OWNER_COMMANDS_ENABLED',
  'RUST_BROWSER_API_ENABLED',
  'RUST_DASHBOARD_ENABLED',
  'RUST_ADMIN_API_ENABLED',
] as const;

/** True only for an explicit, complete cutover configuration. A typo or partial list is false. */
export function rustRuntimeFullEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.RUST_RUNTIME_MODE?.trim().toLowerCase() === 'full' &&
    FULL_RUST_RUNTIME_FLAGS.every((name) => env[name]?.trim().toLowerCase() === 'true')
  );
}

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

/** Owner-only monetization commands require both explicit promotion and the two defense-in-depth
 * identity values used by the Rust gateway. If either value is missing, Node remains authoritative
 * so an incomplete Rust environment can never turn a valid owner command into a denial. */
export function rustOwnerCommandsOwnCommand(
  commandName: string,
  enabled = process.env.RUST_OWNER_COMMANDS_ENABLED,
  ownerId = process.env.OWNER_ID,
  ownerGuildId = process.env.OWNER_GUILD_ID,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' &&
    (ownerId?.trim().length ?? 0) > 0 &&
    (ownerGuildId?.trim().length ?? 0) > 0 &&
    (commandName === 'vozen-grant' || commandName === 'generate-code')
  );
}

/** Read-only/control-plane commands that can be promoted together once Rust is live. */
const RUST_PUBLIC_COMMANDS = new Set([
  'uptime',
  'invite',
  'help',
  'vote',
  'top-speakers',
  'stats',
  'bot-stats',
  'server-stats',
  'game',
]);

export function rustPublicCommandsOwnCommand(
  commandName: string,
  subcommand: string | null = null,
  enabled = process.env.RUST_PUBLIC_COMMANDS_ENABLED,
): boolean {
  if (enabled?.trim().toLowerCase() !== 'true') return false;
  if (!RUST_PUBLIC_COMMANDS.has(commandName)) return false;
  if (commandName !== 'game') return true;
  return subcommand === 'list' || subcommand === 'leaderboard' || subcommand === 'stats';
}

/** Message context-menu transcription has an independent canary because it starts a Whisper
 * process and must not race Node's ephemeral response. */
export function rustTranscriptionOwnsCommand(
  commandName: string,
  commandType = 3,
  enabled = process.env.RUST_TRANSCRIBE_MESSAGE_ENABLED,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' &&
    commandType === 3 &&
    commandName === 'Transcribe voice message'
  );
}

/** Consent withdrawal remains independently promotable while the live receiver is being canaried. */
export function rustTranscriptionControlOwnsCommand(
  commandName: string,
  subcommand: string | null,
  enabled?: string,
): boolean {
  const effectiveEnabled =
    enabled ??
    (process.env.RUST_TRANSCRIBE_CONTROL_ENABLED?.trim().toLowerCase() === 'true' ||
    process.env.RUST_TRANSCRIBE_LIVE_ENABLED?.trim().toLowerCase() === 'true'
      ? 'true'
      : 'false');
  return (
    effectiveEnabled.trim().toLowerCase() === 'true' &&
    commandName === 'transcribe' &&
    subcommand === 'revoke'
  );
}

/** `/transcribe start|stop` is promoted only when the Rust voice driver and the consent-gated
 * receiver are enabled together. `revoke` stays on the control canary above so an operator can
 * withdraw consent before promoting live capture. */
export function rustTranscriptionLiveOwnsCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_TRANSCRIBE_LIVE_ENABLED,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' &&
    commandName === 'transcribe' &&
    (subcommand === 'start' || subcommand === 'stop')
  );
}

/** The Speak message context menu uses the core TTS admission path and has its own canary. */
export function rustSpeakContextOwnsCommand(
  commandName: string,
  commandType = 3,
  coreEnabled = process.env.RUST_CORE_VOICE_ENABLED,
  enabled = process.env.RUST_SPEAK_CONTEXT_ENABLED,
  ttsEngine = process.env.TTS_ENGINE,
): boolean {
  return (
    coreEnabled?.trim().toLowerCase() === 'true' &&
    enabled?.trim().toLowerCase() === 'true' &&
    rustCoreEngineCompatible(ttsEngine) &&
    commandType === 3 &&
    commandName === 'Speak'
  );
}

/** The Translate message context menu reuses the explicit translation quota/provider service. */
export function rustTranslateContextOwnsCommand(
  commandName: string,
  commandType = 3,
  enabled = process.env.RUST_TRANSLATE_CONTEXT_ENABLED,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' && commandType === 3 && commandName === 'Translate'
  );
}

/** `/randomizer` owns a short-lived menu/modal flow inside the Rust voice sink. */
export function rustRandomizerOwnsCommand(
  commandName: string,
  coreEnabled = process.env.RUST_CORE_VOICE_ENABLED,
  enabled = process.env.RUST_RANDOMIZER_ENABLED,
  ttsEngine = process.env.TTS_ENGINE,
): boolean {
  return (
    coreEnabled?.trim().toLowerCase() === 'true' &&
    enabled?.trim().toLowerCase() === 'true' &&
    rustCoreEngineCompatible(ttsEngine) &&
    commandName === 'randomizer'
  );
}

/** `/cast` owns its menu/reveal session only after the Rust core and provider canaries are active. */
export function rustCastOwnsCommand(
  commandName: string,
  coreEnabled = process.env.RUST_CORE_VOICE_ENABLED,
  enabled = process.env.RUST_CAST_ENABLED,
  ttsEngine = process.env.TTS_ENGINE,
): boolean {
  return (
    coreEnabled?.trim().toLowerCase() === 'true' &&
    enabled?.trim().toLowerCase() === 'true' &&
    rustCoreEngineCompatible(ttsEngine) &&
    commandName === 'cast'
  );
}

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
    rustCoreEngineCompatible(ttsEngine) &&
    commandName === 'queue'
  );
}

/** Pronunciation mutations share SQLite with the message pipeline. The Rust adapter also owns
 * the beginner-friendly add modal when this canary is enabled. */
export function rustPronunciationOwnsCommand(
  commandName: string,
  subcommand: string | null,
  _hasCompleteAdd = false,
  enabled = process.env.RUST_PRONUNCIATION_ENABLED,
): boolean {
  if (enabled?.trim().toLowerCase() !== 'true') return false;
  if (commandName !== 'pronunciation' && commandName !== 'server-pronunciation') return false;
  if (subcommand === 'add') return true;
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
    rustCoreEngineCompatible(ttsEngine) &&
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

/** Guided onboarding is separate from individual config leaves and remains opt-in. */
export function rustSetupOwnsCommand(
  commandName: string,
  coreEnabled = process.env.RUST_CORE_VOICE_ENABLED,
  enabled = process.env.RUST_SETUP_ENABLED,
  ttsEngine = process.env.TTS_ENGINE,
): boolean {
  return (
    coreEnabled?.trim().toLowerCase() === 'true' &&
    enabled?.trim().toLowerCase() === 'true' &&
    rustCoreEngineCompatible(ttsEngine) &&
    commandName === 'setup'
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

/** Live game sessions are promoted only when the Rust voice gateway is active as well. */
export function rustGamePlayOwnsCommand(
  commandName: string,
  subcommand: string | null,
  coreEnabled = process.env.RUST_CORE_VOICE_ENABLED,
  enabled = process.env.RUST_GAME_PLAY_ENABLED,
  ttsEngine = process.env.TTS_ENGINE,
): boolean {
  return (
    coreEnabled?.trim().toLowerCase() === 'true' &&
    enabled?.trim().toLowerCase() === 'true' &&
    rustCoreEngineCompatible(ttsEngine) &&
    commandName === 'game' &&
    (subcommand === 'play' || subcommand === 'stop')
  );
}

/** Rust can run the shared core with every legacy operator default now ported to the runtime. */
function rustCoreEngineCompatible(ttsEngine = process.env.TTS_ENGINE): boolean {
  const normalized = ttsEngine?.trim().toLowerCase();
  return (
    !normalized ||
    normalized === 'piper' ||
    normalized === 'gtts' ||
    normalized === 'router' ||
    normalized === 'neural'
  );
}

/** File export remains Piper-only until its provider-specific path is ported. */
function rustPiperCompatible(ttsEngine = process.env.TTS_ENGINE): boolean {
  const normalized = ttsEngine?.trim().toLowerCase();
  return !normalized || normalized === 'piper';
}

/**
 * Translation promotion is leaf-level: `/translate` contains independent private, preference,
 * mapping and automatic-delivery boundaries. Rust may claim only a leaf after its matching
 * runtime adapter is intentionally started.
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

/** `/translate preview` shares the explicit provider/quota adapter but keeps its admin boundary
 * independently testable from member preference leaves. */
export function rustTranslationPreviewOwnsCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_TRANSLATE_TEXT_ENABLED,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' &&
    commandName === 'translate' &&
    subcommand === 'preview'
  );
}

/** Server translation administration is independently canaried because it mutates SQLite. */
export function rustTranslationAdminOwnsCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_TRANSLATION_ADMIN_ENABLED,
): boolean {
  return (
    enabled?.trim().toLowerCase() === 'true' &&
    commandName === 'translate' &&
    (subcommand === 'status' ||
      subcommand === 'enable' ||
      subcommand === 'disable' ||
      subcommand === 'clear' ||
      subcommand === 'map-add' ||
      subcommand === 'map-remove' ||
      subcommand === 'map-list')
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
      rustCoreEngineCompatible(ttsEngine) &&
      RUST_CORE_VOICE_COMMANDS.has(commandName)) ||
    (privateFileEnabled?.trim().toLowerCase() === 'true' &&
      rustPiperCompatible(ttsEngine) &&
      RUST_PRIVATE_TTS_FILE_COMMANDS.has(commandName))
  );
}

/**
 * `/voice` is a mixed surface. Rust's audio core owns `preview` only when the same provider
 * runtime that owns `/tts` is explicitly enabled; the preference browser, config panel and
 * mutation leaves use their own canary. Other unpromoted voice behavior remains Node-owned.
 */
export function rustVoicePreferencesOwnCommand(
  commandName: string,
  subcommand: string | null,
  enabled = process.env.RUST_VOICE_PREFERENCES_ENABLED,
  ttsEngine = process.env.TTS_ENGINE,
  coreEnabled = process.env.RUST_CORE_VOICE_ENABLED,
): boolean {
  const previewEnabled =
    coreEnabled?.trim().toLowerCase() === 'true' && rustCoreEngineCompatible(ttsEngine);
  return (
    commandName === 'voice' &&
    ((previewEnabled && subcommand === 'preview') ||
      (enabled?.trim().toLowerCase() === 'true' &&
        rustCoreEngineCompatible(ttsEngine) &&
        (subcommand === 'list' ||
          subcommand === 'browse' ||
          subcommand === 'config' ||
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
    rustCoreEngineCompatible(ttsEngine)
  );
}
