//! Bounded, best-effort persistence for post-playback speech telemetry.
//!
//! The message handler only performs a non-blocking queue send.  A small worker owns the
//! SQLite writes and coalesces compatible counters before flushing them.  Durable quota and
//! entitlement reservations deliberately do not use this writer.

use std::{
    collections::HashMap,
    sync::{
        Arc, Mutex,
        atomic::{AtomicU64, Ordering},
        mpsc::{self, Receiver, RecvTimeoutError, SyncSender, TrySendError},
    },
    thread,
    time::Duration,
};

use vozen_store::{
    OperationalMetric, OperationalProvider, ProviderHealth, SqliteStore, UserEngine,
};

const QUEUE_CAPACITY: usize = 1024;
const FLUSH_INTERVAL: Duration = Duration::from_millis(50);

#[derive(Clone)]
pub struct SpeechTelemetryWriter {
    inner: Arc<WriterInner>,
}

struct WriterInner {
    sender: SyncSender<Command>,
    dropped: AtomicU64,
}

enum Command {
    Event(Event),
    Flush(mpsc::Sender<()>),
    Shutdown(mpsc::Sender<()>),
}

#[derive(Debug)]
enum Event {
    Metric {
        day: String,
        metric: OperationalMetric,
        provider: OperationalProvider,
        value: i64,
    },
    ProviderHealth {
        provider: OperationalProvider,
        health: ProviderHealth,
        changed_at: i64,
    },
    GuildTalk {
        guild_id: String,
        day: String,
    },
    TalkUsage {
        guild_id: String,
        user_id: String,
        model: String,
        engine: UserEngine,
    },
}

impl SpeechTelemetryWriter {
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Self {
        let (sender, receiver) = mpsc::sync_channel(QUEUE_CAPACITY);
        thread::Builder::new()
            .name("vozen-speech-telemetry".to_owned())
            .spawn(move || worker(receiver, store))
            .expect("spawn speech telemetry worker");
        Self {
            inner: Arc::new(WriterInner {
                sender,
                dropped: AtomicU64::new(0),
            }),
        }
    }

    pub fn record_metric(
        &self,
        day: &str,
        metric: OperationalMetric,
        provider: OperationalProvider,
        value: i64,
    ) {
        self.enqueue(Event::Metric {
            day: day.to_owned(),
            metric,
            provider,
            value,
        });
    }

    pub fn record_provider_health(
        &self,
        provider: OperationalProvider,
        health: ProviderHealth,
        changed_at: i64,
    ) {
        self.enqueue(Event::ProviderHealth {
            provider,
            health,
            changed_at,
        });
    }

    pub fn record_guild_talk(&self, guild_id: &str, day: &str) {
        self.enqueue(Event::GuildTalk {
            guild_id: guild_id.to_owned(),
            day: day.to_owned(),
        });
    }

    pub fn record_talk_usage(
        &self,
        guild_id: &str,
        user_id: &str,
        model: &str,
        engine: UserEngine,
    ) {
        self.enqueue(Event::TalkUsage {
            guild_id: guild_id.to_owned(),
            user_id: user_id.to_owned(),
            model: model.to_owned(),
            engine,
        });
    }

    fn enqueue(&self, event: Event) {
        match self.inner.sender.try_send(Command::Event(event)) {
            Ok(()) => {}
            Err(TrySendError::Full(_)) | Err(TrySendError::Disconnected(_)) => {
                self.inner.dropped.fetch_add(1, Ordering::Relaxed);
            }
        }
    }

    /// Flushes queued telemetry. Intended for graceful shutdown and deterministic tests.
    pub fn flush(&self) {
        let (ack, wait) = mpsc::channel();
        if self.inner.sender.send(Command::Flush(ack)).is_ok() {
            let _ = wait.recv();
        }
    }

    /// Flushes queued telemetry and stops the worker. Safe to call more than once.
    pub fn shutdown(&self) {
        let (ack, wait) = mpsc::channel();
        if self.inner.sender.send(Command::Shutdown(ack)).is_ok() {
            let _ = wait.recv();
        }
    }

    #[must_use]
    pub fn dropped_events(&self) -> u64 {
        self.inner.dropped.load(Ordering::Relaxed)
    }
}

