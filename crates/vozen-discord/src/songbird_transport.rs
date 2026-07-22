//! Songbird implementation of the narrow voice-session transport.
//!
//! Kept behind `voice-driver`: control-plane tests do not require a local Opus toolchain, while
//! the production image must compile this feature before enabling Rust voice sessions.

use async_trait::async_trait;
use serenity::client::Context;
#[cfg(feature = "voice-driver")]
use serenity::model::id::{ChannelId, GuildId};

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
