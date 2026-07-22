#![forbid(unsafe_code)]

//! Discord gateway adapter for the Rust migration.
//!
//! This crate owns only connection lifecycle and the minimal intent set. It deliberately does
//! not register commands on startup, start voice sessions, or send user content until those
//! operations have their Node parity contracts and tests.

use std::{
    collections::{BTreeMap, BTreeSet},
    env,
    sync::{
        Arc, LazyLock, RwLock,
        atomic::{AtomicBool, Ordering},
    },
};

use serenity::{
    async_trait,
    client::{Client, Context, EventHandler},
    model::gateway::{GatewayIntents, Ready},
};
use songbird::serenity::SerenityInit;
use thiserror::Error;
use vozen_contracts::{ContractError, DiscordCommandCatalog};

mod command_registration;
mod command_routing;
mod command_speech_pipeline;
mod core_voice_command;
mod core_voice_executor;
mod core_voice_interaction;
mod core_voice_response;
mod core_voice_service;
mod dashboard_options;
mod interaction_dispatch;
mod message_admission;
mod message_interaction;
mod message_media;
mod message_pipeline;
mod message_voice_service;
mod planned_rejoin;
mod rejoin_service;
mod songbird_transport;
mod speech_preparation;
mod voice_i18n;
mod voice_playback;
mod voice_session;

pub use command_registration::{
    CommandRegistrationClient, CommandRegistrationConfig, CommandRegistrationError,
    CommandRegistrationOutcome, DiscordHttpCommandRegistrationClient, register_commands,
};
pub use command_routing::{CommandArea, command_area, route_command};
pub use command_speech_pipeline::{
    CommandSpeechInput, CommandSpeechOutcome, CommandSpeechPipeline,
};
pub use core_voice_command::{CoreVoiceCommand, CoreVoiceCommandError, parse_promoted_core_voice};
pub use core_voice_executor::{
    CoreVoiceExecutionError, CoreVoiceInteractionExecution, CoreVoiceInteractionExecutor,
};
pub use core_voice_interaction::CoreVoiceInteractionFacts;
pub use core_voice_response::{CoreVoiceResponse, core_voice_response};
pub use core_voice_service::{
    CommandPlaybackError, CommandPlaybackState, CommandSpeechSynthesizer, CommandSynthesisError,
    CommandVoicePlayback, CorePlaybackControlOutcome, CoreTtsOutcome, CoreVoiceInvocation,
    CoreVoiceOutcome, CoreVoiceService, CoreVoiceSettings,
};
pub use dashboard_options::{
    DiscordDashboardOption, DiscordDashboardOptions, DiscordDashboardOptionsProvider,
    locale_display_options, voice_display_options,
};
pub use interaction_dispatch::{
    DispatchOutcome, InteractionDispatchError, InteractionHandler, dispatch_interaction,
};
pub use message_admission::{DiscordMessageFacts, admit_discord_message};
pub use message_interaction::DiscordMessageFactsOwned;
pub use message_media::collect_message_media;
pub use message_pipeline::{MessagePipelineOutcome, MessageSpeechPipeline};
pub use message_voice_service::{MessageVoiceInvocation, MessageVoiceOutcome, MessageVoiceService};
pub use planned_rejoin::{
    MAX_PLANNED_REJOIN_AGE, PLANNED_REJOIN_MARKER, PlannedRejoinScope, RejoinChannelState,
    RejoinPlan, consume_planned_rejoin_marker, plan_rejoin, write_planned_rejoin_marker,
};
pub use rejoin_service::{PlannedRejoinError, PlannedRejoinOutcome, PlannedRejoinService};
pub use songbird_transport::SongbirdVoiceSessionTransport;
pub use speech_preparation::{
    MessagePreparationInput, MessagePreparationOutcome, MessageSpeechDraft, PreparedMessageSpeech,
    begin_message_speech, finish_message_speech, prepare_message_speech,
};
pub use voice_i18n::{VoiceResponseLocalizer, VoiceResponseLocalizerError};
pub use voice_playback::{
    SongbirdCommandPlayback, VoicePlaybackError, join_and_enqueue_wav, leave_voice,
};
pub use voice_session::{
    JoinVoiceOutcome, LeaveVoiceOutcome, VoiceSessionService, VoiceSessionTransport,
    VoiceSessionTransportError,
};

