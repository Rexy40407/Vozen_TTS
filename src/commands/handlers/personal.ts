// src/commands/handlers/personal.ts — PERSONAL (non-admin) tools: /pronunciation
// (individual pronunciation dictionary, limits 3 Free / 50 Premium) and /randomizer
// (spoken draw). Both beginner-friendly: run WITHOUT options they open an interactive UI
// (modal / select menu) instead of an error — the /setup pattern.

import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  ComponentType,
  GuildMember,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ModalSubmitInteraction,
} from 'discord.js';
import type { BotDeps } from '../../bot/deps';
import {
  getUserPronunciations,
  addUserPronunciation,
  removeUserPronunciation,
  getServerPronunciations,
  addServerPronunciation,
  removeServerPronunciation,
  USER_PRON_LIMIT_FREE,
  USER_PRON_LIMIT_PREMIUM,
  SERVER_PRON_LIMIT,
  SERVER_PRON_LIMIT_PREMIUM,
} from '../../store/pronunciation';
import { isUserPremium, isGuildPremium } from '../../store/premium';
import { t } from '../../i18n/index';
import { voteUpsellLine } from '../voteUpsell';
import { voteRewardStatus } from '../../store/voteReward';
import { localeForUser, reply } from '../helpers';
import { speakRawText } from './core';
import { log } from '../../logging/logger';
import { editCard, replyCard } from '../../ui/messages';

const MODAL_WAIT_MS = 5 * 60_000; // modals can take a while — Discord allows up to ~15 min
const SELECT_WAIT_MS = 60_000;

/** This user's personal pronunciation limit HERE (Plus OR Premium server => 50). */
function pronLimitFor(deps: BotDeps, i: ChatInputCommandInteraction): number {
  const now = Date.now();
  const premium =
    isUserPremium(deps.db, i.user.id, now) ||
    (i.guildId ? isGuildPremium(deps.db, i.guildId, now) : false);
  return premium ? USER_PRON_LIMIT_PREMIUM : USER_PRON_LIMIT_FREE;
}

// ── /pronunciation ────────────────────────────────────────────────────────────────────

export async function handlePronunciation(
  i: ChatInputCommandInteraction,
  deps: BotDeps,
): Promise<void> {
  const locale = localeForUser(deps, i);
  const sub = i.options.getSubcommand();

  if (sub === 'list') {
    const dict = getUserPronunciations(deps.db, i.user.id);
    const limit = pronLimitFor(deps, i);
    const out = dict.length
      ? dict.map((e) => `- ${e.term} -> ${e.replacement}`).join('\n')
      : t('pron.listEmpty', locale);
    await reply(i, `${t('pron.listHeader', locale, { count: dict.length, limit })}\n${out}`);
    return;
  }

  if (sub === 'remove') {
    const term = i.options.getString('term', true).trim();
    const removed = removeUserPronunciation(deps.db, i.user.id, term);
    await reply(i, t(removed ? 'pron.removed' : 'pron.notFound', locale, { term }));
    return;
  }

  // sub === 'add': with both options it applies right away; WITHOUT them it opens a modal (beginner-friendly).
  const term = i.options.getString('term')?.trim() ?? '';
  const replacement = i.options.getString('say')?.trim() ?? '';
  if (term && replacement) {
    await applyAddPronunciation(i, deps, locale, term, replacement);
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`pronAdd:${i.id}`)
    .setTitle(t('pron.modalTitle', locale))
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('term')
          .setLabel(t('pron.modalTerm', locale))
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('say')
          .setLabel(t('pron.modalSay', locale))
          .setStyle(TextInputStyle.Short)
          .setMaxLength(200)
          .setRequired(true),
      ),
    );
  await i.showModal(modal);
  let submit: ModalSubmitInteraction;
  try {
    submit = await i.awaitModalSubmit({
      time: MODAL_WAIT_MS,
      filter: (m) => m.customId === `pronAdd:${i.id}` && m.user.id === i.user.id,
    });
  } catch {
    return; // timeout — the user closed the modal; nothing to say
  }
  const mTerm = submit.fields.getTextInputValue('term').trim();
  const mSay = submit.fields.getTextInputValue('say').trim();
  await applyAddPronunciation(submit, deps, locale, mTerm, mSay);
}

