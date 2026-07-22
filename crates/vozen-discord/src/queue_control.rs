//! Authorization and privacy boundary for `/queue`.
//!
//! This mirrors the Node command's deliberate asymmetry: members may view the opaque pending
//! queue and remove their own item from anywhere, while playback-changing controls require both
//! `Manage Server` and presence in Vozen's current voice channel.

use async_trait::async_trait;
use vozen_core::PublicQueueItem;

use crate::{CommandPlaybackError, CommandPlaybackState, QueueCommand};

#[async_trait]
pub trait QueueControlPlayback: Send + Sync {
    /// Whether this guild currently has a Rust-owned playback queue. A missing queue is not an
    /// error and must render the existing empty response instead of exposing transport details.
    async fn has_queue_player(&self, guild_id: &str) -> Result<bool, CommandPlaybackError>;
    async fn queue_snapshot(
        &self,
        guild_id: &str,
        now_ms: u64,
    ) -> Result<Vec<PublicQueueItem>, CommandPlaybackError>;
    async fn remove_queue_item(
        &self,
        guild_id: &str,
        id: &str,
        author_id: Option<&str>,
    ) -> Result<bool, CommandPlaybackError>;
    async fn clear_queue(&self, guild_id: &str) -> Result<(), CommandPlaybackError>;
    async fn pause_queue(&self, guild_id: &str) -> Result<bool, CommandPlaybackError>;
    async fn resume_queue(&self, guild_id: &str) -> Result<bool, CommandPlaybackError>;
    async fn state(&self, guild_id: &str) -> Result<CommandPlaybackState, CommandPlaybackError>;
    async fn skip_queue(&self, guild_id: &str) -> Result<(), CommandPlaybackError>;
}

#[derive(Clone, Copy)]
pub struct QueueControlInvocation<'a> {
    pub guild_id: &'a str,
    pub user_id: &'a str,
    pub can_manage_guild: bool,
    pub caller_voice_channel_id: Option<&'a str>,
    pub bot_voice_channel_id: Option<&'a str>,
    pub now_ms: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum QueueControlOutcome {
    Empty,
    Snapshot(Vec<PublicQueueItem>),
    Removed,
    Unavailable,
    RequiresManageGuild,
    NotInSameVoice,
    Cleared,
    Paused,
    NothingToPause,
    Resumed,
    NotPaused,
    Skipped,
    NothingPlaying,
    PlaybackFailed,
}

pub struct QueueControlService<P> {
    playback: P,
}

impl<P> QueueControlService<P> {
    #[must_use]
    pub fn new(playback: P) -> Self {
        Self { playback }
    }
}

