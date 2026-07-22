import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  Interaction,
  Message,
  Guild,
  VoiceState,
} from 'discord.js';
import type { BotDeps } from './deps';
import { handleGuildDelete, getPlayer } from './deps';
import { markGuildDeparted, unmarkGuildDeparted } from '../store/guildDeparted';
import { handleInteraction, handleAutocomplete, handleMessageContextMenu } from '../commands/index';
import { handleMessage } from '../commands/messageHandler';
import { getGuildConfig } from '../store/guildConfig';
import { getNickname } from '../store/nickname';
import { sanitizeSpeakerName } from '../language/speakerName';
import { buildGreeting, isJoinIntoChannel } from '../voice/greeting';
import { getBirthday, isBirthdayToday } from '../store/birthday';
import { buildPresence } from './presence';
import { pickWelcomeChannel, buildWelcomeEmbed, welcomeLocaleFor } from './welcome';
import { createErrorReporter } from '../errorReporter';
import { bindGatewayWatch } from './gatewayWatch';
import { log } from '../logging/logger';
import { addOperationalMetric, setProviderHealth } from '../store/operationalMetrics';
import { handleTranslationReaction } from '../translation/reaction';

export function createClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User],
    // Global security default: user-controlled bot output cannot mention everyone,
    // roles, or users unless a call site opts in explicitly.
    allowedMentions: { parse: [] },
  });
}

/**
 * Voice greeting: Vozen says "Hello {name}" when a HUMAN joins the voice channel it's
 * in. ON by default (guild_config.greet_on_join); language in greet_locale (default
 * English). Best-effort and defensive: never crashes the gateway. Ignores bots (incl.
 * itself), respects the kill-switch (enabled) and requires an active player. The name is
 * resolved and SANITIZED as in xsaid (honors the /voice nickname).
 */
function greetOnJoin(deps: BotDeps, oldState: VoiceState, newState: VoiceState): void {
  try {
    const member = newState.member;
    if (!member || member.user.bot) return;
    const guildId = newState.guild?.id;
    if (!guildId) return;
    const player = getPlayer(deps, guildId);
    if (!player) return;
    const botChannelId = newState.guild.members.me?.voice?.channelId ?? null;
    if (!isJoinIntoChannel(oldState.channelId, newState.channelId, botChannelId)) return;
    const cfg = getGuildConfig(deps.db, guildId);
    if (!cfg.enabled) return; // server kill-switch
    // Birthday? If the person's birthday is today, Vozen says "Happy birthday {name}" instead of "Hello".
    const bd = getBirthday(deps.db, guildId, member.id);
    const isBirthday = bd !== null && isBirthdayToday(bd, new Date());
    // BIRTHDAY wishes are individual and intentional opt-in (the person registered the
    // date themselves), so they fire even with the normal greeting off. The "Hello"
    // greeting only fires if `greetOnJoin` is ON. No birthday AND no greeting -> nothing to say.
    if (!isBirthday && !cfg.greetOnJoin) return;
    // 5-min cooldown per (guild, user): whoever spams join/leave is greeted only once
    // per window — covers the normal greeting AND the birthday wishes. Only consulted
    // here (after we know there IS something to say) so as not to waste the window. Without
    // the map (old tests) there's no cooldown (old behavior: always greets).
    if (deps.greetCooldown && !deps.greetCooldown.shouldGreet(guildId, member.id)) return;
    const rawName =
      getNickname(deps.db, guildId, member.id) ?? member.displayName ?? member.user.username ?? '';
    const req = buildGreeting({
      locale: cfg.greetLocale,
      name: sanitizeSpeakerName(rawName),
      availableModels: deps.availableModels,
      defaultVoice: cfg.defaultVoice || deps.config.defaultVoice || 'en_US-amy-medium',
      defaultSpeed: deps.config.defaultSpeed,
      birthday: isBirthday,
    });
    void player.say(req);
  } catch (err) {
    log.warn('[client] join greeting failed (ignored)', err);
  }
}

