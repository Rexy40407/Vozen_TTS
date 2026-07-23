//! Process-local observability shared by the Rust TTS and gateway adapters.
//!
//! These counters intentionally contain no message text, user identifiers or guild identifiers.
//! They reset with the process, matching the lifecycle of the existing Node `/stats` metrics.

use std::sync::{
    Arc, Mutex,
    atomic::{AtomicU64, Ordering},
};

const MAX_LATENCY_SAMPLES: usize = 512;

#[derive(Clone, Default)]
pub struct RuntimeMetrics {
    messages_spoken: Arc<AtomicU64>,
    cache_hits: Arc<AtomicU64>,
    cache_misses: Arc<AtomicU64>,
    synth_errors: Arc<AtomicU64>,
    synth_count: Arc<AtomicU64>,
    voice_drops: Arc<AtomicU64>,
    voice_reconnects: Arc<AtomicU64>,
    votes: Arc<AtomicU64>,
    loop_stalls: Arc<AtomicU64>,
    synth_latencies_ms: Arc<Mutex<Vec<u64>>>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct RuntimeMetricsSnapshot {
    pub messages_spoken: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub synth_errors: u64,
    pub synth_count: u64,
    pub synth_p50_ms: u64,
    pub synth_p95_ms: u64,
    pub voice_drops: u64,
    pub voice_reconnects: u64,
    pub votes: u64,
    pub loop_stalls: u64,
}

impl RuntimeMetrics {
    pub fn record_message_spoken(&self) {
        self.messages_spoken.fetch_add(1, Ordering::Relaxed);
    }

    pub fn message_counter(&self) -> Arc<AtomicU64> {
        self.messages_spoken.clone()
    }

    pub fn record_cache_hit(&self) {
        self.cache_hits.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_cache_miss(&self) {
        self.cache_misses.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_synth_error(&self) {
        self.synth_errors.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_voice_drop(&self) {
        self.voice_drops.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_voice_reconnect(&self) {
        self.voice_reconnects.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_vote(&self) {
        self.votes.fetch_add(1, Ordering::Relaxed);
    }

    /// Records a Tokio runtime stall large enough to delay gateway work such as autocomplete.
    /// This is deliberately process-local and contains no request, user, or guild data.
    pub fn record_loop_stall(&self) {
        self.loop_stalls.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_synth_latency_ms(&self, latency_ms: u64) {
        self.synth_count.fetch_add(1, Ordering::Relaxed);
        let Ok(mut samples) = self.synth_latencies_ms.lock() else {
            return;
        };
        samples.push(latency_ms);
        if samples.len() > MAX_LATENCY_SAMPLES {
            let excess = samples.len() - MAX_LATENCY_SAMPLES;
            samples.drain(..excess);
        }
    }

    pub fn snapshot(&self) -> RuntimeMetricsSnapshot {
        let mut samples = self
            .synth_latencies_ms
            .lock()
            .map(|samples| samples.clone())
            .unwrap_or_default();
        samples.sort_unstable();
        let percentile = |percent: usize| -> u64 {
            samples
                .get(((samples.len() * percent) / 100).min(samples.len().saturating_sub(1)))
                .copied()
                .unwrap_or(0)
        };
        RuntimeMetricsSnapshot {
            messages_spoken: self.messages_spoken.load(Ordering::Relaxed),
            cache_hits: self.cache_hits.load(Ordering::Relaxed),
            cache_misses: self.cache_misses.load(Ordering::Relaxed),
            synth_errors: self.synth_errors.load(Ordering::Relaxed),
            synth_count: self.synth_count.load(Ordering::Relaxed),
            synth_p50_ms: percentile(50),
            synth_p95_ms: percentile(95),
            voice_drops: self.voice_drops.load(Ordering::Relaxed),
            voice_reconnects: self.voice_reconnects.load(Ordering::Relaxed),
            votes: self.votes.load(Ordering::Relaxed),
            loop_stalls: self.loop_stalls.load(Ordering::Relaxed),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snapshot_is_process_local_and_uses_sorted_percentiles() {
        let metrics = RuntimeMetrics::default();
        metrics.record_message_spoken();
        metrics.record_cache_hit();
        metrics.record_cache_miss();
        metrics.record_synth_latency_ms(30);
        metrics.record_synth_latency_ms(10);
        metrics.record_synth_latency_ms(20);
        let snapshot = metrics.snapshot();
        assert_eq!(snapshot.messages_spoken, 1);
        assert_eq!(snapshot.cache_hits, 1);
        assert_eq!(snapshot.cache_misses, 1);
        assert_eq!(snapshot.synth_count, 3);
        assert_eq!(snapshot.synth_p50_ms, 20);
        assert_eq!(snapshot.synth_p95_ms, 30);
        assert_eq!(snapshot.loop_stalls, 0);
    }
}
