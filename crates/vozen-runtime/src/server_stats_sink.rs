//! Opt-in gateway adapter for aggregated `/server-stats`.

use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

use serenity::{
    builder::{CreateAllowedMentions, CreateInteractionResponse, CreateInteractionResponseMessage},
    client::Context,
    model::application::Interaction,
};
use vozen_discord::{
    GatewayEventDispatchError, GatewayEventSink, VoiceResponseLocalizer, parse_server_stats_command,
};
use vozen_store::{SqliteStore, VOTE_REDEMPTION_SECRET_MIN_LENGTH, utc_day_key};

pub struct ServerStatsGatewaySink {
    store: Arc<Mutex<SqliteStore>>,
    client_id: Option<String>,
    redemption_secret: Option<String>,
    localizer: VoiceResponseLocalizer,
}

impl ServerStatsGatewaySink {
    pub fn new(
        store: Arc<Mutex<SqliteStore>>,
        client_id: Option<String>,
        redemption_secret: Option<String>,
    ) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            store,
            client_id,
            redemption_secret,
            localizer: VoiceResponseLocalizer::from_generated_contract()
                .map_err(|_| GatewayEventDispatchError)?,
        })
    }

    fn message(
        &self,
        key: &str,
        command: &serenity::model::application::CommandInteraction,
        parameters: &BTreeMap<&str, String>,
    ) -> Result<String, GatewayEventDispatchError> {
        self.localizer
            .render_key(
                key,
                Some(&command.locale),
                command.guild_locale.as_deref(),
                parameters,
            )
            .ok_or(GatewayEventDispatchError)
    }

    fn response(
        &self,
        command: &serenity::model::application::CommandInteraction,
    ) -> Result<String, GatewayEventDispatchError> {
        let Some(guild_id) = command.guild_id else {
            return self.message("serverstats.empty", command, &BTreeMap::new());
        };
        let guild_id = guild_id.get().to_string();
        let user_id = command.user.id.get().to_string();
        let now_ms = now_ms();
        let store = self.store.lock().map_err(|_| GatewayEventDispatchError)?;
        let premium = store
            .is_guild_premium(&guild_id, now_ms)
            .map_err(|_| GatewayEventDispatchError)?
            || store
                .is_user_premium(&user_id, now_ms)
                .map_err(|_| GatewayEventDispatchError)?;
        let limit = if premium { 5 } else { 3 };
        let stats = store
            .admin_guild_stats(&guild_id, &utc_day_key(), limit)
            .map_err(|_| GatewayEventDispatchError)?;
        let games = store
            .guild_game_stats(&guild_id, if premium { 5 } else { 0 })
            .map_err(|_| GatewayEventDispatchError)?;
        if stats.messages == 0 && games.players == 0 {
            return self.message("serverstats.empty", command, &BTreeMap::new());
        }

        let mut lines = vec![self.message("serverstats.title", command, &BTreeMap::new())?];
        let mut parameters = BTreeMap::new();
        parameters.insert("total", stats.messages.to_string());
        parameters.insert("speakers", stats.speakers.to_string());
        lines.push(self.message("serverstats.messages", command, &parameters)?);
        if !stats.top_speakers.is_empty() {
            lines.push(self.message("serverstats.topTalkers", command, &BTreeMap::new())?);
            for (index, row) in stats.top_speakers.into_iter().enumerate() {
                let mut parameters = BTreeMap::new();
                parameters.insert("rank", (index + 1).to_string());
                parameters.insert("user", row.user_id);
                parameters.insert("count", row.count.to_string());
                parameters.insert("streak", row.streak.to_string());
                lines.push(self.message("serverstats.talkerLine", command, &parameters)?);
            }
        }
        if premium {
            let mut parameters = BTreeMap::new();
            parameters.insert("days", stats.streak.to_string());
            lines.push(self.message("serverstats.streak", command, &parameters)?);
            let mut parameters = BTreeMap::new();
            parameters.insert("points", games.points.to_string());
            parameters.insert("wins", games.wins.to_string());
            parameters.insert("players", games.players.to_string());
            lines.push(self.message("serverstats.games", command, &parameters)?);
            if !games.top_players.is_empty() {
                lines.push(self.message("serverstats.topPlayers", command, &BTreeMap::new())?);
                for (index, row) in games.top_players.into_iter().enumerate() {
                    let mut parameters = BTreeMap::new();
                    parameters.insert("rank", (index + 1).to_string());
                    parameters.insert("user", row.user_id);
                    parameters.insert("points", row.points.to_string());
                    parameters.insert("wins", row.wins.to_string());
                    lines.push(self.message("serverstats.playerLine", command, &parameters)?);
                }
            }
        } else {
            lines.push(self.message("serverstats.upsell", command, &BTreeMap::new())?);
            if let (Some(client_id), Some(secret)) = (&self.client_id, &self.redemption_secret)
                && secret.len() >= VOTE_REDEMPTION_SECRET_MIN_LENGTH
                && store
                    .vote_reward_status(&user_id, secret)
                    .map_err(|_| GatewayEventDispatchError)?
                    .eligible
            {
                let mut parameters = BTreeMap::new();
                parameters.insert("url", format!("https://top.gg/bot/{client_id}/vote"));
                lines.push(self.message("vote.upsell", command, &parameters)?);
            }
        }
        Ok(lines.join("\n"))
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for ServerStatsGatewaySink {
    async fn on_message(
        &self,
        _context: Context,
        _message: serenity::model::channel::Message,
    ) -> Result<(), GatewayEventDispatchError> {
        Ok(())
    }

    async fn on_interaction(
        &self,
        context: Context,
        interaction: Interaction,
    ) -> Result<(), GatewayEventDispatchError> {
        let Interaction::Command(command) = interaction else {
            return Ok(());
        };
        if parse_server_stats_command(&command.data)
            .map_err(|_| GatewayEventDispatchError)?
            .is_none()
        {
            return Ok(());
        }
        let response = CreateInteractionResponseMessage::new()
            .content(self.response(&command)?)
            .allowed_mentions(
                CreateAllowedMentions::new()
                    .all_users(false)
                    .all_roles(false)
                    .everyone(false),
            );
        command
            .create_response(&context, CreateInteractionResponse::Message(response))
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        Ok(())
    }

    async fn on_guild_delete(&self, _guild_id: &str) -> Result<(), GatewayEventDispatchError> {
        Ok(())
    }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| {
            duration.as_millis().min(i64::MAX as u128) as i64
        })
}
