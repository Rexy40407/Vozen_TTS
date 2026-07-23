//! Tokio runtime stall monitor.
//!
//! The Node runtime reports delayed event-loop ticks because a blocked loop makes gateway
//! responses (especially autocomplete) appear broken. Tokio is cooperative rather than
//! single-threaded in the same way, but a saturated executor or blocking task produces the same
//! user-visible symptom. Keep the tracker pure and cheap so it can be tested without sleeping.

use std::time::{Duration, Instant};

use vozen_core::RuntimeMetrics;

const INTERVAL: Duration = Duration::from_millis(500);
const WARN_AFTER: Duration = Duration::from_millis(400);

#[derive(Debug, Clone, Copy)]
struct LagTracker {
    expected: Instant,
    interval: Duration,
}

impl LagTracker {
    fn new(now: Instant, interval: Duration) -> Self {
        Self {
            expected: now + interval,
            interval,
        }
    }

    fn tick(&mut self, now: Instant) -> Duration {
        let lag = now.saturating_duration_since(self.expected);
        // Re-anchor after every tick: a single stall must not make every later tick look late.
        self.expected = now + self.interval;
        lag
    }
}

/// Runs until the process exits. The task is intentionally detached: it must never keep shutdown
/// waiting and it has no external side effects beyond a bounded log line and an in-memory metric.
pub fn spawn(metrics: RuntimeMetrics) {
    tokio::spawn(async move {
        let mut tracker = LagTracker::new(Instant::now(), INTERVAL);
        let mut ticker = tokio::time::interval_at(tokio::time::Instant::now() + INTERVAL, INTERVAL);
        loop {
            ticker.tick().await;
            let lag = tracker.tick(Instant::now());
            if lag >= WARN_AFTER {
                metrics.record_loop_stall();
                eprintln!(
                    "[health] Tokio runtime stalled for approximately {}ms; gateway responses may be delayed",
                    lag.as_millis()
                );
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tracker_reanchors_after_a_stall() {
        let start = Instant::now();
        let mut tracker = LagTracker::new(start, Duration::from_millis(500));
        assert_eq!(
            tracker.tick(start + Duration::from_millis(500)),
            Duration::ZERO
        );
        assert_eq!(
            tracker.tick(start + Duration::from_millis(1_400)),
            Duration::from_millis(400)
        );
        assert_eq!(
            tracker.tick(start + Duration::from_millis(1_900)),
            Duration::ZERO
        );
    }

    #[test]
    fn clock_regression_is_treated_as_zero_lag() {
        let start = Instant::now();
        let mut tracker = LagTracker::new(start, Duration::from_millis(500));
        assert_eq!(
            tracker.tick(start + Duration::from_millis(400)),
            Duration::ZERO
        );
    }
}
