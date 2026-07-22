import { describe, expect, it } from 'vitest';
import {
  rustTranslationOwnsCommand,
  rustTranslationPreferencesOwnCommand,
  rustVoiceOwnsAutoRead,
  rustVoiceOwnsCommand,
} from '../src/migration/rustVoiceAuthority';

describe('Rust core voice migration ownership', () => {
  it('is off unless explicitly enabled and only yields the promoted command set', () => {
    expect(rustVoiceOwnsCommand('tts')).toBe(false);
    expect(rustVoiceOwnsCommand('tts', 'yes')).toBe(false);
    expect(rustVoiceOwnsCommand('tts', 'true')).toBe(true);
    expect(rustVoiceOwnsCommand('join', ' TRUE ')).toBe(true);
    expect(rustVoiceOwnsCommand('shut-up', 'true')).toBe(true);
    expect(rustVoiceOwnsCommand('tts-file', 'true')).toBe(false);
    expect(rustVoiceOwnsCommand('tts-file', 'false', 'true')).toBe(true);
    expect(rustVoiceOwnsCommand('tts-file', 'false', 'yes')).toBe(false);
    expect(rustVoiceOwnsCommand('voice', 'true')).toBe(false);
    expect(rustVoiceOwnsCommand('queue', 'true')).toBe(false);
  });

  it('keeps Node message ownership unless both explicit migration flags are set', () => {
    expect(rustVoiceOwnsAutoRead()).toBe(false);
    expect(rustVoiceOwnsAutoRead('true', 'yes')).toBe(false);
    expect(rustVoiceOwnsAutoRead('false', 'true')).toBe(false);
    expect(rustVoiceOwnsAutoRead(' TRUE ', ' true ')).toBe(true);
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
});
