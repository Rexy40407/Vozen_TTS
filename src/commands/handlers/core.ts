// src/commands/handlers/core.ts — join/leave/tts/skip/shut-up handlers + "Speak" context menu (extracted from index.ts, plan 015).
import {
  ChatInputCommandInteraction,
  MessageContextMenuCommandInteraction,
  GuildMember,
  Guild,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import type { BotDeps } from '../../bot/deps';
import { getPlayer, removePlayer, getLimiter } from '../../bot/deps';
import { createVoiceSession, becomeSpeakerIfStage } from '../../voice/session';
import { getUserVoice } from '../../store/userVoice';
import { isDetectionOn } from '../../store/langDetect';
import { resolveUserEngine } from '../../tts/resolveEngine';
import { getGuildConfig } from '../../store/guildConfig';
import { getBlocklist } from '../../store/blocklist';
import { getUserPronunciations, getServerPronunciations } from '../../store/pronunciation';
import { getVoiceEffect } from '../../store/voiceEffect';
import { forgetVoicePresence } from '../../store/voicePresence';
import { cleanText, collectUrlMedia, collectMarkdownMedia } from '../../textCleaning/clean';
import { prepareSpeech, redactRequest, hasReadableText } from '../prepareSpeech';
import { log } from '../../logging/logger';
import { handleTranscribeVoiceMessage, handleTranslateMessage } from './messageTools';
import { t } from '../../i18n/index';
import { localeForUser, reply } from '../helpers';
import { editCard, replyCard } from '../../ui/messages';
import { makeTemporaryMediaCopy } from '../../media/temporaryMedia';
import { admitUserSpeech } from '../../voice/admission';

/** File exports are intentionally shorter than normal in-call TTS. */
const MAX_TTS_FILE_CHARS = 500;

/**
 * Result (discriminated) of trying to join Vozen to the caller's voice channel.
 * Does NOT contain UI text — the caller is what renders the message (via t()), so
 * that a single interaction produces a single response. This is what allows
 * sharing the logic between /join (which responds) and /setup (which folds the result
 * into its checklist), without risking a double-reply on the same interaction.
 */
export type JoinOutcome =
  | { status: 'no-channel' }
  | { status: 'missing-perms'; channelName: string }
  | { status: 'joined'; channelName: string };

/**
 * SHARED logic for "join the caller's voice channel", extracted from the old
 * handleJoin so it can be reused by /setup (guided onboarding). Effects:
 * checks Connect/Speak, (re)creates the player and the connection. Does NOT respond to the interaction
 * — returns a JoinOutcome that the caller translates. Contract preserved:
 *  - no voice channel            -> { status: 'no-channel' } (doesn't touch the player)
 *  - missing Connect/Speak       -> { status: 'missing-perms' } (doesn't destroy the existing player)
 *  - ok                          -> joins and returns { status: 'joined' }
 */
export function joinUserVoice(i: ChatInputCommandInteraction, deps: BotDeps): JoinOutcome {
  const member = i.member as GuildMember;
  const channel = member?.voice?.channel;
  if (!channel) {
    return { status: 'no-channel' };
  }
  // Check Connect/Speak permissions BEFORE touching the existing player: a
  // /join to a forbidden channel must not destroy a player that already works.
  const me = deps.client.user;
  const perms = me ? channel.permissionsFor(me) : null;
  if (!perms || !perms.has(PermissionFlagsBits.Connect) || !perms.has(PermissionFlagsBits.Speak)) {
    return { status: 'missing-perms', channelName: channel.name };
  }
  // Creates the session via the shared helper (same logic as autojoin). The
  // identity guard in onIdle lives there.
  createVoiceSession(deps, i.guildId!, channel.id, i.guild!.voiceAdapterCreator);
  becomeSpeakerIfStage(channel); // no-op if it's not a stage channel
  return { status: 'joined', channelName: channel.name };
}

export async function handleJoin(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  const locale = localeForUser(deps, i);
  const outcome = joinUserVoice(i, deps);
  switch (outcome.status) {
    case 'no-channel':
      await reply(i, t('join.needVoiceChannel', locale));
      return;
    case 'missing-perms':
      await reply(i, t('join.missingPerms', locale, { channel: outcome.channelName }));
      return;
    case 'joined': {
      // Discord exposes the invoking user's selected client language in `i.locale`.
      // Public responses cannot render a different language per viewer, so the command
      // invoker's locale is the only user-specific locale available for this message.
      //
      // The "next step" is STATE-AWARE. A plain /join does NOT enable auto-reading —
      // only /setup does. So:
      //  - auto-read already configured -> the bot reads on its own; tell the user to
      //    just type in that channel (NO /tts — pushing it here confused users whose
      //    server was already set up, which is the production report that drove this).
      //  - not configured -> keep the generic message (/tts to speak now, /setup to
      //    turn on auto-reading), which is the honest next step there.
      const cfg = getGuildConfig(deps.db, i.guildId!);
      const joinedText =
        cfg.autoread && cfg.ttsChannelId
          ? t('join.joinedAutoread', locale, {
              channel: outcome.channelName,
              readChannel: `<#${cfg.ttsChannelId}>`,
            })
          : t('join.joined', locale, { channel: outcome.channelName });
      await i.reply(replyCard(joinedText, { tone: 'success' }));
      return;
    }
  }
}

export async function handleLeave(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  removePlayer(deps, i.guildId!);
  // 24/7 in-call: EXPLICIT exit -> forgets the presence so it does NOT restore on startup
  // (unlike a restart/deploy, which preserves the purpose row).
  forgetVoicePresence(deps.db, i.guildId!);
  getVoiceConnection(i.guildId!)?.destroy();
  await reply(i, t('leave.left', localeForUser(deps, i)));
}

/** Result (discriminated) of trying to READ a text out loud with the user's voice. */
export type SpeakOutcome =
  | { status: 'no-player' }
  | { status: 'not-in-same-voice' }
  | { status: 'rate-limited' }
  | { status: 'empty' }
  | { status: 'blocked' }
  | { status: 'queued' }
  | { status: 'busy' };

/**
 * SHARED pipeline "read `raw` out loud with the user's voice", extracted from /tts to
 * be reused by the "Speak" context-menu. Does EVERYTHING (player gating, rate-limit,
 * cleaning, media, slang/pronunciation, voice choice, blocklist, say) EXCEPT respond to the
 * interaction — returns a SpeakOutcome that the caller translates. This way /tts and "Speak"
 * share the behavior without diverging. Also EXPORTED for /randomizer (speaks the
 * draw result with the voice of whoever ran it).
 */
export async function speakRawText(
  deps: BotDeps,
  guildId: string,
  userId: string,
  guild: Guild,
  raw: string,
  callerVoiceChannelId: string | null,
): Promise<SpeakOutcome> {
  const player = getPlayer(deps, guildId);
  if (!player) return { status: 'no-player' };
  const admission = admitUserSpeech(deps, guildId, userId, guild, callerVoiceChannelId);
  if (!admission.allowed)
    return { status: admission.reason === 'blocked' ? 'blocked' : 'not-in-same-voice' };
  const cfg = getGuildConfig(deps.db, guildId);
  const rl = getLimiter(deps, guildId, cfg.ratePerMin);
  if (!rl.allow(userId, Date.now())) return { status: 'rate-limited' };

  const cleaned = cleanText(raw, {
    maxChars: cfg.maxChars,
    resolveUser: (id: string) =>
      guild.members.cache.get(id)?.displayName ??
      deps.client.users.cache.get(id)?.username ??
      'someone',
    resolveChannel: (id: string) => {
      const ch = guild.channels.cache.get(id);
      return ch && 'name' in ch ? (ch.name as string) : 'channel';
    },
  });
  const media = [...collectUrlMedia(raw), ...collectMarkdownMedia(raw)];
  if (!/[\p{L}\p{N}]/u.test(cleaned) && media.length === 0) return { status: 'empty' };

  const userVoice = getUserVoice(deps.db, guildId, userId);
  const { req } = prepareSpeech({
    personal: cleaned,
    // Pronunciations of the caller (/tts and Speak read with the caller's voice + rules),
    // followed by the SERVER's (apply to everyone).
    pronunciations: [
      ...getUserPronunciations(deps.db, userId),
      ...getServerPronunciations(deps.db, guildId),
    ],
    userVoice,
    available: deps.availableModels,
    autoDetect: isDetectionOn(deps.db, guildId, userId),
    guildDefaultVoice: cfg.defaultVoice,
    defaultVoice: deps.config.defaultVoice,
    defaultSpeed: deps.config.defaultSpeed,
    media: media.map((kind) => ({ kind })),
  });
  // Engine chosen by the user — resolved by the shared paid-engine gate
  // (Kokoro/Google HD -> configured default without Plus/Premium). The two fields returned are
  // exactly engine + gcloudBudget of the SynthRequest.
  const resolvedEngine = resolveUserEngine(deps.db, guildId, userId, userVoice?.engine, Date.now());
  req.engine = resolvedEngine.engine;
  req.gcloudBudget = resolvedEngine.gcloudBudget;

  // Blocklist: REDACTS the blocked words (Vozen reads the rest without saying them). Only returns
  // 'blocked' if, after removing them, nothing readable is left (it was only a blocked word).
  const blocklist = getBlocklist(deps.db, guildId);
  const redacted = redactRequest(req, blocklist);
  const readable =
    hasReadableText(redacted.text) ||
    (redacted.segments?.some((s) => hasReadableText(s.text)) ?? false);
  if (!readable) return { status: 'blocked' };
  const outReq = redacted;
  outReq.effect = getVoiceEffect(deps.db, guildId, userId); // voice effect (premium)
  outReq.streamSentences = true;
  if (deps.config.messageLeadMs > 0) outReq.leadSilenceMs = deps.config.messageLeadMs;
  const queued = await player.say(outReq, {
    authorId: userId,
    source: 'command',
    lane: admission.lane,
  });
  return { status: queued ? 'queued' : 'busy' };
}

/** Translates a SpeakOutcome into the (ephemeral) message to show the user. */
function speakOutcomeMessage(outcome: SpeakOutcome, locale: string): string {
  switch (outcome.status) {
    case 'no-player':
    case 'not-in-same-voice':
      return t('tts.notInVoice', locale);
    case 'rate-limited':
      return t('tts.tooFast', locale);
    case 'empty':
      return t('tts.nothingAfterClean', locale);
    case 'blocked':
      return t('tts.blocked', locale);
    case 'busy':
      return t('tts.busy', locale);
    case 'queued':
      return t('tts.queued', locale);
  }
}

export async function handleTts(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  // Synthesis can take up to ~15s; defer immediately so we don't lose the token (3s).
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const locale = localeForUser(deps, i);
  const raw = i.options.getString('text', true).trim();
  if (!raw) {
    await i.editReply(editCard(t('tts.nothingToRead', locale), { tone: 'warning' }));
    return;
  }
  const outcome = await speakRawText(
    deps,
    i.guildId!,
    i.user.id,
    i.guild!,
    raw,
    i.guild!.members.cache.get(i.user.id)?.voice.channelId ?? null,
  );
  await i.editReply(
    editCard(speakOutcomeMessage(outcome, locale), {
      tone:
        outcome.status === 'queued' ? 'success' : outcome.status === 'busy' ? 'warning' : 'danger',
    }),
  );
}

/**
 * `/tts-file` is an explicit, ephemeral export.  It deliberately does not inspect or
 * join voice state and never calls a GuildVoicePlayer: creating a file is not speaking
 * in a call.  All cost/limit checks happen before the engine is asked to synthesize.
 */
export async function handleTtsFile(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const locale = localeForUser(deps, i);
  const raw = i.options.getString('text', true).trim();
  if (!raw || !/[\p{L}\p{N}]/u.test(raw)) {
    await i.editReply(editCard(t('tts.nothingToRead', locale), { tone: 'warning' }));
    return;
  }
  if (raw.length > MAX_TTS_FILE_CHARS) {
    await i.editReply(
      editCard(t('ttsFile.tooLong', locale, { max: MAX_TTS_FILE_CHARS }), { tone: 'warning' }),
    );
    return;
  }

  const guildId = i.guildId;
  const preferenceScope = guildId ?? '@user-app';
  const cfg = getGuildConfig(deps.db, preferenceScope);
  const limiter = getLimiter(deps, preferenceScope, cfg.ratePerMin);
  if (!limiter.allow(i.user.id, Date.now())) {
    await i.editReply(editCard(t('tts.tooFast', locale), { tone: 'warning' }));
    return;
  }
  const cleaned = cleanText(raw, {
    maxChars: MAX_TTS_FILE_CHARS,
    resolveUser: () => 'someone',
    resolveChannel: () => 'channel',
  });
  if (!/[\p{L}\p{N}]/u.test(cleaned)) {
    await i.editReply(editCard(t('tts.nothingAfterClean', locale), { tone: 'warning' }));
    return;
  }

  const userVoice = getUserVoice(deps.db, preferenceScope, i.user.id);
  const { req } = prepareSpeech({
    personal: cleaned,
    pronunciations: [
      ...getUserPronunciations(deps.db, i.user.id),
      ...(guildId ? getServerPronunciations(deps.db, guildId) : []),
    ],
    userVoice,
    available: deps.availableModels,
    autoDetect: isDetectionOn(deps.db, preferenceScope, i.user.id),
    guildDefaultVoice: cfg.defaultVoice,
    defaultVoice: deps.config.defaultVoice,
    defaultSpeed: deps.config.defaultSpeed,
    media: [], // File export never fetches or describes arbitrary URL media.
  });
  if (
    !deps.availableModels.includes(req.model) ||
    (req.segments?.some((segment) => !deps.availableModels.includes(segment.model)) ?? false)
  ) {
    await i.editReply(editCard(t('ttsFile.unavailable', locale), { tone: 'warning' }));
    return;
  }
  const redacted = redactRequest(req, guildId ? getBlocklist(deps.db, guildId) : []);
  if (!hasReadableText(redacted.text) && !redacted.segments?.some((s) => hasReadableText(s.text))) {
    await i.editReply(editCard(t('tts.blocked', locale), { tone: 'warning' }));
    return;
  }
  const resolvedEngine = resolveUserEngine(
    deps.db,
    preferenceScope,
    i.user.id,
    userVoice?.engine,
    Date.now(),
  );
  redacted.engine = resolvedEngine.engine;
  redacted.gcloudBudget = resolvedEngine.gcloudBudget;
  redacted.effect = guildId ? getVoiceEffect(deps.db, guildId, i.user.id) : undefined;

  let temporary: Awaited<ReturnType<typeof makeTemporaryMediaCopy>> | undefined;
  try {
    const cachedAudioPath = await deps.engine.synth(redacted);
    temporary = await makeTemporaryMediaCopy(cachedAudioPath);
    await i.editReply({
      content: t('ttsFile.ready', locale),
      files: [{ attachment: temporary.path, name: 'vozen-audio.wav' }],
    });
  } catch {
    // Do not log file paths or user text. The generic error handler only runs when this
    // function throws, so handle the export failure locally.
    await i.editReply(editCard(t('ttsFile.failed', locale), { tone: 'danger' })).catch(() => {});
  } finally {
    await temporary?.cleanup().catch(() => {});
  }
}

/**
 * "Speak" context-menu (right-click a message -> Apps -> Speak): reads that message
 * out loud with the voice of whoever clicked. Same pipeline as /tts (speakRawText), but the
 * text comes from the target message instead of an argument.
 */
export async function handleMessageContextMenu(
  i: MessageContextMenuCommandInteraction,
  deps: BotDeps,
): Promise<void> {
  try {
    if (i.commandName === 'Translate') {
      await handleTranslateMessage(i, deps);
      return;
    }
    if (i.commandName === 'Transcribe voice message') {
      await handleTranscribeVoiceMessage(i, deps);
      return;
    }
    if (i.commandName !== 'Speak') return;
    const locale = localeForUser(deps, i);
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    if (!i.guildId || !i.guild) {
      await i.editReply(editCard(t('error.generic', locale), { tone: 'danger' }));
      return;
    }
    const raw = (i.targetMessage.content ?? '').trim();
    if (!raw) {
      await i.editReply(editCard(t('speak.emptyMessage', locale), { tone: 'warning' }));
      return;
    }
    const outcome = await speakRawText(
      deps,
      i.guildId,
      i.user.id,
      i.guild,
      raw,
      i.guild.members.cache.get(i.user.id)?.voice.channelId ?? null,
    );
    await i.editReply(
      editCard(speakOutcomeMessage(outcome, locale), {
        tone:
          outcome.status === 'queued'
            ? 'success'
            : outcome.status === 'busy'
              ? 'warning'
              : 'danger',
      }),
    );
  } catch (err) {
    // Message actions are intentionally dispatched without awaiting in client.ts. Contain every
    // failure here so a provider/database fault cannot become an unhandled rejection or leave a
    // deferred interaction stuck indefinitely.
    log.error(`[context] ${i.commandName} message action failed:`, err);
    if (!i.isRepliable()) return;
    const msg = t('error.generic', 'en');
    if (i.deferred && !i.replied) {
      await i.editReply(editCard(msg, { tone: 'danger' })).catch(() => {});
    } else if (!i.replied) {
      await i.reply(replyCard(msg, { ephemeral: true, tone: 'danger' })).catch(() => {});
    }
  }
}

export async function handleSkip(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  const locale = localeForUser(deps, i);
  const player = getPlayer(deps, i.guildId!);
  if (!player) {
    await reply(i, t('skip.notInVoice', locale));
    return;
  }
  // There is a player, but it may be stopped (nothing playing nor in the queue). Read isActive()
  // BEFORE skip() — skip() would do stop()/emit(Idle) and distort the state — so as
  // not to pretend it skipped something when there was nothing. skip.notInVoice covers
  // "no player at all"; skip.nothing covers "there is a player but it's stopped".
  if (!player.isActive()) {
    await reply(i, t('skip.nothing', locale));
    return;
  }
  player.skip();
  await reply(i, t('skip.skipped', locale));
}

/** /shut-up — silences Vozen now: clears the queue and stops what's playing (stays in the call). */
export async function handleShutup(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  const locale = localeForUser(deps, i);
  const player = getPlayer(deps, i.guildId!);
  if (!player) {
    await reply(i, t('shutup.notInVoice', locale));
    return;
  }
  // Read isActive() BEFORE silence() (silence does stop()/emit(Idle) and would distort the
  // state): distinguishes "there was nothing to say" from "actually silenced it".
  if (!player.isActive()) {
    await reply(i, t('shutup.nothing', locale));
    return;
  }
  player.silence();
  await reply(i, t('shutup.done', locale));
}