export function bindEvents(deps: BotDeps): void {
  const { client } = deps;

  client.once(Events.ClientReady, (c) => {
    log.info(`[client] online as ${c.user.tag}`);
    try {
      setProviderHealth(deps.db, 'internal', 'healthy');
    } catch (err) {
      log.warn('[metrics] failed to initialise local provider health (ignored)', err);
    }
    // P9.3 — presence as subtle self-marketing (brand + CTA). Defensive: never let a
    // presence failure crash the bot startup.
    try {
      c.user.setPresence(buildPresence(deps.config));
    } catch (err) {
      log.warn('[client] failed to set presence (ignored)', err);
    }
  });

  client.on(Events.InteractionCreate, (interaction: Interaction) => {
    if (interaction.isAutocomplete()) {
      void handleAutocomplete(interaction, deps);
      return;
    }
    // Message context-menu (right-click -> Apps -> Speak).
    if (interaction.isMessageContextMenuCommand()) {
      void handleMessageContextMenu(interaction, deps);
      return;
    }
    if (!interaction.isChatInputCommand()) return;
    try {
      addOperationalMetric(deps.db, 'command_invoked', 'internal');
    } catch (err) {
      log.warn('[metrics] failed to record command aggregate (ignored)', err);
    }
    void handleInteraction(interaction, deps);
  });

  client.on(Events.MessageCreate, (message: Message) => {
    void handleMessage(message, deps);
  });

  client.on(Events.MessageReactionAdd, (reaction, user) => {
    void handleTranslationReaction(reaction, user, deps);
  });

  // VoiceStateUpdate — someone joined/left/switched voice channel. Serves the rule
  // "the bot only leaves when it's alone in the call" (AloneWatcher re-evaluates the guild).
  // HIGH-FREQUENCY (fires on every mute/deafen across the whole server), hence the early
  // bail: only act where the bot HAS a player (is in a call in this guild).
  client.on(Events.VoiceStateUpdate, (oldState: VoiceState, newState: VoiceState) => {
    const guildId = newState.guild?.id ?? oldState.guild?.id;
    if (!guildId || !deps.players.has(guildId)) return;
    deps.aloneWatcher?.evaluate(guildId);
    // Greeting: someone JOINED the bot's channel -> "Hello {name}" (if enabled).
    greetOnJoin(deps, oldState, newState);
  });

  // guildCreate — Vozen joined a new server. We send a welcome embed ONCE (beginner
  // onboarding) to a suitable channel. The event is already 1x per join, so it doesn't
  // need dedup. All the testable decision lives in welcome.ts
  // (pickWelcomeChannel/buildWelcomeEmbed); here we just wire the pieces: null -> don't
  // send; try/catch to NEVER crash (new guild = default locale 'en').
  client.on(Events.GuildCreate, (guild: Guild) => {
    try {
      addOperationalMetric(deps.db, 'guild_join', 'internal');
    } catch (err) {
      log.warn('[metrics] failed to record server-join aggregate (ignored)', err);
    }
    // Re-invite: cancel any scheduled purge (the bot came back within the grace period).
    try {
      if (deps.db) unmarkGuildDeparted(deps.db, guild.id);
    } catch (err) {
      log.warn('[retention] failed to clear the departed-guild marker (ignored)', err);
    }
    void (async () => {
      try {
        const channel = pickWelcomeChannel(
          guild as unknown as Parameters<typeof pickWelcomeChannel>[0],
        );
        if (!channel) return;
        // Localize the welcome to the SERVER's own Discord language (preferredLocale),
        // falling back to English. guildCreate has no user interaction, so this is the
        // best signal — a Portuguese/Russian server no longer gets an English welcome.
        const embed = buildWelcomeEmbed(welcomeLocaleFor(guild.preferredLocale));
        // The chosen channel is always a sendable GuildText (pickWelcomeChannel already
        // validated ViewChannel+SendMessages); we use the real instance from the cache.
        const sendable = guild.channels.cache.get(channel.id);
        if (sendable && 'send' in sendable && typeof sendable.send === 'function') {
          await sendable.send({ embeds: [embed] });
        }
      } catch (err) {
        log.warn('[client] failed to send the welcome embed (ignored)', err);
      }
    })();
  });

  // guildDelete — Vozen left (kick/leave) or lost access to a guild. Release the
  // resources held by guildId (limiter + player) so as not to leak memory over long
  // uptime. All the testable logic lives in handleGuildDelete (deps.ts).
  // IMPORTANT: Discord ALSO fires this on transient guild OUTAGES
  // (guild.available === false). In that case we DON'T destroy the session — the voice
  // connection survives the blip and its own reconnection (VoiceConnectionStatus.Disconnected
  // -> handleDisconnect) handles the rest. If we destroyed it, the bot would silently leave
  // the call and ONLY come back when someone sent a message/`/join` (no automatic re-join on
  // GuildAvailable). We only release resources on a REAL removal (available !== false).
  client.on(Events.GuildDelete, (guild: Guild) => {
    if (guild.available === false) return;
    handleGuildDelete(deps, guild.id);
    // Compliance §5(b): mark the REAL departure (the guard above already excludes outages).
    // A daily job purges the data 30 days later if the bot isn't re-invited. try/catch:
    // never crash the gateway because of retention.
    try {
      if (deps.db) markGuildDeparted(deps.db, guild.id, Date.now());
    } catch (err) {
      log.warn('[retention] failed to mark the guild as departed (ignored)', err);
    }
  });

  // Wave 3 — error reporter to a Discord webhook (OPT-IN via ERROR_WEBHOOK_URL).
  // Sends the UNEXPECTED errors (gateway/rejections/exceptions) so the operator can see
  // production problems without reading logs. No-op without url; dedup by hash; never throws.
  const errorReporter = createErrorReporter(deps.config.errorWebhookUrl);

  client.on(Events.Error, (err) => {
    log.error('[client] gateway error', err);
    void errorReporter.report(err, 'gateway');
  });

  // GATEWAY observability + recovery (fix for the recurring "Failed to load options":
  // the bot stayed online but stopped RECEIVING interactions — zombie gateway, invisible
  // in the log). Wires the shard listeners and a watchdog that restarts cleanly if the
  // gateway goes down. process.exit(1) => the supervisor (start-prod.mjs) restarts with a
  // fresh session.
  bindGatewayWatch({
    client,
    logInfo: (m) => log.info(m),
    logWarn: (m) => log.warn(m),
    logError: (m, e) => log.error(m, e),
    reportError: (e, ctx) => void errorReporter.report(e, ctx),
    exit: () => process.exit(1),
  });

  process.on('unhandledRejection', (reason) => {
    log.error('[process] unhandledRejection', reason);
    void errorReporter.report(reason, 'unhandledRejection');
  });
  process.on('uncaughtException', (err) => {
    log.error(
      '[process] uncaughtException; reporting and exiting for a clean supervisor restart',
      err,
    );
    // Node guidance: after an uncaught exception the process is in an undefined state.
    // We exit with code != 0 so the supervisor (start-prod.mjs) restarts fresh, instead
    // of staying "alive but broken" — which the health endpoint would report as OK while
    // the bot is wedged. Short window for the error webhook to drain before exiting.
    const exit = (): void => process.exit(1);
    const t = setTimeout(exit, 2000);
    t.unref();
    void errorReporter.report(err, 'uncaughtException').finally(exit);
  });
}
