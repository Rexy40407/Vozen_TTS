#![forbid(unsafe_code)]

//! Public, unauthenticated HTTP surface shared with vozen.org.
//!
//! Authentication, dashboard and payment webhooks remain on the Node runtime until their
//! individual contracts and security tests have been ported. This crate starts with the narrow
//! health/status surface because it has no identity or payment authority.

use std::sync::Arc;

pub mod account_api;
pub mod discord_oauth;
pub mod kofi_webhook;
pub mod premium_api;

use axum::body::Body;
use axum::http::{HeaderMap, HeaderValue, Request, StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;

const INCIDENT_MAX_CHARS: usize = 240;
const OFFICIAL_ORIGINS: [&str; 2] = ["https://vozen.org", "https://www.vozen.org"];

pub type PublicStatusProvider = Arc<dyn Fn() -> PublicStatusResponse + Send + Sync>;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PublicStatusState {
    Operational,
    Degraded,
    Unavailable,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PublicStatusInput {
    pub bot_ready: bool,
    pub database_ready: bool,
    pub provider_states: Vec<ProviderHealth>,
    pub incident_message: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderHealth {
    Healthy,
    Degraded,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PublicStatusComponents {
    pub bot: PublicStatusState,
    pub database: PublicStatusState,
    pub providers: PublicStatusState,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PublicStatusResponse {
    pub status: PublicStatusState,
    pub components: PublicStatusComponents,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub incident: Option<String>,
}

#[derive(Clone)]
struct AppState {
    public_status: Option<PublicStatusProvider>,
}

/// Maps the minimal internal health input to the public JSON contract. It intentionally omits
/// counts, Discord IDs, provider errors, quotas and raw incident data.
pub fn map_public_status(input: PublicStatusInput) -> PublicStatusResponse {
    let components = PublicStatusComponents {
        bot: component_state(input.bot_ready),
        database: component_state(input.database_ready),
        providers: provider_state(&input.provider_states),
    };
    let states = [components.bot, components.database, components.providers];
    let status = if states.contains(&PublicStatusState::Unavailable) {
        PublicStatusState::Unavailable
    } else if states.contains(&PublicStatusState::Degraded) {
        PublicStatusState::Degraded
    } else {
        PublicStatusState::Operational
    };
    PublicStatusResponse {
        status,
        components,
        incident: sanitise_public_incident(input.incident_message.as_deref()),
    }
}

/// Builds the safe public routes. Passing `None` keeps status opt-in: `/status` and
/// `/api/public/status` return the same JSON 404 response as the Node implementation.
pub fn public_router(public_status: Option<PublicStatusProvider>) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/status", get(status))
        .route("/api/public/status", get(status))
        .fallback(fallback)
        .with_state(AppState { public_status })
}

async fn health() -> Json<StatusBody> {
    Json(StatusBody { status: "ok" })
}

async fn status(
    headers: HeaderMap,
    axum::extract::State(state): axum::extract::State<AppState>,
) -> Response {
    let Some(provider) = state.public_status else {
        return not_found();
    };
    let mut response = Json(provider()).into_response();
    let response_headers = response.headers_mut();
    response_headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=30"),
    );
    if let Some(origin) = official_origin(&headers) {
        response_headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, origin);
        response_headers.insert(header::VARY, HeaderValue::from_static("Origin"));
    }
    response
}

async fn fallback(_request: Request<Body>) -> Response {
    not_found()
}

fn not_found() -> Response {
    (
        StatusCode::NOT_FOUND,
        Json(StatusBody {
            status: "not_found",
        }),
    )
        .into_response()
}

fn component_state(ready: bool) -> PublicStatusState {
    if ready {
        PublicStatusState::Operational
    } else {
        PublicStatusState::Unavailable
    }
}

fn provider_state(states: &[ProviderHealth]) -> PublicStatusState {
    if states.is_empty() {
        PublicStatusState::Unavailable
    } else if states.contains(&ProviderHealth::Degraded) {
        PublicStatusState::Degraded
    } else {
        PublicStatusState::Operational
    }
}

pub fn sanitise_public_incident(value: Option<&str>) -> Option<String> {
    let incident = value?.split_whitespace().collect::<Vec<_>>().join(" ");
    if incident.is_empty() {
        None
    } else {
        Some(incident.chars().take(INCIDENT_MAX_CHARS).collect())
    }
}

fn official_origin(headers: &HeaderMap) -> Option<HeaderValue> {
    let origin = headers.get(header::ORIGIN)?.to_str().ok()?;
    if !OFFICIAL_ORIGINS.contains(&origin) {
        return None;
    }
    match origin {
        "https://vozen.org" => Some(HeaderValue::from_static("https://vozen.org")),
        "https://www.vozen.org" => Some(HeaderValue::from_static("https://www.vozen.org")),
        _ => None,
    }
}

#[derive(Serialize)]
struct StatusBody {
    status: &'static str,
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;
    use tower::ServiceExt;

    #[test]
    fn maps_public_status_without_sensitive_detail() {
        let status = map_public_status(PublicStatusInput {
            bot_ready: true,
            database_ready: true,
            provider_states: vec![ProviderHealth::Healthy, ProviderHealth::Degraded],
            incident_message: Some("  Provider\nmaintenance\t underway  ".into()),
        });
        assert_eq!(status.status, PublicStatusState::Degraded);
        assert_eq!(status.components.providers, PublicStatusState::Degraded);
        assert_eq!(
            status.incident.as_deref(),
            Some("Provider maintenance underway")
        );
    }

    #[tokio::test]
    async fn health_and_status_keep_the_node_public_contract() {
        let provider: PublicStatusProvider = Arc::new(|| {
            map_public_status(PublicStatusInput {
                bot_ready: true,
                database_ready: true,
                provider_states: vec![ProviderHealth::Healthy],
                incident_message: None,
            })
        });
        let app = public_router(Some(provider));

        let health = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/health?probe=1")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("health response");
        assert_eq!(health.status(), StatusCode::OK);
        let health_body = to_bytes(health.into_body(), usize::MAX)
            .await
            .expect("health body");
        assert_eq!(&health_body[..], br#"{"status":"ok"}"#);

        let status = app
            .oneshot(
                Request::builder()
                    .uri("/api/public/status")
                    .header(header::ORIGIN, "https://vozen.org")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("status response");
        assert_eq!(status.status(), StatusCode::OK);
        assert_eq!(
            status.headers().get(header::ACCESS_CONTROL_ALLOW_ORIGIN),
            Some(&HeaderValue::from_static("https://vozen.org"))
        );
        assert_eq!(
            status.headers().get(header::CACHE_CONTROL),
            Some(&HeaderValue::from_static("public, max-age=30"))
        );
    }

    #[tokio::test]
    async fn status_stays_hidden_until_explicitly_enabled() {
        let response = public_router(None)
            .oneshot(
                Request::builder()
                    .uri("/status")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("response");
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body");
        assert_eq!(&body[..], br#"{"status":"not_found"}"#);
    }
}
