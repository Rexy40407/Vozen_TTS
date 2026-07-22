// src/commands/handlers/config.ts — /config, /setup and /stats (admin) handlers extracted from index.ts (plan 015).
import {
  ChatInputCommandInteraction,
  GuildMember,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
} from 'discord.js';
import type { BotDeps } from '../../bot/deps';
import { metrics } from '../../metrics';
import { brandEmbed } from '../../ui/theme';
import { getGuildConfig, setGuildConfig, resetGuildConfig } from '../../store/guildConfig';
import { addBlockword, removeBlockword, getBlocklist, MAX_BLOCKWORDS } from '../../store/blocklist';
import { makeLocalizedNamer } from '../../language/voiceMap';
import { GREET_LANGUAGE_CHOICES, GREET_LOCALES } from '../../voice/greeting';
import { t, SUPPORTED_LOCALES, LOCALE_DISPLAY_NAMES, type SupportedLocale } from '../../i18n/index';
import { localeForUser, reply } from '../helpers';
import { joinUserVoice } from './core';
import { clearTranslationConfig } from '../../store/translation';

export async function handleConfig(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  const locale = localeForUser(deps, i);
  const member = i.member as GuildMember;
  if (!member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
    await reply(i, t('error.needManageGuild', locale));
    return;
  }
  const group = i.options.getSubcommandGroup(false);
  if (group === 'block-word') {
    const sub = i.options.getSubcommand();
    const word = i.options.getString('word', true).trim();
    if (!word) {
      await reply(i, t('config.wordEmpty', locale));
      return;
    }
    if (sub === 'add') {
      if (addBlockword(deps.db, i.guildId!, word) === 'limit') {
        await reply(i, t('config.blockLimit', locale, { max: MAX_BLOCKWORDS }));
        return;
      }
      await reply(i, t('config.blocked', locale, { word }));
    } else {
      removeBlockword(deps.db, i.guildId!, word);
      await reply(i, t('config.unblocked', locale, { word }));
    }
    return;
  }
  // The old `/config pronunciation` group was replaced by the dedicated admin command
  // `/server-pronunciation`; personal entries use `/pronunciation` (handlers/personal.ts).
  const sub = i.options.getSubcommand();
  if (sub === 'tts-channel') {
    const ch = i.options.getChannel('channel', true);
    if (ch.type !== ChannelType.GuildText) {
      await reply(i, t('config.channelWrongType', locale));
      return;
    }
    const me = deps.client.user;
    // ch may be a partial object (APIChannel) — use guild.channels.cache to get the full channel
    const fullCh = i.guild?.channels.cache.get(ch.id);
    const perms = me && fullCh ? fullCh.permissionsFor(me) : null;
    if (!perms || !perms.has(PermissionFlagsBits.ViewChannel)) {
      await reply(i, t('config.channelNoAccess', locale, { channel: `<#${ch.id}>` }));
      return;
    }
    setGuildConfig(deps.db, i.guildId!, { ttsChannelId: ch.id });
    await reply(i, t('config.channelSet', locale, { channel: `<#${ch.id}>` }));
  } else if (sub === 'auto-read') {
    const on = i.options.getBoolean('active', true);
    setGuildConfig(deps.db, i.guildId!, { autoread: on });
    await reply(i, on ? t('config.autoreadOn', locale) : t('config.autoreadOff', locale));
  } else if (sub === 'max-chars') {
    const v = i.options.getInteger('value', true);
    if (v < 1 || v > 2000) {
      await reply(i, t('config.maxCharsRange', locale));
      return;
    }
    setGuildConfig(deps.db, i.guildId!, { maxChars: v });
    await reply(i, t('config.maxCharsSet', locale, { value: v }));
  } else if (sub === 'rate-limit') {
    const v = i.options.getInteger('value', true);
    if (v < 1 || v > 120) {
      await reply(i, t('config.rateLimitRange', locale));
      return;
    }
    setGuildConfig(deps.db, i.guildId!, { ratePerMin: v });
    await reply(i, t('config.rateLimitSet', locale, { value: v }));
  } else if (sub === 'role') {
    // The role option is optional: omitting it (getRole returns null) clears the restriction.
    const role = i.options.getRole('role', false);
    if (role) {
      setGuildConfig(deps.db, i.guildId!, { ttsRoleId: role.id });
      await reply(i, t('config.roleSet', locale, { role: `<@&${role.id}>` }));
    } else {
      setGuildConfig(deps.db, i.guildId!, { ttsRoleId: null });
      await reply(i, t('config.roleCleared', locale));
    }
  } else if (sub === 'priority-role' || sub === 'blocked-role') {
    const role = i.options.getRole('role', false);
    const cfg = getGuildConfig(deps.db, i.guildId!);
    const isPriority = sub === 'priority-role';
    const other = isPriority ? cfg.blockedRoleId : cfg.priorityRoleId;
    if (role && role.id === other) {
      await reply(i, 'Choose a different role: a role cannot be both priority and blocked.');
      return;
    }
    if (isPriority) {
      setGuildConfig(deps.db, i.guildId!, { priorityRoleId: role?.id ?? null });
      await reply(
        i,
        role
          ? `Accessibility queue priority set to <@&${role.id}>.`
          : 'Accessibility queue priority role cleared.',
      );
    } else {
      setGuildConfig(deps.db, i.guildId!, { blockedRoleId: role?.id ?? null });
      await reply(i, role ? `Queue block set to <@&${role.id}>.` : 'Queue block role cleared.');
    }
  } else if (sub === 'enabled') {
    // Server kill-switch: the messageHandler already ignores everything when enabled=false.
    const on = i.options.getBoolean('active', true);
    setGuildConfig(deps.db, i.guildId!, { enabled: on });
    await reply(i, on ? t('config.enabledOn', locale) : t('config.enabledOff', locale));
  } else if (sub === 'x-said') {
    // "{name} said" announcement before each message (who spoke). ON by default.
    const on = i.options.getBoolean('active', true);
    setGuildConfig(deps.db, i.guildId!, { xsaid: on });
    await reply(i, on ? t('config.xsaidOn', locale) : t('config.xsaidOff', locale));
  } else if (sub === 'auto-join') {
    // The bot joins the author's call on its own when a message arrives. OFF by default.
    const on = i.options.getBoolean('active', true);
    setGuildConfig(deps.db, i.guildId!, { autojoin: on });
    await reply(i, on ? t('config.autojoinOn', locale) : t('config.autojoinOff', locale));
  } else if (sub === 'always-on') {
    // 24/7 in-call: the bot stays in the channel even when empty + is restored on startup. OFF by
    // default (opt-in). It only takes EFFECT with Premium (the gate in AloneWatcher/rejoin requires it);
    // storing the toggle is free — the ON message warns that it needs Premium.
    const on = i.options.getBoolean('active', true);
    setGuildConfig(deps.db, i.guildId!, { stayInCall: on });
    await reply(i, on ? t('config.stayOn', locale) : t('config.stayOff', locale));
  } else if (sub === 'read-bots') {
    // Read other bots/webhooks. OFF by default (Vozen never reads itself).
    const on = i.options.getBoolean('active', true);
    setGuildConfig(deps.db, i.guildId!, { readBots: on });
    await reply(i, on ? t('config.readBotsOn', locale) : t('config.readBotsOff', locale));
  } else if (sub === 'text-in-voice') {
    // Read the text chat inside the voice channel where Vozen is. OFF by default.
    const on = i.options.getBoolean('active', true);
    setGuildConfig(deps.db, i.guildId!, { textInVoice: on });
    await reply(i, on ? t('config.textInVoiceOn', locale) : t('config.textInVoiceOff', locale));
  } else if (sub === 'anti-spam') {
    // Do not read spammed messages (massive repetition / same large msg repeated).
    // OFF by default (opt-in).
    const on = i.options.getBoolean('active', true);
    setGuildConfig(deps.db, i.guildId!, { antispam: on });
    await reply(i, on ? t('config.antispamOn', locale) : t('config.antispamOff', locale));
  } else if (sub === 'streaks') {
    // Streak 🔥 notice on each person's 1st message of the day. ON by default.
    const on = i.options.getBoolean('active', true);
    setGuildConfig(deps.db, i.guildId!, { streakAnnounce: on });
    await reply(i, on ? t('config.streaksOn', locale) : t('config.streaksOff', locale));
  } else if (sub === 'soundboard') {
    // Per-server kill-switch for /sound (sound clips in the call). ON by default.
    const on = i.options.getBoolean('active', true);
    setGuildConfig(deps.db, i.guildId!, { soundboard: on });
    await reply(i, on ? t('config.soundboardOn', locale) : t('config.soundboardOff', locale));
  } else if (sub === 'vote-reminders') {
    // Alternating Top.gg/support notices in the configured TTS channel. Default OFF;
    // only a Manage Server admin can opt the guild in or back out.
    const on = i.options.getBoolean('active', true);
    setGuildConfig(deps.db, i.guildId!, { votePromos: on });
    await reply(
      i,
      `${t('config.votePromosLabel', locale)}: **${on ? t('config.on', locale) : t('config.off', locale)}**`,
    );
  } else if (sub === 'greet') {
    // Voice greeting for whoever joins the call. ON by default.
    const on = i.options.getBoolean('active', true);
    setGuildConfig(deps.db, i.guildId!, { greetOnJoin: on });
    await reply(i, on ? t('config.greetOn', locale) : t('config.greetOff', locale));
  } else if (sub === 'greet-language') {
    // Greeting language (static choices -> already validated by Discord; we revalidate
    // defensively against the set of supported greetings).
    const lang = i.options.getString('language', true);
    if (!GREET_LOCALES.has(lang)) {
      await reply(i, t('config.language.unsupported', locale));
      return;
    }
    setGuildConfig(deps.db, i.guildId!, { greetLocale: lang });
    const label = GREET_LANGUAGE_CHOICES.find((c) => c.value === lang)?.name ?? lang;
    await reply(i, t('config.greetLangSet', locale, { language: label }));
  } else if (sub === 'default-voice') {
    // Validate against the available models, just like /voice set.
    const model = i.options.getString('model', true);
    if (!deps.availableModels.includes(model)) {
      await reply(i, t('voice.unknownModel', locale));
      return;
    }
    setGuildConfig(deps.db, i.guildId!, { defaultVoice: model });
    // Beginner-friendly copy: leads with the friendly name (voiceDisplayName) and keeps
    // the raw id copy-pasteable. Behavior unchanged (presentation params only).
    await reply(
      i,
      t('config.defaultVoiceSet', locale, {
        name: makeLocalizedNamer(i.locale, deps.availableModels)(model),
        model,
      }),
    );
  } else if (sub === 'language') {
    // Switch the INTERFACE language. The choices already limit to SUPPORTED_LOCALES, but
    // we validate again (defensive) — includes() needs the cast because the array is
    // `readonly ['en','pt']` and the input is string. Invalid locale -> friendly error
    // in the CURRENT locale (the request is not usable); nothing is persisted.
    const requested = i.options.getString('locale', true);
    if (!SUPPORTED_LOCALES.includes(requested as SupportedLocale)) {
      await reply(i, t('config.language.unsupported', locale));
      return;
    }
    const chosen = requested as SupportedLocale;
    setGuildConfig(deps.db, i.guildId!, { locale: chosen });
    // Confirmation ALREADY in the NEW language (uses `chosen`, not `locale`): the admin sees
    // right away that the change took effect. {language} = readable name of the chosen language.
    await reply(i, t('config.language.set', chosen, { language: LOCALE_DISPLAY_NAMES[chosen] }));
  } else if (sub === 'show') {
    const cfg = getGuildConfig(deps.db, i.guildId!);
    const blocklistCount = getBlocklist(deps.db, i.guildId!).length;
    const on = t('config.on', locale);
    const off = t('config.off', locale);
    const channelStr = cfg.ttsChannelId ? `<#${cfg.ttsChannelId}>` : t('config.valueNone', locale);
    const roleStr = cfg.ttsRoleId ? `<@&${cfg.ttsRoleId}>` : t('config.valueAny', locale);
    const priorityRoleStr = cfg.priorityRoleId
      ? `<@&${cfg.priorityRoleId}>`
      : t('config.valueNone', locale);
    const blockedRoleStr = cfg.blockedRoleId
      ? `<@&${cfg.blockedRoleId}>`
      : t('config.valueNone', locale);
    const voiceStr = cfg.defaultVoice || t('config.valueAutoDetect', locale);
    const lines = [
      t('config.showTitle', locale),
      t('config.showChannel', locale, { value: channelStr }),
      t('config.showAutoread', locale, { value: cfg.autoread ? on : off }),
      t('config.showRole', locale, { value: roleStr }),
      `Queue priority role: ${priorityRoleStr}`,
      `Queue blocked role: ${blockedRoleStr}`,
      t('config.showEnabled', locale, { value: cfg.enabled ? on : off }),
      t('config.showXsaid', locale, { value: cfg.xsaid ? on : off }),
      t('config.showAutojoin', locale, { value: cfg.autojoin ? on : off }),
      t('config.showReadBots', locale, { value: cfg.readBots ? on : off }),
      t('config.showTextInVoice', locale, { value: cfg.textInVoice ? on : off }),
      t('config.showAntispam', locale, { value: cfg.antispam ? on : off }),
      t('config.showSoundboard', locale, { value: cfg.soundboard ? on : off }),
      `${t('config.votePromosLabel', locale)}: ${cfg.votePromos ? on : off}`,
      t('config.showGreet', locale, {
        value: cfg.greetOnJoin ? on : off,
        language:
          GREET_LANGUAGE_CHOICES.find((c) => c.value === cfg.greetLocale)?.name ?? cfg.greetLocale,
      }),
      t('config.showVoice', locale, { value: voiceStr }),
      t('config.showMaxChars', locale, { value: cfg.maxChars }),
      t('config.showRateLimit', locale, { value: cfg.ratePerMin }),
      t('config.showBlocklist', locale, { count: blocklistCount }),
    ];
    await reply(i, lines.join('\n'));
  } else if (sub === 'reset') {
    resetGuildConfig(deps.db, i.guildId!);
    // Mapping/preference tables are outside guild_config, so reset must remove the old scope too.
    clearTranslationConfig(deps.db, i.guildId!);
    await reply(i, t('config.reset', locale));
  }
}

