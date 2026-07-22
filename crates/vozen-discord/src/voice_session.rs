//! Durable `/join` and `/leave` session lifecycle.
//!
//! The Discord adapter supplies the transport implementation. This service owns the critical
//! ordering: a failed join never overwrites a working recovery hint, while an explicit leave
//! always removes that hint so an administrator's intent cannot be undone on restart.

use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use thiserror::Error;
use vozen_store::SqliteStore;

use crate::GatewayState;

#[derive(Debug, Error, Clone, Copy, PartialEq, Eq)]
pub enum VoiceSessionTransportError {
    #[error("Vozen cannot connect or speak in that voice channel")]
    PermissionDenied,
    #[error("Discord voice transport is unavailable")]
    Unavailable,
    #[error("Discord voice transport failed")]
    Failed,
}

/// Narrow voice lifecycle boundary. It receives IDs only after the command adapter has bound
/// them to the invoking Discord user; it never reads configuration or user text.
#[async_trait]
pub trait VoiceSessionTransport: Send + Sync {
    async fn join(
        &self,
        guild_id: &str,
        channel_id: &str,
    ) -> Result<(), VoiceSessionTransportError>;
    async fn leave(&self, guild_id: &str) -> Result<(), VoiceSessionTransportError>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JoinVoiceOutcome {
    NoUserVoiceChannel,
    Joined,
    PermissionDenied,
    Unavailable,
    Failed,
    StoreUnavailable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LeaveVoiceOutcome {
    Left,
    TransportFailed,
    StoreUnavailable,
}

pub struct VoiceSessionService<T> {
    store: Arc<Mutex<SqliteStore>>,
    gateway_state: GatewayState,
    transport: T,
}

impl<T> VoiceSessionService<T> {
    pub fn new(store: Arc<Mutex<SqliteStore>>, gateway_state: GatewayState, transport: T) -> Self {
        Self {
            store,
            gateway_state,
            transport,
        }
    }
}

impl<T: VoiceSessionTransport> VoiceSessionService<T> {
    /// Joins the caller's current voice channel. No stored presence is changed until the
    /// transport reports success, preserving a healthy existing call after a forbidden join.
    pub async fn join_for_user(
        &self,
        guild_id: &str,
        user_id: &str,
        now_ms: i64,
    ) -> JoinVoiceOutcome {
        let Some(channel_id) = self.gateway_state.voice_channel_id(guild_id, user_id) else {
            return JoinVoiceOutcome::NoUserVoiceChannel;
        };
        match self.transport.join(guild_id, &channel_id).await {
            Ok(()) => match self.store.lock() {
                Ok(store) => match store.remember_voice_presence(guild_id, &channel_id, now_ms) {
                    Ok(()) => JoinVoiceOutcome::Joined,
                    Err(_) => JoinVoiceOutcome::StoreUnavailable,
                },
                Err(_) => JoinVoiceOutcome::StoreUnavailable,
            },
            Err(VoiceSessionTransportError::PermissionDenied) => JoinVoiceOutcome::PermissionDenied,
            Err(VoiceSessionTransportError::Unavailable) => JoinVoiceOutcome::Unavailable,
            Err(VoiceSessionTransportError::Failed) => JoinVoiceOutcome::Failed,
        }
    }

    /// An explicit leave is authoritative. The recovery hint is deleted even if the driver has
    /// already disappeared; otherwise a later clean restart could silently rejoin the channel.
    pub async fn leave_explicitly(&self, guild_id: &str) -> LeaveVoiceOutcome {
        let transport = self.transport.leave(guild_id).await;
        let erased = self
            .store
            .lock()
            .ok()
            .and_then(|store| store.forget_voice_presence(guild_id).ok())
            .is_some();
        if !erased {
            return LeaveVoiceOutcome::StoreUnavailable;
        }
        match transport {
            Ok(()) => LeaveVoiceOutcome::Left,
            Err(_) => LeaveVoiceOutcome::TransportFailed,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use super::*;

    #[derive(Default)]
    struct FakeTransport {
        joins: Mutex<Vec<(String, String)>>,
        leaves: Mutex<Vec<String>>,
        join_error: Option<VoiceSessionTransportError>,
        leave_error: Option<VoiceSessionTransportError>,
    }

    #[async_trait]
    impl VoiceSessionTransport for FakeTransport {
        async fn join(
            &self,
            guild_id: &str,
            channel_id: &str,
        ) -> Result<(), VoiceSessionTransportError> {
            self.joins
                .lock()
                .expect("joins")
                .push((guild_id.into(), channel_id.into()));
            self.join_error.map_or(Ok(()), Err)
        }

        async fn leave(&self, guild_id: &str) -> Result<(), VoiceSessionTransportError> {
            self.leaves.lock().expect("leaves").push(guild_id.into());
            self.leave_error.map_or(Ok(()), Err)
        }
    }

    fn make_service(
        transport: FakeTransport,
    ) -> (
        VoiceSessionService<FakeTransport>,
        Arc<Mutex<SqliteStore>>,
        GatewayState,
    ) {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let state = GatewayState::default();
        (
            VoiceSessionService::new(store.clone(), state.clone(), transport),
            store,
            state,
        )
    }

    #[tokio::test]
    async fn join_persists_only_after_a_successful_transport_join() {
        let (service, store, state) = make_service(FakeTransport::default());
        state.update_voice_state("guild", "user", Some("voice".into()));
        assert_eq!(
            service.join_for_user("guild", "user", 42).await,
            JoinVoiceOutcome::Joined
        );
        assert_eq!(
            store
                .lock()
                .expect("store")
                .voice_presences()
                .expect("presence")[0]
                .channel_id,
            "voice"
        );

        let (failed, store, state) = make_service(FakeTransport {
            join_error: Some(VoiceSessionTransportError::PermissionDenied),
            ..FakeTransport::default()
        });
        store
            .lock()
            .expect("store")
            .remember_voice_presence("guild", "existing", 1)
            .expect("existing presence");
        state.update_voice_state("guild", "user", Some("forbidden".into()));
        assert_eq!(
            failed.join_for_user("guild", "user", 2).await,
            JoinVoiceOutcome::PermissionDenied
        );
        assert_eq!(
            store
                .lock()
                .expect("store")
                .voice_presences()
                .expect("presence")[0]
                .channel_id,
            "existing"
        );
    }

    #[tokio::test]
    async fn explicit_leave_clears_rejoin_hint_even_when_driver_is_already_gone() {
        let (service, store, _) = make_service(FakeTransport {
            leave_error: Some(VoiceSessionTransportError::Unavailable),
            ..FakeTransport::default()
        });
        store
            .lock()
            .expect("store")
            .remember_voice_presence("guild", "voice", 1)
            .expect("presence");
        assert_eq!(
            service.leave_explicitly("guild").await,
            LeaveVoiceOutcome::TransportFailed
        );
        assert!(
            store
                .lock()
                .expect("store")
                .voice_presences()
                .expect("presence")
                .is_empty()
        );
    }
}
