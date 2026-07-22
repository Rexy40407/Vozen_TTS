//! Explicit, privacy-minimised translation service.
//!
//! This is deliberately independent of Discord interactions and automatic channel mappings.
//! It mirrors the existing `/translate text` accounting contract: minimise and cap the one
//! requested text, reserve the rolling quota, call the provider, then either record success or
//! refund the exact reservation. No identifier, channel, history or raw provider error crosses
//! this boundary.

use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use vozen_core::translation_input;
use vozen_store::{
    OperationalMetric, OperationalProvider, ProviderHealth, SqliteStore, TranslationReservation,
    utc_day_key_from_unix_millis,
};

pub const FREE_GUILD_TRANSLATION_LIMIT: i64 = 100_000;
pub const PREMIUM_GUILD_TRANSLATION_LIMIT: i64 = 500_000;
pub const FREE_USER_TRANSLATION_LIMIT: i64 = 10_000;
pub const PREMIUM_USER_TRANSLATION_LIMIT: i64 = 100_000;
pub const USER_APP_TRANSLATION_SCOPE: &str = "@user-app";

/// A provider receives exactly one already-minimised text and target locale. Implementations
/// must not enrich this request with Discord metadata.
#[async_trait]
pub trait ExplicitTranslationProvider: Send + Sync {
    fn is_enabled(&self) -> bool;

    async fn translate(&self, text: &str, target_locale: &str) -> Result<String, ()>;
}

pub struct ExplicitTranslationInvocation<'a> {
    /// `None` is a private user-app request. It must use the stable aggregate quota scope.
    pub guild_id: Option<&'a str>,
    pub user_id: &'a str,
    pub text: &'a str,
    pub target_locale: &'a str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExplicitTranslationOutcome {
    Ready { text: String, source_chars: usize },
    Empty,
    Disabled,
    QuotaExceeded,
    Unavailable,
    StoreUnavailable,
}

pub struct ExplicitTranslationService<P> {
    store: Arc<Mutex<SqliteStore>>,
    provider: P,
    now_ms: Arc<dyn Fn() -> i64 + Send + Sync>,
}

impl<P> ExplicitTranslationService<P> {
    pub fn new(
        store: Arc<Mutex<SqliteStore>>,
        provider: P,
        now_ms: Arc<dyn Fn() -> i64 + Send + Sync>,
    ) -> Self {
        Self {
            store,
            provider,
            now_ms,
        }
    }
}

