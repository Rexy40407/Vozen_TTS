//! Opt-in gateway adapter for the Manage Guild-only `/stats` command.

use std::{collections::BTreeMap, time::Instant};

use crate::ui::message_embed;
use serenity::{
    builder::{CreateEmbed, CreateInteractionResponse, CreateInteractionResponseMessage},
    client::Context,
    model::{Permissions, application::Interaction},
};
use vozen_discord::{
    GatewayEventDispatchError, GatewayEventSink, GatewayState, VoiceResponseLocalizer,
    parse_stats_command,
};

pub struct StatsGatewaySink {
    gateway_state: GatewayState,
    localizer: VoiceResponseLocalizer,
    started_at: Instant,
}

impl StatsGatewaySink {
    pub fn new(gateway_state: GatewayState) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            gateway_state,
            localizer: VoiceResponseLocalizer::from_generated_contract()
                .map_err(|_| GatewayEventDispatchError)?,
            started_at: Instant::now(),
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
    ) -> Result<CreateEmbed, GatewayEventDispatchError> {
        let snapshot = self.gateway_state.metrics().snapshot();
        let mut lines = Vec::with_capacity(11);
        lines.push(self.message("stats.title", command, &BTreeMap::new())?);
        let mut parameters = BTreeMap::new();
        parameters.insert("value", snapshot.messages_spoken.to_string());
        lines.push(self.message("stats.messagesSpoken", command, &parameters)?);
        parameters.insert("value", snapshot.cache_hits.to_string());
        lines.push(self.message("stats.cacheHits", command, &parameters)?);
        parameters.insert("value", snapshot.cache_misses.to_string());
        lines.push(self.message("stats.cacheMisses", command, &parameters)?);
        parameters.insert("value", snapshot.synth_errors.to_string());
        lines.push(self.message("stats.synthErrors", command, &parameters)?);
        let mut latency = BTreeMap::new();
        latency.insert("p50", snapshot.synth_p50_ms.to_string());
        latency.insert("p95", snapshot.synth_p95_ms.to_string());
        latency.insert("count", snapshot.synth_count.to_string());
        lines.push(self.message("stats.synthLatency", command, &latency)?);
        parameters.insert("value", snapshot.voice_drops.to_string());
        lines.push(self.message("stats.voiceDrops", command, &parameters)?);
        parameters.insert("value", snapshot.voice_reconnects.to_string());
        lines.push(self.message("stats.voiceReconnects", command, &parameters)?);
        parameters.insert("value", snapshot.votes.to_string());
        lines.push(self.message("stats.votes", command, &parameters)?);
        parameters.insert(
            "value",
            self.gateway_state.bot_voice_sessions().len().to_string(),
        );
        lines.push(self.message("stats.activePlayers", command, &parameters)?);
        parameters.insert("value", self.gateway_state.guild_count().to_string());
        lines.push(self.message("stats.servers", command, &parameters)?);
        parameters.insert("value", self.started_at.elapsed().as_secs().to_string());
        lines.push(self.message("stats.uptime", command, &parameters)?);
        Ok(message_embed(lines.join("\n")))
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for StatsGatewaySink {
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
        if parse_stats_command(&command.data)
            .map_err(|_| GatewayEventDispatchError)?
            .is_none()
        {
            return Ok(());
        }
        let can_manage_guild = command
            .member
            .as_ref()
            .and_then(|member| member.permissions)
            .is_some_and(|permissions| permissions.contains(Permissions::MANAGE_GUILD));
        let response = if can_manage_guild {
            CreateInteractionResponseMessage::new()
                .embeds(vec![self.response(&command)?])
                .ephemeral(true)
        } else {
            let content = self.message("error.needManageGuild", &command, &BTreeMap::new())?;
            CreateInteractionResponseMessage::new()
                .content(content)
                .ephemeral(true)
        };
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn constructs_with_process_local_metrics_only() {
        let sink = StatsGatewaySink::new(GatewayState::default()).expect("sink");
        assert_eq!(sink.gateway_state.guild_count(), 0);
        assert_eq!(sink.gateway_state.metrics().snapshot().synth_count, 0);
    }
}
