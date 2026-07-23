//! Opt-in gateway adapter for public `/uptime`.

use std::{collections::BTreeMap, time::Instant};

use serenity::{
    builder::{CreateInteractionResponse, CreateInteractionResponseMessage},
    client::Context,
    model::application::Interaction,
};
use vozen_discord::{
    GatewayEventDispatchError, GatewayEventSink, VoiceResponseLocalizer, parse_uptime_command,
};

pub struct UptimeGatewaySink {
    started_at: Instant,
    localizer: VoiceResponseLocalizer,
}

impl UptimeGatewaySink {
    pub fn new() -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            started_at: Instant::now(),
            localizer: VoiceResponseLocalizer::from_generated_contract()
                .map_err(|_| GatewayEventDispatchError)?,
        })
    }

    fn response(
        &self,
        command: &serenity::model::application::CommandInteraction,
    ) -> Result<String, GatewayEventDispatchError> {
        let mut parameters = BTreeMap::new();
        parameters.insert(
            "uptime",
            format_duration(self.started_at.elapsed().as_secs()),
        );
        self.localizer
            .render_key(
                "uptime.text",
                Some(&command.locale),
                command.guild_locale.as_deref(),
                &parameters,
            )
            .ok_or(GatewayEventDispatchError)
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

#[async_trait::async_trait]
impl GatewayEventSink for UptimeGatewaySink {
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
        if parse_uptime_command(&command.data)
            .map_err(|_| GatewayEventDispatchError)?
            .is_none()
        {
            return Ok(());
        }
        let content = self.response(&command)?;
        command
            .create_response(
                &context,
                CreateInteractionResponse::Message(
                    CreateInteractionResponseMessage::new()
                        .content(content)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn duration_matches_node_shape() {
        assert_eq!(format_duration(0), "<1m");
        assert_eq!(format_duration(86_400 + 3_600 + 120), "1d 1h 2m");
    }
}
