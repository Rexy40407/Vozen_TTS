//! Bounded, activity-driven reminders used by the message auto-read path.
//!
//! This mirrors the Node `LeaderboardPoster` contract: a guild only becomes eligible after
//! enough messages, the cooldown is per guild, and a successful draw resets the accumulated
//! activity. The state is intentionally in-memory; losing it on restart is safe because the
//! threshold prevents a post immediately after boot.

use std::collections::{BTreeMap, VecDeque};

pub const LEADERBOARD_MIN_MESSAGES: u32 = 30;
pub const LEADERBOARD_COOLDOWN_MS: i64 = 12 * 60 * 60 * 1_000;
pub const LEADERBOARD_POST_PROBABILITY: f64 = 0.15;
const MAX_ENTRIES: usize = 10_000;

#[derive(Debug, Clone, Copy, Default)]
struct GuildActivity {
    count: u32,
    last_post_at: i64,
}

#[derive(Debug, Default)]
pub struct LeaderboardPoster {
    state: BTreeMap<String, GuildActivity>,
    order: VecDeque<String>,
}

impl LeaderboardPoster {
    /// Records one message that was actually accepted by the speech queue.
    ///
    /// `draw` is injected so unit tests can be deterministic and the gateway adapter does not
    /// need a global RNG. Values outside 0..1 are clamped just as a defensive boundary.
    pub fn record(&mut self, guild_id: &str, now_ms: i64, draw: f64) -> bool {
        let mut activity = self.state.remove(guild_id).unwrap_or_default();
        activity.count = activity.count.saturating_add(1);
        self.order.retain(|id| id != guild_id);
        self.order.push_back(guild_id.to_owned());
        self.state.insert(guild_id.to_owned(), activity);

        while self.state.len() > MAX_ENTRIES {
            let Some(oldest) = self.order.pop_front() else {
                break;
            };
            self.state.remove(&oldest);
        }

        if activity.count < LEADERBOARD_MIN_MESSAGES
            || now_ms.saturating_sub(activity.last_post_at) < LEADERBOARD_COOLDOWN_MS
            || draw.clamp(0.0, 1.0) >= LEADERBOARD_POST_PROBABILITY
        {
            return false;
        }

        if let Some(current) = self.state.get_mut(guild_id) {
            current.count = 0;
            current.last_post_at = now_ms;
        }
        true
    }

    pub fn forget_guild(&mut self, guild_id: &str) {
        self.state.remove(guild_id);
        self.order.retain(|id| id != guild_id);
    }
}

/// A process-local draw. It is deliberately not used for secrets or rewards.
#[allow(dead_code)]
pub fn random_unit() -> f64 {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |duration| duration.subsec_nanos());
    f64::from(nanos % 1_000_000) / 1_000_000.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn waits_for_threshold_and_resets_after_a_successful_draw() {
        let mut poster = LeaderboardPoster::default();
        for _ in 0..(LEADERBOARD_MIN_MESSAGES - 1) {
            assert!(!poster.record("guild", LEADERBOARD_COOLDOWN_MS + 1, 0.0));
        }
        assert!(poster.record("guild", LEADERBOARD_COOLDOWN_MS + 1, 0.0));
        assert!(!poster.record("guild", LEADERBOARD_COOLDOWN_MS + 1, 0.0));
    }

    #[test]
    fn cooldown_and_failed_draw_keep_accumulating_activity() {
        let mut poster = LeaderboardPoster::default();
        for _ in 0..LEADERBOARD_MIN_MESSAGES {
            assert!(!poster.record("guild", 1, 0.99));
        }
        assert!(!poster.record("guild", 1, 0.99));
        assert!(poster.record("guild", LEADERBOARD_COOLDOWN_MS + 1, 0.0));
    }

    #[test]
    fn eviction_and_forget_are_bounded_and_guild_scoped() {
        let mut poster = LeaderboardPoster::default();
        poster.forget_guild("missing");
        for _ in 0..LEADERBOARD_MIN_MESSAGES {
            poster.record("guild-a", LEADERBOARD_COOLDOWN_MS + 1, 0.99);
        }
        poster.forget_guild("guild-a");
        assert!(!poster.record("guild-a", LEADERBOARD_COOLDOWN_MS + 1, 0.99));
    }
}
