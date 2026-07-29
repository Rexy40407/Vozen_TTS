const publicBundle = (flag) => [[flag], ['RUST_PUBLIC_COMMANDS_ENABLED']];

const coreVoiceCommands = new Set([
  'join',
  'leave',
  'tts',
  'skip',
  'shut-up',
  'laugh',
  'joke',
  'rizz',
  'sound',
  '8-ball',
  'fortune',
  'fact',
  'wyr',
]);

const publicBundleCommands = new Map([
  ['invite', 'RUST_INVITE_ENABLED'],
  ['vote', 'RUST_VOTE_ENABLED'],
  ['help', 'RUST_HELP_ENABLED'],
  ['top-speakers', 'RUST_TOP_SPEAKERS_ENABLED'],
  ['server-stats', 'RUST_SERVER_STATS_ENABLED'],
  ['stats', 'RUST_STATS_ENABLED'],
  ['uptime', 'RUST_UPTIME_ENABLED'],
  ['bot-stats', 'RUST_BOT_STATS_ENABLED'],
  ['game list', 'RUST_GAME_LIST_ENABLED'],
  ['game leaderboard', 'RUST_GAME_SCORES_ENABLED'],
  ['game stats', 'RUST_GAME_SCORES_ENABLED'],
]);

const configFlags = new Map([
  ['config tts-channel', 'RUST_CONFIG_CHANNEL_ENABLED'],
  ['config auto-read', 'RUST_CONFIG_TOGGLES_ENABLED'],
  ['config max-chars', 'RUST_CONFIG_NUMERIC_ENABLED'],
  ['config rate-limit', 'RUST_CONFIG_NUMERIC_ENABLED'],
  ['config role', 'RUST_CONFIG_ROLE_ENABLED'],
  ['config priority-role', 'RUST_CONFIG_QUEUE_ROLES_ENABLED'],
  ['config blocked-role', 'RUST_CONFIG_QUEUE_ROLES_ENABLED'],
  ['config enabled', 'RUST_CONFIG_TOGGLES_ENABLED'],
  ['config x-said', 'RUST_CONFIG_TOGGLES_ENABLED'],
  ['config auto-join', 'RUST_CONFIG_TOGGLES_ENABLED'],
  ['config read-bots', 'RUST_CONFIG_TOGGLES_ENABLED'],
  ['config text-in-voice', 'RUST_CONFIG_TOGGLES_ENABLED'],
  ['config anti-spam', 'RUST_CONFIG_TOGGLES_ENABLED'],
  ['config streaks', 'RUST_CONFIG_TOGGLES_ENABLED'],
  ['config soundboard', 'RUST_CONFIG_TOGGLES_ENABLED'],
  ['config vote-reminders', 'RUST_CONFIG_TOGGLES_ENABLED'],
  ['config greet', 'RUST_CONFIG_TOGGLES_ENABLED'],
  ['config greet-language', 'RUST_CONFIG_GREET_LANGUAGE_ENABLED'],
  ['config default-voice', 'RUST_CONFIG_DEFAULT_VOICE_ENABLED'],
  ['config language', 'RUST_CONFIG_LANGUAGE_ENABLED'],
  ['config show', 'RUST_CONFIG_SHOW_ENABLED'],
  ['config reset', 'RUST_CONFIG_RESET_ENABLED'],
  ['config block-word add', 'RUST_CONFIG_BLOCKWORD_ENABLED'],
  ['config block-word remove', 'RUST_CONFIG_BLOCKWORD_ENABLED'],
]);

function literalTrue(value) {
  return value?.trim().toLowerCase() === 'true';
}

export function commandLeafPaths(commands, prefix = []) {
  return commands.flatMap((command) => {
    const path = [...prefix, command.name];
    const children = (command.options ?? []).filter(
      (option) => option.type === 1 || option.type === 2,
    );
    return children.length > 0 ? commandLeafPaths(children, path) : [path.join(' ')];
  });
}

