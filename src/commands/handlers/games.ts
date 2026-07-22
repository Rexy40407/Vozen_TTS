// src/commands/handlers/games.ts — /game handler (play/stop/list/leaderboard/stats) extracted from index.ts (plan 015).
import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} from 'discord.js';
import type { BotDeps } from '../../bot/deps';
import { getPlayer } from '../../bot/deps';
import { brandEmbed, rankMedal } from '../../ui/theme';
import { editCard, replyCard } from '../../ui/messages';
import { isGuildPremium, isUserPremium } from '../../store/premium';
import { GAME_DEFS, gameById } from '../../games/index';
import { createGameThread, deleteChannelSafe } from '../../games/thread';
import { getLeaderboard, getUserScore, getUserRank } from '../../store/gameScore';
import { t } from '../../i18n/index';
import { localeForUser, reply } from '../helpers';

/**
 * /game — group mini-games. Subcommands:
 *  - play <game>   : starts a game (voice games require the bot in a call);
 *  - stop          : stops the active game (points from an aborted match don't count);
 *  - list          : lists the available games (derived from GAME_DEFS);
 *  - leaderboard   : top players of the server (persisted in game_score).
 *
 * START/STOP reply EPHEMERAL (ack to the invoker — the game itself speaks in the
 * channel for everyone). `list`/`leaderboard` are informational and shareable, so they
 * reply PUBLIC. All UI in the invoker's locale (localeForUser). The "needs a call" and
 * "there's already a game" gating is done here; the per-guild lock lives in the GameManager.
 */
