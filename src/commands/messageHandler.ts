import { Message, PermissionFlagsBits } from 'discord.js';
import type { BotDeps } from '../bot/deps';
import { getPlayer, getLimiter } from '../bot/deps';
import { createVoiceSession, becomeSpeakerIfStage } from '../voice/session';
import type { GuildVoicePlayer } from '../voice/player';
import { cleanText, collectUrlMedia, collectMarkdownMedia } from '../textCleaning/clean';
import { mediaFromAttachments, mediaFromStickers } from '../language/attachmentMedia';
import type { MediaItem } from '../language/spokenPhrases';
import { sanitizeSpeakerName } from '../language/speakerName';
import { getNickname } from '../store/nickname';
import { getGuildConfig } from '../store/guildConfig';
import { getBlocklist } from '../store/blocklist';
import { redactBlocked } from '../moderation/filter';
import { isRepetitionSpam } from '../moderation/antispam';
import { metrics } from '../metrics';
import { getVoiceEffect } from '../store/voiceEffect';
import { bumpTalk, getTopSpeakers, type TalkBump } from '../store/talkStats';
import { bumpTalkUsage } from '../store/talkUsage';
import { bumpGuildTalk } from '../store/guildTalkStreak';
import { renderLeaderboard } from '../leaderboard/randomPost';
import { supportPromoMessage, votePromoMessage } from '../votePromo';
import { getUserPronunciations, getServerPronunciations } from '../store/pronunciation';
import { getUserVoice } from '../store/userVoice';
import { resolveUserEngine } from '../tts/resolveEngine';
import { isOptedOut } from '../store/optout';
import { isDetectionOn } from '../store/langDetect';
import { prepareSpeech, redactRequest, hasReadableText } from './prepareSpeech';
import { t } from '../i18n/index';
import { log } from '../logging/logger';
import { channelCard } from '../ui/messages';
import { resolveQueueLane } from '../voice/queuePolicy';
import { handleTranslationMessage } from '../translation/messageListener';
import { translateTextForSpeech } from '../translation/explicit';
import { getTranslationPreference } from '../store/translation';
import { getChannelProfile } from '../store/channelProfiles';
import { resolveChannelPolicy } from '../policy/channelPolicy';
import { isPremiumEffect, isVoiceEffect } from '../tts/effects';
import { isGuildPremium, isUserPremium } from '../store/premium';

/**
 * Collects the MEDIA to announce from a message: URLs in the text (link/gif, via
 * collectUrlMedia — same RE_URL as cleanText), attachments by type (image/video/…) and
 * stickers (by name). The order is URLs -> attachments -> stickers. `?.values()` works
 * both for the discord.js Collection and for the test mocks' array; absent
 * -> empty. PURE with respect to `message` (read-only).
 */
function collectMessageMedia(message: Message): MediaItem[] {
  const content = message.content ?? '';
  const urls: MediaItem[] = collectUrlMedia(content).map((kind) => ({ kind }));
  const markdown: MediaItem[] = collectMarkdownMedia(content).map((kind) => ({ kind }));
  const atts = mediaFromAttachments([...(message.attachments?.values() ?? [])]);
  const stickers = mediaFromStickers([...(message.stickers?.values() ?? [])]);
  return [...urls, ...markdown, ...atts, ...stickers];
}

/**
 * Autojoin: when Vozen is not yet in a call and the author is in a voice channel,
 * it joins that channel on its own (if autojoin ON and the bot has Connect/Speak). Returns the
 * created player, or undefined if it could not join (autojoin OFF, author not in voice,
 * no permissions). Silent failure via try/catch — never crashes the handler.
 */
