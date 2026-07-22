import type Database from 'better-sqlite3';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type MessageCreateOptions,
} from 'discord.js';
import { t } from './i18n/index';
import { channelCard } from './ui/messages';

/** Activity required before an admin-controllable promotional notice can appear. */
export const VOTE_PROMO_MIN_MESSAGES = 24;
/** Each individual card can appear at most every other day. */
export const VOTE_PROMO_COOLDOWN_MS = 48 * 60 * 60 * 1000;
/** The rotating slot permits at most one promotional card in any rolling 24 hours. */
export const PROMO_SLOT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
/** Eligible reminders remain occasional instead of appearing at a fixed message count. */
export const VOTE_PROMO_PROBABILITY = 0.12;
const MAX_ENTRIES = 10_000;

export type CommunityPromoKind = 'vote' | 'support';

interface GuildState {
  count: number;
  lastPostAt: number;
}

function lastPostAt(db: Database.Database, guildId: string): number {
  const row = db
    .prepare('SELECT last_post_at FROM vote_promo_state WHERE guild_id = ?')
    .get(guildId) as { last_post_at: number } | undefined;
  return row?.last_post_at ?? 0;
}

/** Atomically reserves and alternates the next slot across restarts or multiple workers. */
function reservePost(
  db: Database.Database,
  guildId: string,
  now: number,
): CommunityPromoKind | null {
  const existing = db
    .prepare(
      `UPDATE vote_promo_state
       SET last_post_at = ?,
           last_kind = CASE last_kind WHEN 'vote' THEN 'support' ELSE 'vote' END
       WHERE guild_id = ? AND last_post_at <= ?
       RETURNING last_kind`,
    )
    .get(now, guildId, now - PROMO_SLOT_COOLDOWN_MS) as
    { last_kind: CommunityPromoKind } | undefined;
  if (existing) return existing.last_kind;

  // First-ever slot is always the vote card. INSERT OR IGNORE makes two workers racing
  // on a new guild safe: only one gets the slot, and the other returns null.
  const inserted = db
    .prepare(
      `INSERT OR IGNORE INTO vote_promo_state (guild_id, last_post_at, last_kind)
       VALUES (?, ?, 'vote')`,
    )
    .run(guildId, now);
  return inserted.changes === 1 ? 'vote' : null;
}

/** Activity-driven persistent rotation: vote, support, vote, support, never on one day. */
export class VotePromoPoster {
  private readonly state = new Map<string, GuildState>();

  constructor(
    private readonly db: Database.Database,
    private readonly now: () => number = () => Date.now(),
    private readonly rand: () => number = Math.random,
  ) {}

  record(guildId: string): CommunityPromoKind | null {
    const state = this.state.get(guildId) ?? {
      count: 0,
      lastPostAt: lastPostAt(this.db, guildId),
    };
    state.count += 1;
    this.state.delete(guildId);
    this.state.set(guildId, state);
    if (this.state.size > MAX_ENTRIES) {
      const oldest = this.state.keys().next().value as string | undefined;
      if (oldest) this.state.delete(oldest);
    }

    const now = this.now();
    if (state.count < VOTE_PROMO_MIN_MESSAGES) return null;
    if (now - state.lastPostAt < PROMO_SLOT_COOLDOWN_MS) return null;
    if (this.rand() >= VOTE_PROMO_PROBABILITY) return null;

    const kind = reservePost(this.db, guildId, now);
    if (!kind) {
      state.lastPostAt = lastPostAt(this.db, guildId);
      return null;
    }
    state.count = 0;
    state.lastPostAt = now;
    return kind;
  }

  forget(guildId: string): void {
    this.state.delete(guildId);
  }
}

/** Localized Components V2 reminder with a safe Top.gg link button. */
export function votePromoMessage(locale: string, clientId: string): MessageCreateOptions {
  const url = `https://top.gg/bot/${clientId}/vote`;
  const optOut = `${t('config.votePromosLabel', locale)}: \`/config vote-reminders active:false\``;
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setURL(url)
      .setLabel(t('vote.button', locale))
      .setEmoji('🗳️'),
  );
  return channelCard(`${t('vote.upsell', locale, { url })}\n\n${optOut}`, {
    tone: 'premium',
    rows: [row],
    allowedMentions: { parse: [] },
  });
}

/** Localized help card with a direct link to the official Vozen support server. */
export function supportPromoMessage(locale: string, supportUrl: string): MessageCreateOptions {
  const optOut = `${t('config.votePromosLabel', locale)}: \`/config vote-reminders active:false\``;
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setURL(supportUrl)
      .setLabel('Vozen Support')
      .setEmoji('🛟'),
  );
  return channelCard(`${t('help.support', locale, { url: supportUrl })}\n\n${optOut}`, {
    tone: 'brand',
    rows: [row],
    allowedMentions: { parse: [] },
  });
}
