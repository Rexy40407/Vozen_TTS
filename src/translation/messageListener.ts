import { ChannelType, PermissionFlagsBits, type Message } from 'discord.js';
import type { BotDeps } from '../bot/deps';
import { getGuildConfig } from '../store/guildConfig';
import {
  getTranslationMapping,
  getTranslationPreference,
  refundTranslationChars,
  reserveTranslationChars,
  resolveTranslationLimits,
} from '../store/translation';
import { addOperationalMetric, setProviderHealth } from '../store/operationalMetrics';
import { TranslationError } from './provider';
import { log } from '../logging/logger';
import { getChannelProfile } from '../store/channelProfiles';
import { resolveChannelPolicy } from '../policy/channelPolicy';

/** Invisible marker on our output, retained as defence-in-depth beside bot/webhook filtering. */
export const TRANSLATION_MARKER = '\u200b\u2063vozen-translation\u2063';
export const TRANSLATION_INPUT_CAP = 1_000;
const QUOTA_REACTION_COOLDOWN_MS = 5 * 60_000;
export const MAX_QUOTA_NOTICE_KEYS = 500;
export const MAX_TRANSLATION_IN_FLIGHT = 8;
const quotaNotices = new Map<string, number>();
let translationsInFlight = 0;

/** Removes every identifier-like mention before text crosses the external provider boundary. */
export function minimiseTranslationText(input: string): string {
  return (
    input
      .replace(/<@!?[^>]+>/g, '[member]')
      .replace(/<@&[^>]+>/g, '[role]')
      .replace(/<#[^>]+>/g, '[channel]')
      .replace(/@everyone|@here/gi, '[mention]')
      // Links can contain signed paths, query parameters and Discord identifiers. They are
      // not useful translation input, so remove them before any external provider sees text.
      .replace(/\bhttps?:\/\/[^\s<>()]+/gi, '[link]')
      .replace(/\bwww\.[^\s<>()]+/gi, '[link]')
      .replace(new RegExp(TRANSLATION_MARKER, 'g'), '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function canUseChannel(channel: unknown, me: unknown, requireSend: boolean): boolean {
  const candidate = channel as {
    type?: ChannelType;
    permissionsFor?: (member: unknown) => { has: (permission: bigint) => boolean } | null;
  };
  if (candidate.type !== ChannelType.GuildText) return false;
  const permissions = candidate.permissionsFor?.(me);
  if (!permissions?.has(PermissionFlagsBits.ViewChannel)) return false;
  return !requireSend || permissions.has(PermissionFlagsBits.SendMessages);
}

async function notifyQuotaOnce(message: Message): Promise<void> {
  const key = `${message.guildId}:${message.author.id}`;
  const now = Date.now();
  const prior = quotaNotices.get(key);
  if (prior !== undefined && now - prior < QUOTA_REACTION_COOLDOWN_MS) return;
  for (const [storedKey, storedAt] of quotaNotices) {
    if (now - storedAt >= QUOTA_REACTION_COOLDOWN_MS) quotaNotices.delete(storedKey);
  }
  while (quotaNotices.size >= MAX_QUOTA_NOTICE_KEYS) {
    const oldest = quotaNotices.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    quotaNotices.delete(oldest);
  }
  quotaNotices.set(key, now);
  // A single neutral reaction gives feedback without turning every rate-limited message into content.
  try {
    const channel = message.channel as { send?: (payload: unknown) => Promise<unknown> };
    if (typeof channel.send === 'function') {
      await channel.send({
        content: 'Translation limit reached; try again later.',
        allowedMentions: { parse: [] },
      });
    }
  } catch {
    // Permission failures are intentionally silent.
  }
}

/**
 * Strict, text-only translation path. It does not call TTS, queue a SynthRequest, or access voice
 * state. Therefore automatic translation cannot bypass the same-call speech invariant.
 */
export async function handleTranslationMessage(message: Message, deps: BotDeps): Promise<void> {
  if (!message.guildId || !message.guild || !message.content?.trim()) return;
  const me = deps.client.user;
  if (!me || message.author.id === me.id || message.author.bot || message.webhookId) return;
  if (message.content.includes(TRANSLATION_MARKER)) return;

  const cfg = getGuildConfig(deps.db, message.guildId);
  // The server-wide kill switch applies to every automated feature, including translation.
  if (!cfg.enabled) return;
  const policy = resolveChannelPolicy(
    cfg,
    getChannelProfile(deps.db, message.guildId, message.channelId),
  );
  if (!policy.translationEnabled) return;
  const mapping = getTranslationMapping(deps.db, message.guildId, message.channelId);
  if (!mapping) return;
  const preference = getTranslationPreference(deps.db, message.guildId, message.author.id);
  if (preference.optedOut) return;

  const source = message.guild.channels.cache.get(mapping.sourceChannelId);
  const destination = message.guild.channels.cache.get(mapping.destinationChannelId);
  if (
    !source ||
    !destination ||
    !canUseChannel(source, me, false) ||
    !canUseChannel(destination, me, true)
  ) {
    log.warn(
      `[translation] mapping ignored because channel permissions are unavailable (guild ${message.guildId})`,
    );
    return;
  }
  const target = destination as { send?: (payload: unknown) => Promise<unknown> };
  if (typeof target.send !== 'function') return;

  const plain = minimiseTranslationText(message.content);
  if (!plain) return;
  const truncated = plain.length > TRANSLATION_INPUT_CAP;
  const text = plain.slice(0, TRANSLATION_INPUT_CAP);
  const limits = resolveTranslationLimits(deps.db, message.guildId, message.author.id);
  const reservation = reserveTranslationChars(deps.db, {
    guildId: message.guildId,
    userId: message.author.id,
    chars: [...text].length,
    guildLimit: limits.guildLimit,
    userLimit: limits.userLimit,
  });
  if (!reservation.ok) {
    await notifyQuotaOnce(message);
    return;
  }

  const provider = deps.translationProvider;
  if (!provider?.enabled) {
    refundTranslationChars(deps.db, reservation, message.guildId, message.author.id);
    // No ordinary-member configuration details. Admins receive the diagnostic only through /translate.
    return;
  }
  if (translationsInFlight >= MAX_TRANSLATION_IN_FLIGHT) {
    refundTranslationChars(deps.db, reservation, message.guildId, message.author.id);
    return;
  }
  translationsInFlight++;
  try {
    const translated = await provider.translate({ text, targetLocale: mapping.targetLocale });
    await target.send({
      content: `${translated}${truncated ? '\n\n_Translation was shortened to the configured safety limit._' : ''}${TRANSLATION_MARKER}`,
      allowedMentions: { parse: [] },
    });
    addOperationalMetric(deps.db, 'translation_success', 'azure_translation');
    addOperationalMetric(deps.db, 'translation_chars', 'azure_translation', [...text].length);
    setProviderHealth(deps.db, 'azure_translation', 'healthy');
  } catch (err) {
    refundTranslationChars(deps.db, reservation, message.guildId, message.author.id);
    addOperationalMetric(deps.db, 'translation_failure', 'azure_translation');
    setProviderHealth(deps.db, 'azure_translation', 'degraded');
    const code = err instanceof TranslationError ? err.code : 'transient';
    // IDs/error class only: never the source text, translated text, request body or provider response.
    log.warn(`[translation] provider failure ${code} (guild ${message.guildId})`);
  } finally {
    translationsInFlight--;
  }
}

/** Test-only hygiene for the bounded process-local admission and feedback state. */
export function resetTranslationListenerState(): void {
  translationsInFlight = 0;
  quotaNotices.clear();
}