function maybeAutojoin(
  message: Message,
  deps: BotDeps,
  autojoinOn: boolean,
): GuildVoicePlayer | undefined {
  if (!autojoinOn || !message.guild || !message.guildId) return undefined;
  const channel = message.member?.voice?.channel;
  if (!channel || !channel.isVoiceBased()) return undefined;
  const me = deps.client.user;
  const perms = me ? channel.permissionsFor(me) : null;
  if (!perms || !perms.has(PermissionFlagsBits.Connect) || !perms.has(PermissionFlagsBits.Speak)) {
    return undefined;
  }
  try {
    const player = createVoiceSession(
      deps,
      message.guildId,
      channel.id,
      message.guild.voiceAdapterCreator,
    );
    becomeSpeakerIfStage(channel); // no-op if it is not a stage channel
    return player;
  } catch (err) {
    log.warn('[messageHandler] autojoin failed (ignored)', err);
    return undefined;
  }
}

/**
 * VISIBLE rate-limit feedback: reacts with 🐢 to the message that was limited. Best-effort —
 * needs AddReactions; without permission/on failure, it is ignored (never breaks the handler nor
 * queues rejections). Before, the rate-limit drop was 100% silent and looked like "the bot
 * doesn't speak"; the reaction tells the user they are going too fast.
 */
function reactRateLimited(message: Message): void {
  try {
    void Promise.resolve(message.react?.('🐢')).catch(() => {});
  } catch {
    /* best-effort — ignore any synchronous error */
  }
}

/**
 * Cooldown window for the rate-limit FEEDBACK (not to be confused with the RateLimiter's own
 * window — they are independent): 1 minute. See RateLimitFeedbackCooldown.
 */
export const RATE_LIMIT_FEEDBACK_WINDOW_MS = 60 * 1000;
/** Entry cap (anti-growth); evict the oldest on overflow — same as GreetCooldown/DuplicateTracker. */
const RATE_LIMIT_FEEDBACK_MAX_ENTRIES = 10_000;

/**
 * Cooldown for the VISIBLE rate-limit feedback (🐢 + log), per (guild, user) — ABUSE-02.
 * Without this, a flood in an autoread channel became ONE REST reaction + ONE log write PER
 * dropped MESSAGE (an I/O storm capable of filling the disk). The `messagesRateLimited`
 * METRIC still counts ALL drops (see handleMessage) — only the
 * visible feedback is throttled. Same cap+evict pattern as GreetCooldown/
 * DuplicateTracker: FIXED window (a suppressed drop does not extend it), injectable clock
 * for tests, Map preserves insertion order -> simple evict of the oldest.
 */
export class RateLimitFeedbackCooldown {
  private readonly last = new Map<string, number>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  private static keyOf(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
  }

  /**
   * Should the feedback to (guild, user) go out NOW? True if never notified or if
   * >= RATE_LIMIT_FEEDBACK_WINDOW_MS has passed since the last notification — records the
   * instant (consumes the window). False within the window, WITHOUT renewing the timestamp.
   */
  shouldNotify(guildId: string, userId: string): boolean {
    const key = RateLimitFeedbackCooldown.keyOf(guildId, userId);
    const nowMs = this.now();
    const prev = this.last.get(key);
    if (prev !== undefined && nowMs - prev < RATE_LIMIT_FEEDBACK_WINDOW_MS) return false;
    this.last.delete(key); // re-insert at the end (MRU) so the evict hits the oldest
    this.last.set(key, nowMs);
    if (this.last.size > RATE_LIMIT_FEEDBACK_MAX_ENTRIES) {
      const oldest = this.last.keys().next().value as string | undefined;
      if (oldest !== undefined) this.last.delete(oldest);
    }
    return true;
  }
}

// Instance shared per process (in-memory state, does not persist — reset on
// restart is acceptable, same trade-off as GreetCooldown/DuplicateTracker). Does not live in
// BotDeps because this file is the only consumer (scope of plan 030).
const rateLimitFeedbackCooldown = new RateLimitFeedbackCooldown();

