// src/commands/helpers.ts — shared helpers (interface locale, ephemeral reply, invite permissions, duration formatting) extracted from index.ts (plan 015).
import {
  PermissionsBitField,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { BotDeps } from '../bot/deps';
import { getGuildConfig } from '../store/guildConfig';
import { DEFAULT_LOCALE, normalizeLocale } from '../i18n/index';
import { replyCard } from '../ui/messages';

/**
 * INTERFACE locale for an interaction. Reads `guild_config.locale` for the guild; in
 * DMs (guildId null) or if the read fails for any reason, returns DEFAULT_LOCALE
 * ('en'). NEVER throws — a failure to read the config must never break the
 * response/error the user receives (this is even called from the catch of
 * handleInteraction). Collapses the repeated `i.guildId ? ...locale : 'en'` pattern.
 */
export function localeFor(deps: BotDeps, guildId: string | null | undefined): string {
  if (!guildId) return DEFAULT_LOCALE;
  try {
    return getGuildConfig(deps.db, guildId).locale;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * INTERFACE locale for a PER-USER (ephemeral) response. Discord sends the language
 * of the CLIENT of whoever clicked in `interaction.locale` (e.g. 'pt-BR',
 * 'en-US', 'es-ES'); this way each user sees the UI in THEIR language, without
 * depending on the locale configured on the guild.
 *
 * Resolution (never throws — like localeFor):
 *   1. Normalizes `interaction.locale` to the base code: part before the '-' in
 *      lowercase ('pt-BR'->'pt', 'en-US'->'en', 'es-419'->'es', 'zh-CN'->'zh',
 *      'sv-SE'->'sv'; a code already in base form like 'fr' maps to itself). One
 *      generic rule covers ALL Discord variants — no special cases.
 *   2. If the base code is in SUPPORTED_LOCALES -> use it.
 *   3. Otherwise (a Discord language we don't yet support, or a missing locale) ->
 *      falls back to the GUILD's configured locale (localeFor), which in turn falls
 *      back to DEFAULT_LOCALE. So /config language remains the shared fallback.
 */
export function localeForUser(
  deps: BotDeps,
  interaction: { locale?: string | null; guildId?: string | null },
): string {
  const base = normalizeLocale(interaction?.locale);
  if (base) return base;
  // Unsupported / missing Discord language -> fall back to the guild (and default).
  return localeFor(deps, interaction?.guildId);
}

/**
 * Minimum permissions Vozen needs on the server it is invited to, derived from
 * the 5 named bits via PermissionsBitField (NOT a magic number):
 *  - Connect/Speak       -> join and speak in voice channels (the bot's core)
 *  - ViewChannel         -> see the channels (text and voice)
 *  - SendMessages        -> reply in the text channel
 *  - ReadMessageHistory  -> read the auto-read channel's history
 * Exported as a string (representation of the bigint) because that is what the
 * `permissions` parameter of the OAuth2 URL expects. Derived and testable: the test
 * recomputes the same integer from the bits, so dropping a bit here breaks the test.
 */
export const INVITE_PERMISSIONS: string = new PermissionsBitField([
  PermissionFlagsBits.Connect,
  PermissionFlagsBits.Speak,
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  // EmbedLinks: STILL REQUIRED after the Components V2 migration. The presentation policy
  // is split by shape, not by accident:
  //   - conversational replies (confirmations, errors, panels) -> ui/messages.ts CARDS;
  //   - rich multi-line LISTS (/stats, /help, /game list|leaderboard|stats, /voice list,
  //     /setup) stay EMBEDS — they are long, scannable and field-like.
  // Without this permission Discord does NOT render those embeds in channels where
  // @everyone lacks it. Reactions/attachments do NOT apply: the code uses neither
  // .react() nor sends files (audited).
  PermissionFlagsBits.EmbedLinks,
  // Game threads (/game): Vozen creates a disposable thread per match, writes in
  // it, and deletes it at the end. Without these, the game falls back (plays in the channel
  // itself); without ManageThreads the thread is not deleted (auto-archives). Already-invited
  // servers don't have these permissions until they re-invite — the fallback handles that.
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.ManageThreads,
]).bitfield.toString();

export async function reply(i: ChatInputCommandInteraction, content: string): Promise<void> {
  await i.reply(replyCard(content, { ephemeral: true }));
}

/**
 * Locale prefix from a Piper model name: the initial part up to and including the
 * first '_' (e.g. 'en_US-amy-medium' -> 'en_', 'pt_PT-tugao' -> 'pt_').
 * If there is no '_', returns '' (laughterFor falls back to "hahaha"). PURE.
 * It is the SAME prefix format used in LANG_TO_PREFIX / pickVoice, so that
 * laughterFor(prefix) and the voice choice speak the same language.
 */
export function localePrefixOf(model: string): string {
  const us = model.indexOf('_');
  return us === -1 ? '' : model.slice(0, us + 1);
}

/**
 * Formats a duration in seconds as "2d 3h 15m" (omits leading zero units;
 * < 1 min -> "<1m"). Universal (d/h/m letters), only the surrounding phrase is localized. PURE.
 */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  return parts.length ? parts.join(' ') : '<1m';
}
