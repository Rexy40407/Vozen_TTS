import type { GuildConfig } from '../store/guildConfig';
import type { ChannelProfile } from '../store/channelProfiles';
import type { UserEngine } from '../store/userVoice';

/**
 * The only interpretation of profile fields. Callers still enforce permissions, opt-out,
 * blocked roles, queue capacity, and same-call separately; a profile never grants an exception.
 */
export interface EffectiveChannelPolicy {
  autoRead: boolean;
  translationEnabled: boolean;
  defaultVoice: string;
  engine: UserEngine | null;
  speed: number | null;
  maxChars: number;
  readBots: boolean;
  voiceChannelId: string | null;
  locale: string | null;
  effect: string | null;
}

export function resolveChannelPolicy(
  guild: Pick<
    GuildConfig,
    'autoread' | 'translationEnabled' | 'defaultVoice' | 'maxChars' | 'readBots'
  >,
  profile: ChannelProfile | null | undefined,
): EffectiveChannelPolicy {
  return {
    autoRead: profile?.autoRead ?? guild.autoread,
    translationEnabled: profile?.translationEnabled ?? guild.translationEnabled,
    defaultVoice: profile?.defaultVoice ?? guild.defaultVoice,
    engine: profile?.engine ?? null,
    speed: profile?.speed ?? null,
    maxChars: profile?.maxChars ?? guild.maxChars,
    readBots: profile?.readBots ?? guild.readBots,
    voiceChannelId: profile?.voiceChannelId ?? null,
    locale: profile?.locale ?? null,
    effect: profile?.effect ?? null,
  };
}
