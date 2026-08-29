//! Private Cloudflare Web Analytics proxy.
//!
//! The browser never receives the Cloudflare account ID, site tag or API token.
//! This module queries the account-scoped RUM datasets, trims their output to
//! aggregate product metrics and keeps successful responses in a small in-memory
//! cache. The resulting object is safe for the owner-only panel.

use std::{
    collections::{BTreeMap, HashMap},
    sync::{Arc, Mutex},
    time::Duration,
};

use reqwest::{Client, StatusCode};
use serde::Serialize;
use serde_json::{Value, json};
use thiserror::Error;

const GRAPHQL_ENDPOINT: &str = "https://api.cloudflare.com/client/v4/graphql";
const CACHE_TTL_MS: i64 = 5 * 60 * 1_000;
const BREAKDOWN_LIMIT: usize = 10;

// Cloudflare's RUM datasets are account-scoped. `siteTag` is the Web Analytics
// property ID used by the dashboard URL (for example `/web-analytics/edit/<siteTag>`).
// It is deliberately different from the public beacon token embedded in the website.
const PAGELOAD_QUERY: &str = r#"
query VozenRumPageloads($accountId: String!, $siteTag: String!, $since: String!, $until: String!) {
  viewer {
    accounts(filter: {accountTag: $accountId}) {
      rumPageloadEventsAdaptiveGroups(
        filter: {datetime_gt: $since, datetime_leq: $until, siteTag: $siteTag}
        limit: 5000
      ) {
        count
        dimensions { requestPath deviceType refererHost }
        sum { visits }
      }
    }
  }
}
"#;

const VITALS_QUERY: &str = r#"
query VozenRumVitals($accountId: String!, $siteTag: String!, $since: String!, $until: String!) {
  viewer {
    accounts(filter: {accountTag: $accountId}) {
      rumWebVitalsEventsAdaptiveGroups(
        filter: {datetime_gt: $since, datetime_leq: $until, siteTag: $siteTag}
        limit: 1
      ) {
        count
        quantiles {
          largestContentfulPaintP75
          interactionToNextPaintP75
          cumulativeLayoutShiftP75
        }
      }
    }
  }
}
"#;

#[derive(Clone)]
pub struct CloudflareWebAnalyticsConfig {
    account_id: String,
    // Kept server-side so the deployment has an explicit, reviewable zone
    // association. The RUM GraphQL datasets themselves are scoped by account
    // and Web Analytics site tag.
    _zone_id: String,
    // Cloudflare Web Analytics property ID, not the browser beacon token.
    site_tag: String,
    api_token: String,
    client: Client,
    cache: Arc<Mutex<HashMap<String, CachedResponse>>>,
}

#[derive(Clone)]
struct CachedResponse {
    expires_at: i64,
    body: WebAnalyticsResponse,
}

#[derive(Debug, Error)]
pub enum CloudflareWebAnalyticsConfigError {
    #[error("Cloudflare Web Analytics needs account ID, zone ID, site tag and a read-only token")]
    MissingValue,
    #[error("Cloudflare HTTP client initialisation failed")]
    Client,
}

#[derive(Debug, Error)]
pub enum WebAnalyticsError {
    #[error("Cloudflare request failed")]
    Request,
    #[error("Cloudflare returned an unsuccessful response")]
    Upstream,
    #[error("Cloudflare returned an invalid analytics payload")]
    Payload,
}

