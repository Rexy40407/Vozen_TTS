import type { Guild } from 'discord.js';
import type { BotDeps } from '../bot/deps';
import { getGuildConfig } from '../store/guildConfig';
import { resolveQueueLane } from './queuePolicy';
import type { QueueLane } from './queue';

/**
 * Admission for speech explicitly requested by a Discord member.  This is deliberately
 * separate from system announcements and game timers: a paid entitlement or a role never
 * grants an exception to the active-call rule.
 */
export type UserSpeechAdmission =
  { allowed: true; lane: QueueLane } | { allowed: false; reason: 'not-in-same-voice' | 'blocked' };

export function admitUserSpeech(
  deps: BotDeps,
  guildId: string,
  userId: string,
  guild: Guild,
  callerVoiceChannelId: string | null,
): UserSpeechAdmission {
  const botVoiceChannelId = guild.members.me?.voice.channelId ?? null;
  if (
    callerVoiceChannelId === null ||
    botVoiceChannelId === null ||
    callerVoiceChannelId !== botVoiceChannelId
  ) {
    return { allowed: false, reason: 'not-in-same-voice' };
  }

  const config = getGuildConfig(deps.db, guildId);
  const member = guild.members.cache.get(userId);
  // The voice-state comparison above is always required. Role enforcement fails closed
  // when configured, while a server with no role policy does not reject a valid caller
  // merely because Discord's member-role cache has not hydrated yet.
  if (!member && (config.priorityRoleId || config.blockedRoleId)) {
    return { allowed: false, reason: 'not-in-same-voice' };
  }
  const roleIds = (
    member as { roles?: { cache?: { keys(): IterableIterator<string> } } } | undefined
  )?.roles?.cache?.keys();
  const policy = resolveQueueLane(config, roleIds ?? []);
  return policy.allowed
    ? { allowed: true, lane: policy.lane }
    : { allowed: false, reason: 'blocked' };
}
