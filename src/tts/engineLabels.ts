// src/tts/engineLabels.ts — the ONE place that turns a stored engine id into the name a
// user reads. It existed in four hand-written copies (the /voice set confirmation, the
// /voice config panel summary, the panel's select options, and the command choices), and
// two of them had already drifted: the panel called the default "Default (local)" while
// /voice set called the same engine "Google".
//
// "Google" was not just inconsistent, it was wrong: the stored value 'google' is the
// LEGACY name for "whatever the operator configured as the default" — local Piper unless
// changed (see store/userVoice.ts) — so the old copy told people they were on Google TTS
// when they were not. The default label is therefore localized (it describes a role);
// the other three are product names and stay as-is in every language.

import type { UserEngine } from '../store/userVoice';
import type { TtsEngineKind } from '../config/index';
import { t } from '../i18n/index';

/** Brand names — identical in every locale. The default is resolved via i18n below. */
const BRAND: Partial<Record<UserEngine, string>> = {
  piper: 'Piper',
  kokoro: 'Kokoro',
  gcloud: 'Google HD',
};

/** Engines unlocked by either personal Plus or Premium on the current server. */
export function isPremiumVoiceEngine(engine: UserEngine): boolean {
  return engine === 'kokoro' || engine === 'gcloud';
}

/**
 * User-facing name of an engine, in `locale`. Total over UserEngine: an unmapped value
 * falls back to the default label rather than leaking the raw id.
 */
export function engineLabel(
  engine: UserEngine,
  locale: string,
  runtimeDefault?: TtsEngineKind,
): string {
  const brand = BRAND[engine];
  if (brand) return brand;
  // `google` is a legacy database id meaning "the operator's default", not a concrete engine.
  // When runtime config is known, name that concrete route instead of assuming it is local.
  if (runtimeDefault === 'piper') return 'Piper';
  if (runtimeDefault === 'gtts' || runtimeDefault === 'router') return 'Google (gTTS)';
  if (runtimeDefault === 'neural') return 'Neural';
  return t('voice.config.engDefault', locale);
}
