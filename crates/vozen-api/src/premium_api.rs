//! Browser API parity for deferred Ko-fi activation.
//!
//! OAuth verification is injected. The production adapter must validate `/oauth2/@me` audience,
//! `/users/@me` identity and the `email` scope before returning an email to this module.

use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use async_trait::async_trait;
use axum::{
    Router,
    body::Bytes,
    extract::State,
    http::{HeaderMap, HeaderValue, Method, StatusCode, header},
    response::{IntoResponse, Response},
    routing::any,
};
use serde::Serialize;
use serde_json::{Value, json};
use vozen_core::hash_kofi_email;
use vozen_store::{
    ActivationOutcome, ClaimOutcome, ClaimedKofiItem, SqliteStore, activate_kofi_by_email_hash,
    claim_kofi_pending_grant,
};

const BODY_MAX_BYTES: usize = 4_000;
const CLAIM_RATE_MAX: usize = 5;
const CLAIM_RATE_WINDOW_MS: i64 = 10 * 60 * 1_000;
const RATE_MAX_ENTRIES: usize = 2_048;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiscordIdentity {
    pub id: String,
    pub username: String,
    pub avatar: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActivationIdentity {
    pub id: String,
    /// Only live while this request is being handled; persistence uses its HMAC instead.
    pub email: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActivationIdentityError {
    NoEmailScope,
    EmailMissing,
    EmailUnverified,
    DiscordUnavailable,
    WrongAudience,
    InvalidToken,
}

/// Boundary for Discord OAuth. It is intentionally impossible to return an activation identity
/// without having completed the application-audience and email verification checks.
#[async_trait]
pub trait DiscordIdentityVerifier: Send + Sync {
    async fn resolve_identity(&self, bearer: &str) -> Result<DiscordIdentity, ()>;
    async fn resolve_activation_identity(
        &self,
        bearer: &str,
    ) -> Result<ActivationIdentity, ActivationIdentityError>;
}

pub struct PremiumApiConfig {
    /// Exact public site origin, normally `https://vozen.org`.
    pub origin: String,
    /// Optional key used to derive an HMAC of Discord's verified email. It is never
    /// returned/logged. Receipt-code claims deliberately remain available without it;
    /// email activation answers `kofi_unavailable`, matching the existing Node API.
    pub kofi_webhook_token: Option<String>,
    pub store: Arc<Mutex<SqliteStore>>,
    pub identity_verifier: Arc<dyn DiscordIdentityVerifier>,
    pub now: Arc<dyn Fn() -> i64 + Send + Sync>,
}

#[derive(Clone)]
struct PremiumApiState {
    origin: HeaderValue,
    kofi_webhook_token: Option<Arc<str>>,
    store: Arc<Mutex<SqliteStore>>,
    identity_verifier: Arc<dyn DiscordIdentityVerifier>,
    now: Arc<dyn Fn() -> i64 + Send + Sync>,
    rate: Arc<Mutex<HashMap<String, RateState>>>,
}

#[derive(Clone, Copy)]
struct RateState {
    count: usize,
    reset: i64,
}

/// Builds only the sensitive payment routes. Merge this with the safe public router during the
/// final cutover; keeping it separate prevents accidental exposure before OAuth is wired.
pub fn premium_router(config: PremiumApiConfig) -> Result<Router, PremiumApiConfigError> {
    let origin =
        HeaderValue::from_str(&config.origin).map_err(|_| PremiumApiConfigError::Origin)?;
    Ok(Router::new()
        .route("/api/link", any(link_request))
        .route("/api/activate", any(activate_request))
        .with_state(PremiumApiState {
            origin,
            kofi_webhook_token: config
                .kofi_webhook_token
                .filter(|token| !token.trim().is_empty())
                .map(Arc::from),
            store: config.store,
            identity_verifier: config.identity_verifier,
            now: config.now,
            rate: Arc::new(Mutex::new(HashMap::new())),
        }))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PremiumApiConfigError {
    Origin,
}

impl std::fmt::Display for PremiumApiConfigError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(match self {
            Self::Origin => "premium API requires a valid exact site origin",
        })
    }
}

impl std::error::Error for PremiumApiConfigError {}

async fn link_request(
    State(state): State<PremiumApiState>,
    method: Method,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    if method == Method::OPTIONS {
        return preflight(&state);
    }
    if method != Method::POST {
        return text_response(StatusCode::METHOD_NOT_ALLOWED, "method not allowed", &state);
    }
    if body.len() > BODY_MAX_BYTES {
        return text_response(StatusCode::PAYLOAD_TOO_LARGE, "too large", &state);
    }
    if rate_limited(&state, client_ip(&headers), (state.now)()) {
        return json_response(
            StatusCode::TOO_MANY_REQUESTS,
            json!({"error":"rate_limited"}),
            &state,
        );
    }
    let code = match parse_claim_body(&body) {
        Some(code) => code,
        None => {
            return json_response(
                StatusCode::BAD_REQUEST,
                json!({"error":"bad_request"}),
                &state,
            );
        }
    };
    let Some(bearer) = bearer_token(&headers) else {
        return json_response(
            StatusCode::UNAUTHORIZED,
            json!({"error":"no_token"}),
            &state,
        );
    };
    let Some(code) = code.filter(|code| !code.is_empty()) else {
        return json_response(
            StatusCode::BAD_REQUEST,
            json!({"error":"bad_request"}),
            &state,
        );
    };
    let identity = match state.identity_verifier.resolve_identity(bearer).await {
        Ok(identity) => identity,
        Err(()) => {
            return json_response(
                StatusCode::UNAUTHORIZED,
                json!({"error":"invalid_token"}),
                &state,
            );
        }
    };
    let outcome = match store_claim(&state, &identity.id, &code, (state.now)()) {
        Ok(outcome) => outcome,
        Err(()) => {
            return json_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                json!({"error":"internal"}),
                &state,
            );
        }
    };
    match outcome {
        ClaimOutcome::Claimed { items } => json_response(
            StatusCode::OK,
            json!({"ok":true,"items":items.into_iter().map(item_body).collect::<Vec<_>>() }),
            &state,
        ),
        ClaimOutcome::UseReceiptCode => json_response(
            StatusCode::BAD_REQUEST,
            json!({"error":"use_receipt_code"}),
            &state,
        ),
        ClaimOutcome::NotFound => {
            json_response(StatusCode::NOT_FOUND, json!({"error":"not_found"}), &state)
        }
    }
}

