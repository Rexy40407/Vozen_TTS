//! Authenticated cross-product entitlement read API.
//!
//! This is deliberately read-only. Billing remains owned by the existing Vozen
//! store; Helper receives a signed snapshot and never duplicates checkout logic.

use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use axum::{
    Router,
    body::Bytes,
    extract::State,
    http::{HeaderMap, StatusCode, header::CONTENT_TYPE},
    response::IntoResponse,
    routing::post,
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use time::OffsetDateTime;

use vozen_store::SqliteStore;

type HmacSha256 = Hmac<Sha256>;

#[derive(Clone)]
pub struct EntitlementsConfig {
    pub store: Arc<Mutex<SqliteStore>>,
    pub service_secret: String,
}

#[derive(Clone)]
struct StateInner {
    store: Arc<Mutex<SqliteStore>>,
    service_secret: String,
    seen_nonces: Arc<Mutex<HashMap<String, i64>>>,
}

#[derive(Debug, Deserialize)]
struct ResolveRequest {
    subject_id: String,
    guild_id: Option<String>,
}

#[derive(Debug, Serialize)]
struct ResolveResponse {
    product: &'static str,
    subject_id: String,
    scope: &'static str,
    plan: &'static str,
    guild_limit: u16,
    active: bool,
    expires_at_ms: Option<i64>,
    version: i64,
    issued_at_ms: i64,
}

pub fn entitlements_router(config: EntitlementsConfig) -> Router {
    Router::new()
        .route("/internal/v1/entitlements/resolve", post(resolve))
        .with_state(StateInner {
            store: config.store,
            service_secret: config.service_secret,
            seen_nonces: Arc::new(Mutex::new(HashMap::new())),
        })
}

async fn resolve(
    State(state): State<StateInner>,
    headers: HeaderMap,
    body: Bytes,
) -> impl IntoResponse {
    if !verify_request(&headers, &body, &state.service_secret, &state.seen_nonces) {
        return (StatusCode::UNAUTHORIZED, "invalid service signature").into_response();
    }
    let request: ResolveRequest = match serde_json::from_slice(&body) {
        Ok(request) => request,
        Err(_) => return (StatusCode::BAD_REQUEST, "invalid request").into_response(),
    };
    if request.subject_id.is_empty() || request.subject_id.len() > 64 {
        return (StatusCode::BAD_REQUEST, "invalid subject").into_response();
    }
    let now = OffsetDateTime::now_utc().unix_timestamp_nanos() / 1_000_000;
    let now = i64::try_from(now).unwrap_or(i64::MAX);
    let result = state
        .store
        .lock()
        .ok()
        .and_then(|store| resolve_from_store(&store, &request, now).ok());
    match result {
        Some(response) => (
            StatusCode::OK,
            [(CONTENT_TYPE, "application/json")],
            serde_json::to_string(&response).unwrap(),
        )
            .into_response(),
        None => (
            StatusCode::INTERNAL_SERVER_ERROR,
            "entitlement lookup failed",
        )
            .into_response(),
    }
}

fn resolve_from_store(
    store: &SqliteStore,
    request: &ResolveRequest,
    now: i64,
) -> Result<ResolveResponse, rusqlite::Error> {
    let status = store
        .premium_status(&request.subject_id, now)
        .map_err(|_| rusqlite::Error::InvalidQuery)?;
    let (plan, guild_limit, active, expires_at_ms, scope) =
        if let Some(guild_id) = request.guild_id.as_deref() {
            let guild_expiry = store
                .effective_guild_premium_expiry(guild_id, now)
                .map_err(|_| rusqlite::Error::InvalidQuery)?;
            let activated_pass = status.pass.as_ref().filter(|pass| {
                pass.active && pass.guilds.iter().any(|activated| activated == guild_id)
            });
            if let Some(guild_expiry) = guild_expiry {
                let seats = activated_pass
                    .map(|pass| u16::try_from(pass.seats.max(1)).unwrap_or(u16::MAX))
                    .unwrap_or(1);
                let expiry = activated_pass
                    .map(|pass| pass.expires_at.max(guild_expiry))
                    .unwrap_or(guild_expiry);
                ("premium", seats, true, Some(expiry), "guild")
            } else if status.plus_active {
                ("plus", 1, true, status.plus_expires_at, "guild")
            } else {
                ("free", 1, true, None, "guild")
            }
        } else if let Some(pass) = status.pass.filter(|pass| pass.active) {
            (
                "premium",
                u16::try_from(pass.seats.max(1)).unwrap_or(u16::MAX),
                true,
                Some(pass.expires_at),
                "user",
            )
        } else if status.plus_active {
            ("plus", 1, true, status.plus_expires_at, "user")
        } else {
            ("free", 1, true, None, "user")
        };
    Ok(ResolveResponse {
        product: "vozen",
        subject_id: request.subject_id.clone(),
        scope,
        plan,
        guild_limit,
        active,
        expires_at_ms,
        version: now,
        issued_at_ms: now,
    })
}

fn verify_request(
    headers: &HeaderMap,
    body: &[u8],
    secret: &str,
    seen_nonces: &Arc<Mutex<HashMap<String, i64>>>,
) -> bool {
    let timestamp = match headers
        .get("x-vozen-timestamp")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<i64>().ok())
    {
        Some(value) => value,
        None => return false,
    };
    let nonce = match headers.get("x-vozen-nonce").and_then(|v| v.to_str().ok()) {
        Some(value) if !value.is_empty() && value.len() <= 128 => value,
        _ => return false,
    };
    let signature = match headers
        .get("x-vozen-signature")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("v1="))
    {
        Some(value) => value,
        None => return false,
    };
    let now = OffsetDateTime::now_utc().unix_timestamp();
    if (now - timestamp).abs() > 60 {
        return false;
    }
    let mut mac = match HmacSha256::new_from_slice(secret.as_bytes()) {
        Ok(mac) => mac,
        Err(_) => return false,
    };
    let body_hash = URL_SAFE_NO_PAD.encode(Sha256::digest(body));
    mac.update(format!("{timestamp}\n{nonce}\n{body_hash}").as_bytes());
    let expected = URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());
    let valid: bool =
        subtle::ConstantTimeEq::ct_eq(expected.as_bytes(), signature.as_bytes()).into();
    if !valid {
        return false;
    }
    let mut seen = match seen_nonces.lock() {
        Ok(seen) => seen,
        Err(_) => return false,
    };
    seen.retain(|_, seen_at| now.saturating_sub(*seen_at) <= 60);
    if seen.contains_key(nonce) {
        return false;
    }
    seen.insert(nonce.to_owned(), now);
    // Keep the replay cache bounded even if an attacker rotates nonces rapidly.
    if seen.len() > 4_096
        && let Some(oldest) = seen
            .iter()
            .min_by_key(|(_, seen_at)| **seen_at)
            .map(|(nonce, _)| nonce.clone())
    {
        seen.remove(&oldest);
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;
    use std::collections::HashMap;

    #[test]
    fn signed_request_rejects_stale_timestamp() {
        let mut headers = HeaderMap::new();
        headers.insert("x-vozen-timestamp", HeaderValue::from_static("1"));
        headers.insert("x-vozen-nonce", HeaderValue::from_static("n"));
        headers.insert("x-vozen-signature", HeaderValue::from_static("v1=bad"));
        assert!(!verify_request(
            &headers,
            b"{}",
            "secret",
            &Arc::new(Mutex::new(HashMap::new()))
        ));
    }

    #[test]
    fn signed_nonce_is_single_use_within_the_timestamp_window() {
        let now = OffsetDateTime::now_utc().unix_timestamp();
        let body = br#"{"subject_id":"u"}"#;
        let nonce = "nonce-1";
        let body_hash = URL_SAFE_NO_PAD.encode(Sha256::digest(body));
        let mut mac = HmacSha256::new_from_slice(b"secret").unwrap();
        mac.update(format!("{now}\n{nonce}\n{body_hash}").as_bytes());
        let signature = URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-vozen-timestamp",
            HeaderValue::from_str(&now.to_string()).unwrap(),
        );
        headers.insert("x-vozen-nonce", HeaderValue::from_static(nonce));
        headers.insert(
            "x-vozen-signature",
            HeaderValue::from_str(&format!("v1={signature}")).unwrap(),
        );
        let cache = Arc::new(Mutex::new(HashMap::new()));
        assert!(verify_request(&headers, body, "secret", &cache));
        assert!(!verify_request(&headers, body, "secret", &cache));
    }

    #[test]
    fn guild_resolution_keeps_user_plus_and_activated_pass_entitlements() {
        let store = SqliteStore::open_in_memory().unwrap();
        let now = OffsetDateTime::now_utc().unix_timestamp_nanos() as i64 / 1_000_000;
        store
            .grant_user_premium("plus-user", 30, "test", now)
            .unwrap();
        let plus = resolve_from_store(
            &store,
            &ResolveRequest {
                subject_id: "plus-user".into(),
                guild_id: Some("guild".into()),
            },
            now,
        )
        .unwrap();
        assert_eq!(plus.plan, "plus");
        assert_eq!(plus.scope, "guild");

        store
            .grant_guild_pass("premium-user", 3, 30, "test", now)
            .unwrap();
        store.activate_seat("premium-user", "guild", now).unwrap();
        let premium = resolve_from_store(
            &store,
            &ResolveRequest {
                subject_id: "premium-user".into(),
                guild_id: Some("guild".into()),
            },
            now,
        )
        .unwrap();
        assert_eq!(premium.plan, "premium");
        assert_eq!(premium.guild_limit, 3);
    }
}
