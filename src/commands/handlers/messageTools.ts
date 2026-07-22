import { MessageFlags, type MessageContextMenuCommandInteraction } from 'discord.js';
import type { BotDeps } from '../../bot/deps';
import { isGuildPremium, isUserPremium } from '../../store/premium';
import { addOperationalMetric } from '../../store/operationalMetrics';
import { getTranslationPreference } from '../../store/translation';
import { SUPPORTED_LOCALES } from '../../i18n/index';
import { translateExplicitText } from '../../translation/explicit';
import {
  transcribeDiscordAudioAttachment,
  type AttachmentTranscriptionDeps,
  type DiscordAudioAttachment,
} from '../../voice/attachmentTranscription';
import { DEFAULT_WHISPER_MODEL, resolveWhisperCmd } from '../../voice/whisperSidecar';
import { globalSttSemaphore, WhisperTranscriber } from '../../voice/whisperTranscriber';

interface OneShotTranscriber {
  prewarm(): void;
  transcribe(path: string): Promise<{ text: string; lang: string }>;
  dispose(): void;
}

export interface MessageTranscriptionRuntime {
  resolveCommand: () => { exe: string; args: string[] } | null;
  acquire: () => (() => void) | null;
  createTranscriber: (command: { exe: string; args: string[] }) => OneShotTranscriber;
  run: typeof transcribeDiscordAudioAttachment;
  recordAudioMs: (value: number) => void;
  limits: (
    interaction: MessageContextMenuCommandInteraction,
    deps: BotDeps,
  ) => {
    maxBytes: number;
    maxSeconds: number;
  };
}

/** Explicit translation of the selected message. This path never joins voice or queues TTS. */
export async function handleTranslateMessage(
  i: MessageContextMenuCommandInteraction,
  deps: BotDeps,
): Promise<void> {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const text = i.targetMessage.content?.trim();
  if (!text) {
    await i.editReply('This message has no readable text.');
    return;
  }
  const scope = i.guildId ?? '@user-app';
  const preferred = getTranslationPreference(deps.db, scope, i.user.id).locale;
  const discordLocale = i.locale.split('-', 1)[0].toLowerCase();
  const targetLocale =
    preferred ??
    (SUPPORTED_LOCALES.includes(discordLocale as (typeof SUPPORTED_LOCALES)[number])
      ? discordLocale
      : 'en');
  const result = await translateExplicitText({
    db: deps.db,
    provider: deps.translationProvider,
    guildId: i.guildId,
    userId: i.user.id,
    text,
    targetLocale,
  });
  const content = result.ok
    ? `**Translation · ${targetLocale}**\n${result.text.replace(/```/g, "'''").slice(0, 1_800)}`
    : result.reason === 'quota'
      ? 'Your rolling 30-day translation limit has been reached.'
      : result.reason === 'empty'
        ? 'This message has no readable text.'
        : 'Translation is temporarily unavailable.';
  await i.editReply({ content, allowedMentions: { parse: [] } });
}

function defaultRuntime(deps: BotDeps): MessageTranscriptionRuntime {
  return {
    resolveCommand: () => resolveWhisperCmd(process.env.WHISPER_MODEL || DEFAULT_WHISPER_MODEL),
    acquire: () => globalSttSemaphore.tryAcquire(),
    createTranscriber: (command) => new WhisperTranscriber(command),
    run: transcribeDiscordAudioAttachment,
    recordAudioMs: (value) => addOperationalMetric(deps.db, 'stt_audio_ms', 'internal', value),
    limits: (interaction) => {
      const now = Date.now();
      const paid =
        isUserPremium(deps.db, interaction.user.id, now) ||
        (interaction.guildId ? isGuildPremium(deps.db, interaction.guildId, now) : false);
      return paid
        ? { maxBytes: 20 * 1024 * 1024, maxSeconds: 120 }
        : { maxBytes: 8 * 1024 * 1024, maxSeconds: 60 };
    },
  };
}

function firstAudioAttachment(
  i: MessageContextMenuCommandInteraction,
): DiscordAudioAttachment | null {
  for (const attachment of i.targetMessage.attachments.values()) {
    if (!attachment.contentType?.toLowerCase().startsWith('audio/')) continue;
    return { url: attachment.url, contentType: attachment.contentType, size: attachment.size };
  }
  return null;
}

/** Explicit, one-shot transcription of an already-posted Discord voice/audio attachment. */
export async function handleTranscribeVoiceMessage(
  i: MessageContextMenuCommandInteraction,
  deps: BotDeps,
  injected?: MessageTranscriptionRuntime,
): Promise<void> {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const attachment = firstAudioAttachment(i);
  if (!attachment) {
    await i.editReply('This message has no supported audio attachment.');
    return;
  }
  const runtime = injected ?? defaultRuntime(deps);
  const command = runtime.resolveCommand();
  if (!command) {
    await i.editReply('Voice-message transcription is temporarily unavailable.');
    return;
  }
  const release = runtime.acquire();
  if (!release) {
    await i.editReply('Transcription is busy. Please try again in a moment.');
    return;
  }
  const transcriber = runtime.createTranscriber(command);
  try {
    transcriber.prewarm();
    const limits = runtime.limits(i, deps);
    const result = await runtime.run(attachment, {
      ...limits,
      transcribe: (wavPath) => transcriber.transcribe(wavPath),
    } as AttachmentTranscriptionDeps);
    if (!result.ok) {
      const detail =
        result.reason === 'duration'
          ? `Audio must be ${limits.maxSeconds} seconds or shorter.`
          : result.reason === 'size'
            ? `Audio must be ${Math.floor(limits.maxBytes / 1024 / 1024)} MB or smaller.`
            : result.reason === 'host' || result.reason === 'url' || result.reason === 'type'
              ? 'Only Discord-hosted MP3, OGG, WAV, M4A or WebM audio is supported.'
              : 'The audio could not be transcribed. Please try another file.';
      await i.editReply(detail);
      return;
    }
    runtime.recordAudioMs(result.durationMs);
    const text = result.text.replace(/```/g, "'''").slice(0, 1_800);
    await i.editReply({
      content: text
        ? `**Transcript${result.language ? ` · ${result.language}` : ''}**\n${text}`
        : 'No clear speech was found in this audio.',
      allowedMentions: { parse: [] },
    });
  } finally {
    transcriber.dispose();
    release();
  }
}