impl<P: QueueControlPlayback> QueueControlService<P> {
    pub async fn execute(
        &self,
        invocation: QueueControlInvocation<'_>,
        command: QueueCommand,
    ) -> QueueControlOutcome {
        let present = match self.playback.has_queue_player(invocation.guild_id).await {
            Ok(present) => present,
            Err(_) => return QueueControlOutcome::PlaybackFailed,
        };
        if !present {
            return QueueControlOutcome::Empty;
        }
        match command {
            QueueCommand::Show => match self
                .playback
                .queue_snapshot(invocation.guild_id, invocation.now_ms)
                .await
            {
                Ok(items) if items.is_empty() => QueueControlOutcome::Empty,
                Ok(items) => QueueControlOutcome::Snapshot(items),
                Err(_) => QueueControlOutcome::PlaybackFailed,
            },
            QueueCommand::Remove { id } => {
                let scope = (!invocation.can_manage_guild).then_some(invocation.user_id);
                match self
                    .playback
                    .remove_queue_item(invocation.guild_id, &id, scope)
                    .await
                {
                    Ok(true) => QueueControlOutcome::Removed,
                    Ok(false) => QueueControlOutcome::Unavailable,
                    Err(_) => QueueControlOutcome::PlaybackFailed,
                }
            }
            QueueCommand::Clear => {
                if let Some(outcome) = control_admission(&invocation) {
                    return outcome;
                }
                match self.playback.clear_queue(invocation.guild_id).await {
                    Ok(()) => QueueControlOutcome::Cleared,
                    Err(_) => QueueControlOutcome::PlaybackFailed,
                }
            }
            QueueCommand::Pause => {
                if let Some(outcome) = control_admission(&invocation) {
                    return outcome;
                }
                match self.playback.pause_queue(invocation.guild_id).await {
                    Ok(true) => QueueControlOutcome::Paused,
                    Ok(false) => QueueControlOutcome::NothingToPause,
                    Err(_) => QueueControlOutcome::PlaybackFailed,
                }
            }
            QueueCommand::Resume => {
                if let Some(outcome) = control_admission(&invocation) {
                    return outcome;
                }
                match self.playback.resume_queue(invocation.guild_id).await {
                    Ok(true) => QueueControlOutcome::Resumed,
                    Ok(false) => QueueControlOutcome::NotPaused,
                    Err(_) => QueueControlOutcome::PlaybackFailed,
                }
            }
            QueueCommand::Skip => {
                if let Some(outcome) = control_admission(&invocation) {
                    return outcome;
                }
                match self.playback.state(invocation.guild_id).await {
                    Ok(CommandPlaybackState::Active) => {
                        match self.playback.skip_queue(invocation.guild_id).await {
                            Ok(()) => QueueControlOutcome::Skipped,
                            Err(_) => QueueControlOutcome::PlaybackFailed,
                        }
                    }
                    Ok(CommandPlaybackState::NoSession | CommandPlaybackState::Idle) => {
                        QueueControlOutcome::NothingPlaying
                    }
                    Err(_) => QueueControlOutcome::PlaybackFailed,
                }
            }
        }
    }
}

fn control_admission(invocation: &QueueControlInvocation<'_>) -> Option<QueueControlOutcome> {
    if !invocation.can_manage_guild {
        return Some(QueueControlOutcome::RequiresManageGuild);
    }
    (invocation.caller_voice_channel_id.is_none()
        || invocation.bot_voice_channel_id.is_none()
        || invocation.caller_voice_channel_id != invocation.bot_voice_channel_id)
        .then_some(QueueControlOutcome::NotInSameVoice)
}

#[cfg(test)]
mod tests {
    use std::sync::{
        Mutex,
        atomic::{AtomicUsize, Ordering},
    };

    use super::*;
    use vozen_core::{QueueLane, QueueSource};

    struct FakePlayback {
        present: bool,
        items: Vec<PublicQueueItem>,
        state: CommandPlaybackState,
        pause: bool,
        resume: bool,
        removed: bool,
        calls: Mutex<Vec<String>>,
        skips: AtomicUsize,
    }

    impl Default for FakePlayback {
        fn default() -> Self {
            Self {
                present: true,
                items: vec![PublicQueueItem {
                    id: "owned".into(),
                    source: QueueSource::Message,
                    lane: QueueLane::Standard,
                    age_ms: 1,
                }],
                state: CommandPlaybackState::Active,
                pause: true,
                resume: true,
                removed: true,
                calls: Mutex::new(Vec::new()),
                skips: AtomicUsize::new(0),
            }
        }
    }

    #[async_trait]
    impl QueueControlPlayback for FakePlayback {
        async fn has_queue_player(&self, _guild_id: &str) -> Result<bool, CommandPlaybackError> {
            Ok(self.present)
        }

        async fn queue_snapshot(
            &self,
            _guild_id: &str,
            _now_ms: u64,
        ) -> Result<Vec<PublicQueueItem>, CommandPlaybackError> {
            Ok(self.items.clone())
        }

        async fn remove_queue_item(
            &self,
            _guild_id: &str,
            id: &str,
            author_id: Option<&str>,
        ) -> Result<bool, CommandPlaybackError> {
            self.calls
                .lock()
                .expect("calls")
                .push(format!("remove:{id}:{}", author_id.unwrap_or("manager")));
            Ok(self.removed)
        }

