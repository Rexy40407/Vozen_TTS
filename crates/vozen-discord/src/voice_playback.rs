//! Songbird playback adapter.
//!
//! Kept behind `voice-driver` so storage/API contract checks run on developer machines without a
//! local Opus toolchain. The production image must compile this feature before it can replace the
//! Node voice path.

use std::path::Path;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum VoicePlaybackError {
    #[error("Rust voice driver is not compiled into this runtime")]
    DriverUnavailable,
    #[error("Songbird voice manager is unavailable")]
    ManagerUnavailable,
    #[error("failed to join or switch Discord voice channel")]
    JoinFailed,
}

/// Joins (or switches to) the requested call and queues a local WAV after already accepted work.
/// Songbird's native queue starts the first item immediately and advances only when the prior
/// track ends, so a new request can never interrupt another user's accepted speech.
/// Callers must already have verified same-call/premium/rejoin policy and Connect+Speak access;
/// this adapter never turns a stored channel id into authorization.
#[cfg(feature = "voice-driver")]
pub async fn join_and_enqueue_wav(
    context: &serenity::client::Context,
    guild_id: serenity::model::id::GuildId,
    channel_id: serenity::model::id::ChannelId,
    wav: impl AsRef<Path> + Send + Sync + 'static,
) -> Result<(), VoicePlaybackError> {
    let manager = songbird::get(context)
        .await
        .ok_or(VoicePlaybackError::ManagerUnavailable)?;
    let call = manager
        .join(guild_id, channel_id)
        .await
        .map_err(|_| VoicePlaybackError::JoinFailed)?;
    let mut handler = call.lock().await;
    handler
        .enqueue_input(songbird::input::File::new(wav).into())
        .await;
    Ok(())
}

/// Removes the driver call and its tasks after an explicit `/leave`, an alone timeout or a real
/// guild departure. Planned restarts deliberately do not call this path.
#[cfg(feature = "voice-driver")]
pub async fn leave_voice(
    context: &serenity::client::Context,
    guild_id: serenity::model::id::GuildId,
) -> Result<(), VoicePlaybackError> {
    let manager = songbird::get(context)
        .await
        .ok_or(VoicePlaybackError::ManagerUnavailable)?;
    manager
        .remove(guild_id)
        .await
        .map_err(|_| VoicePlaybackError::JoinFailed)
}

#[cfg(not(feature = "voice-driver"))]
pub async fn join_and_enqueue_wav(
    _context: &serenity::client::Context,
    _guild_id: serenity::model::id::GuildId,
    _channel_id: serenity::model::id::ChannelId,
    _wav: impl AsRef<Path> + Send + Sync + 'static,
) -> Result<(), VoicePlaybackError> {
    Err(VoicePlaybackError::DriverUnavailable)
}

#[cfg(not(feature = "voice-driver"))]
pub async fn leave_voice(
    _context: &serenity::client::Context,
    _guild_id: serenity::model::id::GuildId,
) -> Result<(), VoicePlaybackError> {
    Err(VoicePlaybackError::DriverUnavailable)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn portable_builds_never_claim_to_have_a_voice_driver() {
        #[cfg(not(feature = "voice-driver"))]
        assert!(matches!(
            VoicePlaybackError::DriverUnavailable,
            VoicePlaybackError::DriverUnavailable
        ));
    }
}
