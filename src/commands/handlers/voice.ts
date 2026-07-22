// src/commands/handlers/voice.ts — /voice handler (set/list/reset/optout/optin/preview/detection/nickname/effect/config) extracted from index.ts (plan 015).
import {
  ChatInputCommandInteraction,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type MessageComponentInteraction,
} from 'discord.js';
import type { BotDeps } from '../../bot/deps';
import { getPlayer, getLimiter } from '../../bot/deps';
import { brandEmbed } from '../../ui/theme';
import { editCard, replyCard, updateCard } from '../../ui/messages';
import { getUserVoice, setUserVoice, resetUserVoice, type UserEngine } from '../../store/userVoice';
import {
  seedPanelState,
  localesOf,
  voicesForLocale,
  needsVoiceRow,
  paginateLocales,
  validateSave,
  SPEED_PRESETS,
} from '../voiceConfigPanel';
import { getGuildConfig } from '../../store/guildConfig';
import { admitUserSpeech } from '../../voice/admission';
import { setOptOut, setOptIn } from '../../store/optout';
import { setDetection } from '../../store/langDetect';
import { setNickname, clearNickname } from '../../store/nickname';
import { isGuildPremium, isUserPremium } from '../../store/premium';
import { setVoiceEffect } from '../../store/voiceEffect';
import { isVoiceEffect, isPremiumEffect, effectLabel, type VoiceEffect } from '../../tts/effects';
import { engineLabel, isPremiumVoiceEngine } from '../../tts/engineLabels';
import {
  addVoiceFavorite,
  listRecentVoices,
  listVoiceFavorites,
  recordRecentVoice,
  removeVoiceFavorite,
} from '../../store/voiceLibrary';
import { sanitizeSpeakerName } from '../../language/speakerName';
import { formatVoiceList, makeLocalizedNamer } from '../../language/voiceMap';
import type { SynthRequest } from '../../tts/engine';
import { resolveUserEngine } from '../../tts/resolveEngine';
import { t } from '../../i18n/index';
import { localeForUser, reply } from '../helpers';
import { filterVoiceCatalog, paginateVoiceCatalog, type VoiceCatalogEngine } from '../voiceBrowse';

/**
 * /voice config — interactive panel (dropdowns + Save) so the whole voice setup is done
 * with clicks and NOTHING is saved until the user presses Save. This removes the
 * accidental-Enter-mid-configuration problem of a slash command with options. All the
 * testable decisions (state seeding, language pagination, per-locale voices, presets,
 * Save validation) live in the pure `voiceConfigPanel` module; this handler is only the
 * discord.js glue and is verified live in Discord.
 */
