import {
  ChannelType,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type GuildMember,
} from 'discord.js';
import type { BotDeps } from '../../bot/deps';
import { getGuildConfig, setGuildConfig } from '../../store/guildConfig';
import {
  addTranslationMapping,
  clearTranslationConfig,
  listTranslationMappings,
  getTranslationPreference,
  removeTranslationMapping,
  resolveTranslationLimits,
  setTranslationPreference,
} from '../../store/translation';
import { SUPPORTED_LOCALES } from '../../i18n/index';
import { reply } from '../helpers';
import { translateExplicitText } from '../../translation/explicit';

function isManager(i: ChatInputCommandInteraction): boolean {
  return (
    (i.member as GuildMember | null)?.permissions?.has(PermissionFlagsBits.ManageGuild) ?? false
  );
}

function validLocale(locale: string): boolean {
  return SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number]);
}

export function canMapChannel(channel: unknown, me: unknown, needsSend: boolean): boolean {
  const value = channel as {
    type?: ChannelType;
    permissionsFor?: (member: unknown) => { has: (bit: bigint) => boolean } | null;
  };
  if (value.type !== ChannelType.GuildText) return false;
  const permissions = value.permissionsFor?.(me);
  return (
    !!permissions?.has(PermissionFlagsBits.ViewChannel) &&
    (!needsSend || permissions.has(PermissionFlagsBits.SendMessages))
  );
}

async function requireManager(i: ChatInputCommandInteraction): Promise<boolean> {
  if (isManager(i)) return true;
  await reply(i, 'You need Manage Server to configure translation.');
  return false;
}

