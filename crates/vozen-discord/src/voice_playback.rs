//! Songbird playback adapter.
//!
//! Kept behind `voice-driver` so storage/API contract checks run on developer machines without a
//! local Opus toolchain. The production image must compile this feature before it can replace the
//! Node voice path.

use std::path::Path;

#[cfg(any(feature = "voice-driver", test))]
use std::collections::BTreeMap;
#[cfg(feature = "voice-driver")]
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use thiserror::Error;

use crate::{CommandPlaybackError, CommandPlaybackState, CommandVoicePlayback};

#[derive(Debug, Error)]
pub enum VoicePlaybackError {
    #[error("Rust voice driver is not compiled into this runtime")]
    DriverUnavailable,
    #[error("Songbird voice manager is unavailable")]
    ManagerUnavailable,
    #[error("failed to join or switch Discord voice channel")]
    JoinFailed,
}

/// Tracks capacity promised to synthesis jobs which have not produced a WAV yet. Songbird can
/// only report tracks it has already received, so these reservations prevent concurrent `/tts`
/// requests from all deciding that the last queue slot is free.
#[cfg(any(feature = "voice-driver", test))]
#[derive(Debug, Default)]
struct QueueReservations {
    by_guild: BTreeMap<String, usize>,
}

#[cfg(any(feature = "voice-driver", test))]
impl QueueReservations {
    fn reserve(&mut self, guild_id: &str, queued: usize, maximum: usize) -> bool {
        let reserved = self.by_guild.get(guild_id).copied().unwrap_or_default();
        if queued.saturating_add(reserved) >= maximum {
            return false;
        }

        self.by_guild.insert(guild_id.to_owned(), reserved + 1);
        true
    }

    /// Returns `true` only when this invocation really owned a reservation. That makes cleanup
    /// idempotent: the core service can safely cancel after a partial playback failure.
    fn release(&mut self, guild_id: &str) -> bool {
        let Some(reserved) = self.by_guild.get_mut(guild_id) else {
            return false;
        };

        if *reserved == 1 {
            self.by_guild.remove(guild_id);
        } else {
            *reserved -= 1;
        }
        true
    }

    fn clear(&mut self, guild_id: &str) {
        self.by_guild.remove(guild_id);
    }
}

/// Production adapter for the command service's bounded guild FIFO.
///
/// It only sees an existing Songbird call: `/join` remains responsible for creating it and the
/// command service remains responsible for authorization. Keeping those two concerns separate
/// avoids a text command silently connecting the bot to a channel.
pub struct SongbirdCommandPlayback {
    #[cfg(feature = "voice-driver")]
    context: serenity::client::Context,
    #[cfg(feature = "voice-driver")]
    maximum_queue_items: usize,
    #[cfg(feature = "voice-driver")]
    reservations: Arc<Mutex<QueueReservations>>,
}

impl SongbirdCommandPlayback {
    #[must_use]
    pub fn new(context: serenity::client::Context, maximum_queue_items: usize) -> Self {
        #[cfg(not(feature = "voice-driver"))]
        let _ = (context, maximum_queue_items);

        Self {
            #[cfg(feature = "voice-driver")]
            context,
            #[cfg(feature = "voice-driver")]
            // A zero-sized queue would make every request look like a configuration success and
            // then fail forever. Clamp it defensively because this is startup configuration.
            maximum_queue_items: maximum_queue_items.max(1),
            #[cfg(feature = "voice-driver")]
            reservations: Arc::new(Mutex::new(QueueReservations::default())),
        }
    }

    #[cfg(feature = "voice-driver")]
    fn guild_id(guild_id: &str) -> Result<serenity::model::id::GuildId, CommandPlaybackError> {
        guild_id
            .parse::<u64>()
            .map(serenity::model::id::GuildId::new)
            .map_err(|_| CommandPlaybackError)
    }

    #[cfg(feature = "voice-driver")]
    fn release_reservation(&self, guild_id: &str) -> bool {
        self.reservations
            .lock()
            .expect("voice queue reservation lock poisoned")
            .release(guild_id)
    }
}

#[cfg(feature = "voice-driver")]
#[async_trait]
impl CommandVoicePlayback for SongbirdCommandPlayback {
    async fn state(&self, guild_id: &str) -> Result<CommandPlaybackState, CommandPlaybackError> {
        let guild_id = Self::guild_id(guild_id)?;
        let manager = songbird::get(&self.context)
            .await
            .ok_or(CommandPlaybackError)?;
        let call = manager.get(guild_id).ok_or(CommandPlaybackError)?;
        let handler = call.lock().await;

        Ok(if handler.queue().current().is_some() {
            CommandPlaybackState::Active
        } else {
            CommandPlaybackState::Idle
        })
    }

