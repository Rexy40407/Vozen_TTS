import type { MessageReaction, PartialMessageReaction, PartialUser, User } from 'discord.js';
import type { BotDeps } from '../bot/deps';
import { translateExplicitText } from './explicit';

const FLAG_LOCALES: Readonly<Record<string, string>> = {
  '🇬🇧': 'en',
  '🇺🇸': 'en',
  '🇵🇹': 'pt',
  '🇧🇷': 'pt',
  '🇪🇸': 'es',
  '🇫🇷': 'fr',
  '🇩🇪': 'de',
  '🇮🇹': 'it',
  '🇳🇱': 'nl',
  '🇵🇱': 'pl',
  '🇹🇷': 'tr',
  '🇯🇵': 'ja',
  '🇰🇷': 'ko',
};

export function flagLocale(emoji: string | null | undefined): string | null {
  return emoji ? (FLAG_LOCALES[emoji] ?? null) : null;
}

/** An explicit flag reaction translates the visible message in-place; it never calls TTS. */
export async function handleTranslationReaction(
  rawReaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  deps: BotDeps,
): Promise<void> {
  if (user.bot) return;
  const locale = flagLocale(rawReaction.emoji.name);
  if (!locale) return;
  const reaction = rawReaction.partial ? await rawReaction.fetch().catch(() => null) : rawReaction;
  if (!reaction) return;
  const rawMessage = reaction.message;
  const message = rawMessage.partial ? await rawMessage.fetch().catch(() => null) : rawMessage;
  if (!message?.guildId || !message.content?.trim() || message.author?.bot || message.webhookId)
    return;

  const result = await translateExplicitText({
    db: deps.db,
    provider: deps.translationProvider,
    guildId: message.guildId,
    userId: user.id,
    text: message.content,
    targetLocale: locale,
  });
  if (!result.ok) return;
  await message
    .reply({
      content: `**Translation · ${locale}**\n${result.text.slice(0, 1_800)}`,
      allowedMentions: { parse: [] },
    })
    .catch(() => undefined);
}
