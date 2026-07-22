import {
  ContainerBuilder,
  MessageFlags,
  TextDisplayBuilder,
  type ActionRowBuilder,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
  type InteractionUpdateOptions,
  type MessageActionRowComponentBuilder,
  type MessageCreateOptions,
  type MessageEditOptions,
  type MessageMentionOptions,
} from 'discord.js';
import { COLORS, type BrandColor } from './theme';

/** Semantic presentation variants shared by commands, automatic notices, and games. */
export type MessageTone = BrandColor | 'auto';

export interface CardOptions<Row extends MessageActionRowComponentBuilder> {
  /** `auto` reads a leading status symbol; otherwise the requested semantic color wins. */
  tone?: MessageTone;
  /** Interactive controls visually grouped inside the same container as their explanation. */
  rows?: readonly ActionRowBuilder<Row>[];
  /** Mention safety remains explicit even when the text lives in a Text Display component. */
  allowedMentions?: MessageMentionOptions;
}

const SUCCESS_MARKS = /^(?:✅|☑️|🎉|🥳|🟢|🟩)/u;
const WARNING_MARKS = /^(?:⚠️|⏳|🟡|🟨)/u;
const DANGER_MARKS = /^(?:❌|🚫|⛔|🛑|🔴|🟥)/u;
const PREMIUM_MARKS = /^(?:💎|👑)/u;

/**
 * Picks a semantic accent without parsing language-specific words. Color is supplementary:
 * the original text and status symbol remain visible for accessibility.
 */
export function toneFromContent(content: string): BrandColor {
  const start = content.trimStart();
  if (SUCCESS_MARKS.test(start)) return 'success';
  if (WARNING_MARKS.test(start)) return 'warning';
  if (DANGER_MARKS.test(start)) return 'danger';
  if (PREMIUM_MARKS.test(start)) return 'premium';
  return 'brand';
}

/**
 * Gives long one-line copy a clear lead and scannable follow-up lines. Existing Markdown,
 * multiline layouts, code blocks, and short status messages are left untouched.
 */
export function formatCardText(raw: string): string {
  const content = raw.trim();
  const minLength = /[。！？]/u.test(content) ? 48 : 88;
  if (
    content.length < minLength ||
    content.includes('\n') ||
    /^(?:#{1,3}\s|>|-|\*|_|`)/u.test(content)
  ) {
    return content;
  }

  const sentences = content
    .split(/(?<=[.!?])\s+|(?<=[。！？])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (sentences.length < 2 || sentences[0].length > 180) {
    return content;
  }

  const [lead, ...details] = sentences;
  const formattedLead = lead.includes('**') ? lead : `**${lead}**`;
  const formattedDetails = details.map((sentence) => {
    const metadata = sentence.match(/^\(([^()\n]*`[^`\n]+`[^()\n]*)\)$/u);
    return metadata ? `-# ${metadata[1]}` : sentence;
  });
  return [formattedLead, ...formattedDetails].join('\n');
}

function containerFor<Row extends MessageActionRowComponentBuilder>(
  content: string,
  options: CardOptions<Row>,
): ContainerBuilder {
  const tone = !options.tone || options.tone === 'auto' ? toneFromContent(content) : options.tone;
  const container = new ContainerBuilder()
    .setAccentColor(COLORS[tone])
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(formatCardText(content)));

  for (const row of options.rows ?? []) container.addActionRowComponents(row);
  return container;
}

/** Creates a Components V2 response, public unless `ephemeral` is requested. */
export function replyCard<Row extends MessageActionRowComponentBuilder>(
  content: string,
  options: CardOptions<Row> & { ephemeral?: boolean } = {},
): InteractionReplyOptions {
  return {
    components: [containerFor(content, options)],
    flags: options.ephemeral
      ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      : MessageFlags.IsComponentsV2,
    allowedMentions: options.allowedMentions ?? { parse: [] },
  };
}

/** Converts a deferred or existing interaction response into a Components V2 card. */
export function editCard<Row extends MessageActionRowComponentBuilder>(
  content: string,
  options: CardOptions<Row> = {},
): InteractionEditReplyOptions {
  return {
    components: [containerFor(content, options)],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: options.allowedMentions ?? { parse: [] },
  };
}

/** Updates a component-driven message while preserving its existing Components V2 flag. */
export function updateCard<Row extends MessageActionRowComponentBuilder>(
  content: string,
  options: CardOptions<Row> = {},
): InteractionUpdateOptions {
  return {
    components: [containerFor(content, options)],
    allowedMentions: options.allowedMentions ?? { parse: [] },
  };
}

/** Creates a Components V2 card for normal channel.send() calls. */
export function channelCard<Row extends MessageActionRowComponentBuilder>(
  content: string,
  options: CardOptions<Row> = {},
): MessageCreateOptions {
  return {
    components: [containerFor(content, options)],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: options.allowedMentions ?? { parse: [] },
  };
}

/** Replaces an existing bot-authored channel message with a Components V2 card. */
export function messageEditCard<Row extends MessageActionRowComponentBuilder>(
  content: string,
  options: CardOptions<Row> = {},
): MessageEditOptions {
  return {
    content: null,
    embeds: [],
    components: [containerFor(content, options)],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: options.allowedMentions ?? { parse: [] },
  };
}