export async function handleMessage(message: Message, deps: BotDeps): Promise<void> {
  try {
    if (!message.guild || !message.guildId) return;
    // Client not READY yet (client.user null): there is no identity nor voice session
    // — ignore the message. Capture `me` ONCE (before we used `client.user!` further
    // down, which contradicted this guard and threw if a pre-READY message arrived).
    const me = deps.client.user;
    if (!me) return;
    // Text translation is an independent, never-spoken path. It runs before normal auto-read
    // admission and retains its own default-deny mappings and quotas.
    await handleTranslationMessage(message, deps);
    // Vozen NEVER reads itself — anti-loop, regardless of read_bots.
    if (message.author.id === me.id) return;

    // Guild kill-switch and bot gate BEFORE the games hook. The kill-switch
    // (/config enabled:off) must stop EVERYTHING — including a running /game
    // (otherwise it would keep consuming messages and speaking). And messages from OTHER
    // bots/webhooks should only reach the game (as guesses) if read_bots is ON.
    const cfg = getGuildConfig(deps.db, message.guildId);
    const channelProfile = getChannelProfile(deps.db, message.guildId, message.channelId);
    const channelPolicy = resolveChannelPolicy(cfg, channelProfile);
    if (!cfg.enabled) return;
    if (message.author.bot && !channelPolicy.readBots) return;

    // A normal human may only cause speech from the call Vozen is already in. Bots are the
    // deliberate read_bots exception: if an admin enabled that setting, their messages keep
    // the historic behavior and are not made dependent on a Discord voice-state cache.
    const authorVoiceChannelId = message.member?.voice?.channelId ?? null;
    const botVoiceChannelId = message.guild.members?.me?.voice?.channelId ?? null;
    const matchesProfileBinding =
      channelPolicy.voiceChannelId === null || channelPolicy.voiceChannelId === botVoiceChannelId;
    const canTriggerSpeech =
      matchesProfileBinding &&
      (message.author.bot ||
        (authorVoiceChannelId !== null && authorVoiceChannelId === botVoiceChannelId));

    // Minigames (/game): if there is an active game IN THE CHANNEL of this message, hand it to
    // the game (a potential guess) and do NOT read it aloud — players' answers
    // are not TTS. Placed BEFORE auto-read/rate-limit (but AFTER the kill-switch/
    // read-bots above): a guess should not spend rate-limit nor require a configured
    // auto-read channel. handleMessage returns true = consumed -> we exit.
    if (
      deps.games?.handleMessage({
        guildId: message.guildId,
        channelId: message.channelId,
        authorId: message.author.id,
        authorName: message.member?.displayName ?? message.author.username ?? 'someone',
        content: message.content ?? '',
        canTriggerSpeech,
      })
    ) {
      // Observability of the games routing: a game in a THREAD only works if the
      // thread's messages reach here (channelId == the thread's id). If one day this
      // stops happening, the guesses would fail SILENTLY — this log makes the
      // path visible (confirms the game is receiving input). log.debug (not
      // info — ABUSE-02): fires PER MESSAGE while the game runs; at info level
      // a busy game would fill the persistent log. LOG_LEVEL=debug still sees it.
      log.debug(`[game] message consumed in channel ${message.channelId}`);
      return;
    }

    // There is something to read when there is TEXT or MEDIA (a .gif/image/sticker without text is
    // also announced). Without either -> nothing to do.
    const media = collectMessageMedia(message);
    if (!message.content && media.length === 0) return;

    // A profile must opt in explicitly for a different channel. An inert profile (all inherited)
    // never expands auto-read beyond the existing configured TTS channel.
    const isAutoreadChannel =
      channelProfile?.autoRead === true ||
      (!channelProfile && cfg.autoread && cfg.ttsChannelId === message.channelId);
    const isMention = message.mentions.has(me.id, {
      ignoreEveryone: true,
      ignoreRoles: true,
      ignoreRepliedUser: true,
    });
    const isReplyToBot =
      message.reference?.messageId != null && message.mentions.repliedUser?.id === me.id;
    // text-in-voice: message sent in the text chat INSIDE the voice channel where
    // Vozen is now (the voice channel's text has channelId == the voice channel's id).
    const isTextInVoice =
      cfg.textInVoice && botVoiceChannelId != null && botVoiceChannelId === message.channelId;

    if (!isAutoreadChannel && !isMention && !isReplyToBot && !isTextInVoice) return;

    // Role gating: if the guild defined an allowed role, only the author with that
    // role is read by auto-read (covers channel, mention and reply). Without a role
    // (null) the current behavior is kept (no restriction). Absent member -> ignore.
    // Note: does it apply to /tts? No. /tts is an explicit user action (they type
    // the command), not auto-read, so role gating is only for messages.
    if (cfg.ttsRoleId) {
      const member = message.member;
      if (!member || !member.roles.cache.has(cfg.ttsRoleId)) return;
    }

    // Per-user opt-out: only silences PASSIVE reading (auto-read channel OR
    // text-in-voice). A mention/reply to the bot is an EXPLICIT user action (like
    // /tts), so it is NOT blocked by opt-out — only automatic reading is.
    if (
      (isAutoreadChannel || isTextInVoice) &&
      !isMention &&
      !isReplyToBot &&
      isOptedOut(deps.db, message.guildId, message.author.id)
    ) {
      return;
    }

    // gating: active player in this guild. With autojoin ON, if Vozen is not yet
    // in a call and the author is in a voice channel (and the bot has Connect/Speak), it joins
    // the author's channel on its own — instead of requiring a manual /join.
    if (
      channelPolicy.voiceChannelId &&
      !message.author.bot &&
      authorVoiceChannelId !== channelPolicy.voiceChannelId
    )
      return;
    let player = getPlayer(deps, message.guildId);
    let autojoinedThisMessage = false;
    if (!player) {
      player = maybeAutojoin(message, deps, cfg.autojoin);
      if (!player) return;
      // createVoiceSession updates the voice connection immediately, but Discord's member
      // cache may lag behind it. This one message is the only safe exception to the normal
      // cache-based same-call check: it is the exact author who caused this handler to join.
      autojoinedThisMessage = true;
    }

    if (!canTriggerSpeech && !autojoinedThisMessage) return;

    // cleanup with the guild's caches
    const cleaned = cleanText(message.content ?? '', {
      maxChars: channelPolicy.maxChars,
      resolveUser: (id: string) =>
        message.guild!.members.cache.get(id)?.displayName ??
        deps.client.users.cache.get(id)?.username ??
        'someone',
      resolveChannel: (id: string) => {
        const ch = message.guild!.channels.cache.get(id);
        return ch && 'name' in ch ? (ch.name as string) : 'channel';
      },
    });
    // Hardened empty guard: requires at least ONE letter or number (\p{L}\p{N}) in the
    // body — OR media to announce (a gif/image/sticker without text is spoken anyway).
    // Covers the empty '' and text left with only punctuation/symbols/zero-width residue
    // (the emoji strip's safety net): none of that is "readable". Without a readable body
    // AND without media -> not worth synthesizing.
    if (!/[\p{L}\p{N}]/u.test(cleaned) && media.length === 0) return;

    // Role policy is authorization for queue admission only. A blocked role always wins;
    // no subscription, command option or user-controlled value can bypass it.
    const roleIds = message.member?.roles?.cache?.keys?.() ?? [];
    const queuePolicy = resolveQueueLane(cfg, roleIds);
    if (!queuePolicy.allowed) return;

    // per-user rate-limit (persistent per-guild limiter). Runs NOW — AFTER the readable-text
    // guard — so that a message that was never going to be spoken (emoji/link/empty) does NOT
    // burn the budget and silence the next readable message (old bug: the rate-limit
    // ran before cleanText). The drop is VISIBLE: 🐢 reaction + metric + log — before it was
    // a silent `return` and looked like "the bot doesn't speak".
    const rl = getLimiter(deps, message.guildId, cfg.ratePerMin);
    if (!rl.allow(message.author.id, Date.now())) {
      // The METRIC counts ALL drops (never throttled — it is the real abuse counter).
      metrics.inc('messagesRateLimited');
      // log.debug (not info — ABUSE-02): a flood dropped ONE log PER MESSAGE at info
      // level, a write storm on the persistent log. LOG_LEVEL=debug still sees it.
      log.debug(`[rate] message from ${message.author.id} dropped (limit ${cfg.ratePerMin}/min)`);
      // VISIBLE feedback (🐢, REST call) throttled per (guild,user) — ABUSE-02: without
      // this, the same flood generated one REST reaction per dropped message. Only the 1st of
      // each window reacts; the following ones stay silent (the metric above is not affected).
      if (rateLimitFeedbackCooldown.shouldNotify(message.guildId, message.author.id)) {
        reactRateLimited(message);
      }
      return;
    }

    // Anti-spam (opt-in per guild, OFF by default): does not read spammed messages —
    // massive token repetition IN the message (e.g. "POKEBOLAS ×39") OR the SAME
    // large message repeated by the same person in a short window. Runs over the text
    // ALREADY cleaned/truncated; BEFORE lastSpeaker/bumpTalk (a skipped msg does not count). The
    // duplicate tracker only exists with the injected map (old tests → no dup).
    if (cfg.antispam) {
      const dup =
        deps.dupTracker?.isDuplicateSpam(message.guildId, message.author.id, cleaned, Date.now()) ??
        false;
      if (isRepetitionSpam(cleaned) || dup) {
        log.info(
          `[antispam] message dropped (guild ${message.guildId}, author ${message.author.id})`,
        );
        return;
      }
    }

    // Blocklist (fetched once; reused in the req redaction further below).
    const blocklist = getBlocklist(deps.db, message.guildId);
    // Body-only-blocked guard: if the user's BODY, after removing the blocked
    // words, has nothing readable left AND there is no media, it is not worth speaking — not even
    // announcing "{name} said" (xsaid) for a message that was only banned word(s).
    // (The actual redaction of what is synthesized — incl. expanded slang — happens in the req.)
    if (
      blocklist.length > 0 &&
      media.length === 0 &&
      !hasReadableText(redactBlocked(cleaned, blocklist))
    )
      return;

    // Server-wide word personalization is handled by /server-pronunciation (applied
    // inside prepareSpeech). The cleaned text passes through as-is as the base.
    let personal = cleaned;
    const translationPreference = getTranslationPreference(
      deps.db,
      message.guildId,
      message.author.id,
    );
    if (translationPreference.speakLocale && /[\p{L}\p{N}]/u.test(personal)) {
      const beforeSpeech = await translateTextForSpeech({
        db: deps.db,
        provider: deps.translationProvider,
        guildId: message.guildId,
        userId: message.author.id,
        text: personal,
        targetLocale: translationPreference.speakLocale,
      });
      personal = beforeSpeech.text;
    }

    // EN slang expansion, guild pronunciation and voice(s) choice — incl. the
    // MIXED synthesis when the message combines base-language + known EN slang
    // (the non-slang part is detected on its own; the EN slang comes out in an English voice as a
    // separate segment). The blocklist is applied afterwards, by REDACTING the req.
    const userVoice = getUserVoice(deps.db, message.guildId, message.author.id);
    // xsaid: announces "{name} said …" before the message — BUT does not repeat the name when the
    // SAME author sends CONSECUTIVE messages (compares with the last speaker read in this guild).
    // The read of `lastSpeaker` and the write (further down) are in the same synchronous block
    // (no await between them), so there is no race (avoids the competitor's bug #99).
    const lastSpeaker = deps.lastSpeaker?.get(message.guildId);
    const announce = cfg.xsaid && lastSpeaker !== message.author.id;
    // Name to announce: phonetic nickname (/voice nickname), otherwise the server's
    // displayName, otherwise the username — always SANITIZED for TTS (strips emojis/symbols).
    // If nothing readable is left, `speakerName` stays '' and xsaid does not announce (no name).
    const rawName =
      getNickname(deps.db, message.guildId, message.author.id) ??
      message.member?.displayName ??
      message.author.username ??
      '';
    const speakerName = sanitizeSpeakerName(rawName);
    const profileLocaleVoice = channelPolicy.locale
      ? deps.availableModels.find(
          (model) =>
            model.toLowerCase().startsWith(`${channelPolicy.locale!.toLowerCase()}_`) ||
            model.toLowerCase().startsWith(`${channelPolicy.locale!.toLowerCase()}-`),
        )
      : undefined;
    const { req } = prepareSpeech({
      personal,
      // The author's pronunciations FIRST (their term wins) + the SERVER's next.
      pronunciations: [
        ...getUserPronunciations(deps.db, message.author.id),
        ...getServerPronunciations(deps.db, message.guildId),
      ],
      userVoice,
      available: deps.availableModels,
      autoDetect: isDetectionOn(deps.db, message.guildId, message.author.id),
      guildDefaultVoice: channelPolicy.defaultVoice || profileLocaleVoice || '',
      defaultVoice: deps.config.defaultVoice,
      defaultSpeed: channelPolicy.speed ?? deps.config.defaultSpeed,
      media,
      announceSpeaker: announce ? speakerName : undefined,
    });
    // Engine chosen by the author (google default | piper | kokoro | gcloud). The shared
    // resolver demotes paid Kokoro/Google HD -> 'google' if Premium is not active (runtime
    // gate) and (Phase 3) attaches the budget descriptor — the TWO fields (engine +
    // gcloudBudget) are exactly what ResolvedEngine returns. The PerUserEngineRouter
    // dispatches by req.engine.
    const resolvedEngine = resolveUserEngine(
      deps.db,
      message.guildId,
      message.author.id,
      userVoice?.engine ?? channelPolicy.engine ?? undefined,
      Date.now(),
    );
    req.engine = resolvedEngine.engine;
    req.gcloudBudget = resolvedEngine.gcloudBudget;

    // Blocklist: instead of skipping the whole message, REDACTS the blocked words from the
    // text ACTUALLY spoken (req.text + segments) — Vozen reads the message WITHOUT saying
    // those words. If after redacting nothing readable is left (the message was only
    // blocked word(s)), it does not speak. (`blocklist` was already fetched in the guard above.)
    const redacted = redactRequest(req, blocklist);
    const readable =
      hasReadableText(redacted.text) ||
      (redacted.segments?.some((s) => hasReadableText(s.text)) ?? false);
    if (!readable) return;

    const outReq = redacted;
    outReq.streamSentences = true;
    // Voice effect (premium): applied to the WAV by the EffectEngine (external engine).
    const personalEffect = getVoiceEffect(deps.db, message.guildId, message.author.id);
    let effectiveEffect = personalEffect;
    if (personalEffect === 'none' && channelPolicy.effect && isVoiceEffect(channelPolicy.effect)) {
      const paidEffectAllowed =
        !isPremiumEffect(channelPolicy.effect) ||
        isUserPremium(deps.db, message.author.id, Date.now()) ||
        isGuildPremium(deps.db, message.guildId, Date.now());
      if (paidEffectAllowed) effectiveEffect = channelPolicy.effect;
    }
    outReq.effect = effectiveEffect;

    // Everything passed validation; queue acceptance below decides whether it counts as usage.

    // Startup silence: the bot only starts speaking `messageLeadMs` after the message
    // (silence PREPENDED to the WAV). Configurable (MESSAGE_LEAD_MS); 0 = no wait.
    if (deps.config.messageLeadMs > 0) outReq.leadSilenceMs = deps.config.messageLeadMs;

    const queued = await player.say(outReq, {
      authorId: message.author.id,
      source: 'message',
      lane: queuePolicy.lane,
    });

    // Everything below is usage/accounting for a request that ACTUALLY entered the queue. A full
    // queue must not change the leaderboard, last-speaker suppression, streaks, or voice stats.
    let talk: TalkBump | null = null;
    if (queued) {
      deps.lastSpeaker?.set(message.guildId, message.author.id);
      // Evaluate the anti-inflation gate only after queue acceptance: a rejected request must not
      // consume the user's one countable slot and suppress their next real message.
      const countsForStats =
        deps.countGate?.shouldCount(message.guildId, message.author.id, cleaned, Date.now()) ??
        true;
      if (countsForStats) {
        try {
          talk = bumpTalk(deps.db, message.guildId, message.author.id, new Date());
          // Effective base voice + engine after voice selection and Premium gating. Operational
          // synthesis fallbacks are deliberately not claimed as selected usage.
          bumpTalkUsage(
            deps.db,
            message.guildId,
            message.author.id,
            outReq.model,
            outReq.engine ?? 'google',
          );
        } catch (err) {
          log.warn('[messageHandler] failed to update speaker/voice statistics (ignored)', err);
        }
        // Per-server streak is independent best-effort and follows the fresh user bump.
        try {
          bumpGuildTalk(deps.db, message.guildId, new Date());
        } catch (err) {
          log.warn('[messageHandler] failed to update the server streak (ignored)', err);
        }
      }
    }

    // Streak 🔥 (F1, TikTok style): "Day N" notice ONLY on the 1st message of each day, from Day 2
    // onwards (announcing everyone's Day 1 every day would be spam), and only if the speech
    // was actually queued and the toggle is on. The mention is VISIBLE but does NOT ping
    // (empty allowedMentions, same as the leaderboard) — on a busy server, notifying
    // each person every day would be annoying. Best-effort: a failed send (no write permission
    // in the channel, etc.) can NEVER break the speech.
    if (queued && talk?.firstOfDay && talk.streak >= 2 && cfg.streakAnnounce) {
      try {
        const ch = message.channel;
        if ('send' in ch && typeof (ch as { send?: unknown }).send === 'function') {
          await (ch as { send: (c: unknown) => Promise<unknown> }).send(
            channelCard(t('streak.day', cfg.locale, { user: message.author.id, n: talk.streak }), {
              tone: 'success',
              allowedMentions: { parse: [] },
            }),
          );
        }
      } catch (err) {
        log.warn('[messageHandler] failed to announce the streak (ignored)', err);
      }
    }

    // Automatic leaderboard (F2): once in a while, Vozen posts the top chatterboxes in
    // the /setup channel. Triggered by ACTIVITY (only counts actually-read messages, in guilds with
    // a configured channel); the decider does the threshold + cooldown + draw. Mentions are
    // suppressed (an unsolicited post should not ping 10 people). Best-effort: a failed send
    // (no write permission, etc.) can NEVER break the speech.
    let automaticPostSent = false;
    if (queued && cfg.ttsChannelId && deps.leaderboardPoster?.record(message.guildId)) {
      try {
        const rows = getTopSpeakers(deps.db, message.guildId, new Date(), 10);
        const ch = deps.client.channels.cache.get(cfg.ttsChannelId);
        if (
          rows.length > 0 &&
          ch &&
          'send' in ch &&
          typeof (ch as { send?: unknown }).send === 'function'
        ) {
          await (ch as { send: (c: unknown) => Promise<unknown> }).send(
            channelCard(renderLeaderboard(rows, cfg.locale), {
              allowedMentions: { parse: [] },
            }),
          );
          automaticPostSent = true;
        }
      } catch (err) {
        log.warn('[messageHandler] failed to post the automatic leaderboard (ignored)', err);
      }
    }

    // Activity-driven promotional rotation in /setup. Admin-controlled and default-off.
    // One shared 24h slot alternates Top.gg -> support -> Top.gg, so the same card cannot
    // recur before 48h and both cards can never appear on the same day.
    if (
      queued &&
      !automaticPostSent &&
      cfg.ttsChannelId &&
      cfg.votePromos &&
      deps.config.clientId &&
      deps.votePromoPoster
    ) {
      try {
        const ch = deps.client.channels.cache.get(cfg.ttsChannelId);
        if (ch && 'send' in ch && typeof (ch as { send?: unknown }).send === 'function') {
          const promo = deps.votePromoPoster.record(message.guildId);
          if (promo) {
            const payload =
              promo === 'vote'
                ? votePromoMessage(cfg.locale, deps.config.clientId)
                : supportPromoMessage(cfg.locale, deps.config.supportUrl);
            await (ch as { send: (c: unknown) => Promise<unknown> }).send(payload);
          }
        }
      } catch (err) {
        log.warn('[messageHandler] failed to post the promotional reminder (ignored)', err);
      }
    }
  } catch (err) {
    log.error('[messageHandler] error', err);
  }
}