impl<P> ExplicitTranslationService<P>
where
    P: ExplicitTranslationProvider,
{
    pub async fn execute(
        &self,
        invocation: ExplicitTranslationInvocation<'_>,
    ) -> ExplicitTranslationOutcome {
        let input = translation_input(invocation.text);
        if input.text.is_empty() {
            return ExplicitTranslationOutcome::Empty;
        }
        if !self.provider.is_enabled() {
            return ExplicitTranslationOutcome::Disabled;
        }

        let now_ms = (self.now_ms)();
        let quota_scope = invocation.guild_id.unwrap_or(USER_APP_TRANSLATION_SCOPE);
        let source_chars = input.text.chars().count();
        let day = utc_day_key_from_unix_millis(now_ms);
        let reservation = {
            let store = match self.store.lock() {
                Ok(store) => store,
                Err(_) => return ExplicitTranslationOutcome::StoreUnavailable,
            };
            let plus = match store.is_user_premium(invocation.user_id, now_ms) {
                Ok(value) => value,
                Err(_) => return ExplicitTranslationOutcome::StoreUnavailable,
            };
            let premium = match invocation.guild_id {
                Some(guild_id) => match store.is_guild_premium(guild_id, now_ms) {
                    Ok(value) => value,
                    Err(_) => return ExplicitTranslationOutcome::StoreUnavailable,
                },
                None => false,
            };
            let guild_limit = if premium {
                PREMIUM_GUILD_TRANSLATION_LIMIT
            } else {
                FREE_GUILD_TRANSLATION_LIMIT
            };
            let user_limit = if plus || premium {
                PREMIUM_USER_TRANSLATION_LIMIT
            } else {
                FREE_USER_TRANSLATION_LIMIT
            };
            match store.reserve_translation_chars(
                quota_scope,
                invocation.user_id,
                source_chars as i64,
                if invocation.guild_id.is_some() {
                    guild_limit
                } else {
                    i64::MAX
                },
                user_limit,
                &day,
            ) {
                Ok(TranslationReservation::Reserved { chars, day }) => {
                    TranslationReservation::Reserved { chars, day }
                }
                Ok(TranslationReservation::Denied(_)) => {
                    return ExplicitTranslationOutcome::QuotaExceeded;
                }
                Err(_) => return ExplicitTranslationOutcome::StoreUnavailable,
            }
        };

        match self
            .provider
            .translate(&input.text, invocation.target_locale)
            .await
        {
            Ok(text) if !text.trim().is_empty() => {
                self.record_success(&day, now_ms, source_chars);
                ExplicitTranslationOutcome::Ready { text, source_chars }
            }
            Ok(_) | Err(()) => {
                self.refund_and_record_failure(
                    quota_scope,
                    invocation.user_id,
                    &reservation,
                    &day,
                    now_ms,
                );
                ExplicitTranslationOutcome::Unavailable
            }
        }
    }

    fn record_success(&self, day: &str, now_ms: i64, source_chars: usize) {
        if let Ok(store) = self.store.lock() {
            let _ = store.add_operational_metric(
                OperationalMetric::TranslationSuccess,
                OperationalProvider::AzureTranslation,
                1.0,
                Some(day),
            );
            let _ = store.add_operational_metric(
                OperationalMetric::TranslationChars,
                OperationalProvider::AzureTranslation,
                source_chars as f64,
                Some(day),
            );
            let _ = store.set_provider_health(
                OperationalProvider::AzureTranslation,
                ProviderHealth::Healthy,
                now_ms,
            );
        }
    }

    fn refund_and_record_failure(
        &self,
        quota_scope: &str,
        user_id: &str,
        reservation: &TranslationReservation,
        day: &str,
        now_ms: i64,
    ) {
        if let Ok(store) = self.store.lock() {
            let _ = store.refund_translation_chars(quota_scope, user_id, reservation);
            let _ = store.add_operational_metric(
                OperationalMetric::TranslationFailure,
                OperationalProvider::AzureTranslation,
                1.0,
                Some(day),
            );
            let _ = store.set_provider_health(
                OperationalProvider::AzureTranslation,
                ProviderHealth::Degraded,
                now_ms,
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicUsize, Ordering};

    use vozen_store::{OperationalMetric, OperationalProvider};

    use super::*;

    struct FakeProvider {
        enabled: bool,
        calls: AtomicUsize,
        result: Result<String, ()>,
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
        ExplicitTranslationService<FakeProvider>,
    ) {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let service = ExplicitTranslationService::new(
            Arc::clone(&store),
            provider,
            Arc::new(|| 1_709_251_200_000),
        );
        (store, service)
    }

    fn invocation<'a>(text: &'a str) -> ExplicitTranslationInvocation<'a> {
        ExplicitTranslationInvocation {
            guild_id: Some("guild"),
            user_id: "user",
            text,
            target_locale: "pt",
        }
    }

    #[tokio::test]
    async fn minimises_before_provider_and_records_identity_free_success_metrics() {
        let (store, service) = service(FakeProvider {
            enabled: true,
            calls: AtomicUsize::new(0),
            result: Ok("olá".into()),
        });
        assert_eq!(
            service
                .execute(invocation("hello <@123> https://example.test/a"))
                .await,
            ExplicitTranslationOutcome::Ready {
                text: "olá".into(),
                source_chars: "hello [member] [link]".chars().count(),
            }
        );
        let metrics = store
            .lock()
            .expect("store")
            .list_daily_operational_metrics(Some("2024-03-01"))
            .expect("metrics");
        assert!(metrics.iter().any(|metric| {
            metric.metric == OperationalMetric::TranslationSuccess
                && metric.provider == OperationalProvider::AzureTranslation
                && metric.value == 1
        }));
        assert!(metrics.iter().any(|metric| {
            metric.metric == OperationalMetric::TranslationChars
                && metric.value == "hello [member] [link]".chars().count() as i64
        }));
    }

    #[tokio::test]
    async fn disabled_or_empty_requests_do_not_call_or_spend_a_provider_quota() {
        let (store, service) = service(FakeProvider {
            enabled: false,
            calls: AtomicUsize::new(0),
            result: Ok("unused".into()),
        });
        assert_eq!(
            service.execute(invocation("hello")).await,
            ExplicitTranslationOutcome::Disabled
        );
        assert_eq!(
            service.execute(invocation("   ")).await,
            ExplicitTranslationOutcome::Empty
        );
        assert_eq!(service.provider.calls.load(Ordering::Relaxed), 0);
        assert!(
            store
                .lock()
                .expect("store")
                .list_daily_operational_metrics(Some("2024-03-01"))
                .expect("metrics")
                .is_empty()
        );
    }

    #[tokio::test]
    async fn provider_failure_refunds_the_exact_reservation_and_marks_health_degraded() {
        let (store, service) = service(FakeProvider {
            enabled: true,
            calls: AtomicUsize::new(0),
            result: Err(()),
        });
        assert_eq!(
            service.execute(invocation("hello")).await,
            ExplicitTranslationOutcome::Unavailable
        );
        let store = store.lock().expect("store");
        assert!(matches!(
            store.reserve_translation_chars("guild", "user", 10_000, 100_000, 10_000, "2024-03-01"),
            Ok(TranslationReservation::Reserved { .. })
        ));
        assert_eq!(
            store.list_provider_health().expect("health")[0].health,
            ProviderHealth::Degraded
        );
    }

    #[tokio::test]
    async fn private_requests_use_the_user_app_scope_and_never_need_a_guild_premium_check() {
        let (store, service) = service(FakeProvider {
            enabled: true,
            calls: AtomicUsize::new(0),
            result: Ok("translated".into()),
        });
        assert!(matches!(
            service
                .execute(ExplicitTranslationInvocation {
                    guild_id: None,
                    user_id: "user",
                    text: "hello",
                    target_locale: "fr",
                })
                .await,
            ExplicitTranslationOutcome::Ready { .. }
        ));
        assert!(matches!(
            store.lock().expect("store").reserve_translation_chars(
                USER_APP_TRANSLATION_SCOPE,
                "user",
                9_995,
                i64::MAX,
                FREE_USER_TRANSLATION_LIMIT,
                "2024-03-01"
            ),
            Ok(TranslationReservation::Reserved { .. })
        ));
    }
}
