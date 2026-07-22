//! Execution layer for the one-shot planned voice-session recovery policy.
//!
//! The marker/policy module intentionally has no Discord side effects. This service is the
//! narrow bridge that consumes its plan only after a caller has resolved every current channel
//! and permission fact from Discord. It never treats a stale SQLite row as proof that Vozen may
//! reconnect.

use std::sync::{Arc, Mutex};

use thiserror::Error;
use vozen_store::SqliteStore;

use crate::{
    GatewayState, PlannedRejoinScope, RejoinChannelState, VoiceSessionTransport, plan_rejoin,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PlannedRejoinOutcome {
    Joined {
        guild_id: String,
    },
    /// The row remains eligible for a later deliberate recovery (for example, Discord returned
    /// a temporary transport failure after the caller had already checked permissions).
    Retained {
        guild_id: String,
    },
    /// Recovery was not authorized or the channel no longer exists, so the durable hint was
    /// removed and can never cause an unexpected future rejoin.
    Forgotten {
        guild_id: String,
    },
}

#[derive(Debug, Error)]
pub enum PlannedRejoinError {
    #[error("SQLite rejoin state is unavailable")]
    StoreUnavailable,
}

/// Applies the plan generated from persisted voice presence. `channel_state` must derive its
/// answer from live Discord state and include bot guild membership, channel existence and
/// Connect/Speak permission checks. It is intentionally injected so no stale cache can be
/// mistaken for authorization.
pub struct PlannedRejoinService<T> {
    store: Arc<Mutex<SqliteStore>>,
    gateway_state: GatewayState,
    transport: T,
}

impl<T> PlannedRejoinService<T> {
    pub fn new(store: Arc<Mutex<SqliteStore>>, gateway_state: GatewayState, transport: T) -> Self {
        Self {
            store,
            gateway_state,
            transport,
        }
    }
}

impl<T: VoiceSessionTransport> PlannedRejoinService<T> {
    /// Executes one recovery attempt. A transport failure intentionally retains an otherwise
    /// eligible row; the marker was consumed by the caller, so a normal future boot still cannot
    /// rejoin it unless a fresh planned-restart marker exists or Premium stay-in-call applies.
    pub async fn recover(
        &self,
        scope: Option<&PlannedRejoinScope>,
        channel_state: impl Fn(&str, &str) -> RejoinChannelState,
    ) -> Result<Vec<PlannedRejoinOutcome>, PlannedRejoinError> {
        let plan = {
            let store = self
                .store
                .lock()
                .map_err(|_| PlannedRejoinError::StoreUnavailable)?;
            let presences = store
                .voice_presences()
                .map_err(|_| PlannedRejoinError::StoreUnavailable)?;
            plan_rejoin(
                presences,
                scope,
                |guild_id| {
                    store
                        .guild_config(guild_id)
                        .map(|config| config.stay_in_call)
                        .unwrap_or(false)
                },
                channel_state,
            )
        };

        let mut outcomes = Vec::with_capacity(plan.rejoin.len() + plan.forget.len());
        for guild_id in plan.forget {
            let store = self
                .store
                .lock()
                .map_err(|_| PlannedRejoinError::StoreUnavailable)?;
            store
                .forget_voice_presence(&guild_id)
                .map_err(|_| PlannedRejoinError::StoreUnavailable)?;
            outcomes.push(PlannedRejoinOutcome::Forgotten { guild_id });
        }
        for presence in plan.rejoin {
            match self
                .transport
                .join(&presence.guild_id, &presence.channel_id)
                .await
            {
                Ok(()) => {
                    // Publish current state immediately, before the asynchronous voice-state
                    // event arrives, so the strict same-call guard sees the restored call.
                    self.gateway_state
                        .set_bot_voice_channel(&presence.guild_id, Some(presence.channel_id));
                    outcomes.push(PlannedRejoinOutcome::Joined {
                        guild_id: presence.guild_id,
                    });
                }
                Err(_) => outcomes.push(PlannedRejoinOutcome::Retained {
                    guild_id: presence.guild_id,
                }),
            }
        }
        Ok(outcomes)
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use async_trait::async_trait;
    use vozen_store::{GuildConfigPatch, VoicePresence};

    use super::*;
    use crate::VoiceSessionTransportError;

    #[derive(Default)]
    struct FakeTransport {
        joins: Mutex<Vec<(String, String)>>,
        fail: bool,
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
            if self.fail {
                Err(VoiceSessionTransportError::Failed)
            } else {
                Ok(())
            }
        }

        async fn leave(&self, _guild_id: &str) -> Result<(), VoiceSessionTransportError> {
            Ok(())
        }
    }

    fn service(
        transport: FakeTransport,
    ) -> (
        PlannedRejoinService<FakeTransport>,
        Arc<Mutex<SqliteStore>>,
        GatewayState,
    ) {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let state = GatewayState::default();
        state.remember_bot_user("bot".into());
        (
            PlannedRejoinService::new(store.clone(), state.clone(), transport),
            store,
            state,
        )
    }

    #[tokio::test]
    async fn eligible_planned_rejoin_updates_live_voice_state_only_after_join() {
        let (service, store, state) = service(FakeTransport::default());
        store
            .lock()
            .expect("store")
            .remember_voice_presence("guild", "voice", 1)
            .expect("presence");
        let outcomes = service
            .recover(Some(&PlannedRejoinScope::All), |_, _| {
                RejoinChannelState::Ready
            })
            .await
            .expect("rejoin");
        assert_eq!(
            outcomes,
            vec![PlannedRejoinOutcome::Joined {
                guild_id: "guild".into()
            }]
        );
        assert_eq!(
            state.bot_voice_channel_id("guild").as_deref(),
            Some("voice")
        );
    }

    #[tokio::test]
    async fn stale_normal_presence_is_forgotten_while_premium_presence_can_recover() {
        let (service, store, _) = service(FakeTransport::default());
        {
            let store_guard = store.lock().expect("store");
            store_guard
                .remember_voice_presence("normal", "voice-a", 1)
                .expect("normal");
            store_guard
                .remember_voice_presence("premium", "voice-b", 1)
                .expect("premium");
            store_guard
                .update_guild_config(
                    "premium",
                    GuildConfigPatch {
                        stay_in_call: Some(true),
                        ..GuildConfigPatch::default()
                    },
                )
                .expect("premium setting");
        }

        let outcomes = service
            .recover(None, |_, _| RejoinChannelState::Ready)
            .await
            .expect("rejoin");
        assert_eq!(
            outcomes,
            vec![
                PlannedRejoinOutcome::Forgotten {
                    guild_id: "normal".into()
                },
                PlannedRejoinOutcome::Joined {
                    guild_id: "premium".into()
                },
            ]
        );
        assert_eq!(
            store
                .lock()
                .expect("store")
                .voice_presences()
                .expect("presences"),
            vec![VoicePresence {
                guild_id: "premium".into(),
                channel_id: "voice-b".into(),
                updated_at: 1,
            }]
        );
    }

    #[tokio::test]
    async fn failed_transport_retains_an_authorized_presence_but_never_claims_live_voice() {
        let (service, store, state) = service(FakeTransport {
            fail: true,
            ..FakeTransport::default()
        });
        store
            .lock()
            .expect("store")
            .remember_voice_presence("guild", "voice", 1)
            .expect("presence");
        assert_eq!(
            service
                .recover(Some(&PlannedRejoinScope::All), |_, _| {
                    RejoinChannelState::Ready
                })
                .await
                .expect("recover"),
            vec![PlannedRejoinOutcome::Retained {
                guild_id: "guild".into()
            }]
        );
        assert_eq!(state.bot_voice_channel_id("guild"), None);
        assert_eq!(
            store
                .lock()
                .expect("store")
                .voice_presences()
                .expect("presence")
                .len(),
            1
        );
    }
}
