//! Songbird implementation of the narrow voice-session transport.
//!
//! Kept behind `voice-driver`: control-plane tests do not require a local Opus toolchain, while
//! the production image must compile this feature before enabling Rust voice sessions.

use async_trait::async_trait;
use serenity::client::Context;
#[cfg(feature = "voice-driver")]
use serenity::{
    builder::EditVoiceState,
    model::{
        channel::{Channel, ChannelType},
        id::{ChannelId, GuildId},
    },
};

use crate::{VoiceSessionTransport, VoiceSessionTransportError};

pub struct SongbirdVoiceSessionTransport {
    #[cfg_attr(not(feature = "voice-driver"), allow(dead_code))]
    context: Context,
}

impl SongbirdVoiceSessionTransport {
    pub fn new(context: Context) -> Self {
        Self { context }
    }
}

#[cfg(feature = "voice-driver")]
#[async_trait]
impl VoiceSessionTransport for SongbirdVoiceSessionTransport {
    async fn join(
        &self,
        guild_id: &str,
        channel_id: &str,
    ) -> Result<(), VoiceSessionTransportError> {
        let guild_id = parse_snowflake(guild_id)?;
        let channel_id = parse_snowflake(channel_id)?;
        let manager = songbird::get(&self.context)
            .await
            .ok_or(VoiceSessionTransportError::Unavailable)?;
        manager
            .join(GuildId::new(guild_id), ChannelId::new(channel_id))
            .await
            .map_err(|_| VoiceSessionTransportError::Failed)?;
        // Songbird only decodes incoming Opus when explicitly configured. Keep this opt-in so a
        // normal Rust voice canary does not pay the receive CPU cost or collect audio; the live
        // STT promotion enables it with `RUST_TRANSCRIBE_LIVE_ENABLED=true` and installs its
        // consent-gated receiver on the same call.
        if live_receive_enabled() {
            if let Some(call) = manager.get(GuildId::new(guild_id)) {
                let mut handler = call.lock().await;
                handler.set_config(songbird::Config::default().decode_mode(
                    songbird::driver::DecodeMode::Decode(songbird::driver::DecodeConfig::default()),
                ));
            }
        }
        // Discord places bots in Stage channels as audience by default. Match Node's best-effort
        // behaviour: first self-promote, then request to speak if a moderator must approve it.
        // A Stage moderation failure never invalidates an otherwise successful voice join.
        promote_stage_speaker(&self.context, ChannelId::new(channel_id)).await;
        Ok(())
    }

    async fn leave(&self, guild_id: &str) -> Result<(), VoiceSessionTransportError> {
        let guild_id = parse_snowflake(guild_id)?;
        let manager = songbird::get(&self.context)
            .await
            .ok_or(VoiceSessionTransportError::Unavailable)?;
        manager
            .remove(GuildId::new(guild_id))
            .await
            .map_err(|_| VoiceSessionTransportError::Failed)
    }
}

#[cfg(feature = "voice-driver")]
fn live_receive_enabled() -> bool {
    std::env::var("RUST_TRANSCRIBE_LIVE_ENABLED")
        .ok()
        .is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

#[cfg(feature = "voice-driver")]
async fn promote_stage_speaker(context: &Context, channel_id: ChannelId) {
    let Ok(Channel::Guild(channel)) = channel_id.to_channel(&context.http).await else {
        return;
    };
    if channel.kind != ChannelType::Stage {
        return;
    }
    if channel
        .edit_own_voice_state(&context.http, EditVoiceState::new().suppress(false))
        .await
        .is_err()
    {
        let _ = channel
            .edit_own_voice_state(&context.http, EditVoiceState::new().request_to_speak(true))
            .await;
    }
}

#[cfg(not(feature = "voice-driver"))]
#[async_trait]
impl VoiceSessionTransport for SongbirdVoiceSessionTransport {
    async fn join(
        &self,
        _guild_id: &str,
        _channel_id: &str,
    ) -> Result<(), VoiceSessionTransportError> {
        Err(VoiceSessionTransportError::Unavailable)
    }

    async fn leave(&self, _guild_id: &str) -> Result<(), VoiceSessionTransportError> {
        Err(VoiceSessionTransportError::Unavailable)
    }
}

#[cfg(any(feature = "voice-driver", test))]
fn parse_snowflake(value: &str) -> Result<u64, VoiceSessionTransportError> {
    value
        .parse::<u64>()
        .ok()
        .filter(|id| *id != 0)
        .ok_or(VoiceSessionTransportError::Failed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn malformed_discord_ids_fail_before_touching_songbird() {
        assert!(parse_snowflake("123").is_ok());
        assert!(parse_snowflake("0").is_err());
        assert!(parse_snowflake("guild").is_err());
    }
}
