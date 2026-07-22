// src/store/dataLifecycle.ts
//
// Data lifecycle for COMPLIANCE (GDPR / Discord Developer Policy §5(b)): two
// operations — purge the data of a SERVER that removed the bot, and erase ALL of a
// USER's data (right to be forgotten).
//
// SINGLE SOURCE OF TRUTH: the 4 lists below categorize each table. A new table with
// `guild_id`/`user_id` MUST go into one of them — otherwise `dataLifecycle.test.ts`
// (rot-guard) FAILS. The purge/erase vs. RETAINED distinction is not derivable from the
// schema (a financial table has `user_id` all the same), so it is explicit and hand-reviewed.
import type Database from 'better-sqlite3';
import { invalidateGuild, invalidateUser } from './cache';
import { deleteUserGcloudUsage } from './gcloudUsage';

// ── Tables with guild_id ─────────────────────────────────────────────────────
/** Deleted when a server removes the bot (after the grace period). Content/config/stats. */
export const GUILD_PURGE_TABLES = [
  'user_voice',
  'guild_config',
  'blocklist',
  'pronunciation',
  'tts_optout',
  'tts_lang_detect_on', // per-(guild,user) automatic language-detection opt-in
  'user_nickname',
  'game_score',
  'user_birthday',
  'talk_stats',
  'talk_usage', // aggregate language/engine counters; still scoped to guild + user
  'guild_talk_streak', // per-server talk streak (aggregate, no per-user data) — dies with the server
  'vote_promo_state', // per-server timestamp + kind enforcing the alternating reminder rotation
  'user_effect',
  'voice_presence',
  'stt_consent',
  'guild_departed', // the departure marker itself (self-cleanup when purging the server)
  'translation_mapping', // opt-in source/destination channel routing, no message content
  'translation_preference', // per-member translation opt-out in the guild
  'translation_daily_usage', // guild-scoped aggregate character quota
  'translation_user_daily_usage', // per-member bounded quota
  'channel_profile', // channel behaviour configuration only, no content
] as const;

/**
 * RETAINED deliberately despite having guild_id: financial record / paid entitlement.
 * The purchase belongs to the USER and follows them; the history has legal retention.
 * Purging here would delete proof of payment and free up paid seats.
 */
export const GUILD_RETAINED_TABLES = ['premium_guild', 'premium_pass_activation'] as const;

// ── Tables with user_id ──────────────────────────────────────────────────────
/** Deleted by `/privacy erase` (personal data). */
export const USER_ERASE_TABLES = [
  'user_voice',
  'user_voice_favorite',
  'user_voice_recent',
  'tts_optout',
  'tts_lang_detect_on', // the user's automatic language-detection opt-in (per guild)
  'user_nickname',
  'game_score',
  'user_birthday',
  'talk_stats',
  'talk_usage',
  'user_effect',
  'user_abbreviation',
  'pronunciation_user',
  'stt_consent',
  'vote_reward',
  'translation_preference',
  'translation_user_daily_usage',
] as const;

/**
 * RETAINED: paid entitlement + financial record. GDPR has an exception for data
 * necessary to fulfill a contract (the premium the person pays for) and legal retention
 * of the history. `/privacy erase` deletes personal data but does not revoke what was purchased.
 */
export const USER_RETAINED_TABLES = [
  'premium_user',
  'premium_pass',
  'premium_pass_activation',
] as const;

// ── Coverage for the EXTENDED rot-guard (non-standard identifier columns) ──────────
// The old rot-guard only saw columns literally named `user_id`/`guild_id`. A user ID
// stored under ANOTHER name (discord_id, key, created_by…) escaped it AND erasure. The
// extended guard (see dataLifecycle.test.ts) requires that EVERY table with an
// identifier-shaped column be in one of the lists above OR one of the two below.

/**
 * Tables deleted by `eraseUser` BUT not via `USER_ERASE_TABLES` (the key is NOT
 * `user_id`): deleted by hand inside the erase transaction. They store the user ID
 * under another name, so the extended guard requires them here so they don't escape the erase.
 */
export const USER_ERASE_BESPOKE = ['kofi_supporter', 'gcloud_usage'] as const;

/**
 * Tables with an identifier-shaped column that are NOT erasable personal data —
 * financial / idempotency ledgers deliberately RETAINED. Being here is a conscious
 * decision (hand-reviewed); the extended guard accepts them.
 */
export const LIFECYCLE_REVIEWED_EXEMPT = [
  // Current Discord monetization state. target_id can identify a user or guild, but this is a
  // paid-access record reconciled from Discord, not data that /privacy erase may revoke.
  'discord_premium_entitlement',
  'premium_code', // code ledger: created_by/redeemed_by = proof of purchase/redemption, retained
  'kofi_transaction', // idempotency ledger: Ko-fi transaction_id, not a user ID
  'kofi_pending', // pending purchases, purged by TTL (startPendingPurgeJob); tx id + email_hash
  'kofi_activation_consent', // versioned immediate-delivery evidence retained with payment records
  // Pseudonymous lifetime anti-abuse marker for the one-time Top.gg reward. It stores
  // only HMAC(user id), never the Discord id, and must survive /privacy erase so the
  // same account cannot erase-and-reclaim. Retained only while the promotion exists.
  'vote_redemption',
  'vote_redemption_meta', // non-personal fingerprint that prevents silent secret rotation
  'topgg_webhook_event', // short-retention external delivery-id idempotency ledger
] as const;

/**
 * Identity-free service aggregates. These rows contain neither Discord identifiers nor
 * content, so `/privacy erase` and guild departure cannot target a person or server.
 * Retention is operational: rotate/purge them with instance logs when no longer useful.
 */
export const IDENTITY_FREE_OPERATIONAL_TABLES = [
  'operational_daily_metric',
  'provider_health_state',
  'gcloud_daily_usage',
] as const;

/**
 * Deletes ALL guild-scoped rows of a server (does not touch the retained ones). Transaction:
 * either deletes everything, or nothing. Invalidates the guild-keyed cache at the end.
 */
export function purgeGuild(db: Database.Database, guildId: string): void {
  const run = db.transaction((gid: string) => {
    for (const table of GUILD_PURGE_TABLES) {
      db.prepare(`DELETE FROM ${table} WHERE guild_id = ?`).run(gid);
    }
  });
  run(guildId);
  invalidateGuild(db, guildId);
}

/**
 * Erases ALL of a user's personal data in any server (does not touch the
 * financial/entitlement data).
 */
export function eraseUser(db: Database.Database, userId: string): void {
  const run = db.transaction((uid: string) => {
    for (const table of USER_ERASE_TABLES) {
      db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(uid);
    }
    // BESPOKE (key != user_id): kofi_supporter stores the Discord ID in `discord_id`;
    // gcloud_usage stores it in `key` for user/pass scope (personal/pass pool). The
    // gcloud_usage scope='guild' rows are retained and purged by TTL
    // (purgeOldGcloudUsage), they are not personal data erasable by this erase.
    db.prepare('DELETE FROM kofi_supporter WHERE discord_id = ?').run(uid);
    deleteUserGcloudUsage(db, uid);
  });
  run(userId);
  invalidateUser(db, userId);
}
