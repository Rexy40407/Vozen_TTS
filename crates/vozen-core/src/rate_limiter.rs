//! Bounded, per-guild user speech rate limiting.
//!
//! This ports the Node token-bucket behaviour instead of using a fixed-window counter: tokens
//! refill continuously, so a user is not artificially locked out until the next minute boundary.

use std::collections::HashMap;

/// Above this many users in one guild, `allow` opportunistically removes buckets which have
/// refilled completely and are therefore indistinguishable from a missing bucket.
pub const MAX_RATE_LIMIT_BUCKETS: usize = 5_000;
pub const DEFAULT_RATE_LIMIT_IDLE_MS: i64 = 5 * 60_000;

#[derive(Debug, Clone, Copy)]
struct Bucket {
    tokens: f64,
    last_refill_ms: i64,
}

/// Per-user token buckets for one guild. It owns no Discord IDs outside this guild and must be
/// discarded when the bot leaves the guild, just as the Node `BotDeps.limiters` entry is.
#[derive(Debug)]
pub struct RateLimiter {
    per_min: i64,
    refill_interval_ms: f64,
    buckets: HashMap<String, Bucket>,
}

impl RateLimiter {
    pub fn new(per_min: i64) -> Self {
        Self {
            per_min,
            refill_interval_ms: if per_min > 0 {
                60_000.0 / per_min as f64
            } else {
                f64::INFINITY
            },
            buckets: HashMap::new(),
        }
    }

    pub fn per_min(&self) -> i64 {
        self.per_min
    }

    pub fn bucket_count(&self) -> usize {
        self.buckets.len()
    }

    /// Removes only full, long-idle buckets. Recreating one later is observably identical to
    /// retaining it, unlike dropping a partially depleted bucket.
    pub fn sweep(&mut self, now_ms: i64, max_idle_ms: i64) -> usize {
        let before = self.buckets.len();
        let per_min = self.per_min;
        let refill_interval_ms = self.refill_interval_ms;
        self.buckets.retain(|_, bucket| {
            let idle = now_ms.saturating_sub(bucket.last_refill_ms);
            let effective = effective_tokens(bucket, now_ms, per_min, refill_interval_ms);
            idle < max_idle_ms || effective < per_min as f64
        });
        before - self.buckets.len()
    }

    /// Consumes one token if available. A non-positive configured rate is a hard deny.
    pub fn allow(&mut self, user_id: &str, now_ms: i64) -> bool {
        if self.per_min <= 0 {
            return false;
        }
        if self.buckets.len() > MAX_RATE_LIMIT_BUCKETS {
            self.sweep(now_ms, DEFAULT_RATE_LIMIT_IDLE_MS);
        }

        let bucket = self.buckets.entry(user_id.to_owned()).or_insert(Bucket {
            tokens: self.per_min as f64,
            last_refill_ms: now_ms,
        });
        let elapsed = now_ms.saturating_sub(bucket.last_refill_ms);
        if elapsed > 0 {
            let refilled = elapsed as f64 / self.refill_interval_ms;
            if refilled > 0.0 {
                bucket.tokens = (bucket.tokens + refilled).min(self.per_min as f64);
                bucket.last_refill_ms = now_ms;
            }
        }
        if bucket.tokens >= 1.0 {
            bucket.tokens -= 1.0;
            true
        } else {
            false
        }
    }
}

/// Process-local map that gives every guild its own configured limiter and recreates that
/// limiter as soon as an administrator changes `rate_per_min`.
#[derive(Debug, Default)]
pub struct GuildRateLimiters {
    by_guild: HashMap<String, RateLimiter>,
}

impl GuildRateLimiters {
    pub fn allow(&mut self, guild_id: &str, user_id: &str, per_min: i64, now_ms: i64) -> bool {
        let limiter = self
            .by_guild
            .entry(guild_id.to_owned())
            .or_insert_with(|| RateLimiter::new(per_min));
        if limiter.per_min() != per_min {
            *limiter = RateLimiter::new(per_min);
        }
        limiter.allow(user_id, now_ms)
    }

    pub fn forget_guild(&mut self, guild_id: &str) {
        self.by_guild.remove(guild_id);
    }

    pub fn guild_count(&self) -> usize {
        self.by_guild.len()
    }
}

fn effective_tokens(bucket: &Bucket, now_ms: i64, per_min: i64, refill_interval_ms: f64) -> f64 {
    let elapsed = now_ms.saturating_sub(bucket.last_refill_ms);
    if elapsed <= 0 {
        return bucket.tokens;
    }
    (bucket.tokens + elapsed as f64 / refill_interval_ms).min(per_min as f64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refill_is_continuous_per_user_and_never_crosses_guilds() {
        let mut limiters = GuildRateLimiters::default();
        for _ in 0..2 {
            assert!(limiters.allow("guild-a", "user", 2, 0));
        }
        assert!(!limiters.allow("guild-a", "user", 2, 0));
        // Half a minute restores exactly one token at two messages per minute.
        assert!(limiters.allow("guild-a", "user", 2, 30_000));
        assert!(limiters.allow("guild-b", "user", 2, 30_000));
    }

    #[test]
    fn non_positive_limits_are_a_hard_deny_without_storing_users() {
        let mut limiter = RateLimiter::new(0);
        assert!(!limiter.allow("user", 0));
        assert_eq!(limiter.bucket_count(), 0);
    }

    #[test]
    fn sweep_only_removes_buckets_that_are_semantically_full() {
        let mut limiter = RateLimiter::new(2);
        assert!(limiter.allow("full-later", 0));
        assert!(limiter.allow("partial", 0));
        assert!(limiter.allow("partial", 0));
        // `full-later` has had time to refill fully; `partial` has not.
        assert_eq!(limiter.sweep(30_000, 1), 1);
        assert_eq!(limiter.bucket_count(), 1);
        assert!(limiter.allow("partial", 30_000));
        assert!(!limiter.allow("partial", 30_000));
        assert!(limiter.allow("full-later", 30_000));
    }

    #[test]
    fn replacing_a_guild_limit_resets_its_old_bucket_state() {
        let mut limiters = GuildRateLimiters::default();
        assert!(limiters.allow("guild", "user", 1, 0));
        assert!(!limiters.allow("guild", "user", 1, 0));
        assert!(limiters.allow("guild", "user", 3, 0));
        limiters.forget_guild("guild");
        assert_eq!(limiters.guild_count(), 0);
    }
}