/// Optional event boundary used while command/message paths are promoted from the Node runtime.
/// The gateway itself remains responsible only for Discord connection state; implementations own
/// their response deadline, content handling and error accounting.
#[async_trait]
pub trait GatewayEventSink: Send + Sync {
    /// Runs after this process has received READY and published its transient bot identity.
    /// Implementations must treat it as an availability hook: a failure cannot prevent the
    /// gateway from accepting later events, and reconnects may deliver READY again.
    async fn on_ready(&self, _context: Context) -> Result<(), GatewayEventDispatchError> {
        Ok(())
    }

    async fn on_message(
        &self,
        context: Context,
        message: serenity::model::channel::Message,
    ) -> Result<(), GatewayEventDispatchError>;

    async fn on_interaction(
        &self,
        context: Context,
        interaction: serenity::model::application::Interaction,
    ) -> Result<(), GatewayEventDispatchError>;

    async fn on_guild_delete(&self, guild_id: &str) -> Result<(), GatewayEventDispatchError>;
}

/// A sink error is intentionally content-free. Gateway callbacks discard it after the sink has
/// recorded safe operational context, so a malformed message can never crash or expose text from
/// the shard task.
#[derive(Debug, Error)]
#[error("promoted gateway event handler failed")]
pub struct GatewayEventDispatchError;

/// Minimal gateway facts used by the Rust adapters. It intentionally contains neither message
/// content, profiles nor tokens: the only live voice data is a transient guild/user/channel ID
/// mapping required to enforce same-call speech admission without Serenity's global member cache.
#[derive(Clone, Default)]
pub struct GatewayState {
    ready: Arc<AtomicBool>,
    bot_user_id: Arc<RwLock<Option<String>>>,
    guild_ids: Arc<RwLock<BTreeSet<String>>>,
    guild_names: Arc<RwLock<BTreeMap<String, String>>>,
    voice_channels: Arc<RwLock<BTreeMap<String, BTreeMap<String, String>>>>,
    /// HTTP is retained after READY only for low-frequency, authorized dashboard option lookups.
    /// It contains no message content or cached guild/member state.
    http: Arc<RwLock<Option<Arc<serenity::http::Http>>>>,
}

impl GatewayState {
    /// Whether this process received Discord's READY event. The value contains no guild or user
    /// identifiers and is safe to consume in the coarse public status mapper.
    pub fn is_ready(&self) -> bool {
        self.ready.load(Ordering::Acquire)
    }

    pub fn bot_has_guild(&self, guild_id: &str) -> bool {
        self.guild_ids
            .read()
            .is_ok_and(|guild_ids| guild_ids.contains(guild_id))
    }

    pub fn guild_ids(&self) -> Vec<String> {
        self.guild_ids
            .read()
            .map(|guild_ids| guild_ids.iter().cloned().collect())
            .unwrap_or_default()
    }

    /// Current gateway membership count for observability only. It never causes an outbound
    /// guild fetch, so startup can report zero until Discord sends READY.
    pub fn guild_count(&self) -> usize {
        self.guild_ids
            .read()
            .map(|guild_ids| guild_ids.len())
            .unwrap_or(0)
    }

    /// Returns a live gateway-cached name for a guild. This cache is intentionally best-effort:
    /// callers must tolerate `None` until Discord has supplied a Guild Create event, rather than
    /// performing a request or returning a stale persisted name.
    pub fn guild_name(&self, guild_id: &str) -> Option<String> {
        self.guild_names
            .read()
            .ok()
            .and_then(|guild_names| guild_names.get(guild_id).cloned())
    }