// State of each permissions-checklist item:
//  - 'ok'         -> the bot has the permission
//  - 'missing'    -> the bot does NOT have the permission (needs to be fixed)
//  - 'unchecked'  -> could not be checked now (e.g. voice perms when
//                    the invoker is not in a voice channel) — will be validated on /join
type PermState = 'ok' | 'missing' | 'unchecked';

function permLine(label: string, state: PermState, locale: string): string {
  if (state === 'ok') return t('setup.permOk', locale, { label });
  if (state === 'missing') return t('setup.permMissing', locale, { label });
  return t('setup.permUnchecked', locale, { label });
}

/**
 * /setup — guided wizard for admins. Reduces the friction of "settings not
 * beginner-friendly": configures the auto-read channel + turns on autoread in a single
 * step and returns a clear checklist of the bot's permissions.
 *
 * Design decisions (the contract is silent on some points):
 *  - Only an *invalid channel type* (non-text) BLOCKS the save. Missing perms
 *    (text OR voice) do NOT block: we save channel+autoread anyway and
 *    warn in the checklist. The goal is to get the admin out of the "I tried everything" state.
 *  - A missing ViewChannel is treated like the rest: it appears in the checklist as
 *    "missing" but the config is saved anyway (consistent with the voice policy).
 *  - Channel resolution: the `channel` option may arrive as a partial APIChannel
 *    (id only), just like in /config tts-channel — we resolve via guild.channels.cache.
 *    The interaction channel (i.channel) already comes full; the `?? ref` fallback
 *    ensures that path works even without a cache hit.
 */
