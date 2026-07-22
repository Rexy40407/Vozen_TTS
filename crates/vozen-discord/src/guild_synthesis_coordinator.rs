//! Per-guild ownership for synthesis work that has not reached Songbird yet.
//!
//! Songbird can only expose WAVs which have already been enqueued. Without this coordinator,
//! two requests for the same guild can finish Piper in a different order from their admission
//! order, and `/skip` cannot affect a request which is still being synthesized. The coordinator
//! is deliberately text-free: it stores only guild identifiers and cancellation state.

use std::{
    collections::BTreeMap,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
};

use tokio::sync::{Mutex as AsyncMutex, OwnedMutexGuard};

#[derive(Default)]
struct GuildSynthesisState {
    gate: Arc<AsyncMutex<()>>,
    clear_generation: AtomicU64,
    active: AtomicBool,
    active_cancelled: AtomicBool,
}

/// Shares an asynchronous synthesis gate between every Rust-owned input path for a guild.
///
/// The map grows only for guilds which have used the Rust voice canary. It contains no user
/// content, voice model, WAV path, or queue metadata.
#[derive(Clone, Default)]
pub struct GuildSynthesisCoordinator {
    states: Arc<Mutex<BTreeMap<String, Arc<GuildSynthesisState>>>>,
}

impl GuildSynthesisCoordinator {
    fn state(&self, guild_id: &str) -> Arc<GuildSynthesisState> {
        let mut states = self
            .states
            .lock()
            .expect("guild synthesis coordinator lock poisoned");
        states
            .entry(guild_id.to_owned())
            .or_insert_with(|| Arc::new(GuildSynthesisState::default()))
            .clone()
    }

    /// Captures the clear generation when a request is admitted. If `/shut-up` runs while the
    /// request waits behind another synthesis job, that request is discarded before it reserves
    /// capacity or spends Piper CPU.
    #[must_use]
    pub fn admission_generation(&self, guild_id: &str) -> u64 {
        self.state(guild_id)
            .clear_generation
            .load(Ordering::Acquire)
    }

    pub async fn acquire(&self, guild_id: &str, admitted_generation: u64) -> GuildSynthesisLease {
        let state = self.state(guild_id);
        let gate = state.gate.clone().lock_owned().await;
        GuildSynthesisLease {
            state,
            admitted_generation,
            active: false,
            _gate: gate,
        }
    }

    /// Cancels only the item currently in reserve/synthesis/enqueue. A later request which is
    /// waiting for the same gate remains valid, matching `/skip` semantics.
    pub fn cancel_active(&self, guild_id: &str) -> bool {
        let state = self.state(guild_id);
        if !state.active.load(Ordering::Acquire) {
            return false;
        }
        state.active_cancelled.store(true, Ordering::Release);
        true
    }

    /// Cancels the in-flight item and invalidates every request admitted before this clear.
    /// This gives `/shut-up` the same effect over work waiting for Piper as it has over Songbird
    /// tracks which are already queued.
    pub fn clear(&self, guild_id: &str) -> bool {
        let state = self.state(guild_id);
        state.clear_generation.fetch_add(1, Ordering::AcqRel);
        if !state.active.load(Ordering::Acquire) {
            return false;
        }
        state.active_cancelled.store(true, Ordering::Release);
        true
    }
}

/// Owns one guild's serial synthesis section. Dropping it always releases the gate and clears
/// the active marker, including error and cancellation paths.
pub struct GuildSynthesisLease {
    state: Arc<GuildSynthesisState>,
    admitted_generation: u64,
    active: bool,
    _gate: OwnedMutexGuard<()>,
}

impl GuildSynthesisLease {
    #[must_use]
    pub fn was_cleared(&self) -> bool {
        self.state.clear_generation.load(Ordering::Acquire) != self.admitted_generation
    }

    /// Makes this lease addressable by `/skip` and `/shut-up`.
    pub fn activate(&mut self) {
        self.state.active_cancelled.store(false, Ordering::Release);
        self.state.active.store(true, Ordering::Release);
        self.active = true;
    }

    #[must_use]
    pub fn cancelled(&self) -> bool {
        self.state.active_cancelled.load(Ordering::Acquire) || self.was_cleared()
    }
}

impl Drop for GuildSynthesisLease {
    fn drop(&mut self) {
        if self.active {
            self.state.active.store(false, Ordering::Release);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn clear_cancels_active_work_and_invalidates_previously_admitted_work() {
        let coordinator = GuildSynthesisCoordinator::default();
        let generation = coordinator.admission_generation("guild");
        let mut lease = coordinator.acquire("guild", generation).await;
        lease.activate();

        assert!(coordinator.clear("guild"));
        assert!(lease.cancelled());
        assert!(lease.was_cleared());
        assert_ne!(generation, coordinator.admission_generation("guild"));
    }

    #[tokio::test]
    async fn skip_cancels_only_the_active_lease() {
        let coordinator = GuildSynthesisCoordinator::default();
        let generation = coordinator.admission_generation("guild");
        let mut lease = coordinator.acquire("guild", generation).await;
        lease.activate();

        assert!(coordinator.cancel_active("guild"));
        assert!(lease.cancelled());
        assert!(!lease.was_cleared());
    }

    #[tokio::test]
    async fn one_guild_waits_for_the_previous_synthesis_lease() {
        let coordinator = GuildSynthesisCoordinator::default();
        let first_generation = coordinator.admission_generation("guild");
        let first = coordinator.acquire("guild", first_generation).await;

        let second_coordinator = coordinator.clone();
        let second = tokio::spawn(async move {
            let generation = second_coordinator.admission_generation("guild");
            second_coordinator.acquire("guild", generation).await
        });
        tokio::task::yield_now().await;
        assert!(!second.is_finished());

        drop(first);
        drop(second.await.expect("second lease"));
    }
}
