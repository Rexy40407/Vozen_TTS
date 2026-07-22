import type Database from 'better-sqlite3';
import { cached, invalidate } from './cache';
import type { UserEngine } from './userVoice';

/**
 * Per-channel policy overrides. Nullable fields deliberately mean "inherit the guild setting";
 * this keeps newly-created profiles inert until an administrator explicitly enables a behaviour.
 * No message, audio, member, or queue content is stored here.
 */
export interface ChannelProfile {
  guildId: string;
  channelId: string;
  autoRead: boolean | null;
  translationEnabled: boolean | null;
  defaultVoice: string | null;
  engine: UserEngine | null;
  speed: number | null;
  maxChars: number | null;
  readBots: boolean | null;
  voiceChannelId: string | null;
  locale: string | null;
  effect: string | null;
}

export const MAX_CHANNEL_PROFILES_PER_GUILD = 25;

interface Row {
  guild_id: string;
  channel_id: string;
  auto_read: number | null;
  translation_enabled: number | null;
  default_voice: string | null;
  engine: string | null;
  speed: number | null;
  max_chars: number | null;
  read_bots: number | null;
  voice_channel_id: string | null;
  locale: string | null;
  effect: string | null;
}

function rowToProfile(row: Row): ChannelProfile {
  return {
    guildId: row.guild_id,
    channelId: row.channel_id,
    autoRead: row.auto_read === null ? null : row.auto_read === 1,
    translationEnabled: row.translation_enabled === null ? null : row.translation_enabled === 1,
    defaultVoice: row.default_voice || null,
    engine:
      row.engine === 'google' ||
      row.engine === 'piper' ||
      row.engine === 'kokoro' ||
      row.engine === 'gcloud'
        ? row.engine
        : null,
    speed: row.speed,
    maxChars: row.max_chars,
    readBots: row.read_bots === null ? null : row.read_bots === 1,
    voiceChannelId: row.voice_channel_id || null,
    locale: row.locale || null,
    effect: row.effect || null,
  };
}

export function listChannelProfiles(db: Database.Database, guildId: string): ChannelProfile[] {
  return cached(db, 'channel_profile', guildId, () =>
    (
      db
        .prepare(
          `SELECT guild_id, channel_id, auto_read, translation_enabled, default_voice,
                  engine, speed, max_chars, read_bots, voice_channel_id, locale, effect
           FROM channel_profile WHERE guild_id = ? ORDER BY channel_id`,
        )
        .all(guildId) as Row[]
    ).map(rowToProfile),
  );
}

export function getChannelProfile(
  db: Database.Database,
  guildId: string,
  channelId: string,
): ChannelProfile | null {
  return (
    listChannelProfiles(db, guildId).find((profile) => profile.channelId === channelId) ?? null
  );
}

export type ChannelProfilePatch = Pick<
  ChannelProfile,
  | 'autoRead'
  | 'translationEnabled'
  | 'defaultVoice'
  | 'engine'
  | 'speed'
  | 'maxChars'
  | 'readBots'
  | 'voiceChannelId'
  | 'locale'
  | 'effect'
>;

/** Returns false instead of silently growing unbounded profile state. */
export function saveChannelProfile(
  db: Database.Database,
  guildId: string,
  channelId: string,
  patch: ChannelProfilePatch,
): boolean {
  const existing = getChannelProfile(db, guildId, channelId);
  if (!existing && listChannelProfiles(db, guildId).length >= MAX_CHANNEL_PROFILES_PER_GUILD)
    return false;
  const next = { ...existing, ...patch } as ChannelProfilePatch;
  db.prepare(
    `INSERT INTO channel_profile (
       guild_id, channel_id, auto_read, translation_enabled, default_voice,
       engine, speed, max_chars, read_bots, voice_channel_id, locale, effect
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, channel_id) DO UPDATE SET
       auto_read = excluded.auto_read,
       translation_enabled = excluded.translation_enabled,
       default_voice = excluded.default_voice,
       engine = excluded.engine,
       speed = excluded.speed,
       max_chars = excluded.max_chars,
       read_bots = excluded.read_bots,
       voice_channel_id = excluded.voice_channel_id,
       locale = excluded.locale,
       effect = excluded.effect`,
  ).run(
    guildId,
    channelId,
    next.autoRead === null ? null : Number(next.autoRead),
    next.translationEnabled === null ? null : Number(next.translationEnabled),
    next.defaultVoice || null,
    next.engine || null,
    next.speed,
    next.maxChars,
    next.readBots === null ? null : Number(next.readBots),
    next.voiceChannelId || null,
    next.locale || null,
    next.effect || null,
  );
  invalidate(db, 'channel_profile', guildId);
  return true;
}

export function deleteChannelProfile(
  db: Database.Database,
  guildId: string,
  channelId: string,
): void {
  db.prepare('DELETE FROM channel_profile WHERE guild_id = ? AND channel_id = ?').run(
    guildId,
    channelId,
  );
  invalidate(db, 'channel_profile', guildId);
}
