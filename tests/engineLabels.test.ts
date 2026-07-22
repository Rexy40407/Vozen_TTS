import { describe, it, expect } from 'vitest';
import { engineLabel } from '../src/tts/engineLabels';
import { t } from '../src/i18n/index';
import type { UserEngine } from '../src/store/userVoice';

describe('engineLabel — one source of truth for the engine names shown to users', () => {
  it('names the real engines by their product name (not localized — they are brands)', () => {
    expect(engineLabel('piper', 'en')).toBe('Piper');
    expect(engineLabel('kokoro', 'en')).toBe('Kokoro');
    expect(engineLabel('gcloud', 'en')).toBe('Google HD');
  });

  it('labels the legacy `google` value as the operator DEFAULT, localized', () => {
    // The stored value 'google' does not mean Google TTS: it is the historical name for
    // "whatever the operator configured as the default", which is local Piper unless
    // changed (see store/userVoice.ts). Calling it "Google" in the UI is a lie.
    expect(engineLabel('google', 'en')).toBe(t('voice.config.engDefault', 'en'));
    expect(engineLabel('google', 'pt')).toBe(t('voice.config.engDefault', 'pt'));
    expect(engineLabel('google', 'en')).not.toBe('Google');
  });

  it('names the concrete runtime default when the operator configuration is known', () => {
    expect(engineLabel('google', 'pt', 'piper')).toBe('Piper');
    expect(engineLabel('google', 'pt', 'gtts')).toBe('Google (gTTS)');
    expect(engineLabel('google', 'pt', 'router')).toBe('Google (gTTS)');
    expect(engineLabel('google', 'pt', 'neural')).toBe('Neural');
  });

  it('is stable across locales for the brand names', () => {
    for (const locale of ['en', 'pt', 'fr', 'ja']) {
      expect(engineLabel('piper', locale)).toBe('Piper');
      expect(engineLabel('gcloud', locale)).toBe('Google HD');
    }
  });

  it('covers every UserEngine value (no engine can render blank)', () => {
    const all: UserEngine[] = ['google', 'piper', 'kokoro', 'gcloud'];
    for (const e of all) {
      const label = engineLabel(e, 'en');
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toBe(e); // never leaks the raw id to the user
    }
  });
});
