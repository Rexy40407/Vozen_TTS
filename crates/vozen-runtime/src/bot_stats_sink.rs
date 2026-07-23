//! Opt-in gateway adapter for public `/bot-stats`.

use std::{collections::BTreeMap, time::Instant};

use serenity::{
    builder::{CreateInteractionResponse, CreateInteractionResponseMessage},
    client::Context,
    model::application::Interaction,
};
use vozen_discord::{
    GatewayEventDispatchError, GatewayEventSink, GatewayState, VoiceResponseLocalizer,
    parse_bot_stats_command,
};

pub struct BotStatsGatewaySink {
    gateway_state: GatewayState,
    started_at: Instant,
    localizer: VoiceResponseLocalizer,
}

impl BotStatsGatewaySink {
    pub fn new(gateway_state: GatewayState) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            gateway_state,
            started_at: Instant::now(),
            localizer: VoiceResponseLocalizer::from_generated_contract()
                .map_err(|_| GatewayEventDispatchError)?,
        })
    }

    fn response(
        &self,
        command: &serenity::model::application::CommandInteraction,
    ) -> Result<String, GatewayEventDispatchError> {
        let mut lines = Vec::with_capacity(5);
        let render = |key: &str, value: String| {
            let mut parameters = BTreeMap::new();
            parameters.insert("value", value);
            self.localizer
                .render_key(
                    key,
                    Some(&command.locale),
                    command.guild_locale.as_deref(),
                    &parameters,
                )
                .ok_or(GatewayEventDispatchError)
        };
        lines.push(
            self.localizer
                .render_key(
                    "botstats.title",
                    Some(&command.locale),
                    command.guild_locale.as_deref(),
                    &BTreeMap::new(),
                )
                .ok_or(GatewayEventDispatchError)?,
        );
        lines.push(render(
            "botstats.servers",
            self.gateway_state.guild_count().to_string(),
        )?);
        lines.push(render(
            "botstats.voiceSessions",
            self.gateway_state.bot_voice_sessions().len().to_string(),
        )?);
        lines.push(render(
            "botstats.messagesSpoken",
            self.gateway_state.messages_spoken().to_string(),
        )?);
        lines.push(render(
            "botstats.uptime",
            format_duration(self.started_at.elapsed().as_secs()),
        )?);
        Ok(lines.join("\n"))
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for BotStatsGatewaySink {
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
        if parse_bot_stats_command(&command.data)
            .map_err(|_| GatewayEventDispatchError)?
            .is_none()
        {
            return Ok(());
        }
        command
            .create_response(
                &context,
                CreateInteractionResponse::Message(
                    CreateInteractionResponseMessage::new()
                        .content(self.response(&command)?)
                        .ephemeral(true),
                ),
            )
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        Ok(())
    }

    async fn on_guild_delete(&self, _guild_id: &str) -> Result<(), GatewayEventDispatchError> {
        Ok(())
    }
}

fn format_duration(total_seconds: u64) -> String {
    let days = total_seconds / 86_400;
    let hours = (total_seconds % 86_400) / 3_600;
    let minutes = (total_seconds % 3_600) / 60;
    let mut parts = Vec::new();
    if days > 0 {
        parts.push(format!("{days}d"));
    }
    if hours > 0 {
        parts.push(format!("{hours}h"));
    }
    if minutes > 0 {
        parts.push(format!("{minutes}m"));
    }
    if parts.is_empty() {
        "<1m".into()
    } else {
        parts.join(" ")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn duration_matches_public_uptime_shape() {
        assert_eq!(format_duration(0), "<1m");
        assert_eq!(format_duration(86_400 + 3_600 + 120), "1d 1h 2m");
    }
}
