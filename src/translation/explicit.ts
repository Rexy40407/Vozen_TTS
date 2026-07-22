import type Database from 'better-sqlite3';
import {
  refundTranslationChars,
  reserveTranslationChars,
  resolveTranslationLimits,
  utcDayKey,
} from '../store/translation';
import { addOperationalMetric, setProviderHealth } from '../store/operationalMetrics';
import { minimiseTranslationText, TRANSLATION_INPUT_CAP } from './messageListener';
import type { TranslationProvider } from './provider';

export interface ExplicitTranslationInput {
  db: Database.Database;
  provider?: TranslationProvider;
  guildId: string | null;
  userId: string;
  text: string;
  targetLocale: string;
  now?: number;
}

export type ExplicitTranslationResult =
  | { ok: true; text: string; sourceChars: number }
  | { ok: false; reason: 'empty' | 'disabled' | 'quota' | 'unavailable' };

/** One explicit text request. It never posts automatically and never enters the TTS queue. */
export async function translateExplicitText(
  input: ExplicitTranslationInput,
): Promise<ExplicitTranslationResult> {
  const text = minimiseTranslationText(input.text).slice(0, TRANSLATION_INPUT_CAP);
  if (!text) return { ok: false, reason: 'empty' };
  if (!input.provider?.enabled) return { ok: false, reason: 'disabled' };
  const now = input.now ?? Date.now();
  const limits = resolveTranslationLimits(input.db, input.guildId, input.userId, now);
  // A constant, non-identifying aggregate scope keeps DM/User-App requests out of guild data.
  const quotaScope = input.guildId ?? '@user-app';
  const reservation = reserveTranslationChars(input.db, {
    guildId: quotaScope,
    userId: input.userId,
    chars: [...text].length,
    guildLimit: input.guildId ? limits.guildLimit : Number.MAX_SAFE_INTEGER,
    userLimit: limits.userLimit,
    day: utcDayKey(now),
  });
  if (!reservation.ok) return { ok: false, reason: 'quota' };
  try {
    const translated = await input.provider.translate({ text, targetLocale: input.targetLocale });
    addOperationalMetric(input.db, 'translation_success', 'azure_translation');
    addOperationalMetric(input.db, 'translation_chars', 'azure_translation', [...text].length);
    setProviderHealth(input.db, 'azure_translation', 'healthy');
    return { ok: true, text: translated, sourceChars: [...text].length };
  } catch {
    refundTranslationChars(input.db, reservation, quotaScope, input.userId);
    addOperationalMetric(input.db, 'translation_failure', 'azure_translation');
    setProviderHealth(input.db, 'azure_translation', 'degraded');
    return { ok: false, reason: 'unavailable' };
  }
}

/**
 * Opt-in pre-speech translation. A provider outage or exhausted quota must never turn a normal
 * TTS message into a silent failure, so this wrapper deliberately falls back to the original.
 */
export async function translateTextForSpeech(
  input: ExplicitTranslationInput,
): Promise<{ text: string; translated: boolean }> {
  const result = await translateExplicitText(input);
  return result.ok
    ? { text: result.text, translated: true }
    : { text: input.text, translated: false };
}
