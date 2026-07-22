// src/commands/handlers/transcribe.ts — /transcribe handler (STT, Phase 4).
//
// /transcribe start|stop|revoke. START (Manage-Guild + Premium): un-deafens the bot
// (selfDeaf:false — WITHOUT this it hears nothing), starts a TranscriptionSession and posts an
// ANNOUNCEMENT with an inline consent button (only the person themselves clicks it, records stt_consent).
// Consent-first: whoever did not consent is never transcribed; whoever consents is remembered forever
// on that server. STOP restores selfDeaf:true and announces. Auto-stops when no consented person
// remains in the call (or the call empties). Without the Whisper sidecar => "unavailable" (inert).
import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  type Message,
} from 'discord.js';
import { getVoiceConnection, type VoiceConnection } from '@discordjs/voice';
import type { BotDeps } from '../../bot/deps';
import { resolveWhisperCmd, DEFAULT_WHISPER_MODEL } from '../../voice/whisperSidecar';
import { WhisperTranscriber, globalSttSemaphore } from '../../voice/whisperTranscriber';
import { TranscriptionSession, makeReceiverCapture } from '../../voice/transcriptionSession';
import { pcmToWavFile } from '../../voice/recorder';
import { hasSttConsent, grantSttConsent, revokeSttConsent } from '../../store/sttConsent';
import { isGuildPremium } from '../../store/premium';
import { evaluateTranscribeStart, shouldAutoStop, resolveTranscribeLang } from '../transcribeGate';
import { addOperationalMetric } from '../../store/operationalMetrics';
import { sanitizeSpeakerName } from '../../language/speakerName';
import { localeFor, localeForUser, reply } from '../helpers';
import { t } from '../../i18n/index';
import { log } from '../../logging/logger';
import { channelCard, editCard, messageEditCard, replyCard } from '../../ui/messages';

interface ActiveSession {
  session: TranscriptionSession;
  transcriber: WhisperTranscriber;
  connection: VoiceConnection;
  /** Voice channel where the bot is (to restore selfDeaf on stop). */
  voiceChannelId: string;
  onSpeaking: (userId: string) => void;
  announceMsg: Message;
  collector: { stop: (reason?: string) => void };
  autoStopTimer: ReturnType<typeof setInterval> | null;
  everConsented: boolean;
  /** Releases the permit of the GLOBAL STT cap (plan 029) — idempotent, callable one or more times. */
  releaseSttSlot: () => void;
  /** Locale used to render the public recording-state card when the session ends. */
  locale: string;
}

// One transcription session per server.
const activeSessions = new Map<string, ActiveSession>();
// Guilds with a /transcribe start IN PROGRESS (reserved before the 1st await, released
// in the finally). Without this, two nearly simultaneous `start`s read `activeSessions` BEFORE
// `activeSessions.set` runs (which only happens after the await on the announcement) and both passed
// the gate — duplicating the speaking listener (duplicate transcription + orphan session).
const startingGuilds = new Set<string>();

/** Ids of the HUMANS (non-bots) in the voice channel where the bot is. */
function humanIdsInVoice(i: ChatInputCommandInteraction, channelId: string): string[] {
  const ch = i.guild?.channels.cache.get(channelId);
  if (!ch || !ch.isVoiceBased()) return [];
  return [...ch.members.values()].filter((m) => !m.user.bot).map((m) => m.id);
}