async fn activate_request(
    State(state): State<PremiumApiState>,
    method: Method,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    if method == Method::OPTIONS {
        return preflight(&state);
    }
    if method != Method::POST {
        return text_response(StatusCode::METHOD_NOT_ALLOWED, "method not allowed", &state);
    }
    if body.len() > BODY_MAX_BYTES {
        return text_response(StatusCode::PAYLOAD_TOO_LARGE, "too large", &state);
    }
    if rate_limited(&state, client_ip(&headers), (state.now)()) {
        return json_response(
            StatusCode::TOO_MANY_REQUESTS,
            json!({"error":"rate_limited"}),
            &state,
        );
    }
    let Some(request) = parse_activation_body(&body) else {
        return json_response(
            StatusCode::BAD_REQUEST,
            json!({"error":"bad_request"}),
            &state,
        );
    };
    if !request.terms_accepted {
        return json_response(
            StatusCode::BAD_REQUEST,
            json!({"error":"consent_required"}),
            &state,
        );
    }
    if request.terms_version.as_deref() != Some(vozen_store::ACTIVATION_TERMS_VERSION) {
        return json_response(
            StatusCode::BAD_REQUEST,
            json!({"error":"bad_terms_version"}),
            &state,
        );
    }
    let Some(bearer) = bearer_token(&headers) else {
        return json_response(
            StatusCode::UNAUTHORIZED,
            json!({"error":"no_token"}),
            &state,
        );
    };
    let Some(kofi_webhook_token) = &state.kofi_webhook_token else {
        return json_response(
            StatusCode::SERVICE_UNAVAILABLE,
            json!({"error":"kofi_unavailable"}),
            &state,
        );
    };
    let identity = match state
        .identity_verifier
        .resolve_activation_identity(bearer)
        .await
    {
        Ok(identity) => identity,
        Err(ActivationIdentityError::NoEmailScope) => {
            return json_response(
                StatusCode::FORBIDDEN,
                json!({"error":"no_email_scope"}),
                &state,
            );
        }
        Err(ActivationIdentityError::EmailMissing) => {
            return json_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                json!({"error":"email_missing"}),
                &state,
            );
        }
        Err(ActivationIdentityError::EmailUnverified) => {
            return json_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                json!({"error":"email_unverified"}),
                &state,
            );
        }
        Err(ActivationIdentityError::DiscordUnavailable) => {
            return json_response(
                StatusCode::SERVICE_UNAVAILABLE,
                json!({"error":"discord_unavailable"}),
                &state,
            );
        }
        Err(ActivationIdentityError::WrongAudience | ActivationIdentityError::InvalidToken) => {
            return json_response(
                StatusCode::UNAUTHORIZED,
                json!({"error":"invalid_token"}),
                &state,
            );
        }
    };
    let email_hash = hash_kofi_email(kofi_webhook_token, &identity.email);
    let outcome = match store_activation(&state, &identity.id, &email_hash, (state.now)()) {
        Ok(outcome) => outcome,
        Err(()) => {
            return json_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                json!({"error":"internal"}),
                &state,
            );
        }
    };
    match outcome {
        ActivationOutcome::Activated {
            items,
            confirmation,
        } => json_response(
            StatusCode::OK,
            json!({
                "ok":true,
                "items":items.into_iter().map(item_body).collect::<Vec<_>>(),
                "confirmation":{
                    "id":confirmation.id,
                    "acceptedAt":confirmation.accepted_at,
                    "termsVersion":confirmation.terms_version,
                    "method":"discord_email",
                }
            }),
            &state,
        ),
        ActivationOutcome::NotFound => {
            json_response(StatusCode::NOT_FOUND, json!({"error":"not_found"}), &state)
        }
    }
}