export async function handleGame(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  const locale = localeForUser(deps, i);
  if (!deps.games) {
    // No games manager (should never happen in production — always injected at
    // bootstrap; defensive guard for tests that don't inject it).
    await reply(i, t('error.generic', locale));
    return;
  }
  const sub = i.options.getSubcommand();

  if (sub === 'play') {
    let gameId = i.options.getString('game');
    if (!gameId) {
      // Beginner-friendly (plan v4): /game play with no game shows a SELECT with the games
      // (localized name), as /setup does with the channel. Only then do we follow the normal flow.
      const select = new StringSelectMenuBuilder()
        .setCustomId(`gamePick:${i.id}`)
        .setPlaceholder(t('game.pickPlaceholder', locale))
        .addOptions(
          GAME_DEFS.slice(0, 25).map((g) => ({
            label: t(g.nameKey, locale),
            description: t(g.descKey, locale).slice(0, 100),
            value: g.id,
          })),
        );
      await i.reply(
        replyCard(t('game.pickPrompt', locale), {
          ephemeral: true,
          rows: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
        }),
      );
      let picked;
      try {
        picked = await i.channel?.awaitMessageComponent({
          componentType: ComponentType.StringSelect,
          time: 60_000,
          filter: (c) => c.customId === `gamePick:${i.id}` && c.user.id === i.user.id,
        });
      } catch {
        await i
          .editReply(editCard(t('game.pickTimeout', locale), { tone: 'warning' }))
          .catch(() => {});
        return;
      }
      if (!picked) return;
      await picked.deferUpdate(); // the UI continues via i.editReply (same ephemeral message)
      await i.editReply(editCard(t('game.pickPrompt', locale))).catch(() => {});
      gameId = picked.values[0];
    } else {
      // IMMEDIATE ack: creating the thread is a REST call that on a slow gateway blows
      // through the interaction token's 3s (10062 Unknown interaction) with the game ALREADY
      // created. deferReply buys 15 min; ALL replies in this branch switch to editReply.
      await i.deferReply({ flags: MessageFlags.Ephemeral });
    }
    const def = gameById(gameId);
    if (!def) {
      await i.editReply(editCard(t('game.unknownGame', locale), { tone: 'danger' }));
      return;
    }
    // Voice games require the bot in a call (like /tts): no player, nothing to announce.
    if (def.needsVoice && !getPlayer(deps, i.guildId!)) {
      await i.editReply(editCard(t('game.start.needVoice', locale), { tone: 'warning' }));
      return;
    }
    // 💎 Premium games (e.g. chess): the user's own Plus OR the server's Premium, same
    // pattern as /voice effect.
    if (def.premium) {
      const now = Date.now();
      const premium =
        isUserPremium(deps.db, i.user.id, now) || isGuildPremium(deps.db, i.guildId!, now);
      if (!premium) {
        await i.editReply(
          editCard(t('game.start.premiumLocked', locale, { game: t(def.nameKey, locale) }), {
            tone: 'premium',
          }),
        );
        return;
      }
    }
    // Check the lock BEFORE creating the thread (avoids an orphan thread in the common case
    // of a game already existing). There's a tiny window until the real start (which is the
    // real gate); if we lose it, we delete the orphan thread below.
    if (deps.games.active(i.guildId!)) {
      const ch = deps.games.channelOf(i.guildId!) ?? i.channelId;
      await i.editReply(
        editCard(t('game.start.alreadyActive', locale, { channel: ch }), { tone: 'warning' }),
      );
      return;
    }
    // Large servers flood the channel with the game's messages — we run it in a disposable
    // THREAD created from this channel. Fallback (voice/DM channel, no permissions): plays
    // in the channel itself, as before.
    const gameName = t(def.nameKey, locale);
    const threadId = await createGameThread(i.channel, `🎮 ${gameName}`);
    const gameChannelId = threadId ?? i.channelId;

    // Game locale = that of WHOEVER starts it (localeForUser), not the guild's — so a
    // server without /config language plays in the language of whoever clicked (e.g.: PT).
    // The `language` option is only used by word-chain; if omitted, it falls back to the
    // starter's locale (the game's resolveLang maps unsupported languages to English). The
    // other games ignore opts (create() with no parameters remains valid).
    const chosenLang = i.options.getString('language') ?? undefined;
    const res = deps.games.start(
      i.guildId!,
      gameChannelId,
      def.create({ language: chosenLang ?? locale }),
      def.needsVoice,
      locale,
      threadId ? i.channelId : undefined, // parent channel only when running in a thread
      i.user.id,
    );
    if (res === 'already-active') {
      // We lost the race after the active() above — clean up the thread we just created.
      if (threadId) void deleteChannelSafe(i.client, threadId);
      const ch = deps.games.channelOf(i.guildId!) ?? i.channelId;
      await i.editReply(
        editCard(t('game.start.alreadyActive', locale, { channel: ch }), { tone: 'warning' }),
      );
      return;
    }
    await i.editReply(
      editCard(
        threadId
          ? t('game.start.startedThread', locale, { game: gameName, channel: threadId })
          : t('game.start.started', locale, { game: gameName }),
        { tone: 'success' },
      ),
    );
    return;
  }

  if (sub === 'stop') {
    // Only the starter or a server manager may stop a game. This prevents trolling
    // while ensuring a regular member is never trapped in a game they created.
    const canManage = i.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
    if (!canManage && !deps.games.isStarter(i.guildId!, i.user.id)) {
      await reply(i, t('error.needManageGuild', locale));
      return;
    }
    const ok = deps.games.stop(i.guildId!);
    await reply(i, ok ? t('game.stop.ok', locale) : t('game.stop.none', locale));
    return;
  }

  if (sub === 'list') {
    const lines = GAME_DEFS.map((g) =>
      t('game.list.line', locale, { name: t(g.nameKey, locale), desc: t(g.descKey, locale) }),
    );
    await i.reply({
      embeds: [brandEmbed().setDescription(`${t('game.list.title', locale)}\n${lines.join('\n')}`)],
    });
    return;
  }

  if (sub === 'leaderboard') {
    const rows = getLeaderboard(deps.db, i.guildId!, 10);
    if (rows.length === 0) {
      await reply(i, t('game.leaderboard.empty', locale));
      return;
    }
    const lines = rows.map((r, idx) =>
      t('game.leaderboard.line', locale, {
        rank: rankMedal(idx + 1),
        user: r.userId,
        points: r.points,
        wins: r.wins,
      }),
    );
    await i.reply({
      embeds: [
        brandEmbed().setDescription(`${t('game.leaderboard.title', locale)}\n${lines.join('\n')}`),
      ],
    });
    return;
  }

  if (sub === 'stats') {
    // The user's OWN stats (ephemeral): points, wins and ranking position.
    const score = getUserScore(deps.db, i.guildId!, i.user.id);
    const { rank, total } = getUserRank(deps.db, i.guildId!, i.user.id);
    if (score.points === 0 && score.wins === 0) {
      await reply(i, t('game.stats.none', locale));
      return;
    }
    const rankStr = rank
      ? t('game.stats.rank', locale, { rank, total })
      : t('game.stats.unranked', locale);
    await i.reply({
      embeds: [
        brandEmbed().setDescription(
          t('game.stats.body', locale, { points: score.points, wins: score.wins, rank: rankStr }),
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
}