        async fn clear_queue(&self, _guild_id: &str) -> Result<(), CommandPlaybackError> {
            self.calls.lock().expect("calls").push("clear".into());
            Ok(())
        }

        async fn pause_queue(&self, _guild_id: &str) -> Result<bool, CommandPlaybackError> {
            Ok(self.pause)
        }

        async fn resume_queue(&self, _guild_id: &str) -> Result<bool, CommandPlaybackError> {
            Ok(self.resume)
        }

        async fn state(
            &self,
            _guild_id: &str,
        ) -> Result<CommandPlaybackState, CommandPlaybackError> {
            Ok(self.state)
        }

        async fn skip_queue(&self, _guild_id: &str) -> Result<(), CommandPlaybackError> {
            self.skips.fetch_add(1, Ordering::Relaxed);
            Ok(())
        }
    }

    fn invocation() -> QueueControlInvocation<'static> {
        QueueControlInvocation {
            guild_id: "guild",
            user_id: "user",
            can_manage_guild: false,
            caller_voice_channel_id: Some("voice"),
            bot_voice_channel_id: Some("voice"),
            now_ms: 100,
        }
    }

    #[tokio::test]
    async fn public_queue_view_is_opaque_and_never_requires_voice_presence() {
        let service = QueueControlService::new(FakePlayback::default());
        assert!(matches!(
            service.execute(invocation(), QueueCommand::Show).await,
            QueueControlOutcome::Snapshot(items) if items[0].id == "owned"
        ));
    }

    #[tokio::test]
    async fn members_can_remove_only_their_own_item_while_managers_can_remove_any_item() {
        let service = QueueControlService::new(FakePlayback::default());
        assert_eq!(
            service
                .execute(invocation(), QueueCommand::Remove { id: "owned".into() })
                .await,
            QueueControlOutcome::Removed
        );
        let mut manager = invocation();
        manager.can_manage_guild = true;
        assert_eq!(
            service
                .execute(manager, QueueCommand::Remove { id: "other".into() })
                .await,
            QueueControlOutcome::Removed
        );
        assert_eq!(
            *service.playback.calls.lock().expect("calls"),
            vec!["remove:owned:user", "remove:other:manager"]
        );
    }

    #[tokio::test]
    async fn audible_controls_require_manager_and_same_call_before_touching_playback() {
        let service = QueueControlService::new(FakePlayback::default());
        assert_eq!(
            service.execute(invocation(), QueueCommand::Clear).await,
            QueueControlOutcome::RequiresManageGuild
        );
        let mut manager = invocation();
        manager.can_manage_guild = true;
        manager.caller_voice_channel_id = Some("other");
        assert_eq!(
            service.execute(manager, QueueCommand::Skip).await,
            QueueControlOutcome::NotInSameVoice
        );
        assert_eq!(service.playback.skips.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn controls_preserve_node_empty_and_playback_outcomes() {
        let service = QueueControlService::new(FakePlayback {
            present: false,
            ..FakePlayback::default()
        });
        let mut manager = invocation();
        manager.can_manage_guild = true;
        assert_eq!(
            service.execute(manager, QueueCommand::Pause).await,
            QueueControlOutcome::Empty
        );

        let service = QueueControlService::new(FakePlayback {
            pause: false,
            resume: false,
            state: CommandPlaybackState::Idle,
            ..FakePlayback::default()
        });
        let mut manager = invocation();
        manager.can_manage_guild = true;
        assert_eq!(
            service.execute(manager, QueueCommand::Pause).await,
            QueueControlOutcome::NothingToPause
        );
        assert_eq!(
            service.execute(manager, QueueCommand::Resume).await,
            QueueControlOutcome::NotPaused
        );
        assert_eq!(
            service.execute(manager, QueueCommand::Skip).await,
            QueueControlOutcome::NothingPlaying
        );
    }
}