fn store_claim(
    state: &PremiumApiState,
    discord_id: &str,
    code: &str,
    now: i64,
) -> Result<ClaimOutcome, ()> {
    let store = state.store.lock().map_err(|_| ())?;
    claim_kofi_pending_grant(&store, discord_id, code, now).map_err(|_| ())
}

fn store_activation(
    state: &PremiumApiState,
    discord_id: &str,
    email_hash: &str,
    now: i64,
) -> Result<ActivationOutcome, ()> {
    let store = state.store.lock().map_err(|_| ())?;
    activate_kofi_by_email_hash(&store, discord_id, email_hash, now).map_err(|_| ())
}

#[derive(Serialize)]
struct ItemBody {
    plan: &'static str,
    days: i64,
    seats: i64,
    #[serde(rename = "expiresAt")]
    expires_at: i64,
}

fn item_body(item: ClaimedKofiItem) -> ItemBody {
    ItemBody {
        plan: item.plan.as_str(),
        days: item.days,
        seats: item.seats,
        expires_at: item.expires_at,
    }
}

struct ActivationRequest {
    terms_accepted: bool,
    terms_version: Option<String>,
}

fn parse_activation_body(body: &[u8]) -> Option<ActivationRequest> {
    let object = serde_json::from_slice::<Value>(body)
        .ok()?
        .as_object()?
        .clone();
    Some(ActivationRequest {
        terms_accepted: object.get("termsAccepted") == Some(&Value::Bool(true)),
        terms_version: object
            .get("termsVersion")
            .and_then(Value::as_str)
            .map(str::to_owned),
    })
}

