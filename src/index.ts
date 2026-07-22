import { readdirSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { getVoiceConnection } from '@discordjs/voice';
import { Events, Routes, PermissionFlagsBits, Status } from 'discord.js';
import { loadConfig } from './config/index';
import { startBotListUpdater, syncTopggCommands } from './botLists';
import { log } from './logging/logger';
import { initDb } from './store/db';
import { startDepartedPurgeJob } from './store/guildDeparted';
import { startPendingPurgeJob } from './store/kofiPending';
import { purgeOldGcloudUsage, monthKeyUTC } from './store/gcloudUsage';
import { sweepOrphanSttTemps } from './voice/transcriptionSession';
import { AudioCache } from './tts/cache';
import {
  createEngine,
  createPerUserEngine,
  selectEngine,
  unofficialGttsEnabled,
} from './tts/factory';
import { syntheticGttsModels } from './language/voiceMap';
import { EffectEngine } from './tts/effects';
import { ProsodyEngine } from './tts/prosody';
import { GuildVoicePlayer } from './voice/player';
import { AloneWatcher } from './voice/aloneWatcher';
import { GreetCooldown } from './voice/greetCooldown';
import { LeaderboardPoster } from './leaderboard/randomPost';
import { VotePromoPoster } from './votePromo';
import { DuplicateTracker } from './moderation/antispam';
import { CountGate } from './moderation/countGate';
import type { BotDeps } from './bot/deps';
import { removePlayer } from './bot/deps';
import { GameManager } from './games/manager';
import { systemClock } from './games/types';
import { channelCard } from './ui/messages';
import { isGuildPremium } from './store/premium';
import {
  claimVoteReward,
  initializeVoteRedemptionLedger,
  purgeExpiredVoteRewards,
  VOTE_REWARD_HOURS,
} from './store/voteReward';
import { createVoiceSession, becomeSpeakerIfStage } from './voice/session';
import { listVoicePresence, forgetVoicePresence } from './store/voicePresence';
import { planRejoin, type ChannelState } from './voice/rejoin';
import { consumePlannedRejoinMarker, writePlannedRejoinMarker } from './voice/deployRejoinMarker';
import { loadBoardEmojis } from './games/boardEmojis';
import { deleteChannelSafe } from './games/thread';
import { getGuildConfig } from './store/guildConfig';
import { createTranslationProvider } from './translation/provider';
import { persistGameScores } from './store/gameScore';
import { t, DEFAULT_LOCALE } from './i18n/index';
import { createClient, bindEvents } from './bot/client';
import { registerCommands, registerOwnerCommands } from './bot/registerCommands';
import { commandDefs } from './commands/definitions';
import { installSignalHandlers } from './bot/shutdown';
import { startHealthServer } from './health';
import { mapPublicStatus } from './health/publicStatus';
import { checkFfmpeg } from './health/ffmpeg';
import { startLoopLagMonitor } from './health/loopLag';
import { startEntitlementSync } from './premium/entitlementSync';
import { startKofiWebhook } from './premium/kofiWebhook';
import { parseShopMap } from './premium/kofi';
import { createStatusApi } from './premium/statusApi';
import {
  createDashboardApi,
  listAuthorizedTextChannels,
  listAuthorizedVoiceChannels,
  listConfigurableRoles,
} from './premium/dashboardApi';
import { createAdminApi, type AdminUserBrief } from './premium/adminApi';
import { startVoteWebhookServer } from './vote';
import { listProviderHealth } from './store/operationalMetrics';
import { claimTopggEvent, purgeExpiredTopggEvents, releaseTopggEvent } from './store/topggEvents';

function discoverModels(modelsDir: string): string[] {
  if (!existsSync(modelsDir)) return [];
  return readdirSync(modelsDir)
    .filter((f) => f.endsWith('.onnx'))
    .map((f) => path.basename(f, '.onnx'))
    .sort();
}

async function main(): Promise<void> {
  const config = loadConfig();
  // Event-loop blocking watchdog (diagnosis of "Failed to load options"):
  // stalls go to the log + metrics.loopStalls. Timer unref'd — never holds the process.
  startLoopLagMonitor();
  const db = initDb(config.dbPath);
  if (config.voteRedemptionSecret) {
    const backfilled = initializeVoteRedemptionLedger(db, config.voteRedemptionSecret);
    if (backfilled > 0) {
      log.info(`[vote] protected ${backfilled} pre-existing reward(s) in the lifetime ledger.`);
    }
  }
  const cache = new AudioCache(path.join(path.dirname(config.dbPath), 'audio-cache'));

  // Models DELIBERATELY excluded from the options/detection. Since 2026-07-10 Diogo
  // asked to REMOVE the European Portuguese Piper (pt_PT-tugao-medium): pt-PT is now
  // served ONLY by Google (syntheticGttsModels generates 'pt_PT-google-medium' because
  // no Piper covers pt_PT) and by Kokoro (opt-in engine, independent of these models).
  // The saved prefs that pointed to the Piper were migrated to the Google voice (see
  // db.ts). The mechanism stays in place: just add/remove an id from this Set (the .onnx
  // stays on disk until deleted by hand).
  const EXCLUDED_MODELS = new Set<string>(['pt_PT-tugao-medium']);
  const piperModels = discoverModels(config.modelsDir).filter((m) => !EXCLUDED_MODELS.has(m));
  if (piperModels.length === 0) {
    if (unofficialGttsEnabled(config.ttsEngine)) {
      log.warn(
        `[index] no .onnx models found in ${config.modelsDir}; only gTTS voices are available.`,
      );
    } else if (config.ttsEngine === 'piper') {
      throw new Error(
        `TTS_ENGINE=piper requires at least one .onnx voice model in ${config.modelsDir}`,
      );
    }
  }
  // Google-ONLY voices: for EACH known language (LOCALE_NAMES) WITHOUT a Piper model on
  // disk, we inject a synthetic voice `{locale}-google-medium`, so that /voice set and
  // automatic detection offer it and it speaks via Google (the default engine). This makes
  // the catalog INDEPENDENT of the disk: even with ./models empty (e.g. a fresh deploy
  // without the .onnx) the ~40 languages still appear, instead of collapsing to only
  // Japanese. The name follows the Piper convention (locale-voice-quality) so gttsLangOfModel
  // derives the tl (ja_JP-... -> 'ja') and LOCALE_NAMES gives the autonym. Excluded in neural (no gTTS).
  const GTTS_ONLY_MODELS = syntheticGttsModels(
    piperModels,
    unofficialGttsEnabled(config.ttsEngine),
  );
  const availableModels = [...piperModels, ...GTTS_ONLY_MODELS].sort();

  // P13.2 — ffmpeg health-check at STARTUP. @discordjs/voice transcodes the
  // audio via prism-media -> ffmpeg; if the binary is missing/from the wrong
  // platform, the 1st playback would blow up late with a raw unhandledRejection. Here
  // we check early and, if it fails, log a CLEAR and actionable ERROR (loud &
  // early — this was exactly the silent failure mode of the 1st live test).
  // We do NOT process.exit/throw: the bot still starts (only playback would
  // fail), the goal is to trade the late error for an early warning. The check
  // goes in a try/catch so it can never prevent the boot.
  try {
    const ff = checkFfmpeg();
    if (ff.ok) {
      log.info(`[health] ffmpeg OK (${ff.version})`);
    } else {
      log.error(`[health] ${ff.error}`);
    }
  } catch (err) {
    log.error('[health] unexpected FFmpeg health-check failure (ignored)', err);
  }

  // The hosted/default path is the per-user router. Piper is local by default; gTTS is
  // created only by the explicit legacy modes. Neural mode uses a single OpenAI engine.
  const baseEngine =
    config.ttsEngine === 'neural'
      ? createEngine(config, cache)
      : createPerUserEngine(config, cache, db); // db => persistent Google HD counters
  // External decorators, from inside out:
  //   selectEngine (multi-segment) -> ProsodyEngine (question/exclamation intonation) ->
  //   EffectEngine (voice effect). ProsodyEngine sits OUTSIDE the multiseg (applies to the FINAL WAV of the
  //   utterance) and INSIDE the effect (a voice effect comes on top). EffectEngine applies the
  //   effect ON TOP of the result; both fall back to the clean voice on failure and keep their
  //   own cache. ProsodyEngine runs only for a question or unambiguous emphasis (own cache 'q').
  const prosodyEngine = new ProsodyEngine(
    selectEngine(baseEngine, config, availableModels, cache),
    cache.withNamespace('q'),
  );
  const engine = new EffectEngine(prosodyEngine, cache.withNamespace('fx'));
  log.info(
    `[index] motor TTS ativo: ${config.ttsEngine === 'neural' ? 'neural' : 'per-user (google+piper)'}`,
  );
  if (config.multilingualSegments) {
    log.warn(
      '[index] MULTILINGUAL_SEGMENTS ON; experimental per-segment multilingual synthesis is active.',
    );
  }

  const client = createClient();
  const deps: BotDeps = {
    client,
    db,
    engine,
    config,
    availableModels,
    players: new Map<string, GuildVoicePlayer>(),
    limiters: new Map(),
    // xsaid: last author read per guild, to avoid repeating "{name} said" back-to-back.
    lastSpeaker: new Map<string, string>(),
    // 5-min cooldown of the join greeting (anti-spam of joining/leaving the call).
    greetCooldown: new GreetCooldown(),
    leaderboardPoster: new LeaderboardPoster(),
    votePromoPoster: new VotePromoPoster(db),
    // Duplicate tracker for the reading anti-spam (opt-in per guild).
    dupTracker: new DuplicateTracker(),
    countGate: new CountGate(),
    translationProvider: createTranslationProvider(
      config.translationProvider ?? { kind: 'disabled' },
    ),
  };

  // Leave rule: Vozen only leaves the call when it becomes ALONE (zero humans in its
  // channel) — and by default it leaves IMMEDIATELY (ALONE_LEAVE_MS=0). It NEVER leaves due
  // to TTS inactivity: with at least 1 human, it stays in the call forever. The
  // AloneWatcher is re-evaluated in the
  // VoiceStateUpdate handler (client.ts). `humansInBotChannel` counts the non-bots
  // of the bot's current channel (null = the bot is not in voice); `leave` is the same path
  // as onIdle (removePlayer -> destroy the connection).
  deps.aloneWatcher = new AloneWatcher({
    humansInBotChannel: (guildId) => {
      const guild = client.guilds.cache.get(guildId);
      const chanId = guild?.members?.me?.voice?.channelId;
      if (!guild || !chanId) return null;
      const chan = guild.channels.cache.get(chanId);
      if (!chan || !chan.isVoiceBased()) return null;
      return chan.members.filter((m) => !m.user.bot).size;
    },
    leave: (guildId) => {
      removePlayer(deps, guildId);
      getVoiceConnection(guildId)?.destroy();
    },
    // 24/7 in-call: the guild stays in the channel even when alone only if it is Premium AND has the
    // toggle on (/config always-on, default OFF). isGuildPremium covers direct Premium + passes.
    stayInCall: (guildId) =>
      isGuildPremium(db, guildId, Date.now()) && getGuildConfig(db, guildId).stayInCall,
  });

  // Minigames (/game). The GameManager is decoupled from discord.js/SQLite: it receives a
  // GameEnv with the capabilities it needs (speak, send to channel, locale,
  // translate, persist scores), all backed by `deps`/`db`/`client`. `singleVoice`
  // and the system clock live in the manager. It sits in `deps.games`, read by
  // handleMessage (guesses) and by the leave funnel (removePlayer -> endGuild).
  const defaultVoiceOf = (guildId: string): string => {
    try {
      return getGuildConfig(db, guildId).defaultVoice || config.defaultVoice || 'en_US-amy-medium';
    } catch {
      return config.defaultVoice || 'en_US-amy-medium';
    }
  };
  // Chess board emojis: name->markup map filled BY REFERENCE in the
  // ClientReady (see below). Starts empty -> chess uses ASCII until it loads.
  const boardEmojis: Record<string, string> = {};
  deps.games = new GameManager({
    clock: systemClock,
    availableModels,
    defaultSpeed: config.defaultSpeed,
    defaultVoiceOf,
    boardEmojis,
    getPlayer: (guildId) => deps.players.get(guildId),
    sendToChannel: async (channelId, content) => {
      const ch = client.channels.cache.get(channelId);
      if (ch && 'send' in ch && typeof (ch as { send?: unknown }).send === 'function') {
        await (ch as { send: (c: unknown) => Promise<unknown> }).send(
          typeof content === 'string'
            ? channelCard(content, { allowedMentions: { parse: [] } })
            : content,
        );
      }
    },
    // Deletes a game's disposable thread at the end (via games/thread — best-effort).
    deleteChannel: (channelId) => deleteChannelSafe(client, channelId),
    localeOf: (guildId) => {
      try {
        return getGuildConfig(db, guildId).locale;
      } catch {
        return DEFAULT_LOCALE;
      }
    },
    translate: (key, locale, params) => t(key, locale, params),
    persistScores: (guildId, points) => persistGameScores(db, guildId, points),
    logError: (msg, err) => log.error(msg, err),
  });

  bindEvents(deps);
  installSignalHandlers(deps, () => {
    // systemctl restart and a normal VPS reboot deliver SIGTERM. Snapshot only the calls
    // live right now, so a clean administrator restart restores them but stale rows do not.
    writePlannedRejoinMarker(deps.players.keys());
  });

  // P9.7 — OPTIONAL HTTP health endpoint (uptime monitors). Only starts if
  // HEALTH_PORT is set. In a defensive try/catch: a problem opening the
  // port (e.g. already in use) must NEVER prevent the bot from starting.
  try {
    startHealthServer(
      config,
      config.publicStatusEnabled
        ? () => {
            let databaseReady = false;
            let providerStates: ('healthy' | 'degraded')[] = [];
            try {
              db.prepare('SELECT 1').get();
              databaseReady = true;
              providerStates = listProviderHealth(db).map((row) => row.health);
            } catch {
              // The public mapper intentionally sees only a coarse failed check.
            }
            return mapPublicStatus({
              botReady: client.ws.status === Status.Ready,
              databaseReady,
              providerStates,
              incidentMessage: config.publicStatusIncident,
            });
          }
        : undefined,
    );
  } catch (err) {
    log.error('[index] failed to start the health server (ignored)', err);
  }

  // The first verified vote on a Discord account grants 48h of Plus. A permanent
  // HMAC ledger makes retries/restarts idempotent, while the temporary entitlement
  // stays separate from paid Premium provenance. No DMs.
  const rewardVote = (userId: string, eventId?: string): boolean => {
    if (eventId && !claimTopggEvent(db, eventId)) return false;
    try {
      if (!config.voteRedemptionSecret) {
        throw new Error('VOTE_REDEMPTION_SECRET is required for the one-time vote reward');
      }
      const res = claimVoteReward(db, userId, Date.now(), config.voteRedemptionSecret);
      if (res.granted) {
        log.info(
          `[vote] one-time reward granted: +${VOTE_REWARD_HOURS}h of Plus (ends ${new Date(res.expiresAt!).toISOString()}).`,
        );
      } else {
        log.info('[vote] vote counted; this account already used its one-time reward.');
      }
      return true;
    } catch (err) {
      if (eventId) releaseTopggEvent(db, eventId);
      log.error('[vote] failed to grant a vote reward; requesting retry', err);
      throw err;
    }
  };

  // P11.5 — top.gg webhook on a DEDICATED PORT (optional): only starts with TOPGG_WEBHOOK_PORT.
  // In production we instead use the /webhook/topgg route on the API server (see startKofiWebhook
  // below), which is already public via Caddy — no need for a dedicated port+route. Defensive try/catch.
  try {
    startVoteWebhookServer(config, rewardVote);
  } catch (err) {
    log.error('[index] failed to start the top.gg webhook (ignored)', err);
  }

  // Ko-fi webhook (purchases -> premium). INERT without KOFI_WEBHOOK_TOKEN. Independent of the
  // gateway: starts right away (does not wait for ClientReady) to avoid missing events. try/catch to
  // never take down the startup (e.g. port in use).
  try {
    // Premium Panel (opt-in): read API on the SAME server. resolveGuildName reads the client's
    // guild cache ON DEMAND (already populated when a browser calls), so it can
    // be created here, before ClientReady.
    const statusApi = config.premiumApiEnabled
      ? createStatusApi({
          db,
          now: () => Date.now(),
          expectedClientId: config.clientId,
          // Wrapped (not raw `fetch`) so `this` is correct — avoids "Illegal invocation".
          fetchImpl: (u, i) => fetch(u, i),
          resolveGuildName: (id) => client.guilds.cache.get(id)?.name ?? null,
          logError: (m, err) => log.error(m, err),
        })
      : undefined;
    // Web config dashboard (opt-in, same gate/server as the panel). botHasGuild reads the client's
    // guild cache ON DEMAND — the authz (MANAGE_GUILD + bot present) lives in the module.
    const dashboardApi = config.premiumApiEnabled
      ? createDashboardApi({
          db,
          now: () => Date.now(),
          expectedClientId: config.clientId,
          fetchImpl: (u, i) => fetch(u, i),
          botHasGuild: (id) => client.guilds.cache.has(id),
          resolveChannels: (id) => {
            const guild = client.guilds.cache.get(id);
            return guild ? listAuthorizedTextChannels(guild) : [];
          },
          resolveVoiceChannels: (id) => {
            const guild = client.guilds.cache.get(id);
            return guild ? listAuthorizedVoiceChannels(guild) : [];
          },
          resolveRoles: (id) => {
            const guild = client.guilds.cache.get(id);
            return guild ? listConfigurableRoles(guild) : [];
          },
          availableModels,
          logError: (m, err) => log.error(m, err),
        })
      : undefined;
    // Admin console (plan 037): reuses statusApi.resolveIdentity to validate the owner's Discord
    // token. Only built when the panel API exists (same OAuth infrastructure). createAdminApi
    // computes enabled=false when the ADMIN_* env vars are absent, so the routes stay inert (404)
    // until configured — this is what keeps the public repo safe.
    // Short TTL cache (id -> identity) for the admin top-talkers card: avoids a REST fetch per
    // user on every panel refresh. Bounded by the small set of distinct top talkers.
    const userBriefCache = new Map<string, { brief: AdminUserBrief; at: number }>();
    const USER_BRIEF_TTL_MS = 10 * 60 * 1000;
    const adminApi = statusApi
      ? createAdminApi({
          db,
          now: () => Date.now(),
          resolveAuthorization: statusApi.resolveAuthorization,
          adminSessionSecret: config.adminSessionSecret,
          ownerId: config.ownerId,
          adminClientId: config.adminClientId,
          logInfo: (m) => log.info(m),
          defaultVoice: config.defaultVoice,
          availableModels,
          defaultEngine: config.ttsEngine,
          // Live guild snapshot for the servers tab: id/name/icon/memberCount only. The usage
          // stats come from talk_stats (already stored), never from a fresh read.
          resolveGuilds: () =>
            client.guilds.cache.map((g) => ({
              id: g.id,
              name: g.name,
              icon: g.iconURL({ size: 64 }) ?? null,
              memberCount: g.memberCount,
              joinedTimestamp: g.joinedTimestamp ?? null,
            })),
          // Identity (name + avatar) for the top-talkers card. Best-effort PER user: client cache
          // first (free), then a REST fetch with its own catch, so one un-fetchable id (left every
          // shared server / rate-limited) never nulls the whole list.
          resolveUsers: async (ids) => {
            const nowMs = Date.now();
            const out: AdminUserBrief[] = [];
            for (const id of ids) {
              const hit = userBriefCache.get(id);
              if (hit && nowMs - hit.at < USER_BRIEF_TTL_MS) {
                out.push(hit.brief);
                continue;
              }
              const user =
                client.users.cache.get(id) ?? (await client.users.fetch(id).catch(() => null));
              const brief: AdminUserBrief = user
                ? {
                    id,
                    username: user.username ?? null,
                    avatar: user.displayAvatarURL({ size: 64, extension: 'webp' }),
                  }
                : { id, username: null, avatar: null };
              userBriefCache.set(id, { brief, at: nowMs });
              out.push(brief);
            }
            return out;
          },
        })
      : undefined;
    startKofiWebhook({
      db,
      token: config.kofiWebhookToken,
      clientId: config.clientId,
      port: config.kofiWebhookPort,
      // Shop items (e.g. the annual passes): Ko-fi sends no product name, only the
      // direct_link_code — KOFI_SHOP_MAP is what turns that code into a grant. Parsed once.
      shopMap: parseShopMap(config.kofiShopMap),
      now: () => Date.now(),
      logInfo: (m) => log.info(m),
      logError: (m, err) => log.error(m, err),
      statusApi,
      dashboardApi,
      adminApi,
      adminPanelOrigin: config.adminPanelOrigin,
      apiOrigin: config.premiumApiEnabled ? config.premiumApiOrigin : undefined,
      // Vote reward on the SAME public port (POST /webhook/topgg) — no dedicated Caddy
      // needed. Only enabled with TOPGG_WEBHOOK_SECRET (without its own port).
      topggWebhookSecret: config.topggWebhookSecret,
      onUpvote: rewardVote,
      claimHelpWebhookUrl: config.claimHelpWebhookUrl,
    });
  } catch (err) {
    log.error('[index] failed to start the Premium HTTP server (ignored)', err);
  }

  // Wave 3 — auto-post of the server count to top.gg. OPT-IN (TOPGG_TOKEN).
  // Starts on ClientReady so guilds.cache.size is already populated. Defensive try/catch:
  // never prevent/take down the startup. The timer is unref'd (does not hold the process).
  client.once(Events.ClientReady, () => {
    // Startup diagnostic (1x per boot, no spam): confirms the app is well
    // configured — the identity (token == CLIENT_ID) and the "Interactions Endpoint URL"
    // in the Developer Portal, which, if set, STEALS all gateway interactions
    // (the bot is online but receives no commands). Reads the config via the bot's own
    // authenticated REST (does not print the token). Best-effort.
    void (async () => {
      try {
        const app = (await client.rest.get(Routes.currentApplication())) as {
          id?: string;
          interactions_endpoint_url?: string | null;
        };
        const idOk = client.user?.id === config.clientId;
        const endpoint = app.interactions_endpoint_url;
        log.info(
          `[diag] app: identidade ${idOk ? 'OK ✓' : '⚠️ token != CLIENT_ID'} · ` +
            `Interactions Endpoint URL ${endpoint ? '⚠️ SET (' + endpoint + '); remove it in the portal' : 'empty ✓'} · ` +
            `${client.guilds.cache.size} server(s)`,
        );
      } catch (err) {
        log.warn('[diag] failed to read the application configuration (ignored)', err);
      }
    })();
    try {
      startBotListUpdater({
        botId: config.clientId,
        token: config.topggToken,
        serverCount: () => client.guilds.cache.size,
      });
      if (config.topggToken) {
        // Top.gg v1 accepts Discord's public command JSON directly. Owner-only guild
        // commands are intentionally excluded because commandDefs contains public commands only.
        void syncTopggCommands(config.topggToken, commandDefs);
      }
    } catch (err) {
      log.error('[index] failed to start the bot-list updater (ignored)', err);
    }
    // Loads the chess board emojis (fills `boardEmojis` by reference).
    // Best-effort: failure => chess uses ASCII.
    void loadBoardEmojis(client, boardEmojis);
    // Discord Premium Apps: syncs the entitlements (native purchases) with the internal
    // premium. INERT if PREMIUM_*_SKU_ID are not set — in production today it is a
    // no-op (only /redeem), activated when the operator creates the SKUs post-verification.
    try {
      startEntitlementSync({
        client,
        db,
        sku: { guildSkuId: config.premiumGuildSkuId, userSkuId: config.premiumUserSkuId },
        now: () => Date.now(),
        logInfo: (m) => log.info(m),
        logError: (m, err) => log.error(m, err),
      });
    } catch (err) {
      log.error('[index] failed to start entitlement synchronization (ignored)', err);
    }
    // Compliance §5(b): purges the data of servers that removed the bot >30 days ago
    // (marked in guild_departed on the real guildDelete). Runs now and then 1x/day.
    try {
      startDepartedPurgeJob(db, (ids) =>
        log.info(
          `[retencao] purgados os dados de ${ids.length} servidor(es) saído(s): ${ids.join(', ')}`,
        ),
      );
    } catch (err) {
      log.error('[index] failed to start the departed-guild purge job (ignored)', err);
    }
    // Data minimization: purges the PENDING (unclaimed) Ko-fi purchases older than 90 days.
    // Runs now and then 1x/day. The buyer claims much earlier; renewals do not depend
    // on old pendings (they use the email->Discord ID map). Best-effort.
    try {
      startPendingPurgeJob(db, (removed) =>
        log.info(`[retention] purged ${removed} old pending Ko-fi purchase(s).`),
      );
    } catch (err) {
      log.error('[index] failed to start the pending Ko-fi purchase purge job (ignored)', err);
    }
    // The raw Discord id is needed only while its 48h reward is active. The
    // lifetime one-claim HMAC remains in vote_redemption, so this minimization
    // cannot make the account eligible again. Runs now and once per day.
    try {
      const purgeVoteEntitlements = (): void => {
        try {
          const removed = purgeExpiredVoteRewards(db, Date.now());
          if (removed > 0) {
            log.info(`[retention] purged ${removed} expired vote entitlement(s).`);
          }
        } catch (err) {
          log.error('[retention] vote entitlement purge failed (ignored)', err);
        }
      };
      purgeVoteEntitlements();
      const voteRewardTimer = setInterval(purgeVoteEntitlements, 24 * 60 * 60 * 1000);
      voteRewardTimer.unref?.();
    } catch (err) {
      log.error('[index] failed to start the vote entitlement purge job (ignored)', err);
    }
    // Removed voice-clone feature: purge the legacy voice-clones/ sample directory (biometric
    // .wav files) the deleted /voice clone feature stored on disk. Runs ONLY ONCE at startup
    // (`once(ClientReady...)`). Idempotent and best-effort — harmless when the directory is
    // already absent (rmSync force). Never prevents startup. The matching DB records are dropped
    // by the DROP TABLE user_clone migration in store/db.ts.
    try {
      const voiceClonesDir = path.join(path.dirname(config.dbPath), 'voice-clones');
      rmSync(voiceClonesDir, { recursive: true, force: true });
    } catch (err) {
      log.error('[index] legacy voice-clones directory cleanup failed (ignored)', err);
    }
    // Sweep of orphaned STT temporary WAVs in the tmpdir (crash between toWav and the rmSync in
    // finally). Startup-only reconciliation; runs only at startup, before any
    // STT session. Best-effort — never prevents startup.
    try {
      const removed = sweepOrphanSttTemps();
      if (removed > 0)
        log.info(`[retencao] sweep de temporários STT órfãos: ${removed} apagado(s).`);
    } catch (err) {
      log.error('[index] orphaned STT temp sweep failed (ignored)', err);
    }
    // gcloud_usage retention (monthly char counters): deletes months older than ~3
    // months. Runs now and then 1x/day. Avoids unbounded growth; the cost gate only looks
    // at the current month. Timer unref'd (never holds the process). Best-effort.
    try {
      const purgeGcloud = (): void => {
        try {
          const cutoff = monthKeyUTC(Date.now() - 92 * 86_400_000);
          const removed = purgeOldGcloudUsage(db, cutoff);
          if (removed > 0) {
            log.info(`[retention] purged ${removed} old gcloud_usage row(s) (< ${cutoff}).`);
          }
        } catch (err) {
          log.error('[retention] gcloud_usage purge failed (ignored)', err);
        }
      };
      purgeGcloud();
      const gcloudTimer = setInterval(purgeGcloud, 24 * 60 * 60 * 1000);
      gcloudTimer.unref?.();
    } catch (err) {
      log.error('[index] failed to start the gcloud_usage purge job (ignored)', err);
    }
    // Top.gg v1 event ids are protocol idempotency metadata, retained only long enough to
    // absorb retries/replays. The one-time reward HMAC ledger remains intentionally separate.
    try {
      const purgeTopgg = (): void => {
        try {
          const removed = purgeExpiredTopggEvents(db);
          if (removed > 0) log.info(`[retention] purged ${removed} expired top.gg event row(s).`);
        } catch (err) {
          log.error('[retention] top.gg event purge failed (ignored)', err);
        }
      };
      purgeTopgg();
      const topggTimer = setInterval(purgeTopgg, 24 * 60 * 60 * 1000);
      topggTimer.unref?.();
    } catch (err) {
      log.error('[index] failed to start the top.gg event purge job (ignored)', err);
    }
    // Premium 24/7 always restores. Ordinary calls restore after a planned deploy or clean
    // administrator/VPS restart; a crash has no clean signal and therefore no marker.
    try {
      const plannedRejoin = consumePlannedRejoinMarker();
      const resumeAfterDeploy = plannedRejoin !== null;
      const restoresPlannedGuild = (guildId: string): boolean =>
        plannedRejoin === 'all' || plannedRejoin?.has(guildId) === true;
      const channelStateOf = (guildId: string, channelId: string): ChannelState => {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return 'gone'; // we are no longer in the guild
        const chan = guild.channels.cache.get(channelId);
        if (!chan || !chan.isVoiceBased()) return 'gone'; // channel deleted / no longer a voice channel
        const me = guild.members.me;
        const perms = me ? chan.permissionsFor(me) : null;
        if (!perms?.has(PermissionFlagsBits.Connect) || !perms.has(PermissionFlagsBits.Speak)) {
          return 'no-perms';
        }
        return 'ready';
      };
      const rows = listVoicePresence(db);
      if (rows.length > 0) {
        const plan = planRejoin(rows, {
          stayInCall: (gid) =>
            restoresPlannedGuild(gid) ||
            (isGuildPremium(db, gid, Date.now()) && getGuildConfig(db, gid).stayInCall),
          channelState: channelStateOf,
        });
        for (const gid of plan.forget) forgetVoicePresence(db, gid);
        let rejoined = 0;
        for (const row of plan.rejoin) {
          try {
            const guild = client.guilds.cache.get(row.guildId);
            if (!guild) continue;
            createVoiceSession(deps, row.guildId, row.channelId, guild.voiceAdapterCreator);
            const chan = guild.channels.cache.get(row.channelId);
            if (chan?.isVoiceBased()) becomeSpeakerIfStage(chan);
            rejoined++;
          } catch (err) {
            log.warn(`[voice] failed to restore 24/7 mode in guild ${row.guildId} (ignored)`, err);
          }
        }
        log.info(
          `[voice] startup rejoin (${resumeAfterDeploy ? 'deploy' : '24/7'}): ${rejoined} servidor(es) repostos, ${plan.forget.length} presença(s) limpa(s).`,
        );
      }
    } catch (err) {
      log.error('[index] 24/7 rejoin failed (ignored)', err);
    }
    // OWNER-ONLY commands (/vozen-grant): resolves the REAL owner(s) via the application
    // (User or Team members) + OWNER_ID, and registers the command ONLY in the control guild
    // (guild command => invisible to the public). deps.ownerIds is the source of truth for the gate.
    void (async () => {
      try {
        const app = await client.application?.fetch();
        const ids = new Set<string>();
        if (config.ownerId) ids.add(config.ownerId);
        const owner = app?.owner;
        if (owner) {
          if ('members' in owner && owner.members) {
            for (const m of owner.members.values()) if (m.user?.id) ids.add(m.user.id);
          } else if ('id' in owner) {
            ids.add(owner.id);
          }
        }
        deps.ownerIds = ids;
        log.info(`[owner] resolved ${ids.size} owner(s) for /vozen-grant.`);
        if (config.ownerGuildId) {
          await registerOwnerCommands(config.token, config.clientId, config.ownerGuildId);
        } else {
          log.info('[owner] OWNER_GUILD_ID is not set; /vozen-grant will not be registered.');
        }
      } catch (err) {
        log.error('[owner] failed to resolve owners or register /vozen-grant (ignored)', err);
      }
    })();
  });

  // Synchronizing the commands is NOT fatal: it is a heavily rate-limited global PUT
  // (429s) and the commands were already registered from previous startups. If it fails
  // (429/network), we warn and proceed to login — the bot starts with the set of
  // commands already registered. Before, a transient 429 aborted the startup and, under the
  // supervisor, entered a crash-loop re-firing the rate-limited PUT (burning the
  // daily global-command quota and prolonging the failure).
  try {
    // stateFile next to the DB: the global PUT only happens when the commands CHANGE
    // (fingerprint) — less rate-limit and less client cache churn post-restart.
    await registerCommands(config.token, config.clientId, {
      stateFile: path.join(path.dirname(config.dbPath), 'commands-state.json'),
    });
  } catch (err) {
    log.error('[index] failed to synchronize commands; starting with existing commands', err);
  }
  await client.login(config.token);
}

main().catch((err) => {
  log.error('[index] fatal startup failure', err);
  process.exit(1);
});