    async fn reserve(
        &self,
        guild_id: &str,
        _lane: vozen_core::QueueLane,
    ) -> Result<bool, CommandPlaybackError> {
        let discord_guild_id = Self::guild_id(guild_id)?;
        let manager = songbird::get(&self.context)
            .await
            .ok_or(CommandPlaybackError)?;
        let call = manager.get(discord_guild_id).ok_or(CommandPlaybackError)?;
        let handler = call.lock().await;
        let queued = handler.queue().len();

        Ok(self
            .reservations
            .lock()
            .expect("voice queue reservation lock poisoned")
            .reserve(guild_id, queued, self.maximum_queue_items))
    }

    async fn enqueue_reserved(
        &self,
        guild_id: &str,
        wav: &Path,
        _lane: vozen_core::QueueLane,
    ) -> Result<(), CommandPlaybackError> {
        // Consume before acquiring Songbird. If the call disappeared during synthesis the core
        // service will invoke the idempotent cancellation path below; no reservation can leak.
        if !self.release_reservation(guild_id) {
            return Err(CommandPlaybackError);
        }

        let discord_guild_id = Self::guild_id(guild_id)?;
        let manager = songbird::get(&self.context)
            .await
            .ok_or(CommandPlaybackError)?;
        let call = manager.get(discord_guild_id).ok_or(CommandPlaybackError)?;
        let mut handler = call.lock().await;
        handler
            .enqueue_input(songbird::input::File::new(wav).into())
            .await;
        Ok(())
    }

    async fn cancel_reservation(
        &self,
        guild_id: &str,
        _lane: vozen_core::QueueLane,
    ) -> Result<(), CommandPlaybackError> {
        self.release_reservation(guild_id);
        Ok(())
    }

    async fn skip(&self, guild_id: &str) -> Result<(), CommandPlaybackError> {
        let guild_id = Self::guild_id(guild_id)?;
        let manager = songbird::get(&self.context)
            .await
            .ok_or(CommandPlaybackError)?;
        let call = manager.get(guild_id).ok_or(CommandPlaybackError)?;
        let handler = call.lock().await;
        handler.queue().skip().map_err(|_| CommandPlaybackError)
    }

    async fn silence(&self, guild_id: &str) -> Result<(), CommandPlaybackError> {
        let discord_guild_id = Self::guild_id(guild_id)?;
        let manager = songbird::get(&self.context)
            .await
            .ok_or(CommandPlaybackError)?;
        let call = manager.get(discord_guild_id).ok_or(CommandPlaybackError)?;
        let handler = call.lock().await;
        handler.queue().stop();
        self.reservations
            .lock()
            .expect("voice queue reservation lock poisoned")
            .clear(guild_id);
        Ok(())
    }
}

#[cfg(not(feature = "voice-driver"))]
#[async_trait]
impl CommandVoicePlayback for SongbirdCommandPlayback {
    async fn state(&self, _guild_id: &str) -> Result<CommandPlaybackState, CommandPlaybackError> {
        Err(CommandPlaybackError)
    }

    async fn reserve(
        &self,
        _guild_id: &str,
        _lane: vozen_core::QueueLane,
    ) -> Result<bool, CommandPlaybackError> {
        Err(CommandPlaybackError)
    }

    async fn enqueue_reserved(
        &self,
        _guild_id: &str,
        _wav: &Path,
        _lane: vozen_core::QueueLane,
    ) -> Result<(), CommandPlaybackError> {
        Err(CommandPlaybackError)
    }

    async fn cancel_reservation(
        &self,
        _guild_id: &str,
        _lane: vozen_core::QueueLane,
    ) -> Result<(), CommandPlaybackError> {
        Err(CommandPlaybackError)
    }

    async fn skip(&self, _guild_id: &str) -> Result<(), CommandPlaybackError> {
        Err(CommandPlaybackError)
    }

    async fn silence(&self, _guild_id: &str) -> Result<(), CommandPlaybackError> {
        Err(CommandPlaybackError)
    }
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

    #[test]
    fn reservations_bound_concurrent_synthesis_to_the_songbird_queue_capacity() {
        let mut reservations = QueueReservations::default();

        assert!(reservations.reserve("42", 1, 3));
        assert!(reservations.reserve("42", 1, 3));
        assert!(!reservations.reserve("42", 1, 3));
        assert!(reservations.release("42"));
        assert!(reservations.reserve("42", 1, 3));
    }

    #[test]
    fn reservation_cleanup_is_idempotent_and_isolated_per_guild() {
        let mut reservations = QueueReservations::default();

        assert!(reservations.reserve("42", 0, 1));
        assert!(reservations.reserve("84", 0, 1));
        reservations.clear("42");
        assert!(!reservations.release("42"));
        assert!(reservations.release("84"));
        assert!(!reservations.release("84"));
    }
}
