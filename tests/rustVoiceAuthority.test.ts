import { describe, expect, it } from 'vitest';
import {
  rustTranslationOwnsCommand,
  rustTranslationOwnsAutomaticMessages,
  rustTranslationAdminOwnsCommand,
  rustTranslationPreviewOwnsCommand,
  rustTranslationPreferencesOwnCommand,
  rustQueueOwnsCommand,
  rustPronunciationOwnsCommand,
  rustConfigLanguageOwnsCommand,
  rustConfigNumericOwnsCommand,
  rustConfigRoleOwnsCommand,
  rustConfigDefaultVoiceOwnsCommand,
  rustConfigChannelOwnsCommand,
  rustSetupOwnsCommand,
  rustConfigQueueRolesOwnCommand,
  rustConfigGreetLanguageOwnsCommand,
  rustConfigBlockwordOwnsCommand,
  rustConfigShowOwnsCommand,
  rustConfigResetOwnsCommand,
  rustUptimeOwnsCommand,
  rustInviteOwnsCommand,
  rustHelpOwnsCommand,
  rustVoteOwnsCommand,
  rustTopSpeakersOwnsCommand,
  rustPrivacyOwnsCommand,
  rustBirthdayOwnsCommand,
  rustBotStatsOwnsCommand,
  rustServerStatsOwnsCommand,
  rustStatsOwnsCommand,
  rustPremiumInfoOwnsCommand,
  rustPremiumMutationOwnsCommand,
  rustRedeemOwnsCommand,
  rustGameListOwnsCommand,
  rustGameScoresOwnsCommand,
  rustConfigTogglesOwnCommand,
  rustVoiceOwnsAutoRead,
  rustVoiceOwnsCommand,
  rustVoicePreferencesOwnCommand,
  rustPublicCommandsOwnCommand,
  rustOwnerCommandsOwnCommand,
  rustTranscriptionOwnsCommand,
  rustTranscriptionControlOwnsCommand,
  rustSpeakContextOwnsCommand,
  rustTranslateContextOwnsCommand,
  rustRandomizerOwnsCommand,
  rustCastOwnsCommand,
} from '../src/migration/rustVoiceAuthority';