fn parse_claim_body(body: &[u8]) -> Option<Option<String>> {
    let value = serde_json::from_slice::<Value>(body).ok()?;
    let code = value
        .as_object()
        .and_then(|object| object.get("code"))
        .and_then(Value::as_str)
        .map(str::to_owned);
    Some(code)
}

fn bearer_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get(header::AUTHORIZATION)?
        .to_str()
        .ok()?
        .strip_prefix("Bearer ")
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn client_ip(headers: &HeaderMap) -> String {
    if let Some(value) = headers
        .get("x-forwarded-for")
        .and_then(|header| header.to_str().ok())
        .and_then(|value| value.rsplit(',').next())
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        value.to_owned()
    } else {
        "unknown".into()
    }
}

fn rate_limited(state: &PremiumApiState, client_ip: String, now: i64) -> bool {
    let Ok(mut rate) = state.rate.lock() else {
        return true;
    };
    rate.retain(|_, value| value.reset > now);
    if !rate.contains_key(&client_ip) && rate.len() >= RATE_MAX_ENTRIES {
        let oldest = rate
            .iter()
            .min_by_key(|(_, value)| value.reset)
            .map(|(key, _)| key.clone());
        if let Some(oldest) = oldest {
            rate.remove(&oldest);
        }
    }
    let entry = rate.entry(client_ip).or_insert(RateState {
        count: 0,
        reset: now + CLAIM_RATE_WINDOW_MS,
    });
    if entry.reset <= now {
        *entry = RateState {
            count: 0,
            reset: now + CLAIM_RATE_WINDOW_MS,
        };
    }
    entry.count += 1;
    entry.count > CLAIM_RATE_MAX
}

fn preflight(state: &PremiumApiState) -> Response {
    let mut response = StatusCode::NO_CONTENT.into_response();
    let headers = response.headers_mut();
    common_headers(headers, state);
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("POST, OPTIONS"),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_static("Authorization, Content-Type"),
    );
    headers.insert(
        header::ACCESS_CONTROL_MAX_AGE,
        HeaderValue::from_static("600"),
    );
    response
}

fn json_response(status: StatusCode, body: Value, state: &PremiumApiState) -> Response {
    let mut response = (status, axum::Json(body)).into_response();
    common_headers(response.headers_mut(), state);
    response
}

fn text_response(status: StatusCode, text: &'static str, state: &PremiumApiState) -> Response {
    let mut response = (status, text).into_response();
    common_headers(response.headers_mut(), state);
    response
}