export async function handleTranscribe(
  i: ChatInputCommandInteraction,
  deps: BotDeps,
): Promise<void> {
  const locale = localeForUser(deps, i);
  const guildId = i.guildId;
  if (!guildId) {
    await reply(i, t('stt.guildOnly', locale));
    return;
  }
  const sub = i.options.getSubcommand();

  if (sub === 'revoke') {
    const had = revokeSttConsent(deps.db, i.user.id, guildId);
    await reply(i, t(had ? 'stt.revoked' : 'stt.revokeNone', locale));
    return;
  }

  if (sub === 'stop') {
    if (!(i.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false)) {
      await reply(i, t('stt.noManage', locale));
      return;
    }
    const stopped = await stopSession(guildId, 'command');
    await reply(i, t(stopped ? 'stt.stopped' : 'stt.notRunning', locale));
    return;
  }

  // sub === 'start'
  const cmd = resolveWhisperCmd(process.env.WHISPER_MODEL || DEFAULT_WHISPER_MODEL);
  const connection = getVoiceConnection(guildId) ?? null;
  const verdict = evaluateTranscribeStart({
    canManage: i.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false,
    isPremium: isGuildPremium(deps.db, guildId, Date.now()),
    sidecarAvailable: cmd !== null,
    botInVoice: connection !== null,
    alreadyRunning: activeSessions.has(guildId) || startingGuilds.has(guildId),
    // Peek WITHOUT reserving (synchronous, no IO — evaluateTranscribeStart must stay pure).
    // The real reservation (tryAcquire) only happens after the gate says 'ok', further below.
    atCapacity: globalSttSemaphore.available <= 0,
  });
  if (verdict !== 'ok') {
    const key = {
      noManage: 'stt.noManage',
      notPremium: 'stt.notPremium',
      unavailable: 'stt.unavailable',
      notInVoice: 'stt.notInVoice',
      alreadyRunning: 'stt.alreadyRunning',
      atCapacity: 'stt.atCapacity',
    }[verdict];
    await reply(i, t(key, locale));
    return;
  }
  // Reserve the GLOBAL permit (STT concurrency cap, plan 029/ABUSE-01) and the guild — BOTH
  // WITHOUT any await in between, just like the peek above. `tryAcquire` is synchronous and should
  // never fail right after the peek (Node is single-threaded, there is no await between the
  // two); the `if` is just a safety net in case this ever stops being true.
  const releaseSttSlot = globalSttSemaphore.tryAcquire();
  if (!releaseSttSlot) {
    await reply(i, t('stt.atCapacity', locale));
    return;
  }
  // Reserve the guild NOW (before any await) — two nearly simultaneous /transcribe start
  // both passed the gate above and duplicated listeners without this reservation. The
  // finally covers EVERY early-return below
  // (noChannel, notInVoice) and the happy path — as soon as activeSessions.set runs,
  // that entry becomes enough to count as "already running".
  startingGuilds.add(guildId);

  // From here on verdict==='ok' guarantees cmd and connection are non-null.
  const conn = connection as VoiceConnection;
  // Error-rollback state (plan 029, part B/DISCORD-02): each variable documents
  // how far the session got, so the catch only undoes what was actually done.
  let voiceChannelId: string | null = null;
  let transcriber: WhisperTranscriber | null = null;
  let onSpeaking: ((uid: string) => void) | null = null;
  let undeafened = false;
  // true as soon as activeSessions.set() runs — from then on stopTranscriptionForGuild
  // becomes the SOLE owner of teardown (prevents the catch below from cleaning up twice).
  let handedOff = false;
  try {
    // Defer NOW (ephemeral): from here on there is IO that may be slow/fail (the announcement in
    // the channel) — without this, the interaction's 3s would blow past before we could respond.
    await i.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = i.channel;
    if (!channel || !channel.isTextBased() || channel.isDMBased() || !('send' in channel)) {
      await i.editReply(editCard(t('stt.noChannel', locale), { tone: 'danger' }));
      return;
    }

    const vcid = conn.joinConfig.channelId;
    if (!vcid) {
      await i.editReply(editCard(t('stt.notInVoice', locale), { tone: 'warning' }));
      return;
    }
    voiceChannelId = vcid;

    // FORCE the transcription language: the one chosen in `language:` wins; otherwise the server's
    // locale (2 letters, e.g. 'pt'). Whisper's auto-detection on short real speech transcribes
    // badly (PT comes out as Czech/Swedish); the sidecar falls back to auto-detection if the language is invalid.
    const lang = resolveTranscribeLang(i.options.getString('language'), localeFor(deps, guildId));
    if (cmd) cmd.args.push('--lang', lang);
    const tr = new WhisperTranscriber(cmd);
    transcriber = tr;
    tr.prewarm();

    // Un-deafen the bot ONLY now (otherwise the receiver receives no audio). selfMute stays
    // FALSE as in every other join/rejoin — a self-muted bot does not transmit audio,
    // which would silence the entire guild's TTS during transcription.
    conn.rejoin({ channelId: voiceChannelId, selfDeaf: false, selfMute: false });
    // Plan 029 invariant: from here on, IF something fails, the catch MUST deafen
    // again — otherwise the bot stays listening with no registered session (DISCORD-02).
    undeafened = true;

    const session = new TranscriptionSession({
      hasConsent: (uid) => hasSttConsent(deps.db, uid, guildId),
      displayName: (uid) => {
        const m = i.guild?.members.cache.get(uid);
        return sanitizeSpeakerName(m?.displayName ?? m?.user.username ?? uid);
      },
      transcribe: (wav) => tr.transcribe(wav),
      post: (text) =>
        channel.send({ content: text, allowedMentions: { parse: [] } }).then(() => {}),
      toWav: (pcm, out) => pcmToWavFile(pcm, out),
      capture: makeReceiverCapture(conn),
      recordAudioMs: (value) => addOperationalMetric(deps.db, 'stt_audio_ms', 'internal', value),
    });

    const speakingHandler = (uid: string): void => {
      void session.onSpeakingStart(uid);
    };
    onSpeaking = speakingHandler;
    conn.receiver.speaking.on('start', speakingHandler);

    // Announcement in the channel WITH the inline consent button (transparency + 1-click in the call).
    const consentRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('sttconsent')
        .setLabel(t('stt.consentBtn', locale))
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
    );
    // MAY THROW (SendMessages lost, rate-limit, network failure) — this is exactly the case
    // the catch below handles (DISCORD-02: bot stays un-deafened and listening with no session).
    const announceMsg = await channel.send(
      channelCard(t('stt.announceStart', locale), {
        tone: 'warning',
        rows: [consentRow],
      }),
    );

    const collector = announceMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
    });
    const active: ActiveSession = {
      session,
      transcriber: tr,
      connection: conn,
      voiceChannelId,
      onSpeaking: speakingHandler,
      announceMsg,
      collector,
      autoStopTimer: null,
      everConsented: false,
      releaseSttSlot,
      locale,
    };
    activeSessions.set(guildId, active);
    handedOff = true;

    collector.on('collect', (btn) => {
      grantSttConsent(deps.db, btn.user.id, guildId, Date.now());
      active.everConsented = true;
      void btn.reply(
        replyCard(t('stt.consentThanks', localeForUser(deps, btn)), {
          ephemeral: true,
          tone: 'success',
        }),
      );
    });

    // Auto-stop: periodically checks whether it still makes sense to continue (empty call, or
    // no consented person remains after there has already been consent).
    active.autoStopTimer = setInterval(() => {
      const humans = humanIdsInVoice(i, voiceChannelId!);
      if (
        shouldAutoStop(humans, (uid) => hasSttConsent(deps.db, uid, guildId), active.everConsented)
      ) {
        void stopSession(guildId, 'auto');
      }
    }, 15_000);
    active.autoStopTimer.unref?.();

    await i.editReply(editCard(t('stt.started', locale), { tone: 'success' }));
  } catch (err) {
    // Error teardown (plan 029, part B/DISCORD-02). If `handedOff` is false, the session
    // NEVER reached `activeSessions` — neither /transcribe stop nor the voice-left funnel
    // (stopTranscriptionForGuild) knows it exists, so the cleanup MUST run
    // here. Guaranteed invariant: if the bot ever un-deafened, this catch ALWAYS
    // deafens again, even when the announcement's `channel.send` fails. The release of the
    // global permit is in the `finally` below (also covers the early-returns without throw).
    log.warn(`[stt] failed to start session (guild ${guildId}):`, err);
    if (!handedOff) {
      if (onSpeaking) {
        try {
          conn.receiver.speaking.off('start', onSpeaking);
        } catch {
          // connection may have died in the meantime — harmless
        }
      }
      if (undeafened && voiceChannelId) {
        try {
          conn.rejoin({ channelId: voiceChannelId, selfDeaf: true, selfMute: false });
        } catch {
          // connection may have died in the meantime — harmless
        }
      }
      transcriber?.dispose();
      // We only report "failed, undid everything" when THAT is true. If `handedOff` was already
      // true here, the session is registered and alive (the only thing that could have thrown after
      // that is the final `editReply(stt.started)`) — lying "nothing is being recorded"
      // would contradict the very trust invariant of plan 029/DISCORD-02.
      await i.editReply(editCard(t('stt.startFailed', locale), { tone: 'danger' })).catch(() => {});
    }
  } finally {
    // Release the global permit IF the session never reached `activeSessions` — covers BOTH
    // the early-returns above (noChannel, notInVoice, no throw) AND the catch (channel.send
    // failed). `releaseSttSlot` is idempotent (Semaphore.makeRelease), so even if
    // the catch also called it there would be no double-release (029 stop: never
    // let the counter go negative/block STT).
    if (!handedOff) releaseSttSlot();
    startingGuilds.delete(guildId);
  }
}