    /// Returns Vozen's current voice channel for a guild. It is absent until the READY identity
    /// and a voice state are both known, so message admission always fails closed during startup.
    pub fn bot_voice_channel_id(&self, guild_id: &str) -> Option<String> {
        let bot_user_id = self.bot_user_id.read().ok()?.clone()?;
        self.voice_channel_id(guild_id, &bot_user_id)
    }

    /// Snapshots only Vozen's current guild/channel pairs for a clean shutdown marker. The
    /// result is derived exclusively from this gateway process and never from SQLite, so a
    /// historical row cannot turn a later restart into an unexpected rejoin.
    pub fn bot_voice_sessions(&self) -> Vec<(String, String)> {
        let Some(bot_user_id) = self.bot_user_id() else {
            return Vec::new();
        };
        self.voice_channels
            .read()
            .map(|guilds| {
                guilds
                    .iter()
                    .filter_map(|(guild_id, users)| {
                        users
                            .get(&bot_user_id)
                            .cloned()
                            .map(|channel_id| (guild_id.clone(), channel_id))
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Current bot identity received from Discord READY. It is transient process state, never a
    /// persisted credential or application configuration value.
    pub fn bot_user_id(&self) -> Option<String> {
        self.bot_user_id.read().ok()?.clone()
    }

    /// Returns the current voice channel only if the gateway has seen a state for this exact
    /// guild/user pair. Missing state intentionally fails closed in the speech admission layer.
    pub fn voice_channel_id(&self, guild_id: &str, user_id: &str) -> Option<String> {
        self.voice_channels.read().ok().and_then(|guilds| {
            guilds
                .get(guild_id)
                .and_then(|users| users.get(user_id))
                .cloned()
        })
    }

    pub(crate) fn discord_http(&self) -> Option<Arc<serenity::http::Http>> {
        self.http.read().ok()?.clone()
    }

    fn replace_guilds(&self, guild_ids: impl IntoIterator<Item = String>) {
        let guild_ids = guild_ids.into_iter().collect::<BTreeSet<_>>();
        if let Ok(mut current) = self.guild_ids.write() {
            *current = guild_ids.clone();
        }
        if let Ok(mut guild_names) = self.guild_names.write() {
            guild_names.retain(|guild_id, _| guild_ids.contains(guild_id));
        }
    }

    fn remember_bot_user(&self, user_id: String) {
        if let Ok(mut bot_user_id) = self.bot_user_id.write() {
            *bot_user_id = Some(user_id);
        }
    }

    fn mark_ready(&self) {
        self.ready.store(true, Ordering::Release);
    }

    /// Sets only the bot's own transient voice fact. Used by `/join` and `/leave` to close the
    /// gap before Discord sends the subsequent voice-state gateway update.
    pub(crate) fn set_bot_voice_channel(&self, guild_id: &str, channel_id: Option<String>) {
        let Some(bot_user_id) = self.bot_user_id.read().ok().and_then(|id| id.clone()) else {
            return;
        };
        self.update_voice_state(guild_id, &bot_user_id, channel_id);
    }

    fn remember_guild(&self, guild_id: String, guild_name: String) {
        if let Ok(mut current) = self.guild_ids.write() {
            current.insert(guild_id.clone());
        }
        if let Ok(mut guild_names) = self.guild_names.write() {
            guild_names.insert(guild_id, guild_name);
        }
    }

    fn remember_http(&self, http: Arc<serenity::http::Http>) {
        if let Ok(mut current) = self.http.write() {
            *current = Some(http);
        }
    }

    fn replace_guild_voice_states(&self, guild: &serenity::model::guild::Guild) {
        let voice_states = guild
            .voice_states
            .iter()
            .filter_map(|(user_id, state)| {
                state
                    .channel_id
                    .map(|channel_id| (user_id.get().to_string(), channel_id.get().to_string()))
            })
            .collect::<BTreeMap<_, _>>();
        if let Ok(mut guilds) = self.voice_channels.write() {
            guilds.insert(guild.id.get().to_string(), voice_states);
        }
    }

    fn update_voice_state(&self, guild_id: &str, user_id: &str, channel_id: Option<String>) {
        if let Ok(mut guilds) = self.voice_channels.write() {
            let users = guilds.entry(guild_id.to_owned()).or_default();
            match channel_id {
                Some(channel_id) => {
                    users.insert(user_id.to_owned(), channel_id);
                }
                None => {
                    users.remove(user_id);
                    if users.is_empty() {
                        guilds.remove(guild_id);
                    }
                }
            }
        }
    }

    fn forget_guild(&self, guild_id: &str) {
        if let Ok(mut current) = self.guild_ids.write() {
            current.remove(guild_id);
        }
        if let Ok(mut guild_names) = self.guild_names.write() {
            guild_names.remove(guild_id);
        }
        if let Ok(mut voice_channels) = self.voice_channels.write() {
            voice_channels.remove(guild_id);
        }
    }
}

const DISCORD_COMMANDS: &str = include_str!("../../../contracts/discord-commands.json");

static COMMAND_CATALOG: LazyLock<DiscordCommandCatalog> = LazyLock::new(|| {
    DiscordCommandCatalog::from_json(DISCORD_COMMANDS).expect("valid command contract")
});

/// Exact gateway permissions requested by the current Node bot. `MESSAGE_CONTENT` is the only
/// privileged intent. Member and presence intents must not be added without a new requirement.
pub fn vozen_gateway_intents() -> GatewayIntents {
    GatewayIntents::GUILDS
        | GatewayIntents::GUILD_VOICE_STATES
        | GatewayIntents::GUILD_MESSAGES
        | GatewayIntents::GUILD_MESSAGE_REACTIONS
        | GatewayIntents::MESSAGE_CONTENT
}

/// Extracts only the subcommand/group chain from a Serenity interaction option tree.
/// Leaf argument values are deliberately excluded; their validation belongs to the handler.
pub fn command_path_from_options(
    options: &[serenity::model::application::CommandDataOption],
) -> Vec<&str> {
    use serenity::model::application::CommandDataOptionValue;

    let mut path = Vec::new();
    let mut current = options;
    loop {
        let Some(option) = current.iter().find(|option| {
            matches!(
                option.value,
                CommandDataOptionValue::SubCommand(_) | CommandDataOptionValue::SubCommandGroup(_)
            )
        }) else {
            return path;
        };
        path.push(option.name.as_str());
        current = match &option.value {
            CommandDataOptionValue::SubCommand(options)
            | CommandDataOptionValue::SubCommandGroup(options) => options,
            _ => unreachable!("subcommand selection was matched above"),
        };
    }
}

/// Validates an incoming Discord command against the versioned catalog before dispatch.
/// This has no side effects and is intentionally separate from response/handler code.
pub fn validate_command_interaction(
    command: &serenity::model::application::CommandData,
) -> Result<(), ContractError> {
    let path = command_path_from_options(&command.options);
    COMMAND_CATALOG
        .resolve_command(&command.name, command.kind.into(), &path)
        .map(|_| ())
}

/// Runtime configuration. The token is intentionally private and the type does not implement
/// `Debug`, preventing accidental log exposure.
pub struct DiscordRuntimeConfig {
    token: String,
}

impl DiscordRuntimeConfig {
    pub fn from_environment() -> Result<Self, DiscordRuntimeError> {
        let token = env::var("DISCORD_TOKEN").map_err(|_| DiscordRuntimeError::MissingToken)?;
        Self::from_token(token)
    }

    pub fn from_token(token: String) -> Result<Self, DiscordRuntimeError> {
        if token.trim().is_empty() {
            return Err(DiscordRuntimeError::MissingToken);
        }
        Ok(Self { token })
    }
}

#[derive(Debug, Error)]
pub enum DiscordRuntimeError {
    #[error("DISCORD_TOKEN is required to start the Discord gateway")]
    MissingToken,
    #[error("Discord gateway error: {0}")]
    Serenity(Box<serenity::Error>),
}

/// Starts the Discord gateway using Discord's recommended shard count. Command registration is
/// intentionally a separate future operation: doing REST registration on every gateway restart
/// would consume Discord's global command quota and invalidate client caches.
pub async fn run_discord_gateway(config: DiscordRuntimeConfig) -> Result<(), DiscordRuntimeError> {
    run_discord_gateway_with_state(config, GatewayState::default()).await
}

/// Starts the gateway while keeping only current bot-guild membership synchronized for API
/// authorization and planned call restoration. The caller owns the state handle, so no global
/// cache can outlive the gateway process.
pub async fn run_discord_gateway_with_state(
    config: DiscordRuntimeConfig,
    gateway_state: GatewayState,
) -> Result<(), DiscordRuntimeError> {
    run_discord_gateway_with_state_and_sink(config, gateway_state, None).await
}

/// Starts the gateway with an explicitly promoted event sink. Passing `None` keeps the current
/// shadow-runtime behaviour: state is synchronized, but no message or interaction is consumed.
/// A caller must construct and pass the sink deliberately, so merely compiling a Rust handler
/// cannot race the still-authoritative Node bot on the same Discord application.
pub async fn run_discord_gateway_with_state_and_sink(
    config: DiscordRuntimeConfig,
    gateway_state: GatewayState,
    event_sink: Option<Arc<dyn GatewayEventSink>>,
) -> Result<(), DiscordRuntimeError> {
    let mut client = Client::builder(config.token, vozen_gateway_intents())
        // Registers the voice gateway/driver but never joins a call by itself. Join/rejoin
        // policy remains behind a tested command handler in a later migration step.
        .register_songbird()
        .event_handler(VozenGatewayHandler {
            gateway_state,
            event_sink,
        })
        .await
        .map_err(|error| DiscordRuntimeError::Serenity(Box::new(error)))?;
    client
        .start_autosharded()
        .await
        .map_err(|error| DiscordRuntimeError::Serenity(Box::new(error)))?;
    Ok(())
}

struct VozenGatewayHandler {
    gateway_state: GatewayState,
    event_sink: Option<Arc<dyn GatewayEventSink>>,
}

#[async_trait]
impl EventHandler for VozenGatewayHandler {
    async fn ready(&self, context: Context, ready: Ready) {
        self.gateway_state.remember_http(context.http.clone());
        self.gateway_state.mark_ready();
        self.gateway_state
            .remember_bot_user(ready.user.id.get().to_string());
        self.gateway_state
            .replace_guilds(ready.guilds.iter().map(|guild| guild.id.get().to_string()));
        if let Some(event_sink) = &self.event_sink {
            let _ = event_sink.on_ready(context).await;
        }
    }

    async fn guild_create(
        &self,
        _context: Context,
        guild: serenity::model::guild::Guild,
        _is_new: Option<bool>,
    ) {
        self.gateway_state
            .remember_guild(guild.id.get().to_string(), guild.name.clone());
        self.gateway_state.replace_guild_voice_states(&guild);
    }

    async fn guild_delete(
        &self,
        _context: Context,
        incomplete: serenity::model::guild::UnavailableGuild,
        _full: Option<serenity::model::guild::Guild>,
    ) {
        let guild_id = incomplete.id.get().to_string();
        self.gateway_state.forget_guild(&guild_id);
        if let Some(event_sink) = &self.event_sink {
            let _ = event_sink.on_guild_delete(&guild_id).await;
        }
    }

    async fn voice_state_update(
        &self,
        _context: Context,
        _old: Option<serenity::model::voice::VoiceState>,
        new: serenity::model::voice::VoiceState,
    ) {
        let Some(guild_id) = new.guild_id else {
            return;
        };
        self.gateway_state.update_voice_state(
            &guild_id.get().to_string(),
            &new.user_id.get().to_string(),
            new.channel_id
                .map(|channel_id| channel_id.get().to_string()),
        );
    }

    async fn message(&self, context: Context, message: serenity::model::channel::Message) {
        if let Some(event_sink) = &self.event_sink {
            let _ = event_sink.on_message(context, message).await;
        }
    }

    async fn interaction_create(
        &self,
        context: Context,
        interaction: serenity::model::application::Interaction,
    ) {
        if let Some(event_sink) = &self.event_sink {
            let _ = event_sink.on_interaction(context, interaction).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn asks_for_exactly_the_existing_intent_set() {
        let expected = GatewayIntents::GUILDS
            | GatewayIntents::GUILD_VOICE_STATES
            | GatewayIntents::GUILD_MESSAGES
            | GatewayIntents::GUILD_MESSAGE_REACTIONS
            | GatewayIntents::MESSAGE_CONTENT;
        assert_eq!(vozen_gateway_intents(), expected);
        assert!(!vozen_gateway_intents().contains(GatewayIntents::GUILD_MEMBERS));
        assert!(!vozen_gateway_intents().contains(GatewayIntents::GUILD_PRESENCES));
    }

    #[test]
    fn rejects_missing_or_blank_tokens_without_exposing_them() {
        assert!(matches!(
            DiscordRuntimeConfig::from_token("  ".into()),
            Err(DiscordRuntimeError::MissingToken)
        ));
        assert!(DiscordRuntimeConfig::from_token("not-a-real-token".into()).is_ok());
    }

    #[test]
    fn gateway_state_exposes_only_current_bot_guild_membership() {
        let state = GatewayState::default();
        state.remember_bot_user("bot".into());
        state.replace_guilds(["guild-b".into(), "guild-a".into()]);
        assert!(state.bot_has_guild("guild-a"));
        state.remember_guild("guild-c".into(), "Guild C".into());
        state.forget_guild("guild-b");
        assert_eq!(state.guild_ids(), vec!["guild-a", "guild-c"]);
        assert_eq!(state.guild_count(), 2);
        assert_eq!(state.guild_name("guild-c").as_deref(), Some("Guild C"));
        assert_eq!(state.guild_name("guild-b"), None);
        assert!(!state.bot_has_guild("guild-b"));
        state.set_bot_voice_channel("guild-c", Some("voice".into()));
        assert_eq!(
            state.bot_voice_channel_id("guild-c").as_deref(),
            Some("voice")
        );
        assert_eq!(
            state.bot_voice_sessions(),
            vec![("guild-c".into(), "voice".into())]
        );
    }

    #[test]
    fn gateway_state_removes_transient_voice_state_on_leave_or_guild_delete() {
        let state = GatewayState::default();
        state.update_voice_state("guild", "user", Some("voice".into()));
        assert_eq!(
            state.voice_channel_id("guild", "user"),
            Some("voice".into())
        );
        state.update_voice_state("guild", "user", None);
        assert_eq!(state.voice_channel_id("guild", "user"), None);
        state.update_voice_state("guild", "user", Some("voice".into()));
        state.forget_guild("guild");
        assert_eq!(state.voice_channel_id("guild", "user"), None);
    }

    #[test]
    fn extracts_only_the_subcommand_path_from_discord_options() {
        use serenity::model::application::CommandDataOption;

        let options: Vec<CommandDataOption> = serde_json::from_str(
            r#"[{"name":"set","type":1,"options":[{"name":"model","type":3,"value":"en_US-amy-medium"}]}]"#,
        )
        .expect("Discord subcommand payload");
        assert_eq!(command_path_from_options(&options), vec!["set"]);

        let grouped: Vec<CommandDataOption> = serde_json::from_str(
            r#"[{"name":"block-word","type":2,"options":[{"name":"add","type":1,"options":[]}]}]"#,
        )
        .expect("Discord subcommand group payload");
        assert_eq!(
            command_path_from_options(&grouped),
            vec!["block-word", "add"]
        );
    }
}