/** Applies the add (validation + limit + upsell) and replies to the given interaction. */
async function applyAddPronunciation(
  i: ChatInputCommandInteraction | ModalSubmitInteraction,
  deps: BotDeps,
  locale: string,
  term: string,
  replacement: string,
): Promise<void> {
  const send = async (content: string) => {
    if (i.replied || i.deferred) await i.followUp(replyCard(content, { ephemeral: true }));
    else await i.reply(replyCard(content, { ephemeral: true }));
  };
  if (!term || !replacement) {
    await send(t('pron.empty', locale));
    return;
  }
  const now = Date.now();
  const premium =
    isUserPremium(deps.db, i.user.id, now) ||
    (i.guildId ? isGuildPremium(deps.db, i.guildId, now) : false);
  const limit = premium ? USER_PRON_LIMIT_PREMIUM : USER_PRON_LIMIT_FREE;
  const res = addUserPronunciation(deps.db, i.user.id, term, replacement, limit);
  if (res === 'limit') {
    const parts = [t('pron.limitHit', locale, { limit })];
    if (!premium) {
      // Paid path + the one-time 48h vote reward while this account is eligible.
      parts.push(t('pron.limitUpsell', locale, { url: deps.config.kofiUrl }));
      const vote =
        deps.config.voteRedemptionSecret &&
        voteRewardStatus(deps.db, i.user.id, deps.config.voteRedemptionSecret).eligible
          ? voteUpsellLine(locale, deps.config.clientId)
          : null;
      if (vote) parts.push(vote);
    }
    await send(parts.join('\n'));
    return;
  }
  await send(t('pron.set', locale, { term, replacement }));
}

// ── /server-pronunciation (admin, cap 3 Free / 50 Premium, for the whole guild) ──────────

/** SERVER pronunciation limit: 50 with the guild Premium, 3 otherwise. */
function serverPronLimit(deps: BotDeps, guildId: string): number {
  return isGuildPremium(deps.db, guildId, Date.now())
    ? SERVER_PRON_LIMIT_PREMIUM
    : SERVER_PRON_LIMIT;
}

export async function handleServerPronunciation(
  i: ChatInputCommandInteraction,
  deps: BotDeps,
): Promise<void> {
  const locale = localeForUser(deps, i);
  const member = i.member as GuildMember;
  if (!member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
    await reply(i, t('error.needManageGuild', locale));
    return;
  }
  const sub = i.options.getSubcommand();

  if (sub === 'list') {
    const dict = getServerPronunciations(deps.db, i.guildId!);
    const out = dict.length
      ? dict.map((e) => `- ${e.term} -> ${e.replacement}`).join('\n')
      : t('spron.listEmpty', locale);
    await reply(
      i,
      `${t('spron.listHeader', locale, { count: dict.length, limit: serverPronLimit(deps, i.guildId!) })}\n${out}`,
    );
    return;
  }

  if (sub === 'remove') {
    const term = i.options.getString('term', true).trim();
    const removed = removeServerPronunciation(deps.db, i.guildId!, term);
    await reply(i, t(removed ? 'spron.removed' : 'spron.notFound', locale, { term }));
    return;
  }

  // add: with both options it applies right away; without them it opens a modal.
  const term = i.options.getString('term')?.trim() ?? '';
  const say = i.options.getString('say')?.trim() ?? '';
  if (term && say) {
    await applyAddServerPron(i, deps, locale, term, say);
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`spronAdd:${i.id}`)
    .setTitle(t('spron.modalTitle', locale))
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('term')
          .setLabel(t('pron.modalTerm', locale))
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('say')
          .setLabel(t('spron.modalSay', locale))
          .setStyle(TextInputStyle.Short)
          .setMaxLength(200)
          .setRequired(true),
      ),
    );
  await i.showModal(modal);
  let submit: ModalSubmitInteraction;
  try {
    submit = await i.awaitModalSubmit({
      time: MODAL_WAIT_MS,
      filter: (m) => m.customId === `spronAdd:${i.id}` && m.user.id === i.user.id,
    });
  } catch {
    return;
  }
  await applyAddServerPron(
    submit,
    deps,
    locale,
    submit.fields.getTextInputValue('term').trim(),
    submit.fields.getTextInputValue('say').trim(),
  );
}

/** Applies the server add (validation + cap 3/50) and replies to the given interaction. */
async function applyAddServerPron(
  i: ChatInputCommandInteraction | ModalSubmitInteraction,
  deps: BotDeps,
  locale: string,
  term: string,
  replacement: string,
): Promise<void> {
  const send = async (content: string) => {
    if (i.replied || i.deferred) await i.followUp(replyCard(content, { ephemeral: true }));
    else await i.reply(replyCard(content, { ephemeral: true }));
  };
  if (!term || !replacement) {
    await send(t('pron.empty', locale));
    return;
  }
  const limit = serverPronLimit(deps, i.guildId!);
  const res = addServerPronunciation(deps.db, i.guildId!, term, replacement, limit);
  if (res === 'limit') {
    await send(t('spron.limitHit', locale, { limit }));
    return;
  }
  await send(t('spron.set', locale, { term, replacement }));
}

// ── /randomizer ───────────────────────────────────────────────────────────────────────