impl CloudflareWebAnalyticsConfig {
    pub fn new(
        account_id: String,
        zone_id: String,
        site_tag: String,
        api_token: String,
    ) -> Result<Self, CloudflareWebAnalyticsConfigError> {
        if [
            account_id.as_str(),
            zone_id.as_str(),
            site_tag.as_str(),
            api_token.as_str(),
        ]
        .iter()
        .any(|value| value.trim().is_empty())
        {
            return Err(CloudflareWebAnalyticsConfigError::MissingValue);
        }
        let client = Client::builder()
            .timeout(Duration::from_secs(12))
            .build()
            .map_err(|_| CloudflareWebAnalyticsConfigError::Client)?;
        Ok(Self {
            account_id,
            _zone_id: zone_id,
            site_tag,
            api_token,
            client,
            cache: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    pub async fn fetch(
        &self,
        from_day: &str,
        to_day: &str,
        now_ms: i64,
    ) -> Result<WebAnalyticsResponse, WebAnalyticsError> {
        let cache_key = format!("{from_day}:{to_day}");
        if let Some(value) = self
            .cache
            .lock()
            .ok()
            .and_then(|cache| cache.get(&cache_key).cloned())
            .filter(|value| value.expires_at > now_ms)
        {
            return Ok(value.body);
        }

        let since = format!("{from_day}T00:00:00Z");
        let until = format!("{to_day}T23:59:59Z");
        let variables = json!({
            "accountId": self.account_id,
            "siteTag": self.site_tag,
            "since": since,
            "until": until,
        });
        let pageloads = self.graphql(PAGELOAD_QUERY, variables.clone()).await?;
        let vitals = self.graphql(VITALS_QUERY, variables).await?;
        let body = normalise_response(from_day, to_day, now_ms, &pageloads, &vitals)?;
        if let Ok(mut cache) = self.cache.lock() {
            cache.retain(|_, value| value.expires_at > now_ms);
            cache.insert(
                cache_key,
                CachedResponse {
                    expires_at: now_ms.saturating_add(CACHE_TTL_MS),
                    body: body.clone(),
                },
            );
        }
        Ok(body)
    }

    async fn graphql(&self, query: &str, variables: Value) -> Result<Value, WebAnalyticsError> {
        let response = self
            .client
            .post(GRAPHQL_ENDPOINT)
            .bearer_auth(&self.api_token)
            .json(&json!({"query": query, "variables": variables}))
            .send()
            .await
            .map_err(|_| WebAnalyticsError::Request)?;
        if response.status() != StatusCode::OK {
            return Err(WebAnalyticsError::Upstream);
        }
        let body = response
            .json::<Value>()
            .await
            .map_err(|_| WebAnalyticsError::Payload)?;
        if body
            .get("errors")
            .and_then(Value::as_array)
            .is_some_and(|errors| !errors.is_empty())
        {
            return Err(WebAnalyticsError::Upstream);
        }
        Ok(body)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct WebAnalyticsResponse {
    pub source: &'static str,
    pub from: String,
    pub to: String,
    #[serde(rename = "lastUpdated")]
    pub last_updated: i64,
    pub visits: u64,
    #[serde(rename = "pageViews")]
    pub page_views: u64,
    #[serde(rename = "topPages")]
    pub top_pages: Vec<WebAnalyticsBreakdown>,
    pub referrers: Vec<WebAnalyticsBreakdown>,
    pub devices: Vec<WebAnalyticsBreakdown>,
    #[serde(rename = "coreWebVitals")]
    pub core_web_vitals: WebVitals,
    #[serde(rename = "partialData")]
    pub partial_data: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct WebAnalyticsBreakdown {
    pub label: String,
    pub value: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct WebVitals {
    #[serde(rename = "lcpP75Ms", skip_serializing_if = "Option::is_none")]
    pub lcp_p75_ms: Option<u64>,
    #[serde(rename = "inpP75Ms", skip_serializing_if = "Option::is_none")]
    pub inp_p75_ms: Option<u64>,
    #[serde(rename = "clsP75", skip_serializing_if = "Option::is_none")]
    pub cls_p75: Option<f64>,
    #[serde(rename = "sampleCount")]
    pub sample_count: u64,
}

fn normalise_response(
    from_day: &str,
    to_day: &str,
    now_ms: i64,
    pageloads: &Value,
    vitals: &Value,
) -> Result<WebAnalyticsResponse, WebAnalyticsError> {
    let groups = account_groups(pageloads, "rumPageloadEventsAdaptiveGroups")?;
    let mut page_views = 0_u64;
    let mut visits = 0_u64;
    let mut pages = BTreeMap::<String, u64>::new();
    let mut referrers = BTreeMap::<String, u64>::new();
    let mut devices = BTreeMap::<String, u64>::new();
    for group in groups {
        let count = group.get("count").and_then(Value::as_u64).unwrap_or(0);
        let group_visits = group
            .pointer("/sum/visits")
            .and_then(Value::as_u64)
            .unwrap_or(0);
        page_views = page_views.saturating_add(count);
        visits = visits.saturating_add(group_visits);
        let dimensions = group.get("dimensions").and_then(Value::as_object);
        if let Some(label) = dimensions
            .and_then(|value| value.get("requestPath"))
            .and_then(Value::as_str)
            .and_then(path_label)
        {
            add_breakdown(&mut pages, label, count);
        }
        if let Some(label) = dimensions
            .and_then(|value| value.get("refererHost"))
            .and_then(Value::as_str)
            .and_then(text_label)
        {
            add_breakdown(&mut referrers, label, count);
        }
        if let Some(label) = dimensions
            .and_then(|value| value.get("deviceType"))
            .and_then(Value::as_str)
            .and_then(text_label)
        {
            add_breakdown(&mut devices, label, count);
        }
    }
    let vitals_group = account_groups(vitals, "rumWebVitalsEventsAdaptiveGroups")?
        .first()
        .cloned();
    let quantiles = vitals_group
        .as_ref()
        .and_then(|group| group.get("quantiles"));
    let sample_count = vitals_group
        .as_ref()
        .and_then(|group| group.get("count"))
        .and_then(Value::as_u64)
        .unwrap_or(0);
    Ok(WebAnalyticsResponse {
        source: "cloudflare-web-analytics",
        from: from_day.to_owned(),
        to: to_day.to_owned(),
        last_updated: now_ms,
        visits,
        page_views,
        top_pages: sorted_breakdown(pages),
        referrers: sorted_breakdown(referrers),
        devices: sorted_breakdown(devices),
        core_web_vitals: WebVitals {
            lcp_p75_ms: microseconds_to_ms(quantiles, "largestContentfulPaintP75"),
            inp_p75_ms: microseconds_to_ms(quantiles, "interactionToNextPaintP75"),
            cls_p75: cls_value(quantiles),
            sample_count,
        },
        // Cloudflare RUM can be blocked by a visitor's content blocker, so the
        // owner panel always makes that sampling limitation explicit.
        partial_data: true,
    })
}

fn account_groups<'a>(body: &'a Value, field: &str) -> Result<&'a Vec<Value>, WebAnalyticsError> {
    body.pointer(&format!("/data/viewer/accounts/0/{field}"))
        .and_then(Value::as_array)
        .ok_or(WebAnalyticsError::Payload)
}

fn add_breakdown(values: &mut BTreeMap<String, u64>, label: String, value: u64) {
    let entry = values.entry(label).or_default();
    *entry = entry.saturating_add(value);
}

fn sorted_breakdown(values: BTreeMap<String, u64>) -> Vec<WebAnalyticsBreakdown> {
    let mut values = values
        .into_iter()
        .map(|(label, value)| WebAnalyticsBreakdown { label, value })
        .collect::<Vec<_>>();
    values.sort_by(|left, right| {
        right
            .value
            .cmp(&left.value)
            .then_with(|| left.label.cmp(&right.label))
    });
    values.truncate(BREAKDOWN_LIMIT);
    values
}

fn path_label(value: &str) -> Option<String> {
    let path = value.split(['?', '#']).next().unwrap_or_default().trim();
    if !path.starts_with('/') || path.len() > 180 || path.chars().any(char::is_control) {
        return None;
    }
    Some(path.to_owned())
}

fn text_label(value: &str) -> Option<String> {
    let value = value.trim();
    if value.is_empty() || value.len() > 180 || value.chars().any(char::is_control) {
        return None;
    }
    Some(value.to_owned())
}

fn microseconds_to_ms(quantiles: Option<&Value>, key: &str) -> Option<u64> {
    let value = quantiles?.get(key)?.as_f64()?;
    (value >= 0.0).then_some((value / 1_000.0).round() as u64)
}

fn cls_value(quantiles: Option<&Value>) -> Option<f64> {
    let value = quantiles?.get("cumulativeLayoutShiftP75")?.as_f64()?;
    (value >= 0.0).then_some((value * 1_000.0).round() / 1_000.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalises_aggregate_rum_without_exposing_the_site_configuration() {
        let pageloads = json!({"data":{"viewer":{"accounts":[{
            "rumPageloadEventsAdaptiveGroups":[
              {"count":10,"dimensions":{"requestPath":"/tts/?invite=secret","refererHost":"google.com","deviceType":"mobile"},"sum":{"visits":4}},
              {"count":5,"dimensions":{"requestPath":"/helper/","refererHost":"google.com","deviceType":"desktop"},"sum":{"visits":2}}
            ]
        }]}}});
        let vitals = json!({"data":{"viewer":{"accounts":[{
            "rumWebVitalsEventsAdaptiveGroups":[{"count":8,"quantiles":{
              "largestContentfulPaintP75":2400000,"interactionToNextPaintP75":180000,"cumulativeLayoutShiftP75":0.06
            }}]
        }]}}});
        let result = normalise_response("2026-08-01", "2026-08-07", 42, &pageloads, &vitals)
            .expect("normalised response");
        assert_eq!(result.visits, 6);
        assert_eq!(result.page_views, 15);
        assert_eq!(
            result.top_pages[0],
            WebAnalyticsBreakdown {
                label: "/tts/".into(),
                value: 10
            }
        );
        assert_eq!(result.core_web_vitals.lcp_p75_ms, Some(2400));
        assert_eq!(result.core_web_vitals.inp_p75_ms, Some(180));
        assert_eq!(result.core_web_vitals.cls_p75, Some(0.06));
        let public = serde_json::to_string(&result).expect("serialise");
        assert!(!public.contains("secret"));
    }

    #[test]
    fn configuration_fails_closed_when_a_secret_is_missing() {
        let result = CloudflareWebAnalyticsConfig::new(
            "account".into(),
            "zone".into(),
            "site".into(),
            "".into(),
        );
        assert!(matches!(
            result,
            Err(CloudflareWebAnalyticsConfigError::MissingValue)
        ));
    }
}
