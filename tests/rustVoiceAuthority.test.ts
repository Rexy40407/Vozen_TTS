import { describe, expect, it } from 'vitest';
import {
  rustTranslationOwnsCommand,
  rustTranslationOwnsAutomaticMessages,
  rustTranslationPreferencesOwnCommand,
  rustQueueOwnsCommand,
  rustPronunciationOwnsCommand,
  rustConfigLanguageOwnsCommand,
  rustVoiceOwnsAutoRead,
  rustVoiceOwnsCommand,
  rustVoicePreferencesOwnCommand,
} from '../src/migration/rustVoiceAuthority';

describe('Rust core voice migration ownership', () => {
  it('is off unless explicitly enabled and only yields the promoted command set', () => {
    expect(rustVoiceOwnsCommand('tts')).toBe(false);
    expect(rustVoiceOwnsCommand('tts', 'yes')).toBe(false);
    expect(rustVoiceOwnsCommand('tts', 'true')).toBe(true);
    expect(rustVoiceOwnsCommand('tts', 'true', 'false', 'gtts')).toBe(false);
    expect(rustVoiceOwnsCommand('join', ' TRUE ')).toBe(true);
    expect(rustVoiceOwnsCommand('shut-up', 'true')).toBe(true);
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

  it('keeps pronunciation modal fallback in Node while direct leaves canary in Rust', () => {
    expect(rustPronunciationOwnsCommand('pronunciation', 'list')).toBe(false);
    expect(rustPronunciationOwnsCommand('pronunciation', 'list', false, 'true')).toBe(true);
    expect(rustPronunciationOwnsCommand('pronunciation', 'remove', false, 'true')).toBe(true);
    expect(rustPronunciationOwnsCommand('pronunciation', 'add', false, 'true')).toBe(false);
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
    expect(rustVoicePreferencesOwnCommand('voice', 'preview', 'true')).toBe(false);
    expect(rustVoicePreferencesOwnCommand('translate', 'reset', 'true')).toBe(false);
  });

  it('keeps Node automatic translation authoritative until its own exact flag is enabled', () => {
    expect(rustTranslationOwnsAutomaticMessages()).toBe(false);
    expect(rustTranslationOwnsAutomaticMessages('yes')).toBe(false);
    expect(rustTranslationOwnsAutomaticMessages(' TRUE ')).toBe(true);
  });
});