/** Builds the randomizer modal: N "Option 1..N" fields. */
function randomizerModal(id: string, amount: number, locale: string): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`randFill:${id}`)
    .setTitle(t('rand.modalTitle', locale, { amount }));
  for (let n = 1; n <= amount; n++) {
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(`opt${n}`)
          .setLabel(t('rand.modalOption', locale, { n }))
          .setStyle(TextInputStyle.Short)
          .setMaxLength(120)
          .setRequired(true),
      ),
    );
  }
  return modal;
}

/** Draws and announces: speaks in the call if possible, otherwise replies by text. */
async function drawAndAnnounce(
  i: ChatInputCommandInteraction | ModalSubmitInteraction,
  deps: BotDeps,
  locale: string,
  options: string[],
): Promise<void> {
  const winner = options[Math.floor(Math.random() * options.length)];
  const line = t('rand.result', locale, { winner, count: options.length });
  let spoke = false;
  if (i.guildId && i.guild) {
    try {
      const outcome = await speakRawText(
        deps,
        i.guildId,
        i.user.id,
        i.guild,
        t('rand.speak', locale, { winner }),
        i.guild.members.cache.get(i.user.id)?.voice.channelId ?? null,
      );
      spoke = outcome.status === 'queued';
    } catch (err) {
      log.error('[randomizer] failed to speak the result; text response remains available', err);
    }
  }
  const content = `🎲 ${line}${spoke ? '' : `\n${t('rand.notInVoice', locale)}`}`;
  // PUBLIC reply on purpose: the draw is of interest to the channel, not just to whoever ran it.
  if (i.replied || i.deferred) await i.followUp(replyCard(content, { tone: 'success' }));
  else await i.reply(replyCard(content, { tone: 'success' }));
}

export async function handleRandomizer(
  i: ChatInputCommandInteraction,
  deps: BotDeps,
): Promise<void> {
  const locale = localeForUser(deps, i);

  // Path 1: comma-separated list (for >5 options or whoever prefers to type).
  const csv = i.options.getString('options')?.trim();
  if (csv) {
    const opts = csv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (opts.length < 2) {
      await reply(i, t('rand.needTwo', locale));
      return;
    }
    await drawAndAnnounce(i, deps, locale, opts.slice(0, 50));
    return;
  }

  // Path 2: `amount` given -> modal with N fields.
  let amount = i.options.getInteger('amount') ?? 0;

  // Path 3: NOTHING given -> select 2..5 (beginner-friendly), then the modal.
  if (!amount) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`randAmount:${i.id}`)
      .setPlaceholder(t('rand.selectPlaceholder', locale))
      .addOptions(
        [2, 3, 4, 5].map((n) => ({
          label: t('rand.selectOption', locale, { n }),
          value: String(n),
        })),
      );
    await i.reply(
      replyCard(t('rand.selectPrompt', locale), {
        ephemeral: true,
        rows: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
      }),
    );
    let picked;
    try {
      picked = await i.channel?.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: SELECT_WAIT_MS,
        filter: (c) => c.customId === `randAmount:${i.id}` && c.user.id === i.user.id,
      });
    } catch {
      await i.editReply(editCard(t('rand.timeout', locale), { tone: 'warning' })).catch(() => {});
      return;
    }
    if (!picked) return;
    amount = Number(picked.values[0]);
    // The modal MUST be the 1st response to the select interaction.
    await picked.showModal(randomizerModal(i.id, amount, locale));
    await i.editReply(editCard(t('rand.filling', locale))).catch(() => {});
    let submit: ModalSubmitInteraction;
    try {
      submit = await picked.awaitModalSubmit({
        time: MODAL_WAIT_MS,
        filter: (m) => m.customId === `randFill:${i.id}` && m.user.id === i.user.id,
      });
    } catch {
      return;
    }
    const opts: string[] = [];
    for (let n = 1; n <= amount; n++) opts.push(submit.fields.getTextInputValue(`opt${n}`).trim());
    await drawAndAnnounce(submit, deps, locale, opts.filter(Boolean));
    return;
  }

  // direct amount (2..5, validated by the command definition) -> modal right away.
  await i.showModal(randomizerModal(i.id, amount, locale));
  let submit: ModalSubmitInteraction;
  try {
    submit = await i.awaitModalSubmit({
      time: MODAL_WAIT_MS,
      filter: (m) => m.customId === `randFill:${i.id}` && m.user.id === i.user.id,
    });
  } catch {
    return;
  }
  const opts: string[] = [];
  for (let n = 1; n <= amount; n++) opts.push(submit.fields.getTextInputValue(`opt${n}`).trim());
  await drawAndAnnounce(submit, deps, locale, opts.filter(Boolean));
}