describe('Rust core voice migration ownership', () => {
  it('keeps owner commands on Node until both identity guards are present', () => {
    expect(rustOwnerCommandsOwnCommand('vozen-grant', 'true', 'owner', 'guild')).toBe(true);
    expect(rustOwnerCommandsOwnCommand('generate-code', 'true', 'owner', 'guild')).toBe(true);
    expect(rustOwnerCommandsOwnCommand('vozen-grant', 'true', '', 'guild')).toBe(false);
    expect(rustOwnerCommandsOwnCommand('vozen-grant', 'true', 'owner', '')).toBe(false);
    expect(rustOwnerCommandsOwnCommand('redeem', 'true', 'owner', 'guild')).toBe(false);
    expect(rustOwnerCommandsOwnCommand('vozen-grant', 'yes', 'owner', 'guild')).toBe(false);
  });

  it('groups only read-only/control-plane commands behind the public canary', () => {
    expect(rustPublicCommandsOwnCommand('help', null, 'true')).toBe(true);
    expect(rustPublicCommandsOwnCommand('game', 'leaderboard', 'true')).toBe(true);
    expect(rustPublicCommandsOwnCommand('game', 'play', 'true')).toBe(false);
    expect(rustPublicCommandsOwnCommand('premium', 'info', 'true')).toBe(false);
    expect(rustPublicCommandsOwnCommand('help', null, 'false')).toBe(false);
  });
  it('keeps message transcription behind an exact independent canary', () => {
    expect(rustTranscriptionOwnsCommand('Transcribe voice message')).toBe(false);
    expect(rustTranscriptionOwnsCommand('Transcribe voice message', 3, 'true')).toBe(true);
    expect(rustTranscriptionOwnsCommand('Transcribe voice message', 2, 'true')).toBe(false);
    expect(rustTranscriptionOwnsCommand('Translate', 3, 'true')).toBe(false);
  });

  it('canaries only consent withdrawal while live transcription stays on Node', () => {
    expect(rustTranscriptionControlOwnsCommand('transcribe', 'revoke', 'true')).toBe(true);
    expect(rustTranscriptionControlOwnsCommand('transcribe', 'start', 'true')).toBe(false);
    expect(rustTranscriptionControlOwnsCommand('transcribe', 'stop', 'true')).toBe(false);
    expect(rustTranscriptionControlOwnsCommand('transcribe', 'revoke', 'false')).toBe(false);
  });

  it('keeps the Speak context menu behind core, Piper, and its own canary', () => {
    expect(rustSpeakContextOwnsCommand('Speak', 3, 'false', 'true', 'piper')).toBe(false);
    expect(rustSpeakContextOwnsCommand('Speak', 3, 'true', 'false', 'piper')).toBe(false);
    expect(rustSpeakContextOwnsCommand('Speak', 3, 'true', 'true', 'google')).toBe(false);
    expect(rustSpeakContextOwnsCommand('Speak', 2, 'true', 'true', 'piper')).toBe(false);
    expect(rustSpeakContextOwnsCommand('Translate', 3, 'true', 'true', 'piper')).toBe(false);
    expect(rustSpeakContextOwnsCommand('Speak', 3, 'true', 'true', 'piper')).toBe(true);
  });

  it('keeps the Translate context menu behind its exact canary', () => {
    expect(rustTranslateContextOwnsCommand('Translate', 3, 'false')).toBe(false);
    expect(rustTranslateContextOwnsCommand('Translate', 2, 'true')).toBe(false);
    expect(rustTranslateContextOwnsCommand('Speak', 3, 'true')).toBe(false);
    expect(rustTranslateContextOwnsCommand('Translate', 3, 'true')).toBe(true);
  });

  it('keeps randomizer behind the core Piper canary', () => {
    expect(rustRandomizerOwnsCommand('randomizer')).toBe(false);
    expect(rustRandomizerOwnsCommand('randomizer', 'true', 'true', 'piper')).toBe(true);
    expect(rustRandomizerOwnsCommand('randomizer', 'true', 'true', 'gtts')).toBe(false);
    expect(rustRandomizerOwnsCommand('joke', 'true', 'true', 'piper')).toBe(false);
  });

  it('keeps cast behind the core Piper canary', () => {
    expect(rustCastOwnsCommand('cast')).toBe(false);
    expect(rustCastOwnsCommand('cast', 'true', 'true', 'piper')).toBe(true);
    expect(rustCastOwnsCommand('cast', 'true', 'true', 'gtts')).toBe(false);
    expect(rustCastOwnsCommand('randomizer', 'true', 'true', 'piper')).toBe(false);
  });

  it('is off unless explicitly enabled and only yields the promoted command set', () => {
    expect(rustVoiceOwnsCommand('tts')).toBe(false);
    expect(rustVoiceOwnsCommand('tts', 'yes')).toBe(false);
    expect(rustVoiceOwnsCommand('tts', 'true')).toBe(true);
    expect(rustVoiceOwnsCommand('tts', 'true', 'false', 'gtts')).toBe(false);
    expect(rustVoiceOwnsCommand('join', ' TRUE ')).toBe(true);
    expect(rustVoiceOwnsCommand('shut-up', 'true')).toBe(true);
    expect(rustVoiceOwnsCommand('laugh', 'true')).toBe(true);
    expect(rustVoiceOwnsCommand('joke', 'true')).toBe(true);
    expect(rustVoiceOwnsCommand('rizz', 'true')).toBe(true);
    expect(rustVoiceOwnsCommand('sound', 'true')).toBe(true);
    expect(rustVoiceOwnsCommand('8-ball', 'true')).toBe(true);
    expect(rustVoiceOwnsCommand('fortune', 'true')).toBe(true);
    expect(rustVoiceOwnsCommand('fact', 'true')).toBe(true);
    expect(rustVoiceOwnsCommand('wyr', 'true')).toBe(true);
    expect(rustVoiceOwnsCommand('tts-file', 'true')).toBe(false);
    expect(rustVoiceOwnsCommand('tts-file', 'false', 'true')).toBe(true);
    expect(rustVoiceOwnsCommand('tts-file', 'false', 'yes')).toBe(false);
    expect(rustVoiceOwnsCommand('voice', 'true')).toBe(false);
    expect(rustVoiceOwnsCommand('queue', 'true')).toBe(false);
  });

  it('keeps queue ownership behind its own Piper-compatible canary', () => {
    expect(rustQueueOwnsCommand('queue')).toBe(false);
    expect(rustQueueOwnsCommand('queue', 'true', 'yes')).toBe(false);
    expect(rustQueueOwnsCommand('queue', 'true', 'true')).toBe(true);
    expect(rustQueueOwnsCommand('queue', 'true', 'true', 'gtts')).toBe(false);
    expect(rustQueueOwnsCommand('join', 'true', 'true')).toBe(false);
  });

  it('promotes pronunciation modal and direct leaves behind one canary', () => {
    expect(rustPronunciationOwnsCommand('pronunciation', 'list')).toBe(false);
    expect(rustPronunciationOwnsCommand('pronunciation', 'list', false, 'true')).toBe(true);
    expect(rustPronunciationOwnsCommand('pronunciation', 'remove', false, 'true')).toBe(true);
    expect(rustPronunciationOwnsCommand('pronunciation', 'add', false, 'true')).toBe(true);
    expect(rustPronunciationOwnsCommand('pronunciation', 'add', true, 'true')).toBe(true);
    expect(rustPronunciationOwnsCommand('server-pronunciation', 'add', true, 'true')).toBe(true);
    expect(rustPronunciationOwnsCommand('server-pronunciation', 'list', false, 'yes')).toBe(false);
    expect(rustPronunciationOwnsCommand('queue', 'list', true, 'true')).toBe(false);
  });

  it('promotes only the config language leaf', () => {
    expect(rustConfigLanguageOwnsCommand('config', 'language')).toBe(false);
    expect(rustConfigLanguageOwnsCommand('config', 'language', 'true')).toBe(true);
    expect(rustConfigLanguageOwnsCommand('config', 'show', 'true')).toBe(false);
    expect(rustConfigLanguageOwnsCommand('voice', 'language', 'true')).toBe(false);
  });

  it('promotes only the boolean config leaves behind their own flag', () => {
    expect(rustConfigTogglesOwnCommand('config', 'auto-read')).toBe(false);
    expect(rustConfigTogglesOwnCommand('config', 'auto-read', 'true')).toBe(true);
    expect(rustConfigTogglesOwnCommand('config', 'greet', 'true')).toBe(true);
    expect(rustConfigTogglesOwnCommand('config', 'language', 'true')).toBe(false);
    expect(rustConfigTogglesOwnCommand('config', 'show', 'true')).toBe(false);
    expect(rustConfigTogglesOwnCommand('voice', 'auto-read', 'true')).toBe(false);
  });

  it('promotes only numeric config limits behind their own canary', () => {
    expect(rustConfigNumericOwnsCommand('config', 'max-chars')).toBe(false);
    expect(rustConfigNumericOwnsCommand('config', 'max-chars', 'true')).toBe(true);
    expect(rustConfigNumericOwnsCommand('config', 'rate-limit', 'true')).toBe(true);
    expect(rustConfigNumericOwnsCommand('config', 'language', 'true')).toBe(false);
    expect(rustConfigNumericOwnsCommand('config', 'show', 'true')).toBe(false);
    expect(rustConfigNumericOwnsCommand('voice', 'max-chars', 'true')).toBe(false);
  });

  it('promotes only the simple config role leaf behind its own canary', () => {
    expect(rustConfigRoleOwnsCommand('config', 'role')).toBe(false);
    expect(rustConfigRoleOwnsCommand('config', 'role', 'true')).toBe(true);
    expect(rustConfigRoleOwnsCommand('config', 'priority-role', 'true')).toBe(false);
    expect(rustConfigRoleOwnsCommand('config', 'blocked-role', 'true')).toBe(false);
    expect(rustConfigRoleOwnsCommand('config', 'show', 'true')).toBe(false);
  });

  it('promotes default voice only with the Piper-compatible catalogue canary', () => {
    expect(rustConfigDefaultVoiceOwnsCommand('config', 'default-voice')).toBe(false);
    expect(rustConfigDefaultVoiceOwnsCommand('config', 'default-voice', 'true', 'piper')).toBe(
      true,
    );
    expect(rustConfigDefaultVoiceOwnsCommand('config', 'default-voice', 'true', 'gtts')).toBe(
      false,
    );
    expect(rustConfigDefaultVoiceOwnsCommand('config', 'role', 'true', 'piper')).toBe(false);
  });

  it('promotes only the tts channel config leaf behind its own canary', () => {
    expect(rustConfigChannelOwnsCommand('config', 'tts-channel')).toBe(false);
    expect(rustConfigChannelOwnsCommand('config', 'tts-channel', 'true')).toBe(true);
    expect(rustConfigChannelOwnsCommand('config', 'auto-read', 'true')).toBe(false);
    expect(rustConfigChannelOwnsCommand('voice', 'tts-channel', 'true')).toBe(false);
  });

  it('keeps setup behind core, setup and Piper canaries', () => {
    expect(rustSetupOwnsCommand('setup', 'false', 'true', 'piper')).toBe(false);
    expect(rustSetupOwnsCommand('setup', 'true', 'false', 'piper')).toBe(false);
    expect(rustSetupOwnsCommand('setup', 'true', 'true', 'gtts')).toBe(false);
    expect(rustSetupOwnsCommand('setup', 'true', 'true', 'piper')).toBe(true);
    expect(rustSetupOwnsCommand('stats', 'true', 'true', 'piper')).toBe(false);
  });

  it('promotes both queue-role leaves behind one conflict-aware canary', () => {
    expect(rustConfigQueueRolesOwnCommand('config', 'priority-role')).toBe(false);
    expect(rustConfigQueueRolesOwnCommand('config', 'priority-role', 'true')).toBe(true);
    expect(rustConfigQueueRolesOwnCommand('config', 'blocked-role', 'true')).toBe(true);
    expect(rustConfigQueueRolesOwnCommand('config', 'role', 'true')).toBe(false);
    expect(rustConfigQueueRolesOwnCommand('voice', 'priority-role', 'true')).toBe(false);
  });

  it('promotes only the greeting language leaf behind its own canary', () => {
    expect(rustConfigGreetLanguageOwnsCommand('config', 'greet-language')).toBe(false);
    expect(rustConfigGreetLanguageOwnsCommand('config', 'greet-language', 'true')).toBe(true);
    expect(rustConfigGreetLanguageOwnsCommand('config', 'language', 'true')).toBe(false);
    expect(rustConfigGreetLanguageOwnsCommand('voice', 'greet-language', 'true')).toBe(false);
  });

  it('promotes only block-word add/remove behind the grouped canary', () => {
    expect(rustConfigBlockwordOwnsCommand('config', 'block-word', 'add')).toBe(false);
    expect(rustConfigBlockwordOwnsCommand('config', 'block-word', 'add', 'true')).toBe(true);
    expect(rustConfigBlockwordOwnsCommand('config', 'block-word', 'remove', 'true')).toBe(true);
    expect(rustConfigBlockwordOwnsCommand('config', 'block-word', 'list', 'true')).toBe(false);
    expect(rustConfigBlockwordOwnsCommand('config', null, 'add', 'true')).toBe(false);
  });

  it('promotes only read-only config show behind its own canary', () => {
    expect(rustConfigShowOwnsCommand('config', 'show')).toBe(false);
    expect(rustConfigShowOwnsCommand('config', 'show', 'true')).toBe(true);
    expect(rustConfigShowOwnsCommand('config', 'reset', 'true')).toBe(false);
    expect(rustConfigShowOwnsCommand('voice', 'show', 'true')).toBe(false);
  });

  it('promotes only config reset behind its own canary', () => {
    expect(rustConfigResetOwnsCommand('config', 'reset')).toBe(false);
    expect(rustConfigResetOwnsCommand('config', 'reset', 'true')).toBe(true);
    expect(rustConfigResetOwnsCommand('config', 'show', 'true')).toBe(false);
    expect(rustConfigResetOwnsCommand('voice', 'reset', 'true')).toBe(false);
  });

  it('promotes only public uptime behind its own canary', () => {
    expect(rustUptimeOwnsCommand('uptime')).toBe(false);
    expect(rustUptimeOwnsCommand('uptime', 'true')).toBe(true);
    expect(rustUptimeOwnsCommand('bot-stats', 'true')).toBe(false);
  });

  it('promotes only public invite behind its own canary', () => {
    expect(rustInviteOwnsCommand('invite')).toBe(false);
    expect(rustInviteOwnsCommand('invite', 'true')).toBe(true);
    expect(rustInviteOwnsCommand('vote', 'true')).toBe(false);
  });

  it('promotes only public help behind its own canary', () => {
    expect(rustHelpOwnsCommand('help')).toBe(false);
    expect(rustHelpOwnsCommand('help', 'true')).toBe(true);
    expect(rustHelpOwnsCommand('invite', 'true')).toBe(false);
  });

  it('promotes only public vote behind its own canary', () => {
    expect(rustVoteOwnsCommand('vote')).toBe(false);
    expect(rustVoteOwnsCommand('vote', 'true')).toBe(true);
    expect(rustVoteOwnsCommand('help', 'true')).toBe(false);
  });

  it('promotes only public top-speakers behind its own canary', () => {
    expect(rustTopSpeakersOwnsCommand('top-speakers')).toBe(false);
    expect(rustTopSpeakersOwnsCommand('top-speakers', 'true')).toBe(true);
    expect(rustTopSpeakersOwnsCommand('server-stats', 'true')).toBe(false);
  });

  it('promotes only privacy erase behind its own canary', () => {
    expect(rustPrivacyOwnsCommand('privacy', 'erase')).toBe(false);
    expect(rustPrivacyOwnsCommand('privacy', 'erase', 'true')).toBe(true);
    expect(rustPrivacyOwnsCommand('privacy', null, 'true')).toBe(false);
    expect(rustPrivacyOwnsCommand('help', 'erase', 'true')).toBe(false);
  });

  it('promotes only birthday leaves behind its own canary', () => {
    expect(rustBirthdayOwnsCommand('birthday', 'set')).toBe(false);
    expect(rustBirthdayOwnsCommand('birthday', 'show', 'true')).toBe(true);
    expect(rustBirthdayOwnsCommand('birthday', 'clear', ' TRUE ')).toBe(true);
    expect(rustBirthdayOwnsCommand('birthday', null, 'true')).toBe(false);
    expect(rustBirthdayOwnsCommand('joke', 'show', 'true')).toBe(false);
  });

  it('promotes only server stats behind its own canary', () => {
    expect(rustServerStatsOwnsCommand('server-stats')).toBe(false);
    expect(rustServerStatsOwnsCommand('server-stats', 'true')).toBe(true);
    expect(rustServerStatsOwnsCommand('stats', 'true')).toBe(false);
  });

  it('promotes only manage-guild stats behind its own canary', () => {
    expect(rustStatsOwnsCommand('stats')).toBe(false);
    expect(rustStatsOwnsCommand('stats', 'true')).toBe(true);
    expect(rustStatsOwnsCommand('server-stats', 'true')).toBe(false);
  });

  it('promotes only public bot stats behind its own canary', () => {
    expect(rustBotStatsOwnsCommand('bot-stats')).toBe(false);
    expect(rustBotStatsOwnsCommand('bot-stats', 'true')).toBe(true);
    expect(rustBotStatsOwnsCommand('stats', 'true')).toBe(false);
  });

  it('promotes only premium info behind its own canary', () => {
    expect(rustPremiumInfoOwnsCommand('premium', 'info')).toBe(false);
    expect(rustPremiumInfoOwnsCommand('premium', 'info', 'true')).toBe(true);
    expect(rustPremiumInfoOwnsCommand('premium', 'activate', 'true')).toBe(false);
  });

  it('promotes only premium mutations behind the same explicit canary', () => {
    expect(rustPremiumMutationOwnsCommand('premium', 'activate')).toBe(false);
    expect(rustPremiumMutationOwnsCommand('premium', 'activate', 'true')).toBe(true);
    expect(rustPremiumMutationOwnsCommand('premium', 'deactivate', 'true')).toBe(true);
    expect(rustPremiumMutationOwnsCommand('premium', 'info', 'true')).toBe(false);
  });

  it('promotes only redeem behind its own canary', () => {
    expect(rustRedeemOwnsCommand('redeem')).toBe(false);
    expect(rustRedeemOwnsCommand('redeem', 'true')).toBe(true);
    expect(rustRedeemOwnsCommand('premium', 'true')).toBe(false);
  });

  it('promotes only the read-only game list leaf behind its own canary', () => {
    expect(rustGameListOwnsCommand('game', 'list')).toBe(false);
    expect(rustGameListOwnsCommand('game', 'list', 'true')).toBe(true);
    expect(rustGameListOwnsCommand('game', 'play', 'true')).toBe(false);
    expect(rustGameListOwnsCommand('game', 'leaderboard', 'true')).toBe(false);
    expect(rustGameListOwnsCommand('help', 'list', 'true')).toBe(false);
  });

  it('promotes only read-only game scores behind their own canary', () => {
    expect(rustGameScoresOwnsCommand('game', 'leaderboard')).toBe(false);
    expect(rustGameScoresOwnsCommand('game', 'leaderboard', 'true')).toBe(true);
    expect(rustGameScoresOwnsCommand('game', 'stats', 'true')).toBe(true);
    expect(rustGameScoresOwnsCommand('game', 'play', 'true')).toBe(false);
    expect(rustGameScoresOwnsCommand('game', 'stop', 'true')).toBe(false);
  });

  it('keeps Node message ownership unless both explicit migration flags are set', () => {
    expect(rustVoiceOwnsAutoRead()).toBe(false);
    expect(rustVoiceOwnsAutoRead('true', 'yes')).toBe(false);
    expect(rustVoiceOwnsAutoRead('false', 'true')).toBe(false);
    expect(rustVoiceOwnsAutoRead(' TRUE ', ' true ')).toBe(true);
    expect(rustVoiceOwnsAutoRead('true', 'true', 'neural')).toBe(false);
  });

  it('only yields the private translate text leaf when its exact flag is enabled', () => {
    expect(rustTranslationOwnsCommand('translate', 'text')).toBe(false);
    expect(rustTranslationOwnsCommand('translate', 'text', 'yes')).toBe(false);
    expect(rustTranslationOwnsCommand('translate', 'text', ' TRUE ')).toBe(true);
    expect(rustTranslationOwnsCommand('translate', 'language', 'true')).toBe(false);
    expect(rustTranslationOwnsCommand('translate', 'map-add', 'true')).toBe(false);
    expect(rustTranslationOwnsCommand('tts', 'text', 'true')).toBe(false);
  });

  it('keeps preference leaves independent from the private translation text canary', () => {
    expect(rustTranslationPreferencesOwnCommand('translate', 'language')).toBe(false);
    expect(rustTranslationPreferencesOwnCommand('translate', 'language', 'yes')).toBe(false);
    expect(rustTranslationPreferencesOwnCommand('translate', 'language', 'true')).toBe(true);
    expect(rustTranslationPreferencesOwnCommand('translate', 'speak-language', 'true')).toBe(true);
    expect(rustTranslationPreferencesOwnCommand('translate', 'opt-out', 'true')).toBe(true);
    expect(rustTranslationPreferencesOwnCommand('translate', 'text', 'true')).toBe(false);
    expect(rustTranslationPreferencesOwnCommand('translate', 'map-add', 'true')).toBe(false);
  });

  it('promotes translation preview only behind the explicit translation canary', () => {
    expect(rustTranslationPreviewOwnsCommand('translate', 'preview')).toBe(false);
    expect(rustTranslationPreviewOwnsCommand('translate', 'preview', 'true')).toBe(true);
    expect(rustTranslationPreviewOwnsCommand('translate', 'text', 'true')).toBe(false);
  });

  it('promotes only the server translation administration leaves under their own canary', () => {
    expect(rustTranslationAdminOwnsCommand('translate', 'status')).toBe(false);
    expect(rustTranslationAdminOwnsCommand('translate', 'map-add', 'yes')).toBe(false);
    expect(rustTranslationAdminOwnsCommand('translate', 'map-add', 'true')).toBe(true);
    expect(rustTranslationAdminOwnsCommand('translate', 'map-remove', 'true')).toBe(true);
    expect(rustTranslationAdminOwnsCommand('translate', 'map-list', 'true')).toBe(true);
    expect(rustTranslationAdminOwnsCommand('translate', 'language', 'true')).toBe(false);
    expect(rustTranslationAdminOwnsCommand('translate', 'text', 'true')).toBe(false);
  });

  it('yields only Rust-complete textual voice preferences under their own flag', () => {
    expect(rustVoicePreferencesOwnCommand('voice', 'reset')).toBe(false);
    expect(rustVoicePreferencesOwnCommand('voice', 'reset', 'yes')).toBe(false);
    expect(rustVoicePreferencesOwnCommand('voice', 'reset', ' TRUE ')).toBe(true);
    expect(rustVoicePreferencesOwnCommand('voice', 'set', 'true', 'router')).toBe(false);
    expect(rustVoicePreferencesOwnCommand('voice', 'detection', 'true')).toBe(true);
    expect(rustVoicePreferencesOwnCommand('voice', 'effect', 'true')).toBe(true);
    expect(rustVoicePreferencesOwnCommand('voice', 'set', 'true')).toBe(true);
    expect(rustVoicePreferencesOwnCommand('voice', 'favorite', 'true')).toBe(true);
    expect(rustVoicePreferencesOwnCommand('voice', 'favorites', 'true')).toBe(true);
    expect(rustVoicePreferencesOwnCommand('voice', 'list', 'true')).toBe(true);
    expect(rustVoicePreferencesOwnCommand('voice', 'browse', 'true')).toBe(true);
    expect(rustVoicePreferencesOwnCommand('voice', 'preview', 'true')).toBe(false);
    expect(rustVoicePreferencesOwnCommand('voice', 'preview', undefined, 'piper', 'true')).toBe(
      true,
    );
    expect(rustVoicePreferencesOwnCommand('voice', 'preview', undefined, 'router', 'true')).toBe(
      false,
    );
    expect(rustVoicePreferencesOwnCommand('voice', 'config', 'true')).toBe(true);
    expect(rustVoicePreferencesOwnCommand('translate', 'reset', 'true')).toBe(false);
  });

  it('keeps Node automatic translation authoritative until its own exact flag is enabled', () => {
    expect(rustTranslationOwnsAutomaticMessages()).toBe(false);
    expect(rustTranslationOwnsAutomaticMessages('yes')).toBe(false);
    expect(rustTranslationOwnsAutomaticMessages(' TRUE ')).toBe(true);
  });
});