export async function handleSetup(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  const locale = localeForUser(deps, i);
  const member = i.member as GuildMember;
  if (!member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
    await reply(i, t('error.needManageGuild', locale));
    return;
  }

  // (a) Resolve the target channel: `channel` option or, if omitted, the interaction channel.
  const ref =
    (i.options.getChannel('channel', false) as { id: string; type?: number } | null) ?? i.channel;
  if (!ref || !('id' in ref)) {
    await reply(i, t('setup.noChannel', locale));
    return;
  }
  // Resolve the full channel (with permissionsFor) from the cache; the interaction
  // channel is already full, so the `?? ref` fallback covers that case.
  const fullCh = (i.guild?.channels.cache.get(ref.id) ?? ref) as {
    id: string;
    type?: number;
    permissionsFor?: (u: unknown) => { has: (flag: bigint) => boolean } | null;
  };

  if (fullCh.type !== ChannelType.GuildText) {
    await reply(i, t('setup.channelWrongType', locale));
    return;
  }

  const me = deps.client.user;
  const textPerms = me && fullCh.permissionsFor ? fullCh.permissionsFor(me) : null;
  // The text channel needs ViewChannel AND SendMessages (contract 3a). Each one
  // has its own checklist line, with its own independent state — so the
  // admin sees exactly which one is missing (before, we merged the two and showed "❌
  // ViewChannel" even when only SendMessages was missing, which was misleading).
  const canView = textPerms?.has(PermissionFlagsBits.ViewChannel) ?? false;
  const canSend = textPerms?.has(PermissionFlagsBits.SendMessages) ?? false;
  const viewState: PermState = canView ? 'ok' : 'missing';
  const sendState: PermState = canSend ? 'ok' : 'missing';

  // (b) Voice perms: can only be checked if the invoker is in a voice channel.
  const voiceCh = member?.voice?.channel as
    | { name?: string; permissionsFor?: (u: unknown) => { has: (flag: bigint) => boolean } | null }
    | null
    | undefined;
  let connectState: PermState = 'unchecked';
  let speakState: PermState = 'unchecked';
  if (voiceCh) {
    const vp = me && voiceCh.permissionsFor ? voiceCh.permissionsFor(me) : null;
    connectState = vp?.has(PermissionFlagsBits.Connect) ? 'ok' : 'missing';
    speakState = vp?.has(PermissionFlagsBits.Speak) ? 'ok' : 'missing';
  }

  // (c) Configure in a single step — ALWAYS, even if perms are missing (we only warn).
  setGuildConfig(deps.db, i.guildId!, { ttsChannelId: fullCh.id, autoread: true });

  // (c2) 1-step onboarding: if the invoker is in a voice channel AND the bot has
  // Connect+Speak there (connectState/speakState === 'ok'), we join the voice NOW
  // reusing the SAME logic as /join (shared helper joinUserVoice) — the
  // beginner is ready without having to run /join afterwards. If perms are missing
  // or they are not in voice, we do NOT try to join (the checklist already warns) — the
  // reconciliation is: /join = simple "enter voice"; /setup = guided onboarding (config
  // + joining when possible). joinUserVoice does NOT reply to the interaction; we fold the
  // result into a checklist line to keep a SINGLE reply.
  let joinedChannelName: string | null = null;
  if (connectState === 'ok' && speakState === 'ok') {
    const outcome = joinUserVoice(i, deps);
    if (outcome.status === 'joined') {
      joinedChannelName = outcome.channelName;
    }
  }

  const testVoiceRequested = i.options.getBoolean('test-voice') ?? false;
  let voiceTestQueued = false;
  if (testVoiceRequested && joinedChannelName !== null) {
    const player = deps.players.get(i.guildId!);
    const model = deps.availableModels[0] ?? deps.config.defaultVoice ?? 'en_US-amy-medium';
    voiceTestQueued =
      (await player?.say(
        {
          text: 'Vozen is ready.',
          model,
          speed: deps.config.defaultSpeed ?? 1,
          engine: 'piper',
          singleVoice: true,
        },
        { source: 'system', lane: 'accessibility' },
      )) ?? false;
  }

  // (d) Beginner-friendly summary.
  const lines: string[] = [
    t('setup.done', locale),
    t('setup.channelLine', locale, { channel: `<#${fullCh.id}>` }),
    t('setup.autoreadOn', locale),
    '',
    t('setup.permsHeader', locale),
    permLine(t('setup.permView', locale), viewState, locale),
    permLine(t('setup.permSend', locale), sendState, locale),
    permLine(t('setup.permConnect', locale), connectState, locale),
    permLine(t('setup.permSpeak', locale), speakState, locale),
  ];

  if (joinedChannelName !== null) {
    lines.push('', t('setup.joinedVoice', locale, { channel: joinedChannelName }));
  }
  if (voiceTestQueued) lines.push('🔊 Voice test queued with the local Piper engine.');

  const anyMissing = [viewState, sendState, connectState, speakState].includes('missing');
  if (anyMissing) {
    lines.push('', t('setup.fixHint', locale));
  }
  if (connectState === 'unchecked' || speakState === 'unchecked') {
    lines.push('', t('setup.voiceUncheckedNote', locale));
  }
  // Already joined to voice -> next step is just to type; otherwise (not in voice but
  // everything else ok) we keep the hint to run /join.
  if (!anyMissing && connectState === 'ok' && speakState === 'ok') {
    lines.push(
      '',
      joinedChannelName !== null ? t('setup.readyTalk', locale) : t('setup.allGood', locale),
    );
  }

  // Guide for MEMBERS: the admin just configured the server, but MEMBERS
  // need to know the next step. We ALWAYS close /setup with the 3-step
  // flow (join voice -> /join -> type) for the admin to share. Short and
  // pointing to /help (the full reference) — it does not duplicate it.
  lines.push('', t('setup.membersHeader', locale), t('setup.membersBody', locale));

  // Card: green when everything is OK, yellow when some permission is missing.
  const embed = brandEmbed(anyMissing ? 'warning' : 'success').setDescription(lines.join('\n'));
  await i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

export async function handleStats(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  const locale = localeForUser(deps, i);
  const member = i.member as GuildMember;
  if (!member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
    await reply(i, t('error.needManageGuild', locale));
    return;
  }
  const snap = metrics.snapshot();
  const uptimeSec = Math.floor(process.uptime());
  const lines = [
    t('stats.title', locale),
    t('stats.messagesSpoken', locale, { value: snap.messagesSpoken }),
    t('stats.cacheHits', locale, { value: snap.cacheHits }),
    t('stats.cacheMisses', locale, { value: snap.cacheMisses }),
    t('stats.synthErrors', locale, { value: snap.synthErrors }),
    t('stats.synthLatency', locale, {
      p50: snap.synthP50Ms,
      p95: snap.synthP95Ms,
      count: snap.synthCount,
    }),
    t('stats.voiceDrops', locale, { value: snap.voiceDrops }),
    t('stats.voiceReconnects', locale, { value: snap.voiceReconnects }),
    t('stats.votes', locale, { value: snap.votes }),
    t('stats.activePlayers', locale, { value: deps.players.size }),
    t('stats.servers', locale, { value: deps.client.guilds.cache.size }),
    t('stats.uptime', locale, { value: uptimeSec }),
  ];
  await i.reply({
    embeds: [brandEmbed().setDescription(lines.join('\n'))],
    flags: MessageFlags.Ephemeral,
  });
}
