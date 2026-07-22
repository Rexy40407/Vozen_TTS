//! Automatic channel-translation preparation with delivery-aware accounting.
//!
//! A Discord adapter must check live source/destination permissions before invoking this service
//! and call [`AutomaticTranslationDelivery::mark_delivered`] only after Discord accepts the
//! outbound message. Dropping a delivery receipt refunds quota and releases its concurrency slot,
//! so a failed send can never be billed as a successful translation.

use std::sync::{Arc, Mutex};

use vozen_core::{
    AutomaticTranslationDecision, AutomaticTranslationDenial, AutomaticTranslationFacts,
    admit_automatic_translation, translation_input,
};
use vozen_store::{
    OperationalMetric, OperationalProvider, ProviderHealth, SqliteStore, TranslationReservation,
    utc_day_key_from_unix_millis,
};

use crate::{
    ExplicitTranslationProvider, FREE_GUILD_TRANSLATION_LIMIT, FREE_USER_TRANSLATION_LIMIT,
    PREMIUM_GUILD_TRANSLATION_LIMIT, PREMIUM_USER_TRANSLATION_LIMIT,
};

pub const MAX_AUTOMATIC_TRANSLATION_IN_FLIGHT: usize = 8;

pub struct AutomaticTranslationInvocation<'a> {
    pub guild_id: &'a str,
    pub channel_id: &'a str,
    pub author_id: &'a str,
    pub raw: &'a str,
    pub is_self: bool,
    pub is_bot: bool,
    pub is_webhook: bool,
    /// A live Discord adapter must authorize this exact destination before quota is reserved.
    /// A changed mapping fails closed instead of reusing authorization for another channel.
    pub authorized_destination_channel_id: Option<&'a str>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum AutomaticTranslationOutcome {
    Ignored(AutomaticTranslationDenial),
    QuotaExceeded,
    ProviderDisabled,
    Busy,
    Unavailable,
    StoreUnavailable,
    Ready(AutomaticTranslationDelivery),
}

/// A provider result awaiting Discord delivery. Its text is transient and must not be logged or
/// persisted; it contains no source author/channel identity.
pub struct AutomaticTranslationDelivery {
    pub destination_channel_id: String,
    pub text: String,
    pub shortened: bool,
    guild_id: String,
    author_id: String,
    source_chars: usize,
    reservation: TranslationReservation,
    store: Arc<Mutex<SqliteStore>>,
    in_flight: Arc<Mutex<usize>>,
    now_ms: Arc<dyn Fn() -> i64 + Send + Sync>,
    settled: bool,
}

impl std::fmt::Debug for AutomaticTranslationDelivery {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("AutomaticTranslationDelivery")
            .field("destination_channel_id", &self.destination_channel_id)
            .field("shortened", &self.shortened)
            .finish_non_exhaustive()
    }
}

impl PartialEq for AutomaticTranslationDelivery {
    fn eq(&self, other: &Self) -> bool {
        self.destination_channel_id == other.destination_channel_id
            && self.text == other.text
            && self.shortened == other.shortened
    }
}

impl Eq for AutomaticTranslationDelivery {}

impl AutomaticTranslationDelivery {
    /// Records success only once Discord accepted the outbound translation message.
    pub fn mark_delivered(mut self) {
        self.settle(true);
        self.settled = true;
    }

    fn settle(&self, delivered: bool) {
        let now_ms = (self.now_ms)();
        if let Ok(store) = self.store.lock() {
            let day = utc_day_key_from_unix_millis(now_ms);
            if delivered {
                let _ = store.add_operational_metric(
                    OperationalMetric::TranslationSuccess,
                    OperationalProvider::AzureTranslation,
                    1.0,
                    Some(&day),
                );
                let _ = store.add_operational_metric(
                    OperationalMetric::TranslationChars,
                    OperationalProvider::AzureTranslation,
                    self.source_chars as f64,
                    Some(&day),
                );
                let _ = store.set_provider_health(
                    OperationalProvider::AzureTranslation,
                    ProviderHealth::Healthy,
                    now_ms,
                );
            } else {
                let _ = store.refund_translation_chars(
                    &self.guild_id,
                    &self.author_id,
                    &self.reservation,
                );
                let _ = store.add_operational_metric(
                    OperationalMetric::TranslationFailure,
                    OperationalProvider::AzureTranslation,
                    1.0,
                    Some(&day),
                );
                let _ = store.set_provider_health(
                    OperationalProvider::AzureTranslation,
                    ProviderHealth::Degraded,
                    now_ms,
                );
            }
        }
        if let Ok(mut in_flight) = self.in_flight.lock() {
            *in_flight = in_flight.saturating_sub(1);
        }
    }
}