async function handleVoiceConfig(
  i: ChatInputCommandInteraction,
  deps: BotDeps,
  locale: string,
): Promise<void> {
  const models = deps.availableModels;
  if (!models.length) {
    await reply(i, t('voice.listEmpty', locale));
    return;
  }
  const localeOf = (m: string): string => {
    const d = m.indexOf('-');
    return d === -1 ? m : m.slice(0, d);
  };
  const cfg = getGuildConfig(deps.db, i.guildId!);
  const defaultModel =
    cfg.defaultVoice || deps.config.defaultVoice || models[0] || 'en_US-amy-medium';
  const state = seedPanelState(getUserVoice(deps.db, i.guildId!, i.user.id), {
    model: models.includes(defaultModel) ? defaultModel : models[0]!,
    speed: deps.config.defaultSpeed,
  });
  // Guard: a saved model that is no longer installed would leave the language select
  // with no matching default — fall back to the first available voice.
  if (!models.includes(state.model)) state.model = models[0]!;

  const langNamer = makeLocalizedNamer(i.locale, models, { voice: false });
  const fullNamer = makeLocalizedNamer(i.locale, models);
  const engineName = (e: UserEngine): string => engineLabel(e, locale, deps.config.ttsEngine);

  const locales = localesOf(models);
  const clip = (s: string): string => (s.length > 100 ? s.slice(0, 99) + '…' : s);

  function render(): {
    content: string;
    rows: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[];
  } {
    const curLocale = localeOf(state.model);
    const page = paginateLocales(locales, state.langPage);
    // Row 1 — language (24 langs + "More" sentinel when there are more pages).
    const langOptions = page.slice.map((loc) => ({
      label: clip(langNamer(voicesForLocale(models, loc)[0] ?? loc)),
      value: loc,
      default: loc === curLocale,
    }));
    if (page.hasMore)
      langOptions.push({
        label: t('voice.config.more', locale),
        value: '__more__',
        default: false,
      });
    const rows: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`vcfg:lang:${i.id}`)
          .setPlaceholder(t('voice.config.pickLanguage', locale))
          .addOptions(langOptions),
      ),
    ];
    // Row 2 — voice, ONLY when this language has more than one installed voice.
    if (needsVoiceRow(models, curLocale)) {
      rows.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`vcfg:voice:${i.id}`)
            .setPlaceholder(t('voice.config.pickVoice', locale))
            .addOptions(
              voicesForLocale(models, curLocale).map((m) => ({
                label: clip(fullNamer(m)),
                value: m,
                default: m === state.model,
              })),
            ),
        ),
      );
    }
    // Row 3 — engine.
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`vcfg:engine:${i.id}`)
          .setPlaceholder(t('voice.config.pickEngine', locale))
          // Same labels as every other surface (engineLabel); 💎 marks paid engines.
          .addOptions(
            (['google', 'piper', 'kokoro', 'gcloud'] as const).map((e) => ({
              label: isPremiumVoiceEngine(e)
                ? `💎 ${engineLabel(e, locale, deps.config.ttsEngine)}`
                : engineLabel(e, locale, deps.config.ttsEngine),
              value: e,
              default: state.engine === e,
            })),
          ),
      ),
    );
    // Row 4 — speed presets.
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`vcfg:speed:${i.id}`)
          .setPlaceholder(t('voice.config.pickSpeed', locale))
          .addOptions(
            SPEED_PRESETS.map((s) => ({
              label: `${s}×`,
              value: String(s),
              default: s === state.speed,
            })),
          ),
      ),
    );
    // Row 5 — Save / Cancel.
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`vcfg:save:${i.id}`)
          .setLabel(t('voice.config.save', locale))
          .setStyle(ButtonStyle.Success)
          .setEmoji('💾'),
        new ButtonBuilder()
          .setCustomId(`vcfg:cancel:${i.id}`)
          .setLabel(t('voice.config.cancel', locale))
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('✖️'),
      ),
    );
    const summary = t('voice.config.summary', locale, {
      voice: fullNamer(state.model),
      engine: engineName(state.engine),
      speed: state.speed,
    });
    return { content: `${t('voice.config.title', locale)}\n${summary}`, rows };
  }

  const initial = render();
  await i.reply(replyCard(initial.content, { ephemeral: true, rows: initial.rows }));
  const msg = await i.fetchReply();
  let done = false;
  const collector = msg.createMessageComponentCollector({ time: 120_000 });
  const onCollect = async (ci: MessageComponentInteraction): Promise<void> => {
    // The panel is ephemeral (only the invoker sees it), so a different user can never reach
    // its components — this guard is defensive only, hence it silently ignores the interaction.
    if (ci.user.id !== i.user.id) return;
    if (ci.isButton() && ci.customId === `vcfg:cancel:${i.id}`) {
      done = true;
      await ci.update(updateCard(t('voice.config.cancelled', locale), { tone: 'warning' }));
      collector.stop('cancelled');
      return;
    }
    if (ci.isButton() && ci.customId === `vcfg:save:${i.id}`) {
      const now = Date.now();
      const premium =
        isUserPremium(deps.db, i.user.id, now) || isGuildPremium(deps.db, i.guildId!, now);
      const check = validateSave(state, { premium });
      if (!check.ok) {
        // Keep the panel open; tell them via a follow-up so they can pick another engine.
        await ci.reply(
          replyCard(
            t(
              state.engine === 'kokoro' ? 'voice.engine.kokoroLocked' : 'voice.engine.gcloudLocked',
              locale,
            ),
            {
              ephemeral: true,
              tone: 'premium',
            },
          ),
        );
        return;
      }
      setUserVoice(deps.db, i.guildId!, i.user.id, state.model, state.speed, state.engine);
      done = true;
      await ci.update(
        updateCard(
          t('voice.set', locale, {
            name: fullNamer(state.model),
            model: state.model,
            speed: state.speed,
            engine: engineName(state.engine),
          }),
          { tone: 'success' },
        ),
      );
      collector.stop('saved');
      return;
    }
    if (ci.isStringSelectMenu()) {
      const value = ci.values[0]!;
      if (ci.customId === `vcfg:lang:${i.id}`) {
        if (value === '__more__') {
          state.langPage = paginateLocales(locales, state.langPage).nextPage;
        } else {
          const first = voicesForLocale(models, value)[0];
          if (first) state.model = first; // switch to the language's first voice
        }
      } else if (ci.customId === `vcfg:voice:${i.id}`) {
        state.model = value;
      } else if (ci.customId === `vcfg:engine:${i.id}`) {
        state.engine = value as UserEngine;
      } else if (ci.customId === `vcfg:speed:${i.id}`) {
        state.speed = Number(value);
      }
      const next = render();
      await ci.update(updateCard(next.content, { rows: next.rows }));
    }
  };
  // `.catch` is load-bearing: a double-click (already-acknowledged, 40060) or a panel
  // left open past the ack window (10062) rejects the update/reply, and a bare `void`
  // would surface that as an unhandledRejection in the global error reporter. The panel
  // is disposable — dropping a failed ack is the right outcome. Same convention as the
  // rest of this file.
  collector.on('collect', (ci) => void onCollect(ci).catch(() => {}));
  collector.on('end', () => {
    if (done) return;
    void i
      .editReply(editCard(t('voice.config.expired', locale), { tone: 'warning' }))
      .catch(() => {});
  });
}

