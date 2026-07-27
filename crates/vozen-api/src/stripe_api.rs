//! Stripe Checkout, Billing Portal and webhook integration.
//!
//! This module deliberately uses Stripe's hosted UI. Vozen never receives card data or shipping
//! addresses. The only identity sent to Stripe is the already-authenticated Discord user ID.

use std::{
    sync::{Arc, Mutex},
    time::Duration,
};

use axum::{
    Router,
    body::Bytes,
    extract::State,
    http::{HeaderMap, HeaderValue, Method, StatusCode, header},
    response::{IntoResponse, Response},
    routing::any,
};
use hmac::{Hmac, Mac};
use serde::Deserialize;
use serde_json::{Value, json};
use sha2::Sha256;
use subtle::ConstantTimeEq;
use vozen_store::{SqliteStore, StripeSubscriptionInput};

use crate::premium_api::DiscordIdentityVerifier;

type HmacSha256 = Hmac<Sha256>;

const STRIPE_API: &str = "https://api.stripe.com/v1";
const SIGNATURE_TOLERANCE_SECONDS: i64 = 300;

#[derive(Debug, Clone)]
pub struct StripePriceIds {
    pub plus_monthly: String,
    pub plus_yearly: String,
    pub premium_monthly: String,
    pub premium_yearly: String,
    pub max_monthly: String,
    pub max_yearly: String,
}

impl StripePriceIds {
    fn get(&self, plan: &str, interval: &str) -> Option<(&str, i64)> {
        match (plan, interval) {
            ("plus", "monthly") => Some((&self.plus_monthly, 1)),
            ("plus", "yearly") => Some((&self.plus_yearly, 1)),
            ("premium", "monthly") => Some((&self.premium_monthly, 2)),
            ("premium", "yearly") => Some((&self.premium_yearly, 2)),
            ("max", "monthly") => Some((&self.max_monthly, 5)),
            ("max", "yearly") => Some((&self.max_yearly, 5)),
            _ => None,
        }
    }
}

pub struct StripeApiConfig {
    pub origin: String,
    pub secret_key: String,
    pub webhook_secret: String,
    pub prices: StripePriceIds,
    pub store: Arc<Mutex<SqliteStore>>,
    pub identity_verifier: Arc<dyn DiscordIdentityVerifier>,
    pub now: Arc<dyn Fn() -> i64 + Send + Sync>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StripeApiConfigError {
    Origin,
    MissingSecret,
    MissingWebhookSecret,
    MissingPrice,
}

impl std::fmt::Display for StripeApiConfigError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Origin => "Stripe requires a valid site origin",
            Self::MissingSecret => "Stripe secret key is missing",
            Self::MissingWebhookSecret => "Stripe webhook secret is missing",
            Self::MissingPrice => "a Stripe price ID is missing",
        })
    }
}
impl std::error::Error for StripeApiConfigError {}

#[derive(Clone)]
struct StripeState {
    origin: HeaderValue,
    secret_key: Arc<str>,
    webhook_secret: Arc<str>,
    prices: Arc<StripePriceIds>,
    store: Arc<Mutex<SqliteStore>>,
    verifier: Arc<dyn DiscordIdentityVerifier>,
    now: Arc<dyn Fn() -> i64 + Send + Sync>,
    client: reqwest::Client,
}

pub fn stripe_router(config: StripeApiConfig) -> Result<Router, StripeApiConfigError> {
    if config.secret_key.trim().is_empty() {
        return Err(StripeApiConfigError::MissingSecret);
    }
    if config.webhook_secret.trim().is_empty() {
        return Err(StripeApiConfigError::MissingWebhookSecret);
    }
    if config.prices.get("plus", "monthly").is_none()
        || [
            &config.prices.plus_monthly,
            &config.prices.plus_yearly,
            &config.prices.premium_monthly,
            &config.prices.premium_yearly,
            &config.prices.max_monthly,
            &config.prices.max_yearly,
        ]
        .iter()
        .any(|id| id.trim().is_empty())
    {
        return Err(StripeApiConfigError::MissingPrice);
    }
    let origin = HeaderValue::from_str(&config.origin).map_err(|_| StripeApiConfigError::Origin)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());
    let router = Router::new()
        .route("/api/billing/checkout", any(checkout))
        .route("/api/billing/portal", any(portal))
        .route("/webhook/stripe", any(webhook))
        .with_state(StripeState {
            origin,
            secret_key: Arc::from(config.secret_key),
            webhook_secret: Arc::from(config.webhook_secret),
            prices: Arc::new(config.prices),
            store: config.store,
            verifier: config.identity_verifier,
            now: config.now,
            client,
        })
        .layer(axum::extract::DefaultBodyLimit::max(256_000));
    Ok(router)
}

#[derive(Deserialize)]
struct CheckoutInput {
    plan: String,
    interval: String,
}

