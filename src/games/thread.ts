// src/games/thread.ts
//
// discord.js glue for the games' disposable THREADS. Isolated here so the rest of the
// framework (manager, games) stays decoupled from discord.js and testable with a fake
// env. Everything best-effort: any failure (no permissions, channel type without threads,
// already-deleted channel) returns the fallback (null / archive), never throws — but
// always LOGS the outcome, so a permissions failure doesn't go unnoticed.

import { ChannelType, PermissionFlagsBits, type Client } from 'discord.js';
import { log } from '../logging/logger';

/** Auto-archive duration (min) — safety net if both deleting AND archiving fail. */
const AUTO_ARCHIVE_MIN = 60;

/**
 * Diagnoses the delete permission BEFORE attempting: distinguishes the two causes of
 * "Missing Permissions", which are resolved in OPPOSITE ways, and writes to the log which
 * one applies (otherwise you re-invite blindly when the problem is the channel, or vice versa):
 *  - missing at the SERVER level  → the re-invite didn't take (stale link?) → use the current /invite;
 *  - present at the server but the PARENT channel removes it via an override → enable "Manage Threads"
 *    for the Vozen role in THAT channel's permissions.
 * Best-effort and purely informational — never changes the flow nor throws.
 */
function diagnoseThreadDelete(ch: unknown, _channelId: string): void {
  try {
    const thread = ch as {
      parentId?: string;
      guild?: { members?: { me?: unknown } };
      parent?: { permissionsFor?: (m: unknown) => { has?: (p: bigint) => boolean } | null };
    };
    const me = thread.guild?.members?.me as
      { permissions?: { has?: (p: bigint) => boolean } } | undefined;
    if (!me) return; // without the bot member in cache there is nothing to compare
    const guildHas = me.permissions?.has?.(PermissionFlagsBits.ManageThreads) ?? false;
    // EFFECTIVE permission on the parent channel (with overrides already applied); if the
    // parent is not in cache it falls back to the server value (we can't assert an override then).
    const chanPerms = thread.parent?.permissionsFor?.(me);
    const chanHas = chanPerms?.has?.(PermissionFlagsBits.ManageThreads) ?? guildHas;
    if (chanHas) return; // should be able to delete — nothing to flag
    if (!guildHas) {
      log.warn(
        `[game] diagnosis: Vozen does not have Manage Threads at guild level; ` +
          `the invite may be stale. Run /invite in Discord and use that link.`,
      );
    } else {
      log.warn(
        `[game] diagnosis: Vozen has Manage Threads at guild level, but parent channel ` +
          `${thread.parentId ?? '?'} overrides it. Grant Manage Threads to the Vozen role ` +
          `in that channel.`,
      );
    }
  } catch {
    // the diagnosis is just a helper — if something is missing, we proceed to the real attempt
  }
}

/**
 * Creates a public thread from `channel` (the channel where /game play was issued).
 * Returns the thread id, or null if it can't (channel type without threads, no permissions,
 * voice/DM channels) — the caller then plays in the channel itself (the usual behavior).
 */
export async function createGameThread(channel: unknown, name: string): Promise<string | null> {
  try {
    const ch = channel as {
      type?: number;
      threads?: { create?: (o: unknown) => Promise<{ id: string }> };
    };
    // Only server TEXT/ANNOUNCEMENT channels support public threads.
    if (ch?.type !== ChannelType.GuildText && ch?.type !== ChannelType.GuildAnnouncement)
      return null;
    if (typeof ch.threads?.create !== 'function') return null;
    const thread = await ch.threads.create({
      name: name.slice(0, 100), // Discord limit
      autoArchiveDuration: AUTO_ARCHIVE_MIN,
      reason: 'Vozen game session',
    });
    if (thread.id) log.info(`[game] thread ${thread.id} created for the match.`);
    return thread.id ?? null;
  } catch (err) {
    log.warn(
      `[game] thread creation failed (${(err as Error)?.message ?? String(err)}); the game will continue in the current channel.`,
    );
    return null;
  }
}

/**
 * Deletes the game thread by id. Degradation ladder, always logged:
 *  1. delete — needs Manage Threads (fresh invite);
 *  2. archive — the bot created the thread, so it can archive it even without
 *     Manage Threads (it disappears from the channel list all the same);
 *  3. nothing — the thread auto-archives after AUTO_ARCHIVE_MIN.
 */
export async function deleteChannelSafe(client: Client, channelId: string): Promise<void> {
  const ch =
    client.channels.cache.get(channelId) ??
    (await client.channels.fetch(channelId).catch(() => null));
  if (!ch) {
    log.warn(`[game] thread ${channelId} was not found for deletion (already removed?).`);
    return;
  }
  // Before attempting, log whether (and where) the delete permission is missing.
  diagnoseThreadDelete(ch, channelId);
  const c = ch as {
    delete?: (reason?: string) => Promise<unknown>;
    setArchived?: (archived?: boolean, reason?: string) => Promise<unknown>;
  };
  try {
    if (typeof c.delete === 'function') {
      await c.delete('Vozen game ended');
      log.info(`[game] thread ${channelId} deleted.`);
      return;
    }
  } catch (err) {
    log.warn(
      `[game] deleting thread ${channelId} failed (${(err as Error)?.message ?? String(err)}); ` +
        `is Manage Threads missing? Re-invite the bot with /invite. Archiving as fallback.`,
    );
  }
  try {
    if (typeof c.setArchived === 'function') {
      await c.setArchived(true, 'Vozen game ended');
      log.info(`[game] thread ${channelId} archived as a deletion fallback.`);
    }
  } catch (err) {
    log.warn(
      `[game] archiving thread ${channelId} also failed (${(err as Error)?.message ?? String(err)}); ` +
        `it will auto-archive after ${AUTO_ARCHIVE_MIN} minutes.`,
    );
  }
}
