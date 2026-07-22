#![forbid(unsafe_code)]

//! Discord gateway adapter for the Rust migration.
//!
//! This crate owns only connection lifecycle and the minimal intent set. It deliberately does
//! not register commands on startup, start voice sessions, or send user content until those
//! operations have their Node parity contracts and tests.

use std::{
    collections::BTreeSet,
    env,
    sync::{Arc, LazyLock, RwLock},
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
mod interaction_dispatch;
mod planned_rejoin;

pub use command_registration::{
    CommandRegistrationClient, CommandRegistrationConfig, CommandRegistrationError,
    CommandRegistrationOutcome, DiscordHttpCommandRegistrationClient, register_commands,
};
pub use command_routing::{CommandArea, command_area, route_command};
pub use interaction_dispatch::{
    DispatchOutcome, InteractionDispatchError, InteractionHandler, dispatch_interaction,
};
pub use planned_rejoin::{
    MAX_PLANNED_REJOIN_AGE, PLANNED_REJOIN_MARKER, PlannedRejoinScope, RejoinChannelState,
    RejoinPlan, consume_planned_rejoin_marker, plan_rejoin, write_planned_rejoin_marker,
};

/// Read-only gateway facts that other Rust adapters may use only after their own OAuth or
/// permission checks. Guild membership is intentionally the sole fact here: it contains no user
/// profiles, messages, tokens or voice state.
#[derive(Clone, Default)]
pub struct GatewayState {
    guild_ids: Arc<RwLock<BTreeSet<String>>>,
}

impl GatewayState {
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

    fn replace_guilds(&self, guild_ids: impl IntoIterator<Item = String>) {
        if let Ok(mut current) = self.guild_ids.write() {
            *current = guild_ids.into_iter().collect();
        }
    }

    fn remember_guild(&self, guild_id: String) {
        if let Ok(mut current) = self.guild_ids.write() {
            current.insert(guild_id);
        }
    }

    fn forget_guild(&self, guild_id: &str) {
        if let Ok(mut current) = self.guild_ids.write() {
            current.remove(guild_id);
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
    let mut client = Client::builder(config.token, vozen_gateway_intents())
        // Registers the voice gateway/driver but never joins a call by itself. Join/rejoin
        // policy remains behind a tested command handler in a later migration step.
        .register_songbird()
        .event_handler(VozenGatewayHandler { gateway_state })
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
}

#[async_trait]
impl EventHandler for VozenGatewayHandler {
    async fn ready(&self, _context: Context, ready: Ready) {
        self.gateway_state
            .replace_guilds(ready.guilds.iter().map(|guild| guild.id.get().to_string()));
    }

    async fn guild_create(
        &self,
        _context: Context,
        guild: serenity::model::guild::Guild,
        _is_new: Option<bool>,
    ) {
        self.gateway_state
            .remember_guild(guild.id.get().to_string());
    }

    async fn guild_delete(
        &self,
        _context: Context,
        incomplete: serenity::model::guild::UnavailableGuild,
        _full: Option<serenity::model::guild::Guild>,
    ) {
        self.gateway_state
            .forget_guild(&incomplete.id.get().to_string());
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
        state.replace_guilds(["guild-b".into(), "guild-a".into()]);
        assert!(state.bot_has_guild("guild-a"));
        state.remember_guild("guild-c".into());
        state.forget_guild("guild-b");
        assert_eq!(state.guild_ids(), vec!["guild-a", "guild-c"]);
        assert!(!state.bot_has_guild("guild-b"));
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
