// src/commands/handlers/meta.ts — informational/growth handlers: /help, /invite, /vote, /uptime, /bot-stats, /top-speakers, /premium, /vozen-grant (extracted from index.ts, plan 015).
import {
  ChatInputCommandInteraction,
  GuildMember,
  PermissionFlagsBits,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import type { BotDeps } from '../../bot/deps';
import { metrics } from '../../metrics';
import { brandEmbed } from '../../ui/theme';
import { editCard, replyCard, updateCard } from '../../ui/messages';
import { getTopSpeakers } from '../../store/talkStats';
import { buildServerStats } from '../../store/serverStats';
import {
  getUserPremiumExpiry,
  isGuildPremium,
  isUserPremium,
  effectiveGuildPremiumExpiry,
  getPremiumPass,
  countActiveSeats,
  listPassActivations,
  activateSeat,
  deactivateSeat,
  grantGuildPass,
  grantUserPremium,
} from '../../store/premium';
import { randomInt } from 'node:crypto';
import { t } from '../../i18n/index';
import { INVITE_PERMISSIONS, formatDuration, localeForUser, reply } from '../helpers';
import { commandDefs } from '../definitions';
import { insertPremiumCode, redeemPremiumCode } from '../../store/premiumCode';
import { generateCodeString, normalizeCode } from '../../premium/codeGen';
import { voteRewardStatus } from '../../store/voteReward';
import { voteUpsellLine } from '../voteUpsell';

/** Public repo (AGPL-3.0 §13: in-product Corresponding Source offer, see /help). */
const SOURCE_URL = 'https://github.com/Rexy40407/discord-bot-Vozen';

/**
 * /top-speakers — public ranking of who had the most messages READ by Vozen in this guild,
 * with each one's streak (consecutive days speaking). Same rendering as the game leaderboard
 * (<@id> + i18n lines). Empty -> a message inviting people to speak.
 */
export async function handleTopSpeakers(
  i: ChatInputCommandInteraction,
  deps: BotDeps,
): Promise<void> {
  const locale = localeForUser(deps, i);
  const rows = getTopSpeakers(deps.db, i.guildId!, new Date(), 10);
  if (rows.length === 0) {
    await reply(i, t('topspeakers.empty', locale));
    return;
  }
  const lines = rows.map((r, idx) =>
    t('topspeakers.line', locale, {
      rank: idx + 1,
      user: r.userId,
      count: r.count,
      streak: r.streak,
    }),
  );
  await i.reply(
    replyCard(`${t('topspeakers.title', locale)}\n${lines.join('\n')}`, {
      allowedMentions: { parse: [] },
    }),
  );
}

/**
 * /server-stats — AGGREGATED server statistics. Premium perk: a Premium server (or a Plus
 * user) sees everything (reads + streaks + games); free sees a TEASER (top-3 talkers +
 * upsell) to discover the perk. Only aggregates data that is ALREADY stored (talk_stats +
 * game_score) — no new collection; see docs/COMPLIANCE-VAGA5.md. The <@id> do NOT ping
 * (allowedMentions []).
 */
export async function handleServerStats(
  i: ChatInputCommandInteraction,
  deps: BotDeps,
): Promise<void> {
  const locale = localeForUser(deps, i);
  const now = Date.now();
  const premium =
    isGuildPremium(deps.db, i.guildId!, now) || isUserPremium(deps.db, i.user.id, now);
  const s = buildServerStats(deps.db, i.guildId!, new Date(now), premium ? 5 : 3);

  if (s.totalMessages === 0 && s.gamePlayers === 0) {
    await reply(i, t('serverstats.empty', locale));
    return;
  }

  const lines: string[] = [
    t('serverstats.title', locale),
    t('serverstats.messages', locale, { total: s.totalMessages, speakers: s.activeSpeakers }),
  ];
  if (s.topSpeakers.length) {
    lines.push(t('serverstats.topTalkers', locale));
    s.topSpeakers.forEach((r, idx) =>
      lines.push(
        t('serverstats.talkerLine', locale, {
          rank: idx + 1,
          user: r.userId,
          count: r.count,
          streak: r.streak,
        }),
      ),
    );
  }

  if (premium) {
    // Premium: live streak + games summary + top players.
    lines.push(t('serverstats.streak', locale, { days: s.topStreak }));
    lines.push(
      t('serverstats.games', locale, {
        points: s.gamePoints,
        wins: s.gameWins,
        players: s.gamePlayers,
      }),
    );
    if (s.topPlayers.length) {
      lines.push(t('serverstats.topPlayers', locale));
      s.topPlayers.forEach((r, idx) =>
        lines.push(
          t('serverstats.playerLine', locale, {
            rank: idx + 1,
            user: r.userId,
            points: r.points,
            wins: r.wins,
          }),
        ),
      );
    }
  } else {
    // Free: teaser + one-time vote reward, only while this account is eligible.
    lines.push(t('serverstats.upsell', locale));
    const vote =
      deps.config.voteRedemptionSecret &&
      voteRewardStatus(deps.db, i.user.id, deps.config.voteRedemptionSecret).eligible
        ? voteUpsellLine(locale, deps.config.clientId)
        : null;
    if (vote) lines.push(vote);
  }

  await i.reply(replyCard(lines.join('\n'), { allowedMentions: { parse: [] } }));
}

// Discord renders <t:SECONDS:D> as a per-user localized date.
const stampDate = (ms: number): string => `<t:${Math.floor(ms / 1000)}:D>`;
// <t:SECONDS:R> = localized RELATIVE time ("in 3 days").

/** Server names (best-effort via cache; fallback = id) for the pass messages. */
function serverNames(deps: BotDeps, ids: string[]): string {
  return ids.map((id) => deps.client.guilds.cache.get(id)?.name ?? id).join(', ');
}

/** /premium — dispatches the info | activate | deactivate subcommands. */
export async function handlePremium(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  const sub = i.options.getSubcommand(false) ?? 'info';
  if (sub === 'activate') return handlePremiumActivate(i, deps);
  if (sub === 'deactivate') return handlePremiumDeactivate(i, deps);
  return handlePremiumInfo(i, deps);
}

/** /premium info — status (server + pass + Plus) OR showcase + purchase link. */
async function handlePremiumInfo(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  const locale = localeForUser(deps, i);
  const now = Date.now();
  const lines: string[] = [];

  const guildActive = i.guildId ? isGuildPremium(deps.db, i.guildId, now) : false;
  if (i.guildId) {
    if (guildActive) {
      const exp = effectiveGuildPremiumExpiry(deps.db, i.guildId, now);
      lines.push(t('premium.lineServerActive', locale, { date: stampDate(exp ?? now) }));
    } else {
      lines.push(t('premium.lineServerFree', locale));
    }
  }

  const pass = getPremiumPass(deps.db, i.user.id);
  const passActive = pass !== null && pass.expiresAt > now;
  if (passActive) {
    const used = countActiveSeats(deps.db, i.user.id);
    lines.push(
      t('premium.linePass', locale, {
        used,
        total: pass!.seats,
        date: stampDate(pass!.expiresAt),
      }),
    );
    const acts = listPassActivations(deps.db, i.user.id);
    if (acts.length)
      lines.push(t('premium.passServers', locale, { servers: serverNames(deps, acts) }));
  }

  const uExp = getUserPremiumExpiry(deps.db, i.user.id);
  const uActive = uExp !== null && uExp > now;
  lines.push(
    uActive
      ? t('premium.lineUserActive', locale, { date: stampDate(uExp!) })
      : t('premium.lineUserFree', locale),
  );

  const anyActive = guildActive || passActive || uActive;
  const desc = anyActive
    ? [...lines, '', t('premium.enginePerks', locale)]
    : [
        t('premium.pitch', locale),
        '',
        t('premium.enginePerks', locale),
        '',
        t('premium.buyHint', locale, { link: deps.config.kofiUrl }),
      ];
  // Without Plus: offer the 48h reward only if this account never used it.
  // Claimed accounts get an honest permanent status instead of a false countdown.
  if (!anyActive && deps.config.voteRedemptionSecret) {
    const vs = voteRewardStatus(deps.db, i.user.id, deps.config.voteRedemptionSecret);
    if (vs.eligible) {
      const vote = voteUpsellLine(locale, deps.config.clientId);
      if (vote) desc.push('', vote);
    } else {
      desc.push('', t('vote.cooldownStatus', locale));
    }
  }
  const embed = brandEmbed(anyActive ? 'premium' : 'brand')
    .setTitle(t('premium.title', locale))
    .setDescription(desc.join('\n'));
  const purchaseButtons: ButtonBuilder[] = [];
  if (i.guildId && deps.config.premiumGuildSkuId) {
    purchaseButtons.push(
      new ButtonBuilder().setStyle(ButtonStyle.Premium).setSKUId(deps.config.premiumGuildSkuId),
    );
  }
  if (deps.config.premiumUserSkuId) {
    purchaseButtons.push(
      new ButtonBuilder().setStyle(ButtonStyle.Premium).setSKUId(deps.config.premiumUserSkuId),
    );
  }
  const components = purchaseButtons.length
    ? [new ActionRowBuilder<ButtonBuilder>().addComponents(purchaseButtons)]
    : [];
  await i.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
}

/**
 * /premium activate — spends 1 pass licence ON THIS server, with a confirmation pop-up.
 * Needs Manage Server (activating Premium affects the whole server). The confirmation is
 * ephemeral (only the invoker sees it), so there's no need to filter third-party clicks.
 */
async function handlePremiumActivate(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  const locale = localeForUser(deps, i);
  const member = i.member as GuildMember | null;
  if (!i.guildId || !member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
    await reply(i, t('premium.needManageGuild', locale));
    return;
  }
  const now = Date.now();
  const pass = getPremiumPass(deps.db, i.user.id);
  if (!pass || pass.expiresAt <= now) {
    await reply(i, t('premium.noPass', locale, { link: deps.config.kofiUrl }));
    return;
  }
  const acts = listPassActivations(deps.db, i.user.id);
  if (acts.includes(i.guildId)) {
    await reply(i, t('premium.alreadyActive', locale));
    return;
  }
  if (acts.length >= pass.seats) {
    await reply(
      i,
      t('premium.noSeats', locale, { total: pass.seats, servers: serverNames(deps, acts) }),
    );
    return;
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('premActYes')
      .setLabel(t('premium.confirmYes', locale))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('premActNo')
      .setLabel(t('premium.confirmNo', locale))
      .setStyle(ButtonStyle.Secondary),
  );
  await i.reply(
    replyCard(t('premium.confirmActivate', locale, { total: pass.seats, used: acts.length }), {
      ephemeral: true,
      tone: 'premium',
      rows: [row],
    }),
  );
  const msg = await i.fetchReply();

  let btn;
  try {
    btn = await msg.awaitMessageComponent({ componentType: ComponentType.Button, time: 30_000 });
  } catch {
    await i
      .editReply(editCard(t('premium.activateTimeout', locale), { tone: 'warning' }))
      .catch(() => {});
    return;
  }
  if (btn.customId === 'premActNo') {
    await btn.update(updateCard(t('premium.activateCancelled', locale), { tone: 'warning' }));
    return;
  }
  // Re-checks and spends in a transaction (the state may have changed during the 30s confirmation).
  const res = activateSeat(deps.db, i.user.id, i.guildId, Date.now());
  let out: string;
  if (res.status === 'ok') {
    out = t('premium.activateOk', locale, {
      date: stampDate(res.expiresAt!),
      used: res.used!,
      total: res.seats!,
    });
  } else if (res.status === 'already') {
    out = t('premium.alreadyActive', locale);
  } else if (res.status === 'no_seats') {
    out = t('premium.noSeats', locale, {
      total: res.seats!,
      servers: serverNames(deps, listPassActivations(deps.db, i.user.id)),
    });
  } else {
    out = t('premium.noPass', locale, { link: deps.config.kofiUrl });
  }
  await btn.update(updateCard(out, { tone: res.status === 'ok' ? 'success' : 'warning' }));
}

/** /premium deactivate — frees this server's licence (reversible and safe action). */
async function handlePremiumDeactivate(
  i: ChatInputCommandInteraction,
  deps: BotDeps,
): Promise<void> {
  const locale = localeForUser(deps, i);
  const member = i.member as GuildMember | null;
  if (!i.guildId || !member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
    await reply(i, t('premium.needManageGuild', locale));
    return;
  }
  const freed = deactivateSeat(deps.db, i.user.id, i.guildId);
  await reply(i, freed ? t('premium.deactivateOk', locale) : t('premium.deactivateNone', locale));
}

/**
 * /vozen-grant — OWNER-ONLY. Grants a Premium pass (guild) or Plus (user) to someone,
 * for N days. Defense in depth: (1) the command is registered ONLY on OWNER_GUILD_ID, so
 * the public doesn't even see it; (2) HERE it refuses anyone not in deps.ownerIds — the REAL
 * owner resolved from Discord at startup, not spoofable via env; (3) response always ephemeral.
 */
export async function handleVozenGrant(
  i: ChatInputCommandInteraction,
  deps: BotDeps,
): Promise<void> {
  const locale = localeForUser(deps, i);
  // Layer 2: only the real owner(s). Without resolved ownerIds, nobody passes.
  if (!deps.ownerIds || !deps.ownerIds.has(i.user.id)) {
    await reply(i, t('grant.denied', locale));
    return;
  }
  const target = i.options.getUser('user', true);
  const plan = i.options.getString('plan', true);
  const days = i.options.getInteger('days') ?? 30;
  const now = Date.now();
  if (plan === 'plus') {
    const exp = grantUserPremium(deps.db, target.id, days, 'manual', now);
    await reply(i, t('grant.okPlus', locale, { user: target.id, days, date: stampDate(exp) }));
  } else {
    const seats = i.options.getInteger('seats') ?? 3;
    const exp = grantGuildPass(deps.db, target.id, seats, days, 'manual', now);
    await reply(
      i,
      t('grant.okPremium', locale, { user: target.id, days, seats, date: stampDate(exp) }),
    );
  }
}

/**
 * /generate-code — OWNER-ONLY: generates gift code(s). Defense in depth same as
 * /vozen-grant: (1) registered only on OWNER_GUILD_ID (invisible to the public); (2) real-owner
 * gate here; (3) ephemeral response. Each code is single-use; redeemed with /redeem.
 * `seats` only counts for premium (0 for plus). Regenerates on a PK collision (practically nil).
 */
export async function handleGenCode(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  const locale = localeForUser(deps, i);
  if (!deps.ownerIds || !deps.ownerIds.has(i.user.id)) {
    await reply(i, t('grant.denied', locale));
    return;
  }
  const plan = i.options.getString('plan', true) as 'premium' | 'plus';
  const days = i.options.getInteger('days') ?? 30;
  const seats = plan === 'plus' ? 0 : (i.options.getInteger('seats') ?? 3);
  const amount = i.options.getInteger('amount') ?? 1;
  const expiresDays = i.options.getInteger('expires-days');
  const now = Date.now();
  const expiresAt = expiresDays ? now + expiresDays * 86_400_000 : null;
  const codes: string[] = [];
  for (let n = 0; n < amount; n++) {
    for (let tries = 0; tries < 5; tries++) {
      const code = generateCodeString((max) => randomInt(max));
      const inserted = insertPremiumCode(deps.db, {
        code,
        plan,
        days,
        seats,
        createdBy: i.user.id,
        createdAt: now,
        expiresAt,
      });
      if (inserted) {
        codes.push(code);
        break;
      }
    }
  }
  await reply(
    i,
    t('gencode.done', locale, {
      count: codes.length,
      plan,
      days,
      list: codes.map((c) => `\`${c}\``).join('\n'),
    }),
  );
}

/**
 * /redeem — PUBLIC: redeems a gift code (single-use, atomic redemption in the store).
 * Grants to the redeemer's ACCOUNT — Plus directly, or a Premium pass activated with
 * /premium activate. Ephemeral response. source 'code' (distinguishes from kofi/manual).
 */
export async function handleRedeem(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  const locale = localeForUser(deps, i);
  const code = normalizeCode(i.options.getString('code', true));
  const now = Date.now();
  // The grant runs INSIDE the redemption transaction (via callback): if it fails, the code is
  // NOT burned. We capture the expiry in the closure for the success message.
  let exp = 0;
  const res = redeemPremiumCode(deps.db, code, i.user.id, now, (db, claim) => {
    exp =
      claim.plan === 'plus'
        ? grantUserPremium(db, i.user.id, claim.days, 'redeem', now)
        : grantGuildPass(db, i.user.id, claim.seats, claim.days, 'redeem', now);
  });
  if (!res.ok) {
    const key =
      res.reason === 'not-found'
        ? 'redeem.notFound'
        : res.reason === 'expired'
          ? 'redeem.expired'
          : 'redeem.used';
    await reply(i, t(key, locale));
    return;
  }
  if (res.plan === 'plus') {
    await reply(i, t('redeem.okPlus', locale, { days: res.days, date: stampDate(exp) }));
  } else {
    await reply(
      i,
      t('redeem.okPremium', locale, { days: res.days, seats: res.seats, date: stampDate(exp) }),
    );
  }
}

/** /uptime — PUBLIC: how long Vozen has been online. */
export async function handleUptime(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  const locale = localeForUser(deps, i);
  await reply(i, t('uptime.text', locale, { uptime: formatDuration(process.uptime()) }));
}

/** /bot-stats — PUBLIC: trust numbers (servers, voice sessions, uptime). */
export async function handleBotstats(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  const locale = localeForUser(deps, i);
  const snap = metrics.snapshot();
  const lines = [
    t('botstats.title', locale),
    t('botstats.servers', locale, { value: deps.client.guilds.cache.size }),
    t('botstats.voiceSessions', locale, { value: deps.players.size }),
    t('botstats.messagesSpoken', locale, { value: snap.messagesSpoken }),
    t('botstats.uptime', locale, { value: formatDuration(process.uptime()) }),
  ];
  await i.reply({
    embeds: [brandEmbed().setDescription(lines.join('\n'))],
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * /invite — returns the bot's OAuth2 invite URL, built from the config's
 * CLIENT_ID. Trigger of the "viral loop".
 *
 * Design decisions:
 *  - NORMAL reply (not ephemeral): the command's goal is to share the link, so
 *    we want it visible in the channel for whoever else wants to add Vozen.
 *    That's why we do NOT use the reply() helper (which is ephemeral) — we call
 *    i.reply() directly without flags.
 *  - The URL is built with URLSearchParams to escape the values correctly; the
 *    scope "bot applications.commands" gets encoded (the space becomes '+'), which
 *    is valid for the OAuth2 endpoint.
 *  - permissions = INVITE_PERMISSIONS (integer derived from the 5 bits, see top).
 *  - Without a configured CLIENT_ID: we respond with a clear message instead of
 *    generating a broken link (empty client_id). We check with !clientId to
 *    catch both undefined and empty string.
 */
export async function handleInvite(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  const locale = localeForUser(deps, i);
  const clientId = deps.config.clientId;
  if (!clientId) {
    await reply(i, t('invite.noClientId', locale));
    return;
  }
  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'bot applications.commands',
    permissions: INVITE_PERMISSIONS,
  });
  const url = `https://discord.com/oauth2/authorize?${params.toString()}`;
  // Link button + the URL in the text (clickable and copyable). ButtonStyle.Link has no
  // customId — it carries only the URL, so it needs no collector.
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setURL(url)
      .setLabel(t('invite.button', locale))
      .setEmoji('➕'),
  );
  await i.reply(replyCard(t('invite.link', locale, { url }), { rows: [row] }));
}

/**
 * /vote — returns the link to Vozen's vote page on top.gg (P11.5),
 * built from the config's CLIENT_ID. Growth trigger, sibling of
 * /invite.
 *
 * Design decisions (mirror /invite):
 *  - NORMAL reply (not ephemeral): the goal is to SHARE the link so more
 *    people vote, so it stays visible in the channel — we do NOT use the reply()
 *    helper (ephemeral); we call i.reply() directly without flags.
 *  - URL = https://top.gg/bot/<CLIENT_ID>/vote. The CLIENT_ID is the application id
 *    (the same one as /invite); top.gg uses it as the bot's id in its listing.
 *  - Without a configured CLIENT_ID: a clear ephemeral message instead of a broken
 *    link (top.gg/bot//vote). We check with !clientId (catches undefined and
 *    empty string), just like /invite.
 */
export async function handleVote(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  const locale = localeForUser(deps, i);
  const clientId = deps.config.clientId;
  if (!clientId) {
    await reply(i, t('vote.noClientId', locale));
    return;
  }
  const url = `https://top.gg/bot/${clientId}/vote`;
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setURL(url)
      .setLabel(t('vote.button', locale))
      .setEmoji('🗳️'),
  );
  const claimed =
    deps.config.voteRedemptionSecret &&
    voteRewardStatus(deps.db, i.user.id, deps.config.voteRedemptionSecret).alreadyRedeemed;
  const content = [t('vote.link', locale, { url })];
  if (claimed) content.push(t('vote.cooldownStatus', locale));
  await i.reply(replyCard(content.join('\n\n'), { rows: [row] }));
}

