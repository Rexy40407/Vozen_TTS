import {
  PermissionFlagsBits,
  PermissionsBitField,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { BotDeps } from '../../bot/deps';
import { getPlayer } from '../../bot/deps';
import { reply } from '../helpers';

function isManager(i: ChatInputCommandInteraction): boolean {
  const permissions = i.member?.permissions;
  return (
    permissions instanceof PermissionsBitField && permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

function isInBotVoice(i: ChatInputCommandInteraction): boolean {
  const mine = i.guild?.members.me?.voice.channelId ?? null;
  const caller = i.guild?.members.cache.get(i.user.id)?.voice.channelId ?? null;
  return mine !== null && mine === caller;
}

/** Queue view intentionally renders only source/lane/age and opaque ids, never spoken content. */
export async function handleQueue(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  const player = getPlayer(deps, i.guildId!);
  const action = i.options.getSubcommand(false) ?? 'show';
  if (!player) {
    await reply(i, 'The queue is empty.');
    return;
  }
  if (action === 'show') {
    const jobs = player.queueSnapshot();
    const lines = jobs.map(
      (job) =>
        `- \`${job.id}\` - ${job.source}, ${job.lane}, ${Math.floor(job.ageMs / 1000)}s waiting`,
    );
    await reply(
      i,
      lines.length
        ? `Pending queue (${lines.length}):\n${lines.join('\n')}`
        : 'The queue is empty.',
    );
    return;
  }
  if (action === 'remove') {
    const id = i.options.getString('id', true);
    const removed = isManager(i)
      ? player.removeQueuedById(id)
      : player.removeQueuedByAuthorId(i.user.id, id);
    await reply(i, removed ? 'Removed that queued item.' : 'That queue item is unavailable.');
    return;
  }
  if (!isManager(i)) {
    await reply(i, 'You need Manage Server to control the queue.');
    return;
  }
  // Playback controls change audible output, so the same-call invariant still applies even to admins.
  if (!isInBotVoice(i)) {
    await reply(i, "Join Vozen's voice channel to control audio.");
    return;
  }
  if (action === 'clear') {
    player.silence();
    await reply(i, 'Cleared the queue.');
    return;
  }
  if (action === 'pause') {
    const paused = player.pause();
    await reply(i, paused ? 'Audio paused.' : 'There is no audio to pause.');
    return;
  }
  if (action === 'resume') {
    const resumed = player.resume();
    await reply(i, resumed ? 'Audio resumed.' : 'Audio is not paused.');
    return;
  }
  if (!player.isActive()) {
    await reply(i, 'There is no audio to skip.');
    return;
  }
  player.skip();
  await reply(i, 'Skipped the current audio.');
}