impl Drop for SpeechTelemetryWriter {
    fn drop(&mut self) {
        if Arc::strong_count(&self.inner) == 1 {
            self.shutdown();
        }
    }
}

fn worker(receiver: Receiver<Command>, store: Arc<Mutex<SqliteStore>>) {
    let mut pending = Pending::default();
    loop {
        match receiver.recv_timeout(FLUSH_INTERVAL) {
            Ok(Command::Event(event)) => pending.push(event),
            Ok(Command::Flush(ack)) => {
                pending.flush(&store);
                let _ = ack.send(());
            }
            Ok(Command::Shutdown(ack)) => {
                pending.flush(&store);
                let _ = ack.send(());
                return;
            }
            Err(RecvTimeoutError::Timeout) => pending.flush(&store),
            Err(RecvTimeoutError::Disconnected) => {
                pending.flush(&store);
                return;
            }
        }
    }
}

#[derive(Default)]
struct Pending {
    metrics: MetricPending,
    provider_health: HashMap<String, (OperationalProvider, ProviderHealth, i64)>,
    guild_talk: HashMap<(String, String), i64>,
    talk_usage: HashMap<(String, String, String, UserEngine), i64>,
}

type MetricPending =
    HashMap<(String, String, String), (String, OperationalMetric, OperationalProvider, i64)>;

impl Pending {
    fn push(&mut self, event: Event) {
        match event {
            Event::Metric {
                day,
                metric,
                provider,
                value,
            } => {
                let key = (day.clone(), format!("{metric:?}"), format!("{provider:?}"));
                let entry = self
                    .metrics
                    .entry(key)
                    .or_insert((day, metric, provider, 0));
                entry.3 += value;
            }
            Event::ProviderHealth {
                provider,
                health,
                changed_at,
            } => {
                self.provider_health
                    .insert(format!("{provider:?}"), (provider, health, changed_at));
            }
            Event::GuildTalk { guild_id, day } => {
                *self.guild_talk.entry((guild_id, day)).or_default() += 1;
            }
            Event::TalkUsage {
                guild_id,
                user_id,
                model,
                engine,
            } => {
                *self
                    .talk_usage
                    .entry((guild_id, user_id, model, engine))
                    .or_default() += 1
            }
        }
    }

    fn flush(&mut self, store: &Arc<Mutex<SqliteStore>>) {
        if self.metrics.is_empty()
            && self.provider_health.is_empty()
            && self.guild_talk.is_empty()
            && self.talk_usage.is_empty()
        {
            return;
        }
        let Ok(store) = store.lock() else {
            return;
        };
        for (_, (day, metric, provider, value)) in self.metrics.drain() {
            let _ = store.add_operational_metric(metric, provider, value as f64, Some(&day));
        }
        for (_, (provider, health, changed_at)) in self.provider_health.drain() {
            let _ = store.set_provider_health(provider, health, changed_at);
        }
        for ((guild_id, day), value) in self.guild_talk.drain() {
            for _ in 0..value {
                let _ = store.bump_guild_talk(&guild_id, &day);
            }
        }
        for ((guild_id, user_id, model, engine), value) in self.talk_usage.drain() {
            for _ in 0..value {
                let _ = store.bump_talk_usage(&guild_id, &user_id, &model, engine);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn metrics_from_different_days_keep_separate_buckets() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let writer = SpeechTelemetryWriter::new(store.clone());
        writer.record_metric(
            "2026-07-31",
            OperationalMetric::SynthSuccess,
            OperationalProvider::Piper,
            1,
        );
        writer.record_metric(
            "2026-08-01",
            OperationalMetric::SynthSuccess,
            OperationalProvider::Piper,
            1,
        );
        writer.flush();

        let store = store.lock().expect("store");
        assert_eq!(
            store
                .list_daily_operational_metrics(Some("2026-07-31"))
                .expect("first day")
                .iter()
                .map(|row| row.value)
                .sum::<i64>(),
            1
        );
        assert_eq!(
            store
                .list_daily_operational_metrics(Some("2026-08-01"))
                .expect("second day")
                .iter()
                .map(|row| row.value)
                .sum::<i64>(),
            1
        );
    }
}
