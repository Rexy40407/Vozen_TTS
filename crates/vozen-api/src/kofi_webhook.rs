//! Authenticated Ko-fi webhook adapter.
//!
//! Purchases remain pending until the buyer selects their Discord account and accepts the
//! delivery terms. The only automatic path is a renewal already bound to the same opaque email
//! HMAC. The request body and every external field are untrusted.

use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use axum::{
    Router,
    body::Bytes,
    extract::State,
    http::{Method, StatusCode},
    response::{IntoResponse, Response},
    routing::any,
};
use vozen_core::{
    ShopProduct, hash_kofi_email, map_kofi_to_grant, parse_kofi_payload, verify_kofi_token,
};
use vozen_store::{KofiDelivery, SqliteStore, process_kofi_delivery};

const BODY_MAX_BYTES: usize = 64_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnmappedShopPurchase {
    pub shop_item_codes: Vec<String>,
    pub transaction_id: Option<String>,
}

type UnmappedShopReporter = Arc<dyn Fn(UnmappedShopPurchase) + Send + Sync>;

pub struct KofiWebhookConfig {
    /// Ko-fi's shared verification token. A blank token makes construction fail closed.
    pub verification_token: String,
    pub store: Arc<Mutex<SqliteStore>>,
    pub shop_map: HashMap<String, ShopProduct>,
    pub now: Arc<dyn Fn() -> i64 + Send + Sync>,
    /// Redacted alert for a paid Shop order absent from `KOFI_SHOP_MAP`.
    pub on_unmapped_shop: Option<UnmappedShopReporter>,
}

#[derive(Clone)]
struct KofiWebhookState {
    verification_token: Arc<str>,
    store: Arc<Mutex<SqliteStore>>,
    shop_map: Arc<HashMap<String, ShopProduct>>,
    now: Arc<dyn Fn() -> i64 + Send + Sync>,
    on_unmapped_shop: Option<UnmappedShopReporter>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KofiWebhookConfigError {
    VerificationToken,
}

impl std::fmt::Display for KofiWebhookConfigError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("Ko-fi webhook requires a verification token")
    }
}

impl std::error::Error for KofiWebhookConfigError {}

/// Builds the sensitive payment route. Ko-fi deployments historically pointed at the server
/// root, while newer setups use `/webhook/kofi`; keep both paths during the cutover so changing
/// the runtime does not silently stop purchase delivery.
pub fn kofi_webhook_router(config: KofiWebhookConfig) -> Result<Router, KofiWebhookConfigError> {
    if config.verification_token.trim().is_empty() {
        return Err(KofiWebhookConfigError::VerificationToken);
    }
    Ok(Router::new()
        .route("/", any(kofi_webhook))
        .route("/webhook/kofi", any(kofi_webhook))
        .with_state(KofiWebhookState {
            verification_token: Arc::from(config.verification_token),
            store: config.store,
            shop_map: Arc::new(config.shop_map),
            now: config.now,
            on_unmapped_shop: config.on_unmapped_shop,
        }))
}