/**
 * Read-only catalog browser.  Pagination state lives only in this ephemeral collector;
 * custom ids carry an interaction id and action, never a model id supplied by the client.
 */
async function handleVoiceBrowse(
  i: ChatInputCommandInteraction,
  deps: BotDeps,
  locale: string,
): Promise<void> {
  const requestedLocale = i.options.getString('locale')?.trim().toLowerCase() ?? '';
  if (requestedLocale && !/^[a-z]{2}$/.test(requestedLocale)) {
    await reply(i, t('voice.browse.invalidLocale', locale));
    return;
  }
  const engine = (i.options.getString('engine') ?? 'all') as VoiceCatalogEngine;
  if (!['all', 'local', 'google'].includes(engine)) {
    await reply(i, t('voice.browse.empty', locale));
    return;
  }
  const voices = filterVoiceCatalog(
    deps.availableModels,
    { query: i.options.getString('query'), locale: requestedLocale, engine },
    i.locale,
  );
  if (!voices.length) {
    await reply(i, t('voice.browse.empty', locale));
    return;
  }
  const favourites = new Set(listVoiceFavorites(deps.db, i.user.id));
  const recent = new Set(listRecentVoices(deps.db, i.user.id));
  let page = 0;
  let expired = false;
  const render = () => {
    const current = paginateVoiceCatalog(voices, page);
    page = current.page;
    const lines = current.slice.map((voice) => {
      const badges = `${favourites.has(voice.id) ? ' ⭐' : ''}${recent.has(voice.id) ? ' 🕘' : ''}`;
      return `• **${voice.label}** — ${voice.engine}${badges}`;
    });
    return {
      content: `${t('voice.browse.title', locale, {
        page: current.page + 1,
        pages: current.pageCount,
      })}\n${lines.join('\n')}`,
      rows: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`vbr:prev:${i.id}`)
            .setLabel(t('voice.browse.previous', locale))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(current.page === 0),
          new ButtonBuilder()
            .setCustomId(`vbr:next:${i.id}`)
            .setLabel(t('voice.browse.next', locale))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(current.page >= current.pageCount - 1),
        ),
      ],
    };
  };
  const initial = render();
  await i.reply(replyCard(initial.content, { ephemeral: true, rows: initial.rows }));
  const message = await i.fetchReply();
  const collector = message.createMessageComponentCollector({ time: 120_000 });
  collector.on('collect', (component) => {
    if (component.user.id !== i.user.id || !component.isButton()) return;
    if (component.customId === `vbr:prev:${i.id}`) page -= 1;
    else if (component.customId === `vbr:next:${i.id}`) page += 1;
    else return;
    const next = render();
    void component.update(updateCard(next.content, { rows: next.rows })).catch(() => {});
  });
  collector.on('end', () => {
    if (expired) return;
    expired = true;
    void i
      .editReply(editCard(t('voice.browse.expired', locale), { tone: 'warning' }))
      .catch(() => {});
  });
}