/** `/translate` is intentionally separate from voice config: text translation never enters TTS. */
export async function handleTranslate(
  i: ChatInputCommandInteraction,
  deps: BotDeps,
): Promise<void> {
  const sub = i.options.getSubcommand();
  const preferenceScope = i.guildId ?? '@user-app';
  if (sub === 'language') {
    const locale = i.options.getString('locale', true);
    if (!validLocale(locale)) {
      await reply(i, 'That locale is not supported.');
      return;
    }
    const current = getTranslationPreference(deps.db, preferenceScope, i.user.id);
    setTranslationPreference(deps.db, { ...current, locale });
    await reply(i, `Your default translation language is now **${locale}**.`);
    return;
  }
  if (sub === 'text') {
    const raw = i.options.getString('text', true);
    const preferred = getTranslationPreference(deps.db, preferenceScope, i.user.id).locale;
    const locale = i.options.getString('locale') ?? preferred ?? i.locale.split('-', 1)[0] ?? 'en';
    if (!validLocale(locale)) {
      await reply(i, 'That locale is not supported.');
      return;
    }
    const result = await translateExplicitText({
      db: deps.db,
      provider: deps.translationProvider,
      guildId: i.guildId,
      userId: i.user.id,
      text: raw,
      targetLocale: locale,
    });
    const response = result.ok
      ? `**Translation · ${locale}**\n${result.text.slice(0, 1_800)}`
      : result.reason === 'quota'
        ? 'Your rolling 30-day translation limit has been reached.'
        : result.reason === 'disabled'
          ? 'Translation is temporarily unavailable because no provider is configured.'
          : result.reason === 'empty'
            ? 'Provide readable text to translate.'
            : 'Translation is temporarily unavailable.';
    await reply(i, response);
    return;
  }
  if (!i.guildId) {
    await reply(i, 'This translation setting is available only in a server.');
    return;
  }
  if (sub === 'speak-language') {
    const locale = i.options.getString('locale', true).toLowerCase();
    if (locale !== 'off' && !validLocale(locale)) {
      await reply(i, 'That locale is not supported. Use `off` to disable this preference.');
      return;
    }
    const current = getTranslationPreference(deps.db, i.guildId, i.user.id);
    setTranslationPreference(deps.db, {
      ...current,
      speakLocale: locale === 'off' ? null : locale,
    });
    await reply(
      i,
      locale === 'off'
        ? 'Translate-before-speaking is now off.'
        : `Vozen will translate your readable messages to **${locale}** before speaking. If translation is unavailable, it safely reads the original text.`,
    );
    return;
  }
  if (sub === 'opt-out') {
    const optedOut = i.options.getBoolean('active', true);
    setTranslationPreference(deps.db, { guildId: i.guildId, userId: i.user.id, optedOut });
    await reply(
      i,
      optedOut
        ? 'You are opted out of automatic translations in this server.'
        : 'You are opted back in to configured automatic translations in this server.',
    );
    return;
  }
  if (!(await requireManager(i))) return;
  if (sub === 'status') {
    const cfg = getGuildConfig(deps.db, i.guildId);
    const mappings = listTranslationMappings(deps.db, i.guildId);
    const provider = deps.translationProvider;
    const limits = resolveTranslationLimits(deps.db, i.guildId, i.user.id);
    await reply(
      i,
      [
        `Translation: **${cfg.translationEnabled ? 'on' : 'off'}**`,
        `Provider: ${provider?.enabled ? provider.kind : 'not configured (disabled)'}`,
        `Mappings: ${mappings.length}`,
        `Rolling 30-day cap: ${limits.guildLimit.toLocaleString('en-US')} characters (you: ${limits.userLimit.toLocaleString('en-US')})`,
      ].join('\n'),
    );
    return;
  }
  if (sub === 'enable') {
    if (!deps.translationProvider?.enabled) {
      await reply(
        i,
        'Translation is disabled because the operator has not configured a provider. No messages will be sent externally.',
      );
      return;
    }
    if (listTranslationMappings(deps.db, i.guildId).length === 0) {
      await reply(i, 'Add a valid source-to-destination mapping before enabling translation.');
      return;
    }
    setGuildConfig(deps.db, i.guildId, { translationEnabled: true });
    await reply(
      i,
      'Translation enabled for the configured channels. It never speaks translated text.',
    );
    return;
  }
  if (sub === 'disable') {
    setGuildConfig(deps.db, i.guildId, { translationEnabled: false });
    await reply(i, 'Translation disabled. Existing mappings remain saved until removed.');
    return;
  }
  if (sub === 'clear') {
    clearTranslationConfig(deps.db, i.guildId);
    setGuildConfig(deps.db, i.guildId, { translationEnabled: false });
    await reply(
      i,
      'Translation mappings and member opt-outs were deleted; translation remains disabled.',
    );
    return;
  }
  if (sub === 'map-list') {
    const mappings = listTranslationMappings(deps.db, i.guildId);
    await reply(
      i,
      mappings.length
        ? mappings
            .map(
              (m) => `<#${m.sourceChannelId}> -> <#${m.destinationChannelId}> (${m.targetLocale})`,
            )
            .join('\n')
        : 'No translation mappings are configured.',
    );
    return;
  }
  if (sub === 'map-remove') {
    const source = i.options.getChannel('source', true);
    const removed = removeTranslationMapping(deps.db, i.guildId, source.id);
    await reply(
      i,
      removed
        ? 'Translation mapping removed.'
        : 'No translation mapping exists for that source channel.',
    );
    return;
  }
  if (sub === 'map-add') {
    const sourceOption = i.options.getChannel('source', true);
    const destinationOption = i.options.getChannel('destination', true);
    const source = i.guild?.channels.cache.get(sourceOption.id) ?? sourceOption;
    const destination = i.guild?.channels.cache.get(destinationOption.id) ?? destinationOption;
    const locale = i.options.getString('locale', true);
    if (!validLocale(locale)) {
      await reply(i, 'That locale is not supported.');
      return;
    }
    if (
      source.id === destination.id ||
      !canMapChannel(source, deps.client.user, false) ||
      !canMapChannel(destination, deps.client.user, true)
    ) {
      await reply(
        i,
        'Both channels must be distinct text channels that Vozen can view; it must also be able to send in the destination.',
      );
      return;
    }
    try {
      addTranslationMapping(deps.db, {
        guildId: i.guildId,
        sourceChannelId: source.id,
        destinationChannelId: destination.id,
        targetLocale: locale,
      });
      await reply(i, `Mapping saved: <#${source.id}> -> <#${destination.id}> (${locale}).`);
    } catch {
      await reply(i, 'That mapping would create a translation loop and was rejected.');
    }
    return;
  }
  if (sub === 'preview') {
    const text = i.options.getString('text', true);
    const locale = i.options.getString('locale', true);
    if (!validLocale(locale)) {
      await reply(i, 'Provide readable text and a supported target locale.');
      return;
    }
    const result = await translateExplicitText({
      db: deps.db,
      provider: deps.translationProvider,
      guildId: i.guildId,
      userId: i.user.id,
      text,
      targetLocale: locale,
    });
    await reply(
      i,
      result.ok
        ? `Preview (${locale}):\n${result.text.slice(0, 1_800)}`
        : result.reason === 'quota'
          ? 'The rolling 30-day translation limit has been reached.'
          : result.reason === 'empty'
            ? 'Provide readable text and a supported target locale.'
            : result.reason === 'disabled'
              ? 'Translation is currently disabled.'
              : 'Translation is temporarily unavailable.',
    );
    return;
  }
  // Defensive no-op for a malformed interaction/version mismatch.
  await reply(i, 'Unknown translation action.');
}