async fn kofi_webhook(
    State(state): State<KofiWebhookState>,
    method: Method,
    body: Bytes,
) -> Response {
    if method != Method::POST {
        return StatusCode::NOT_FOUND.into_response();
    }
    if body.len() > BODY_MAX_BYTES {
        return (StatusCode::PAYLOAD_TOO_LARGE, "too large").into_response();
    }
    let Ok(raw) = std::str::from_utf8(&body) else {
        return (StatusCode::BAD_REQUEST, "bad payload").into_response();
    };
    let Some(event) = parse_kofi_payload(raw) else {
        return (StatusCode::BAD_REQUEST, "bad payload").into_response();
    };
    if !verify_kofi_token(&event, Some(&state.verification_token)) {
        return (StatusCode::UNAUTHORIZED, "bad token").into_response();
    }
    let Some(grant) = map_kofi_to_grant(&event, &state.shop_map) else {
        // A plain donation or an unknown Shop item is acknowledged so retries cannot create a
        // delivery storm. The final runtime will record a redacted operator metric for unmapped
        // Shop codes before Node is retired. The callback is intentionally redacted: no buyer
        // name, message or email is ever handed to an operator telemetry path.
        if event.event_type == "Shop Order"
            && let Some(report) = &state.on_unmapped_shop
        {
            report(UnmappedShopPurchase {
                shop_item_codes: event.shop_item_codes,
                transaction_id: event.transaction_id,
            });
        }
        return (StatusCode::OK, "ok").into_response();
    };
    let email_hash = event
        .email
        .as_deref()
        .map(|email| hash_kofi_email(&state.verification_token, email));
    let delivery = KofiDelivery {
        transaction_id: event.transaction_id,
        email_hash,
        is_subscription_payment: event.is_subscription_payment,
        is_first_subscription_payment: event.is_first_subscription_payment,
        grant,
    };
    let result = match state.store.lock() {
        Ok(store) => process_kofi_delivery(&store, &delivery, (state.now)()),
        Err(_) => return (StatusCode::SERVICE_UNAVAILABLE, "retry").into_response(),
    };
    match result {
        Ok(_) => (StatusCode::OK, "ok").into_response(),
        // A 5xx is intentional: Ko-fi retries and `kofi_transaction` makes a successful retry
        // idempotent. A 200 here could lose a paid delivery on SQLITE_BUSY/disk failure.
        Err(_) => (StatusCode::SERVICE_UNAVAILABLE, "retry").into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request};
    use tower::ServiceExt;
    use vozen_store::KofiPendingPlan;

    const NOW: i64 = 1_000;

    fn router(store: Arc<Mutex<SqliteStore>>) -> Router {
        kofi_webhook_router(KofiWebhookConfig {
            verification_token: "token".into(),
            store,
            shop_map: HashMap::new(),
            now: Arc::new(|| NOW),
            on_unmapped_shop: None,
        })
        .expect("router")
    }

    fn payload(token: &str, tier: &str) -> String {
        format!(
            r#"{{"verification_token":"{token}","type":"Subscription","is_subscription_payment":true,"is_first_subscription_payment":true,"tier_name":"{tier}","email":"buyer@example.com","kofi_transaction_id":"tx-1"}}"#
        )
    }

    #[tokio::test]
    async fn holds_new_paid_purchase_pending_after_verifying_the_kofi_token() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let response = router(store.clone())
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/webhook/kofi")
                    .body(Body::from(payload("token", "Vozen Premium")))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let pending = store
            .lock()
            .unwrap()
            .unclaimed_kofi_pending_by_transaction("tx-1")
            .expect("pending")
            .expect("purchase");
        assert_eq!(pending.input.plan, KofiPendingPlan::Premium);
        assert!(pending.input.email_hash.is_some());
    }

    #[tokio::test]
    async fn rejects_wrong_token_without_creating_a_pending_purchase() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let response = router(store.clone())
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/webhook/kofi")
                    .body(Body::from(payload("attacker", "Vozen Plus")))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        assert!(
            store
                .lock()
                .unwrap()
                .unclaimed_kofi_pending_by_transaction("tx-1")
                .expect("read")
                .is_none()
        );
    }

    #[tokio::test]
    async fn accepts_the_legacy_root_webhook_path() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let response = router(store.clone())
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/")
                    .body(Body::from(payload("token", "Vozen Plus")))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        assert!(
            store
                .lock()
                .unwrap()
                .unclaimed_kofi_pending_by_transaction("tx-1")
                .expect("pending")
                .is_some()
        );
    }

    #[tokio::test]
    async fn rejects_oversized_webhooks_and_acknowledges_unknown_products() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let oversized = router(store.clone())
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/webhook/kofi")
                    .body(Body::from("x".repeat(BODY_MAX_BYTES + 1)))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(oversized.status(), StatusCode::PAYLOAD_TOO_LARGE);

        let unknown = router(store)
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/webhook/kofi")
                    .body(Body::from(payload("token", "A tip")))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(unknown.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn reports_unmapped_shop_order_without_disclosing_buyer_data() {
        let reports = Arc::new(Mutex::new(Vec::new()));
        let reporter = reports.clone();
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let router = kofi_webhook_router(KofiWebhookConfig {
            verification_token: "token".into(),
            store,
            shop_map: HashMap::new(),
            now: Arc::new(|| NOW),
            on_unmapped_shop: Some(Arc::new(move |purchase| {
                reporter.lock().unwrap().push(purchase);
            })),
        })
        .expect("router");
        let payload = r#"{"verification_token":"token","type":"Shop Order","shop_items":[{"direct_link_code":"annual-2026"}],"email":"buyer@example.com","kofi_transaction_id":"tx-private"}"#;
        let response = router
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/webhook/kofi")
                    .body(Body::from(payload))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            reports.lock().unwrap().as_slice(),
            [UnmappedShopPurchase {
                shop_item_codes: vec!["annual-2026".into()],
                transaction_id: Some("tx-private".into()),
            }]
        );
    }
}