/**
 * /help — in-app command discovery, designed for BEGINNERS (server owner or
 * member who has never used the bot). Responds with a beginner-friendly EMBED:
 * an intro of what Vozen does + a "Quick start (3 steps)" + commands GROUPED by
 * task (Getting started / Your voice / Fun / Server admin / More), each line with
 * a friendly one-liner and at least one concrete example.
 *
 * Design decisions:
 *  - ALL text is rendered via t(key, locale) in the guild's locale
 *    (getGuildConfig.locale). By default (locale 'en') it comes out in ENGLISH; there's
 *    a 'pt' translation for everything. The group bodies are HAND-AUTHORED in the
 *    catalog (not derived from the commandDefs descriptions) because "one concrete
 *    example per section" cannot be derived from a short description.
 *  - Coverage GUARD: since the bodies are hand-authored, we risk a NEW command in
 *    commandDefs being left out. For /help to remain the discovery source, we verify
 *    at runtime that ALL top-level names appear in the assembled text; any that are
 *    missing are APPENDED to the "More" group. This way the guard test (every
 *    top-level command appears in /help) stays genuinely protective without forcing
 *    us to list everything by hand.
 *  - Ephemeral reply so the channel isn't cluttered.
 */
export async function handleHelp(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  // INTERFACE locale of the USER who asked for help (/help is ephemeral, only they
  // see it): uses their client's Discord locale (localeForUser), falling back to the
  // guild locale and then DEFAULT_LOCALE. Never throws.
  const locale = localeForUser(deps, i);

  // Each FIELD has a name (translated header) and a value (translated body). The
  // quick-start comes first so the beginner can get going without reading everything.
  const fields: { name: string; value: string }[] = [
    { name: t('help.quickStartTitle', locale), value: t('help.quickStartBody', locale) },
    { name: t('help.groupStarted', locale), value: t('help.groupStartedBody', locale) },
    { name: t('help.groupVoice', locale), value: t('help.groupVoiceBody', locale) },
    { name: t('help.groupFun', locale), value: t('help.groupFunBody', locale) },
    { name: t('help.groupAdmin', locale), value: t('help.groupAdminBody', locale) },
    { name: t('help.groupMore', locale), value: t('help.groupMoreBody', locale) },
  ];

  // Coverage GUARD: ensures no top-level command stays invisible. Joins all the
  // values into a string and, for each commandDef, if `/name` doesn't appear,
  // appends it to the "More" group (the last field). Keeps /help as real discovery
  // without repeating the list by hand.
  const mentioned = fields.map((f) => f.value).join('\n');
  const missing = commandDefs.map((d) => d.name).filter((name) => !mentioned.includes(`/${name}`));
  if (missing.length) {
    const more = fields[fields.length - 1];
    more.value += '\n' + missing.map((name) => `• /${name}`).join('\n');
  }

  // Support/report line (Discord Developer Policy requirement: give the user a way
  // to report problems). Comes from the config (env SUPPORT_URL; default = official
  // support server).
  const supportLine = t('help.support', locale, { url: deps.config.supportUrl });
  // AGPL-3.0 §13: offers the Corresponding Source inside the product itself (Discord), for
  // those who never open the site. Public and stable repo URL.
  const sourceLine = t('help.source', locale, { url: SOURCE_URL });

  const embed = brandEmbed()
    .setTitle(t('help.embedTitle', locale))
    // Description: what Vozen does + the free/paid engine boundary, then support and source.
    .setDescription(
      `${t('help.title', locale)}\n${t('help.intro', locale)}\n\n${t('welcome.enginePlans', locale)}\n\n${supportLine}\n${sourceLine}`,
    )
    .addFields(fields)
    .setFooter({ text: t('help.footer', locale, { command: '/setup' }) });

  await i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