async fn checkout(
    State(state): State<StripeState>,
    method: Method,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    if method == Method::OPTIONS {
        return cors(StatusCode::NO_CONTENT, "", &state);
    }
    if method != Method::POST {
        return cors(StatusCode::METHOD_NOT_ALLOWED, "method not allowed", &state);
    }
    let Some(user) = identity(&state, &headers).await else {
        return cors(StatusCode::UNAUTHORIZED, "unauthorized", &state);
    };
    let Ok(input) = serde_json::from_slice::<CheckoutInput>(&body) else {
        return cors(StatusCode::BAD_REQUEST, "invalid checkout request", &state);
    };
    let Some((price, seats)) = state.prices.get(&input.plan, &input.interval) else {
        return cors(StatusCode::BAD_REQUEST, "unsupported plan", &state);
    };
    let form = [
        ("mode", "subscription".to_owned()),
        ("line_items[0][price]", price.to_owned()),
        ("line_items[0][quantity]", "1".to_owned()),
        ("client_reference_id", user.id.clone()),
        ("metadata[discord_user_id]", user.id.clone()),
        ("metadata[plan]", input.plan.clone()),
        ("metadata[seats]", seats.to_string()),
        (
            "subscription_data[metadata][discord_user_id]",
            user.id.clone(),
        ),
        ("subscription_data[metadata][plan]", input.plan.clone()),
        ("subscription_data[metadata][seats]", seats.to_string()),
        (
            "success_url",
            format!(
                "{}/account?billing=success",
                state.origin.to_str().unwrap_or("https://vozen.org")
            ),
        ),
        (
            "cancel_url",
            format!(
                "{}/#premium",
                state.origin.to_str().unwrap_or("https://vozen.org")
            ),
        ),
        ("allow_promotion_codes", "true".to_owned()),
    ];
    let response = state
        .client
        .post(format!("{STRIPE_API}/checkout/sessions"))
        .basic_auth(&*state.secret_key, Some(""))
        .form(&form)
        .send()
        .await;
    match response {
        Ok(response) if response.status().is_success() => match response
            .json::<Value>()
            .await
            .ok()
            .and_then(|v| v.get("url").and_then(Value::as_str).map(str::to_owned))
        {
            Some(url) => json_response(StatusCode::OK, json!({"url": url}), &state),
            None => json_response(
                StatusCode::BAD_GATEWAY,
                json!({"error":"stripe_response"}),
                &state,
            ),
        },
        _ => json_response(
            StatusCode::BAD_GATEWAY,
            json!({"error":"stripe_unavailable"}),
            &state,
        ),
    }
}

async fn portal(State(state): State<StripeState>, method: Method, headers: HeaderMap) -> Response {
    if method == Method::OPTIONS {
        return cors(StatusCode::NO_CONTENT, "", &state);
    }
    if method != Method::POST {
        return cors(StatusCode::METHOD_NOT_ALLOWED, "method not allowed", &state);
    }
    let Some(user) = identity(&state, &headers).await else {
        return cors(StatusCode::UNAUTHORIZED, "unauthorized", &state);
    };
    let customer = state
        .store
        .lock()
        .ok()
        .and_then(|store| store.stripe_customer_for_user(&user.id).ok().flatten());
    let Some(customer) = customer else {
        return json_response(
            StatusCode::NOT_FOUND,
            json!({"error":"no_subscription"}),
            &state,
        );
    };
    let form = [
        ("customer", customer),
        (
            "return_url",
            format!(
                "{}/account",
                state.origin.to_str().unwrap_or("https://vozen.org")
            ),
        ),
    ];
    match state
        .client
        .post(format!("{STRIPE_API}/billing_portal/sessions"))
        .basic_auth(&*state.secret_key, Some(""))
        .form(&form)
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => match response
            .json::<Value>()
            .await
            .ok()
            .and_then(|v| v.get("url").and_then(Value::as_str).map(str::to_owned))
        {
            Some(url) => json_response(StatusCode::OK, json!({"url": url}), &state),
            None => json_response(
                StatusCode::BAD_GATEWAY,
                json!({"error":"stripe_response"}),
                &state,
            ),
        },
        _ => json_response(
            StatusCode::BAD_GATEWAY,
            json!({"error":"stripe_unavailable"}),
            &state,
        ),
    }
}

