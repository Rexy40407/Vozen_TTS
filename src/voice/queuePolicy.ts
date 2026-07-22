import type { GuildConfig } from '../store/guildConfig';
import type { QueueLane } from './queue';

/** Pure role policy: blocks always win and paid entitlement is deliberately irrelevant. */
export function resolveQueueLane(
  config: Pick<GuildConfig, 'priorityRoleId' | 'blockedRoleId'>,
  roleIds: Iterable<string>,
): {
  allowed: boolean;
  lane: QueueLane;
} {
  const roles = new Set(roleIds);
  if (config.blockedRoleId && roles.has(config.blockedRoleId))
    return { allowed: false, lane: 'standard' };
  if (config.priorityRoleId && roles.has(config.priorityRoleId))
    return { allowed: true, lane: 'accessibility' };
  return { allowed: true, lane: 'standard' };
}