fn common_headers(headers: &mut HeaderMap, state: &PremiumApiState) {
    headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, state.origin.clone());
    headers.insert(header::VARY, HeaderValue::from_static("Origin"));
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::to_bytes, http::Request};
    use tower::ServiceExt;
    use vozen_store::{KofiPendingGrantInput, KofiPendingPlan};

    const NOW: i64 = 1_000_000;

    struct Identities;

    #[async_trait]
    impl DiscordIdentityVerifier for Identities {
        async fn resolve_identity(&self, bearer: &str) -> Result<DiscordIdentity, ()> {
            (bearer == "valid")
                .then(|| DiscordIdentity {
                    id: "discord-user".into(),
                    username: "Rexy".into(),
                    avatar: None,
                })
                .ok_or(())
        }

        async fn resolve_activation_identity(
            &self,
            bearer: &str,
        ) -> Result<ActivationIdentity, ActivationIdentityError> {
            match bearer {
                "valid" => Ok(ActivationIdentity {
                    id: "discord-user".into(),
                    email: "buyer@example.com".into(),
                }),
                "unverified" => Err(ActivationIdentityError::EmailUnverified),
                _ => Err(ActivationIdentityError::InvalidToken),
            }
        }
    }

    fn app(store: Arc<Mutex<SqliteStore>>) -> Router {
        premium_router(PremiumApiConfig {
            origin: "https://vozen.org".into(),
            kofi_webhook_token: Some("kofi-secret".into()),
            store,
            identity_verifier: Arc::new(Identities),
            now: Arc::new(|| NOW),
        })
        .expect("router")
    }

    fn request(uri: &str, authorization: Option<&str>, body: &str) -> Request<axum::body::Body> {
        let mut builder = Request::builder()
            .method(Method::POST)
            .uri(uri)
            .header("content-type", "application/json");
        if let Some(authorization) = authorization {
            builder = builder.header(header::AUTHORIZATION, authorization);
        }
        builder
            .body(axum::body::Body::from(body.to_owned()))
            .expect("request")
    }

    fn request_with_xff(forwarded_for: &str) -> Request<axum::body::Body> {
        let mut request = request("/api/link", Some("Bearer bad"), r#"{"code":"receipt"}"#);
        request.headers_mut().insert(
            "x-forwarded-for",
            HeaderValue::from_str(forwarded_for).expect("header"),
        );
        request
    }

    #[tokio::test]
    async fn receipt_link_uses_verified_identity_and_rejects_email_as_code() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        store
            .lock()
            .expect("lock")
            .record_kofi_pending_grant(
                &KofiPendingGrantInput {
                    transaction_id: "receipt".into(),
                    email_hash: None,
                    plan: KofiPendingPlan::Plus,
                    days: 30,
                    seats: 0,
                    is_subscription: false,
                },
                NOW,
            )
            .expect("pending");
        let app = app(store.clone());
        let rejected = app
            .clone()
            .oneshot(request(
                "/api/link",
                Some("Bearer valid"),
                r#"{"code":"buyer@example.com"}"#,
            ))
            .await
            .expect("response");
        assert_eq!(rejected.status(), StatusCode::BAD_REQUEST);
        let accepted = app
            .oneshot(request(
                "/api/link",
                Some("Bearer valid"),
                r#"{"code":"receipt"}"#,
            ))
            .await
            .expect("response");
        assert_eq!(accepted.status(), StatusCode::OK);
        assert!(
            store
                .lock()
                .expect("lock")
                .is_user_premium("discord-user", NOW + 1)
                .expect("plus")
        );
    }

    #[tokio::test]
    async fn email_activation_requires_versioned_consent_and_never_returns_the_email() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let email_hash = hash_kofi_email("kofi-secret", "buyer@example.com");
        store
            .lock()
            .expect("lock")
            .record_kofi_pending_grant(
                &KofiPendingGrantInput {
                    transaction_id: "activation".into(),
                    email_hash: Some(email_hash),
                    plan: KofiPendingPlan::Premium,
                    days: 30,
                    seats: 3,
                    is_subscription: true,
                },
                NOW,
            )
            .expect("pending");
        let app = app(store.clone());
        let consent = app
            .clone()
            .oneshot(request(
                "/api/activate",
                Some("Bearer valid"),
                r#"{"termsAccepted":false,"termsVersion":"2026-07-19"}"#,
            ))
            .await
            .expect("response");
        assert_eq!(consent.status(), StatusCode::BAD_REQUEST);
        let activated = app
            .oneshot(request(
                "/api/activate",
                Some("Bearer valid"),
                r#"{"termsAccepted":true,"termsVersion":"2026-07-19"}"#,
            ))
            .await
            .expect("response");
        assert_eq!(activated.status(), StatusCode::OK);
        let bytes = to_bytes(activated.into_body(), usize::MAX)
            .await
            .expect("body");
        assert!(!String::from_utf8_lossy(&bytes).contains("buyer@example.com"));
        assert!(
            store
                .lock()
                .expect("lock")
                .premium_pass("discord-user")
                .expect("pass")
                .is_some()
        );
    }

    #[tokio::test]
    async fn activation_is_explicitly_unavailable_without_kofi_but_receipt_claims_still_work() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let app = premium_router(PremiumApiConfig {
            origin: "https://vozen.org".into(),
            kofi_webhook_token: None,
            store: store.clone(),
            identity_verifier: Arc::new(Identities),
            now: Arc::new(|| NOW),
        })
        .expect("router without Ko-fi token");

        let unavailable = app
            .clone()
            .oneshot(request(
                "/api/activate",
                Some("Bearer valid"),
                r#"{"termsAccepted":true,"termsVersion":"2026-07-19"}"#,
            ))
            .await
            .expect("response");
        assert_eq!(unavailable.status(), StatusCode::SERVICE_UNAVAILABLE);
        let body = to_bytes(unavailable.into_body(), usize::MAX)
            .await
            .expect("body");
        assert_eq!(&body[..], br#"{"error":"kofi_unavailable"}"#);

        store
            .lock()
            .expect("lock")
            .record_kofi_pending_grant(
                &KofiPendingGrantInput {
                    transaction_id: "receipt-without-token".into(),
                    email_hash: None,
                    plan: KofiPendingPlan::Plus,
                    days: 30,
                    seats: 0,
                    is_subscription: false,
                },
                NOW,
            )
            .expect("pending");
        let claim = app
            .oneshot(request(
                "/api/link",
                Some("Bearer valid"),
                r#"{"code":"receipt-without-token"}"#,
            ))
            .await
            .expect("claim response");
        assert_eq!(claim.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn cors_preflight_and_invalid_tokens_keep_the_node_contract() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let app = app(store);
        let preflight = app
            .clone()
            .oneshot(
                Request::builder()
                    .method(Method::OPTIONS)
                    .uri("/api/link")
                    .body(axum::body::Body::empty())
                    .expect("request"),
            )
            .await
            .expect("response");
        assert_eq!(preflight.status(), StatusCode::NO_CONTENT);
        assert_eq!(
            preflight.headers().get(header::ACCESS_CONTROL_ALLOW_ORIGIN),
            Some(&HeaderValue::from_static("https://vozen.org"))
        );
        let invalid = app
            .oneshot(request(
                "/api/link",
                Some("Bearer bad"),
                r#"{"code":"receipt"}"#,
            ))
            .await
            .expect("response");
        assert_eq!(invalid.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn malformed_purchase_inputs_keep_the_specific_public_errors() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let app = app(store);
        let empty_code = app
            .clone()
            .oneshot(request("/api/link", Some("Bearer valid"), r#"{"code":""}"#))
            .await
            .expect("response");
        assert_eq!(empty_code.status(), StatusCode::BAD_REQUEST);
        let missing_version = app
            .oneshot(request(
                "/api/activate",
                Some("Bearer valid"),
                r#"{"termsAccepted":true}"#,
            ))
            .await
            .expect("response");
        assert_eq!(missing_version.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(missing_version.into_body(), usize::MAX)
            .await
            .expect("body");
        assert_eq!(&body[..], br#"{"error":"bad_terms_version"}"#);
    }

    #[tokio::test]
    async fn claim_rate_limit_uses_the_last_trusted_forwarded_ip() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let app = app(store);
        for forged_prefix in 0..CLAIM_RATE_MAX {
            let response = app
                .clone()
                .oneshot(request_with_xff(&format!(
                    "10.0.0.{forged_prefix}, 192.0.2.9"
                )))
                .await
                .expect("response");
            assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        }
        let blocked = app
            .oneshot(request_with_xff("203.0.113.7, 192.0.2.9"))
            .await
            .expect("response");
        assert_eq!(blocked.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(
            blocked.headers().get(header::ACCESS_CONTROL_ALLOW_ORIGIN),
            Some(&HeaderValue::from_static("https://vozen.org"))
        );
    }
}