async fn webhook(State(state): State<StripeState>, headers: HeaderMap, body: Bytes) -> Response {
    let Some(signature) = headers
        .get("stripe-signature")
        .and_then(|v| v.to_str().ok())
    else {
        return StatusCode::BAD_REQUEST.into_response();
    };
    let now = (state.now)() / 1000;
    if !verify_signature(&body, signature, &state.webhook_secret, now) {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    let Ok(event) = serde_json::from_slice::<Value>(&body) else {
        return StatusCode::BAD_REQUEST.into_response();
    };
    let event_id = event.get("id").and_then(Value::as_str).unwrap_or_default();
    let event_type = event
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if event_id.is_empty() {
        return StatusCode::BAD_REQUEST.into_response();
    }
    if state
        .store
        .lock()
        .ok()
        .and_then(|store| store.stripe_event_processed(event_id).ok())
        .unwrap_or(false)
    {
        return StatusCode::OK.into_response();
    }
    let object = event
        .pointer("/data/object")
        .cloned()
        .unwrap_or(Value::Null);
    let handled = match event_type {
        "checkout.session.completed" => handle_checkout(&state, &object).is_ok(),
        "invoice.paid" => handle_invoice(&state, &object).is_ok(),
        "customer.subscription.updated" | "customer.subscription.deleted" => {
            handle_subscription(&state, &object).is_ok()
        }
        "invoice.payment_failed" => handle_invoice_failed(&state, &object).is_ok(),
        _ => true,
    };
    if !handled {
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    }
    if let Ok(store) = state.store.lock() {
        let _ = store.record_stripe_event_once(event_id, (state.now)());
    }
    StatusCode::OK.into_response()
}

fn handle_checkout(state: &StripeState, object: &Value) -> Result<(), String> {
    let Some(subscription_id) = object.get("subscription").and_then(Value::as_str) else {
        return Ok(());
    };
    let customer_id = object
        .get("customer")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let metadata = object
        .get("metadata")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let user_id = metadata
        .get("discord_user_id")
        .and_then(Value::as_str)
        .or_else(|| object.get("client_reference_id").and_then(Value::as_str))
        .unwrap_or_default();
    let plan = metadata
        .get("plan")
        .and_then(Value::as_str)
        .unwrap_or("plus");
    let seats = metadata
        .get("seats")
        .and_then(Value::as_str)
        .and_then(|v| v.parse().ok())
        .unwrap_or(1);
    if customer_id.is_empty() || user_id.is_empty() {
        return Err("Stripe checkout missing identity metadata".into());
    }
    state
        .store
        .lock()
        .map_err(|_| "store lock".to_owned())?
        .upsert_stripe_subscription(&StripeSubscriptionInput {
            subscription_id: subscription_id.into(),
            customer_id: customer_id.into(),
            user_id: user_id.into(),
            plan: plan.into(),
            seats,
            current_period_end: 0,
            status: "active".into(),
            updated_at: (state.now)(),
        })
        .map_err(|e| e.to_string())
}

fn handle_subscription(state: &StripeState, object: &Value) -> Result<(), String> {
    let id = object
        .get("id")
        .and_then(Value::as_str)
        .ok_or("missing subscription id")?;
    let old = state
        .store
        .lock()
        .map_err(|_| "store lock".to_owned())?
        .stripe_subscription(id)
        .map_err(|e| e.to_string())?;
    let Some(old) = old else {
        return Ok(());
    };
    let period_end = object
        .get("current_period_end")
        .and_then(Value::as_i64)
        .unwrap_or(old.current_period_end);
    let status = object
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("active");
    let input = StripeSubscriptionInput {
        subscription_id: old.subscription_id,
        customer_id: old.customer_id,
        user_id: old.user_id,
        plan: old.plan,
        seats: old.seats,
        current_period_end: period_end,
        status: status.into(),
        updated_at: (state.now)(),
    };
    state
        .store
        .lock()
        .map_err(|_| "store lock".to_owned())?
        .upsert_stripe_subscription(&input)
        .map_err(|e| e.to_string())
}

fn handle_invoice(state: &StripeState, object: &Value) -> Result<(), String> {
    let id = object
        .get("subscription")
        .and_then(Value::as_str)
        .ok_or("invoice missing subscription")?;
    let mut sub = state
        .store
        .lock()
        .map_err(|_| "store lock".to_owned())?
        .stripe_subscription(id)
        .map_err(|e| e.to_string())?
        .ok_or("unknown Stripe subscription")?;
    let period_end = object
        .pointer("/lines/data/0/period/end")
        .and_then(Value::as_i64)
        .unwrap_or(sub.current_period_end);
    let now = (state.now)();
    let end_ms = period_end.saturating_mul(1000);
    let days = ((end_ms.saturating_sub(now) + 86_399_999) / 86_400_000).max(1);
    sub.current_period_end = end_ms;
    sub.status = "active".into();
    sub.updated_at = now;
    let store = state.store.lock().map_err(|_| "store lock".to_owned())?;
    store
        .upsert_stripe_subscription(&StripeSubscriptionInput {
            subscription_id: sub.subscription_id.clone(),
            customer_id: sub.customer_id.clone(),
            user_id: sub.user_id.clone(),
            plan: sub.plan.clone(),
            seats: sub.seats,
            current_period_end: sub.current_period_end,
            status: sub.status.clone(),
            updated_at: sub.updated_at,
        })
        .map_err(|e| e.to_string())?;
    if sub.plan == "plus" {
        store
            .grant_user_premium(&sub.user_id, days, "stripe", now)
            .map_err(|e| e.to_string())?;
    } else {
        store
            .grant_guild_pass(&sub.user_id, sub.seats, days, "stripe", now)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn handle_invoice_failed(state: &StripeState, object: &Value) -> Result<(), String> {
    let Some(id) = object.get("subscription").and_then(Value::as_str) else {
        return Ok(());
    };
    let Some(mut sub) = state
        .store
        .lock()
        .map_err(|_| "store lock".to_owned())?
        .stripe_subscription(id)
        .map_err(|e| e.to_string())?
    else {
        return Ok(());
    };
    sub.status = "past_due".into();
    sub.updated_at = (state.now)();
    let input = StripeSubscriptionInput {
        subscription_id: sub.subscription_id,
        customer_id: sub.customer_id,
        user_id: sub.user_id,
        plan: sub.plan,
        seats: sub.seats,
        current_period_end: sub.current_period_end,
        status: sub.status,
        updated_at: sub.updated_at,
    };
    state
        .store
        .lock()
        .map_err(|_| "store lock".to_owned())?
        .upsert_stripe_subscription(&input)
        .map_err(|e| e.to_string())
}

async fn identity(
    state: &StripeState,
    headers: &HeaderMap,
) -> Option<crate::premium_api::DiscordIdentity> {
    let raw = headers.get(header::AUTHORIZATION)?.to_str().ok()?;
    let token = raw.strip_prefix("Bearer ")?.trim();
    if token.is_empty() {
        return None;
    }
    state.verifier.resolve_identity(token).await.ok()
}

fn verify_signature(body: &[u8], header: &str, secret: &str, now: i64) -> bool {
    let mut timestamp = None;
    let mut signatures = Vec::new();
    for part in header.split(',') {
        let mut pieces = part.splitn(2, '=');
        match (pieces.next(), pieces.next()) {
            (Some("t"), Some(value)) => timestamp = value.parse::<i64>().ok(),
            (Some("v1"), Some(value)) => signatures.push(value),
            _ => {}
        }
    }
    let Some(timestamp) = timestamp else {
        return false;
    };
    if (now - timestamp).abs() > SIGNATURE_TOLERANCE_SECONDS {
        return false;
    }
    let Ok(mut mac) = HmacSha256::new_from_slice(secret.as_bytes()) else {
        return false;
    };
    mac.update(format!("{timestamp}.").as_bytes());
    mac.update(body);
    let expected = mac.finalize().into_bytes();
    signatures.iter().any(|value| {
        let Ok(found) = hex_bytes(value) else {
            return false;
        };
        found.as_slice().ct_eq(expected.as_slice()).into()
    })
}

fn hex_bytes(value: &str) -> Result<Vec<u8>, ()> {
    if value.len() != 64 {
        return Err(());
    }
    let mut out = Vec::with_capacity(32);
    let bytes = value.as_bytes();
    for i in (0..64).step_by(2) {
        let hi = (bytes[i] as char).to_digit(16).ok_or(())?;
        let lo = (bytes[i + 1] as char).to_digit(16).ok_or(())?;
        out.push(((hi << 4) | lo) as u8);
    }
    Ok(out)
}

fn json_response(status: StatusCode, value: Value, state: &StripeState) -> Response {
    let mut response = (status, axum::Json(value)).into_response();
    add_cors(response.headers_mut(), state);
    response
}
fn cors(status: StatusCode, message: &str, state: &StripeState) -> Response {
    let mut response = (status, message.to_owned()).into_response();
    add_cors(response.headers_mut(), state);
    response
}
fn add_cors(headers: &mut HeaderMap, state: &StripeState) {
    headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, state.origin.clone());
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_static("authorization,content-type"),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("POST,OPTIONS"),
    );
    headers.insert(header::VARY, HeaderValue::from_static("Origin"));
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn signature_accepts_valid_payload_and_rejects_stale() {
        let body = br#"{"id":"evt_test"}"#;
        let timestamp = 1_000;
        let mut mac = HmacSha256::new_from_slice(b"whsec_test").unwrap();
        mac.update(format!("{timestamp}.").as_bytes());
        mac.update(body);
        let digest = mac.finalize().into_bytes();
        let signature = digest
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        assert!(verify_signature(
            body,
            &format!("t={timestamp},v1={signature}"),
            "whsec_test",
            timestamp
        ));
        assert!(!verify_signature(
            body,
            &format!("t={timestamp},v1={signature}"),
            "whsec_test",
            timestamp + 301
        ));
    }
}