export function ownershipRequirements(path) {
  if (coreVoiceCommands.has(path)) return [['RUST_CORE_VOICE_ENABLED']];
  if (publicBundleCommands.has(path)) return publicBundle(publicBundleCommands.get(path));
  if (configFlags.has(path)) return [[configFlags.get(path)]];

  if (path.startsWith('queue ')) {
    return [['RUST_CORE_VOICE_ENABLED', 'RUST_QUEUE_ENABLED']];
  }
  if (path === 'cast') {
    return [['RUST_CORE_VOICE_ENABLED', 'RUST_CAST_ENABLED']];
  }
  if (path === 'randomizer') {
    return [['RUST_CORE_VOICE_ENABLED', 'RUST_RANDOMIZER_ENABLED']];
  }
  if (path === 'setup') {
    return [['RUST_CORE_VOICE_ENABLED', 'RUST_SETUP_ENABLED']];
  }
  if (path === 'game play' || path === 'game stop') {
    return [['RUST_CORE_VOICE_ENABLED', 'RUST_GAME_PLAY_ENABLED']];
  }
  if (path === 'Speak') {
    return [['RUST_CORE_VOICE_ENABLED', 'RUST_SPEAK_CONTEXT_ENABLED']];
  }
  if (path === 'tts-file') return [['RUST_TTS_FILE_ENABLED']];
  if (path.startsWith('birthday ')) return [['RUST_BIRTHDAY_ENABLED']];
  if (path === 'privacy erase') return [['RUST_PRIVACY_ENABLED']];
  if (path === 'translate text' || path === 'translate preview') {
    return [['RUST_TRANSLATE_TEXT_ENABLED']];
  }
  if (
    path === 'translate language' ||
    path === 'translate speak-language' ||
    path === 'translate opt-out'
  ) {
    return [['RUST_TRANSLATION_PREFERENCES_ENABLED']];
  }
  if (
    path.startsWith('translate ') &&
    ![
      'translate text',
      'translate preview',
      'translate language',
      'translate speak-language',
      'translate opt-out',
    ].includes(path)
  ) {
    return [['RUST_TRANSLATION_ADMIN_ENABLED']];
  }
  if (path === 'Translate') return [['RUST_TRANSLATE_CONTEXT_ENABLED']];
  if (path.startsWith('premium ')) return [['RUST_PREMIUM_ENABLED']];
  if (path === 'transcribe start' || path === 'transcribe stop') {
    return [['RUST_TRANSCRIBE_LIVE_ENABLED']];
  }
  if (path === 'transcribe revoke') {
    return [['RUST_TRANSCRIBE_CONTROL_ENABLED'], ['RUST_TRANSCRIBE_LIVE_ENABLED']];
  }
  if (path === 'Transcribe voice message') {
    return [['RUST_TRANSCRIBE_MESSAGE_ENABLED']];
  }
  if (path === 'voice preview') return [['RUST_CORE_VOICE_ENABLED']];
  if (path.startsWith('voice ')) return [['RUST_VOICE_PREFERENCES_ENABLED']];
  if (path.startsWith('pronunciation ') || path.startsWith('server-pronunciation ')) {
    return [['RUST_PRONUNCIATION_ENABLED']];
  }
  if (path === 'redeem') return [['RUST_REDEEM_ENABLED']];
  if (path === 'vozen-grant' || path === 'generate-code') {
    return [['RUST_OWNER_COMMANDS_ENABLED']];
  }
  return [];
}

export function auditCommandOwnership(contract, environment, includeOwner = false) {
  const commands = includeOwner
    ? [...contract.public_commands, ...contract.owner_commands]
    : contract.public_commands;
  const paths = commandLeafPaths(commands);
  const unknown = [];
  const disabled = [];

  for (const path of paths) {
    const alternatives = ownershipRequirements(path);
    if (alternatives.length === 0) {
      unknown.push(path);
      continue;
    }
    if (
      !alternatives.some((required) => required.every((flag) => literalTrue(environment[flag])))
    ) {
      disabled.push({
        path,
        alternatives,
      });
    }
  }

  return { paths, unknown, disabled };
}