impl Drop for AutomaticTranslationDelivery {
    fn drop(&mut self) {
        if !self.settled {
            self.settle(false);
        }
    }
}

pub struct AutomaticTranslationService<P> {
    store: Arc<Mutex<SqliteStore>>,
    provider: P,
    in_flight: Arc<Mutex<usize>>,
    now_ms: Arc<dyn Fn() -> i64 + Send + Sync>,
}

impl<P> AutomaticTranslationService<P> {
    pub fn new(
        store: Arc<Mutex<SqliteStore>>,
        provider: P,
        now_ms: Arc<dyn Fn() -> i64 + Send + Sync>,
    ) -> Self {
        Self {
            store,
            provider,
            in_flight: Arc::new(Mutex::new(0)),
            now_ms,
        }
    }
}

impl<P> AutomaticTranslationService<P>
where
    P: ExplicitTranslationProvider,
{
    pub async fn prepare(
        &self,
        invocation: AutomaticTranslationInvocation<'_>,
    ) -> AutomaticTranslationOutcome {
        let now_ms = (self.now_ms)();
        let (destination_channel_id, target_locale, reservation, input) = {
            let store = match self.store.lock() {
                Ok(store) => store,
                Err(_) => return AutomaticTranslationOutcome::StoreUnavailable,
            };
            let config = match store.guild_config(invocation.guild_id) {
                Ok(config) => config,
                Err(_) => return AutomaticTranslationOutcome::StoreUnavailable,
            };
            let profile = match store.channel_profile(invocation.guild_id, invocation.channel_id) {
                Ok(profile) => profile,
                Err(_) => return AutomaticTranslationOutcome::StoreUnavailable,
            };
            let mapping = match store.translation_mappings(invocation.guild_id) {
                Ok(mappings) => mappings
                    .into_iter()
                    .find(|mapping| mapping.source_channel_id == invocation.channel_id),
                Err(_) => return AutomaticTranslationOutcome::StoreUnavailable,
            };
            let preference =
                match store.translation_preference(invocation.guild_id, invocation.author_id) {
                    Ok(preference) => preference,
                    Err(_) => return AutomaticTranslationOutcome::StoreUnavailable,
                };
            let decision = admit_automatic_translation(AutomaticTranslationFacts {
                content: invocation.raw,
                is_self: invocation.is_self,
                is_bot: invocation.is_bot,
                is_webhook: invocation.is_webhook,
                server_enabled: config.enabled,
                guild_translation_enabled: config.translation_enabled,
                channel_translation_enabled: profile
                    .and_then(|profile| profile.translation_enabled),
                has_mapping: mapping.is_some(),
                opted_out: preference.opted_out,
            });
            if let AutomaticTranslationDecision::Ignore(reason) = decision {
                return AutomaticTranslationOutcome::Ignored(reason);
            }
            let Some(mapping) = mapping else {
                return AutomaticTranslationOutcome::Ignored(AutomaticTranslationDenial::NoMapping);
            };
            if invocation.authorized_destination_channel_id
                != Some(mapping.destination_channel_id.as_str())
            {
                return AutomaticTranslationOutcome::Ignored(AutomaticTranslationDenial::NoMapping);
            }
            let input = translation_input(invocation.raw);
            if input.text.is_empty() {
                return AutomaticTranslationOutcome::Ignored(
                    AutomaticTranslationDenial::NoReadableContent,
                );
            }
            let source_chars = input.text.chars().count();
            let plus = match store.is_user_premium(invocation.author_id, now_ms) {
                Ok(value) => value,
                Err(_) => return AutomaticTranslationOutcome::StoreUnavailable,
            };
            let premium = match store.is_guild_premium(invocation.guild_id, now_ms) {
                Ok(value) => value,
                Err(_) => return AutomaticTranslationOutcome::StoreUnavailable,
            };
            let reservation = match store.reserve_translation_chars(
                invocation.guild_id,
                invocation.author_id,
                source_chars as i64,
                if premium {
                    PREMIUM_GUILD_TRANSLATION_LIMIT
                } else {
                    FREE_GUILD_TRANSLATION_LIMIT
                },
                if plus || premium {
                    PREMIUM_USER_TRANSLATION_LIMIT
                } else {
                    FREE_USER_TRANSLATION_LIMIT
                },
                &utc_day_key_from_unix_millis(now_ms),
            ) {
                Ok(TranslationReservation::Reserved { chars, day }) => {
                    TranslationReservation::Reserved { chars, day }
                }
                Ok(TranslationReservation::Denied(_)) => {
                    return AutomaticTranslationOutcome::QuotaExceeded;
                }
                Err(_) => return AutomaticTranslationOutcome::StoreUnavailable,
            };
            (
                mapping.destination_channel_id,
                mapping.target_locale,
                reservation,
                input,
            )
        };

        if !self.provider.is_enabled() {
            self.refund_only(invocation.guild_id, invocation.author_id, &reservation);
            return AutomaticTranslationOutcome::ProviderDisabled;
        }
        {
            let mut in_flight = match self.in_flight.lock() {
                Ok(in_flight) => in_flight,
                Err(_) => {
                    self.refund_only(invocation.guild_id, invocation.author_id, &reservation);
                    return AutomaticTranslationOutcome::StoreUnavailable;
                }
            };
            if *in_flight >= MAX_AUTOMATIC_TRANSLATION_IN_FLIGHT {
                drop(in_flight);
                self.refund_only(invocation.guild_id, invocation.author_id, &reservation);
                return AutomaticTranslationOutcome::Busy;
            }
            *in_flight += 1;
        }
        match self.provider.translate(&input.text, &target_locale).await {
            Ok(text) if !text.trim().is_empty() => {
                AutomaticTranslationOutcome::Ready(AutomaticTranslationDelivery {
                    destination_channel_id,
                    text,
                    shortened: input.truncated,
                    guild_id: invocation.guild_id.to_owned(),
                    author_id: invocation.author_id.to_owned(),
                    source_chars: input.text.chars().count(),
                    reservation,
                    store: Arc::clone(&self.store),
                    in_flight: Arc::clone(&self.in_flight),
                    now_ms: Arc::clone(&self.now_ms),
                    settled: false,
                })
            }
            Ok(_) | Err(()) => {
                self.refund_and_record_failure(
                    invocation.guild_id,
                    invocation.author_id,
                    &reservation,
                    now_ms,
                );
                if let Ok(mut in_flight) = self.in_flight.lock() {
                    *in_flight = in_flight.saturating_sub(1);
                }
                AutomaticTranslationOutcome::Unavailable
            }
        }
    }

    fn refund_and_record_failure(
        &self,
        guild_id: &str,
        author_id: &str,
        reservation: &TranslationReservation,
        now_ms: i64,
    ) {
        self.refund_only(guild_id, author_id, reservation);
        if let Ok(store) = self.store.lock() {
            let _ = store.add_operational_metric(
                OperationalMetric::TranslationFailure,
                OperationalProvider::AzureTranslation,
                1.0,
                Some(&utc_day_key_from_unix_millis(now_ms)),
            );
            let _ = store.set_provider_health(
                OperationalProvider::AzureTranslation,
                ProviderHealth::Degraded,
                now_ms,
            );
        }
    }

    fn refund_only(&self, guild_id: &str, author_id: &str, reservation: &TranslationReservation) {
        if let Ok(store) = self.store.lock() {
            let _ = store.refund_translation_chars(guild_id, author_id, reservation);
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicUsize, Ordering};

    use async_trait::async_trait;
    use vozen_store::{GuildConfigPatch, OperationalMetric};

    use super::*;

    struct FakeProvider {
        enabled: bool,
        result: Result<String, ()>,
        calls: AtomicUsize,
    }

    #[async_trait]
    impl ExplicitTranslationProvider for FakeProvider {
        fn is_enabled(&self) -> bool {
            self.enabled
        }

        async fn translate(&self, _text: &str, _target_locale: &str) -> Result<String, ()> {
            self.calls.fetch_add(1, Ordering::Relaxed);
            self.result.clone()
        }
    }

    fn service(
        provider: FakeProvider,
    ) -> (
        Arc<Mutex<SqliteStore>>,
        AutomaticTranslationService<FakeProvider>,
    ) {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        store
            .lock()
            .expect("store")
            .update_guild_config(
                "guild",
                GuildConfigPatch {
                    translation_enabled: Some(true),
                    ..GuildConfigPatch::default()
                },
            )
            .expect("config");
        store
            .lock()
            .expect("store")
            .upsert_translation_mapping(&vozen_store::TranslationMapping {
                guild_id: "guild".into(),
                source_channel_id: "source".into(),
                destination_channel_id: "destination".into(),
                target_locale: "pt".into(),
            })
            .expect("mapping");
        let service = AutomaticTranslationService::new(
            Arc::clone(&store),
            provider,
            Arc::new(|| 1_709_251_200_000),
        );
        (store, service)
    }

    fn invocation<'a>(raw: &'a str) -> AutomaticTranslationInvocation<'a> {
        AutomaticTranslationInvocation {
            guild_id: "guild",
            channel_id: "source",
            author_id: "user",
            raw,
            is_self: false,
            is_bot: false,
            is_webhook: false,
            authorized_destination_channel_id: Some("destination"),
        }
    }

    #[tokio::test]
    async fn only_records_success_after_the_adapter_confirms_delivery() {
        let (store, service) = service(FakeProvider {
            enabled: true,
            result: Ok("olá".into()),
            calls: AtomicUsize::new(0),
        });
        let outcome = service.prepare(invocation("hello <@123>")).await;
        let AutomaticTranslationOutcome::Ready(delivery) = outcome else {
            panic!("expected delivery");
        };
        assert_eq!(delivery.destination_channel_id, "destination");
        assert_eq!(delivery.text, "olá");
        assert!(
            store
                .lock()
                .expect("store")
                .list_daily_operational_metrics(Some("2024-03-01"))
                .expect("metrics")
                .is_empty()
        );
        delivery.mark_delivered();
        assert!(
            store
                .lock()
                .expect("store")
                .list_daily_operational_metrics(Some("2024-03-01"))
                .expect("metrics")
                .iter()
                .any(|metric| metric.metric == OperationalMetric::TranslationSuccess)
        );
    }

    #[tokio::test]
    async fn disabled_provider_refunds_before_returning_without_a_provider_call() {
        let (store, service) = service(FakeProvider {
            enabled: false,
            result: Ok("unused".into()),
            calls: AtomicUsize::new(0),
        });
        assert_eq!(
            service.prepare(invocation("hello")).await,
            AutomaticTranslationOutcome::ProviderDisabled
        );
        assert!(matches!(
            store.lock().expect("store").reserve_translation_chars(
                "guild",
                "user",
                FREE_USER_TRANSLATION_LIMIT,
                FREE_GUILD_TRANSLATION_LIMIT,
                FREE_USER_TRANSLATION_LIMIT,
                "2024-03-01"
            ),
            Ok(TranslationReservation::Reserved { .. })
        ));
        assert_eq!(service.provider.calls.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn changed_mapping_destination_fails_closed_before_reserving_quota() {
        let (store, service) = service(FakeProvider {
            enabled: true,
            result: Ok("unused".into()),
            calls: AtomicUsize::new(0),
        });
        let mut request = invocation("hello");
        request.authorized_destination_channel_id = Some("stale-destination");
        assert_eq!(
            service.prepare(request).await,
            AutomaticTranslationOutcome::Ignored(AutomaticTranslationDenial::NoMapping)
        );
        assert!(matches!(
            store.lock().expect("store").reserve_translation_chars(
                "guild",
                "user",
                FREE_USER_TRANSLATION_LIMIT,
                FREE_GUILD_TRANSLATION_LIMIT,
                FREE_USER_TRANSLATION_LIMIT,
                "2024-03-01"
            ),
            Ok(TranslationReservation::Reserved { .. })
        ));
        assert_eq!(service.provider.calls.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn dropping_an_undelivered_translation_refunds_the_reservation() {
        let (store, service) = service(FakeProvider {
            enabled: true,
            result: Ok("olá".into()),
            calls: AtomicUsize::new(0),
        });
        let delivery = match service.prepare(invocation("hello")).await {
            AutomaticTranslationOutcome::Ready(delivery) => delivery,
            _ => panic!("expected delivery"),
        };
        drop(delivery);
        assert!(matches!(
            store.lock().expect("store").reserve_translation_chars(
                "guild",
                "user",
                FREE_USER_TRANSLATION_LIMIT,
                FREE_GUILD_TRANSLATION_LIMIT,
                FREE_USER_TRANSLATION_LIMIT,
                "2024-03-01"
            ),
            Ok(TranslationReservation::Reserved { .. })
        ));
    }
}
