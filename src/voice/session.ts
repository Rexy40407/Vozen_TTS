// src/voice/session.ts
//
// Creates a voice session (connection + player) for a guild/channel. It is the SINGLE
// SOURCE of this logic, shared by /join (joinUserVoice, from an interaction) and by
// autojoin (from a message) — so they don't diverge (e.g. the identity guard in onIdle,
// which avoids tearing down a replacement player).

import {
  joinVoiceChannel,
  getVoiceConnection,
  type DiscordGatewayAdapterCreator,
} from '@discordjs/voice';
import { ChannelType, type VoiceBasedChannel } from 'discord.js';
import { GuildVoicePlayer } from './player';
import type { BotDeps } from '../bot/deps';
import { removePlayer } from '../bot/deps';
import { rememberVoicePresence } from '../store/voicePresence';
import { log } from '../logging/logger';
import { addOperationalMetric, setProviderHealth } from '../store/operationalMetrics';

/**
 * STAGE channels: when joining a stage channel, the bot ends up as AUDIENCE (suppressed)
 * and is not heard. Here we request to be a SPEAKER (setSuppressed(false)); if there's no
 * permission for that, we request to speak (setRequestToSpeak). Best-effort and
 * fire-and-forget — NEVER blocks or crashes the join; in a normal voice channel it's a
 * no-op. NOT unit-testable (needs a real Discord stage).
 */
export function becomeSpeakerIfStage(channel: VoiceBasedChannel): void {
  if (channel.type !== ChannelType.GuildStageVoice) return;
  const voice = channel.guild?.members?.me?.voice;
  if (!voice) return;
  Promise.resolve(voice.setSuppressed(false)).catch(() => {
    // No permission to self-promote -> request to speak (the moderator accepts).
    Promise.resolve(voice.setRequestToSpeak(true)).catch((err) => {
      log.warn('[voice] failed to become a stage speaker (ignored)', err);
    });
  });
}

/**
 * (Re)creates the guild's voice session in the given channel and returns the player.
 * Replaces any previous player (removePlayer first). The onIdle is identity-aware: it
 * only tears down the session if THIS player is still the registered one (a /join during
 * a reconnection may have installed another in the same slot). Does NOT check permissions
 * — it's the caller that validates Connect/Speak beforehand.
 */
export function createVoiceSession(
  deps: BotDeps,
  guildId: string,
  channelId: string,
  adapterCreator: DiscordGatewayAdapterCreator,
): GuildVoicePlayer {
  removePlayer(deps, guildId);
  const connection = joinVoiceChannel({
    channelId,
    guildId,
    adapterCreator,
    selfDeaf: true,
    selfMute: false,
  });
  const player = new GuildVoicePlayer(
    connection,
    deps.engine,
    deps.config.queueCap,
    () => {
      if (deps.players.get(guildId) !== player) return;
      removePlayer(deps, guildId);
      getVoiceConnection(guildId)?.destroy();
    },
    (metric, provider, value) => {
      addOperationalMetric(deps.db, metric, provider, value);
      if (metric === 'synth_success') setProviderHealth(deps.db, provider, 'healthy');
      if (metric === 'synth_failure') setProviderHealth(deps.db, provider, 'degraded');
    },
  );
  deps.players.set(guildId, player);
  // Persist the current call for two distinct startup policies: Premium 24/7 always
  // restores it; a normal call restores it only after the one-shot deployment marker.
  // Normal exits remove this row, while clean shutdown deliberately leaves it in place.
  // Best-effort — NEVER blocks joining the call.
  if (deps.db) {
    try {
      rememberVoicePresence(deps.db, guildId, channelId, Date.now());
    } catch (err) {
      log.warn('[voice] failed to persist voice presence (ignored)', err);
    }
  }
  return player;
}