/**
 * External teardown: called by the voice-exit FUNNEL (removePlayer) when the bot
 * leaves the call (kick, /leave, left-because-alone) mid-transcription. Best-
 * -effort and idempotent (no-op if there was no session) — does NOT attempt `rejoin` (the connection
 * has already died at that point) nor announce in the channel, unlike stopSession.
 */
export function stopTranscriptionForGuild(guildId: string): void {
  const a = activeSessions.get(guildId);
  if (!a) return;
  activeSessions.delete(guildId);
  a.session.stop();
  try {
    a.connection.receiver.speaking.off('start', a.onSpeaking);
  } catch {
    // connection may have already died
  }
  a.collector.stop('voice-left');
  if (a.autoStopTimer) clearInterval(a.autoStopTimer);
  a.transcriber.dispose();
  // Releases the permit of the GLOBAL STT cap (plan 029) — this is the FUNNEL where EVERY session
  // registered in `activeSessions` eventually passes (stop() calls it too, see below).
  // Idempotent: even if something called it twice, it does not over-release.
  a.releaseSttSlot();
  a.announceMsg
    .edit(messageEditCard(t('stt.announceStop', a.locale), { tone: 'warning' }))
    .catch(() => {});
}

/** Stops the server's session: restores selfDeaf, clears listeners/timers, announces. */
async function stopSession(guildId: string, _reason: 'command' | 'auto'): Promise<boolean> {
  const a = activeSessions.get(guildId);
  if (!a) return false;
  stopTranscriptionForGuild(guildId);
  // Deafen the bot again (stops listening) — only here, because only here the connection
  // still exists (the voice-exit teardown above must NEVER attempt a rejoin on it).
  try {
    a.connection.rejoin({ channelId: a.voiceChannelId, selfDeaf: true, selfMute: false });
  } catch {
    // the connection may have already dropped
  }
  log.info(`[stt] session stopped (guild ${guildId}, ${_reason})`);
  return true;
}