export async function handleVoice(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  const locale = localeForUser(deps, i);
  const sub = i.options.getSubcommand();
  if (sub === 'config') {
    await handleVoiceConfig(i, deps, locale);
    return;
  }
  if (sub === 'browse') {
    await handleVoiceBrowse(i, deps, locale);
    return;
  }
  if (sub === 'favorite' || sub === 'unfavorite') {
    const model = i.options.getString('model', true);
    if (!deps.availableModels.includes(model)) {
      await reply(i, t('voice.unknownModel', locale));
      return;
    }
    if (sub === 'favorite') {
      const saved = addVoiceFavorite(deps.db, i.user.id, model);
      await reply(
        i,
        saved
          ? `Added **${makeLocalizedNamer(i.locale, deps.availableModels)(model)}** to your favourites.`
          : 'Your favourites are full. Remove one before adding another.',
      );
    } else {
      const removed = removeVoiceFavorite(deps.db, i.user.id, model);
      await reply(i, removed ? 'Voice removed from your favourites.' : 'That voice was not saved.');
    }
    return;
  }
  if (sub === 'favorites' || sub === 'recent') {
    const models =
      sub === 'favorites'
        ? listVoiceFavorites(deps.db, i.user.id)
        : listRecentVoices(deps.db, i.user.id);
    const available = models.filter((model) => deps.availableModels.includes(model));
    const title = sub === 'favorites' ? 'Favourite voices' : 'Recent voices';
    await reply(
      i,
      available.length
        ? `**${title}**\n${available.map((model) => `• ${makeLocalizedNamer(i.locale, deps.availableModels)(model)} — \`${model}\``).join('\n')}`
        : `**${title}**\nNo available voices yet.`,
    );
    return;
  }
  if (sub === 'set') {
    const model = i.options.getString('model', true);
    if (!deps.availableModels.includes(model)) {
      await reply(i, t('voice.unknownModel', locale));
      return;
    }
    // Beginner-friendly range guard: the `speed` builder has NO min/max, so
    // Discord does NOT reject client-side (e.g. speed:5). Previously it did a silent clamp
    // (5 -> 2×) and replied "success" — a silent surprise. It only validates when the
    // value WAS provided (getNumber returns null if omitted) AND it falls OUTSIDE 0.5–2.0;
    // in that case a friendly error with the range and NOTHING saved (rejection, not clamp).
    // Boundaries 0.5 and 2.0 remain valid. Omitted -> falls to defaultSpeed (unchanged).
    const rawSpeed = i.options.getNumber('speed');
    if (rawSpeed !== null && (rawSpeed < 0.5 || rawSpeed > 2.0)) {
      await reply(i, t('voice.badSpeed', locale));
      return;
    }
    const speed = rawSpeed ?? deps.config.defaultSpeed;
    // Clamp preserved: no-op for valid provided values (already in [0.5,2.0]); keeps
    // the old behavior for the omitted->defaultSpeed path.
    const clamped = Math.min(2.0, Math.max(0.5, speed));
    // Per-user engine: new option (google/piper/kokoro/gcloud). If OMITTED, PRESERVES
    // the user's current engine — otherwise changing only the voice would reset the engine to Google (read-first).
    const engineOpt = i.options.getString('engine') as
      'google' | 'piper' | 'kokoro' | 'gcloud' | null;
    const currentEngine = getUserVoice(deps.db, i.guildId!, i.user.id)?.engine ?? 'google';
    const engine = engineOpt ?? currentEngine;
    // Premium GATE: Kokoro and Google HD require Vozen Plus (user) OR the server's
    // Premium. Only here, when SAVING — at runtime resolveUserEngine revalidates (expired
    // Premium -> gTTS). Same pattern as the premium effects (voice.effect.locked).
    if (isPremiumVoiceEngine(engine)) {
      const now = Date.now();
      const unlocked =
        isUserPremium(deps.db, i.user.id, now) || isGuildPremium(deps.db, i.guildId!, now);
      if (!unlocked) {
        await reply(
          i,
          t(
            engine === 'kokoro' ? 'voice.engine.kokoroLocked' : 'voice.engine.gcloudLocked',
            locale,
          ),
        );
        return;
      }
    }
    setUserVoice(deps.db, i.guildId!, i.user.id, model, clamped, engine);
    recordRecentVoice(deps.db, i.user.id, model);
    // Beginner-friendly copy: voice name IN THE USER'S LANGUAGE (i.locale) + raw
    // copy-pasteable id. Includes the chosen engine.
    await reply(
      i,
      t('voice.set', locale, {
        name: makeLocalizedNamer(i.locale, deps.availableModels)(model),
        model,
        speed: clamped,
        engine: engineLabel(engine, locale, deps.config.ttsEngine),
      }),
    );
  } else if (sub === 'list') {
    // Beginner-friendly: instead of a flat list of Piper ids, groups by language
    // with human names (formatVoiceList). The raw id stays in parentheses so
    // /voice set remains copy-pasteable. Language headers IN THE USER'S
    // LANGUAGE (i.locale); message header i18n.
    const list = deps.availableModels.length
      ? formatVoiceList(deps.availableModels, i.locale)
      : t('voice.listEmpty', locale);
    // Card: fits comfortably in an embed description's 4096 chars (groups by language).
    const embed = brandEmbed().setDescription(`${t('voice.listHeader', locale)}\n${list}`);
    await i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } else if (sub === 'reset') {
    resetUserVoice(deps.db, i.guildId!, i.user.id);
    await reply(i, t('voice.reset', locale));
  } else if (sub === 'detection') {
    // Opt-in per (guild,user): ON => the message language is detected and the voice picked
    // per language (the speaker may change); OFF (default) => one fixed voice reads all.
    const active = i.options.getBoolean('active', true);
    setDetection(deps.db, i.guildId!, i.user.id, active);
    await reply(i, active ? t('voice.detection.on', locale) : t('voice.detection.off', locale));
  } else if (sub === 'opt-out') {
    // Per-user (no admin gate): each person manages their own opt-out of auto-read.
    setOptOut(deps.db, i.guildId!, i.user.id);
    await reply(i, t('voice.optout', locale));
  } else if (sub === 'opt-in') {
    setOptIn(deps.db, i.guildId!, i.user.id);
    await reply(i, t('voice.optin', locale));
  } else if (sub === 'nickname') {
    // PHONETIC nickname for xsaid. Empty/omitted -> clears (back to the server name).
    const raw = i.options.getString('name');
    if (raw === null || raw.trim() === '') {
      clearNickname(deps.db, i.guildId!, i.user.id);
      await reply(i, t('voice.nickname.cleared', locale));
    } else {
      // Saves ALREADY sanitized (strips emojis/symbols); if nothing legible remains, refuses.
      const clean = sanitizeSpeakerName(raw);
      if (!clean) {
        await reply(i, t('voice.nickname.invalid', locale));
        return;
      }
      setNickname(deps.db, i.guildId!, i.user.id, clean);
      await reply(i, t('voice.nickname.set', locale, { name: clean }));
    }
  } else if (sub === 'effect') {
    const raw = i.options.getString('effect', true);
    const effect: VoiceEffect = isVoiceEffect(raw) ? raw : 'none';
    // Premium GATE: premium effects require Vozen Premium (server) OR Vozen Plus (user).
    // Only here, when SAVING — the player blindly applies whatever is saved.
    if (isPremiumEffect(effect)) {
      const now = Date.now();
      const unlocked =
        isGuildPremium(deps.db, i.guildId!, now) || isUserPremium(deps.db, i.user.id, now);
      if (!unlocked) {
        await reply(i, t('voice.effect.locked', locale, { effect: effectLabel(effect) }));
        return;
      }
    }
    setVoiceEffect(deps.db, i.guildId!, i.user.id, effect);
    await reply(
      i,
      effect === 'none'
        ? t('voice.effect.cleared', locale)
        : t('voice.effect.set', locale, { effect: effectLabel(effect) }),
    );
  } else if (sub === 'preview') {
    const SAMPLE = t('preview.sample', locale);
    const explicitModel = i.options.getString('model');

    // Validates the explicit model BEFORE checking the player.
    if (explicitModel !== null && !deps.availableModels.includes(explicitModel)) {
      await reply(i, t('voice.unknownModel', locale));
      return;
    }

    const player = getPlayer(deps, i.guildId!);
    if (!player) {
      await reply(i, t('voice.notInVoice', locale));
      return;
    }
    const admission = admitUserSpeech(
      deps,
      i.guildId!,
      i.user.id,
      i.guild!,
      i.guild!.members.cache.get(i.user.id)?.voice.channelId ?? null,
    );
    if (!admission.allowed) {
      await reply(i, t('tts.notInVoice', locale));
      return;
    }

    const cfg = getGuildConfig(deps.db, i.guildId!);

    // Per-user rate-limit (SAME limiter as /tts and /laugh — ABUSE-03): without this
    // the preview would queue without limit -> monopolize the voice queue (1 worker per
    // guild) and force cache-miss syntheses by cycling the `model:` option. Same pattern
    // as handleLaugh in fun.ts.
    const rl = getLimiter(deps, i.guildId!, cfg.ratePerMin);
    if (!rl.allow(i.user.id, Date.now())) {
      await reply(i, t('tts.tooFast', locale));
      return;
    }

    const stored = getUserVoice(deps.db, i.guildId!, i.user.id);
    // Preview does NOT go through resolveSynth on purpose: resolveSynth now lets the
    // message LANGUAGE decide the voice, but /voice preview is a DEMO of ONE specific
    // voice — it must play exactly the requested model (or the saved/default one),
    // regardless of the sample-phrase language. So we build the
    // SynthRequest directly. Precedence: explicit model > user's saved voice >
    // guild default_voice > .env > amy. Speed: the user's, otherwise the default.
    const model =
      (explicitModel ?? stored?.model) ||
      cfg.defaultVoice ||
      deps.config.defaultVoice ||
      'en_US-amy-medium';
    const speed = stored?.speed ?? deps.config.defaultSpeed;
    // singleVoice: the preview is a DEMO of ONE specific voice; detection must never
    // override it nor split the sample phrase by language. The engine is the user's (the preview
    // must sound like what they will actually hear).
    const req: SynthRequest = {
      text: SAMPLE,
      model,
      speed,
      singleVoice: true,
      // The preview must sound like what the user will hear; the resolver applies the paid-engine
      // gate and the Google HD budget — engine + gcloudBudget.
      ...resolveUserEngine(deps.db, i.guildId!, i.user.id, stored?.engine, Date.now()),
    };
    // say() returns false when the queue is at the cap: in that case do NOT lie "now
    // playing" — we reuse the same tts.busy key as /tts (consistency).
    const queued = await player.say(req, {
      authorId: i.user.id,
      source: 'command',
      lane: admission.lane,
    });
    await reply(i, queued ? t('voice.previewPlaying', locale) : t('tts.busy', locale));
  }
}
