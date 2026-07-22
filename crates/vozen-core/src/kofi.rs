//! Pure Ko-fi webhook interpretation.
//!
//! This module accepts untrusted request text but performs no IO. The HTTP adapter must verify
//! the token before it maps a product or touches SQLite.

use std::collections::HashMap;

use hmac::{Hmac, Mac};
use serde_json::Value;
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

/// Number of guild licences included with the normal Premium pass.
pub const PREMIUM_PASS_SEATS: i64 = 3;
/// Number of guild licences included with the legacy Premium Max pass.
pub const PREMIUM_MAX_SEATS: i64 = 8;
const MAX_SHOP_DAYS: i64 = 3_650;
const MAX_SHOP_SEATS: i64 = 100;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KofiPlan {
    Premium,
    Plus,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KofiEvent {
    pub verification_token: String,
    pub event_type: String,
    pub message: Option<String>,
    pub is_subscription_payment: bool,
    pub is_first_subscription_payment: bool,
    pub tier_name: Option<String>,
    pub shop_items_text: String,
    pub shop_item_codes: Vec<String>,
    /// The adapter must HMAC this immediately and never persist it in clear text.
    pub email: Option<String>,
    pub amount: Option<String>,
    pub transaction_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KofiGrant {
    pub plan: KofiPlan,
    pub days: i64,
    pub seats: i64,
    pub discord_id: Option<String>,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShopProduct {
    pub plan: KofiPlan,
    pub days: i64,
    pub seats: i64,
}

/// Parses either Ko-fi's form payload (`data=<json>`) or plain JSON. It intentionally omits the
/// buyer name: no layer after Ko-fi has a use for it.
pub fn parse_kofi_payload(raw: &str) -> Option<KofiEvent> {
    let trimmed = raw.trim();
    let json = if trimmed.starts_with("data=") || trimmed.contains("data=") {
        form_urlencoded::parse(trimmed.as_bytes())
            .find_map(|(key, value)| (key == "data").then(|| value.into_owned()))?
    } else {
        trimmed.to_owned()
    };
    let value: Value = serde_json::from_str(&json).ok()?;
    let object = value.as_object()?;
    let shop_items = object
        .get("shop_items")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let shop_parts = shop_items
        .iter()
        .filter_map(Value::as_object)
        .map(|item| {
            let variation = value_to_string(item.get("variation_name")).unwrap_or_default();
            let code = value_to_string(item.get("direct_link_code")).unwrap_or_default();
            (variation, code)
        })
        .collect::<Vec<_>>();
    let shop_items_text = shop_parts
        .iter()
        .map(|(variation, code)| format!("{variation} {code}"))
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_owned();
    let shop_item_codes = shop_parts
        .into_iter()
        .map(|(_, code)| code.trim().to_owned())
        .filter(|code| !code.is_empty())
        .collect();

    Some(KofiEvent {
        verification_token: value_to_string(object.get("verification_token")).unwrap_or_default(),
        event_type: value_to_string(object.get("type")).unwrap_or_default(),
        message: optional_value_to_string(object.get("message")),
        is_subscription_payment: object
            .get("is_subscription_payment")
            .is_some_and(|value| value == true),
        is_first_subscription_payment: object
            .get("is_first_subscription_payment")
            .is_some_and(|value| value == true),
        tier_name: optional_value_to_string(object.get("tier_name")),
        shop_items_text,
        shop_item_codes,
        email: optional_value_to_string(object.get("email")),
        amount: optional_value_to_string(object.get("amount")),
        transaction_id: optional_value_to_string(object.get("kofi_transaction_id")),
    })
}

/// Fixed-size SHA-256 digests compared in constant time. An unset secret always fails closed.
pub fn verify_kofi_token(event: &KofiEvent, expected: Option<&str>) -> bool {
    let Some(expected) = expected.filter(|token| !token.is_empty()) else {
        return false;
    };
    let supplied_hash = Sha256::digest(event.verification_token.as_bytes());
    let expected_hash = Sha256::digest(expected.as_bytes());
    supplied_hash.ct_eq(&expected_hash).into()
}

/// HMAC-SHA256 of the normalized buyer email. The webhook secret prevents offline reversal.
pub fn hash_kofi_email(webhook_token: &str, email: &str) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(webhook_token.as_bytes())
        .expect("HMAC accepts arbitrary key lengths");
    mac.update(email.trim().to_ascii_lowercase().as_bytes());
    hex_lower(&mac.finalize().into_bytes())
}

/// First standalone Discord snowflake in a purchase message (17 to 20 digits).
pub fn extract_kofi_discord_id(message: Option<&str>) -> Option<String> {
    let message = message?;
    let bytes = message.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if !bytes[index].is_ascii_digit() {
            index += 1;
            continue;
        }
        let start = index;
        while index < bytes.len() && bytes[index].is_ascii_digit() {
            index += 1;
        }
        let previous_is_word = start > 0 && is_ascii_word(bytes[start - 1]);
        let next_is_word = index < bytes.len() && is_ascii_word(bytes[index]);
        if !previous_is_word && !next_is_word && (17..=20).contains(&(index - start)) {
            return Some(message[start..index].to_owned());
        }
    }
    None
}

/// Parses `code:plan:days[:seats]` product mappings. Invalid entries are ignored individually so
/// an environment typo cannot stop all incoming purchases.
pub fn parse_kofi_shop_map(raw: Option<&str>) -> HashMap<String, ShopProduct> {
    let mut products = HashMap::new();
    let Some(raw) = raw else {
        return products;
    };
    for entry in raw.split(',') {
        let parts = entry.trim().split(':').map(str::trim).collect::<Vec<_>>();
        if !(3..=4).contains(&parts.len()) || parts[0].is_empty() {
            continue;
        }
        let plan = match parts[1] {
            "plus" => KofiPlan::Plus,
            "premium" => KofiPlan::Premium,
            _ => continue,
        };
        let Ok(days) = parts[2].parse::<i64>() else {
            continue;
        };
        if !(1..=MAX_SHOP_DAYS).contains(&days) {
            continue;
        }
        let seats = match parts.get(3) {
            None => PREMIUM_PASS_SEATS,
            Some(value) => match value.parse::<i64>() {
                Ok(seats) if (1..=MAX_SHOP_SEATS).contains(&seats) => seats,
                _ => continue,
            },
        };
        products.insert(parts[0].to_owned(), ShopProduct { plan, days, seats });
    }
    products
}

/// Maps a validated event to an entitlement without applying it. Shop codes beat text matching
/// because digital Ko-fi shop orders usually omit the product name.
pub fn map_kofi_to_grant(
    event: &KofiEvent,
    shop_map: &HashMap<String, ShopProduct>,
) -> Option<KofiGrant> {
    for code in &event.shop_item_codes {
        if let Some(product) = shop_map.get(code) {
            return Some(KofiGrant {
                plan: product.plan,
                days: product.days,
                seats: product.seats,
                discord_id: extract_kofi_discord_id(event.message.as_deref()),
                label: format!("shop:{code}"),
            });
        }
    }
    let label = format!(
        "{} {}",
        event.tier_name.as_deref().unwrap_or_default(),
        event.shop_items_text
    )
    .trim()
    .to_owned();
    let lower = label.to_ascii_lowercase();
    let plan = if lower.contains("plus") {
        KofiPlan::Plus
    } else if lower.contains("premium") {
        KofiPlan::Premium
    } else {
        return None;
    };
    let days = if ["annual", "anual", "yearly", "year", "ano"]
        .iter()
        .any(|needle| lower.contains(needle))
    {
        365
    } else {
        30
    };
    let seats = match plan {
        KofiPlan::Plus => PREMIUM_PASS_SEATS,
        KofiPlan::Premium => premium_seats(&lower),
    };
    Some(KofiGrant {
        plan,
        days,
        seats,
        discord_id: extract_kofi_discord_id(event.message.as_deref()),
        label: if label.is_empty() {
            match plan {
                KofiPlan::Plus => "plus".into(),
                KofiPlan::Premium => "premium".into(),
            }
        } else {
            label
        },
    })
}

fn premium_seats(lower: &str) -> i64 {
    let bytes = lower.as_bytes();
    for start in 0..bytes.len() {
        if start > 0 && bytes[start - 1].is_ascii_digit() {
            continue;
        }
        let mut end = start;
        while end < bytes.len() && bytes[end].is_ascii_digit() {
            end += 1;
        }
        if end == start {
            continue;
        }
        let rest = &lower[end..];
        let whitespace = rest.len() - rest.trim_start().len();
        let rest = &rest[whitespace..];
        let Some(rest) = rest.strip_prefix("server") else {
            continue;
        };
        if !(rest.starts_with('s') || !rest.as_bytes().first().is_some_and(u8::is_ascii_alphabetic))
        {
            continue;
        }
        let Ok(seats) = lower[start..end].parse::<i64>() else {
            continue;
        };
        if (1..=MAX_SHOP_SEATS).contains(&seats) {
            return seats;
        }
    }
    if lower
        .split(|character: char| !character.is_ascii_alphabetic())
        .any(|word| word == "max")
    {
        PREMIUM_MAX_SEATS
    } else {
        PREMIUM_PASS_SEATS
    }
}

fn value_to_string(value: Option<&Value>) -> Option<String> {
    match value? {
        Value::String(value) => Some(value.clone()),
        Value::Number(value) => Some(value.to_string()),
        Value::Bool(value) => Some(value.to_string()),
        Value::Null => None,
        _ => None,
    }
}

fn optional_value_to_string(value: Option<&Value>) -> Option<String> {
    value
        .filter(|value| !value.is_null())
        .and_then(|value| value_to_string(Some(value)))
}

fn is_ascii_word(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || byte == b'_'
}

fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    const DISCORD_ID: &str = "123456789012345678";

    fn payload(overrides: &str) -> String {
        format!(
            r#"{{"verification_token":"tok","type":"Subscription","message":"Discord: {DISCORD_ID}","is_subscription_payment":true,"tier_name":"Vozen Premium — Monthly","email":"buyer@example.com"{overrides}}}"#
        )
    }

    #[test]
    fn parses_form_data_and_never_keeps_buyer_name() {
        let raw = format!(
            "data={}",
            form_urlencoded::byte_serialize(payload("").as_bytes()).collect::<String>()
        );
        let event = parse_kofi_payload(&raw).expect("event");
        assert_eq!(event.verification_token, "tok");
        assert_eq!(
            event.message.as_deref(),
            Some(format!("Discord: {DISCORD_ID}").as_str())
        );
        assert_eq!(event.email.as_deref(), Some("buyer@example.com"));
        assert!(parse_kofi_payload("nonsense{").is_none());
    }

    #[test]
    fn token_email_and_discord_id_rules_are_safe() {
        let event = parse_kofi_payload(&payload("")).expect("event");
        assert!(verify_kofi_token(&event, Some("tok")));
        assert!(!verify_kofi_token(&event, Some("other")));
        assert!(!verify_kofi_token(&event, None));
        assert_eq!(
            extract_kofi_discord_id(event.message.as_deref()).as_deref(),
            Some(DISCORD_ID)
        );
        assert_eq!(extract_kofi_discord_id(Some("x123456789012345678y")), None);
        assert_eq!(hash_kofi_email("secret", "  BUYER@example.COM ").len(), 64);
        assert_eq!(
            hash_kofi_email("secret", "BUYER@example.COM"),
            hash_kofi_email("secret", "buyer@example.com")
        );
    }

    #[test]
    fn configured_shop_code_beats_text_and_invalid_map_entries_are_skipped() {
        let map = parse_kofi_shop_map(Some("annual:plus:365, eight:premium:365:8, bad:wrong:30"));
        assert_eq!(map.len(), 2);
        let event = parse_kofi_payload(&format!(
            r#"{{"verification_token":"tok","type":"Shop Order","message":"{DISCORD_ID}","shop_items":[{{"direct_link_code":"eight","variation_name":""}}]}}"#
        )).expect("event");
        assert_eq!(
            map_kofi_to_grant(&event, &map),
            Some(KofiGrant {
                plan: KofiPlan::Premium,
                days: 365,
                seats: 8,
                discord_id: Some(DISCORD_ID.into()),
                label: "shop:eight".into(),
            })
        );
    }

    #[test]
    fn tier_mapping_preserves_plus_priority_and_historical_seat_rules() {
        let map = HashMap::new();
        let plus =
            parse_kofi_payload(&payload(r#", "tier_name":"Premium Plus 1 year""#)).expect("plus");
        let max =
            parse_kofi_payload(&payload(r#", "tier_name":"Vozen Premium Max""#)).expect("max");
        let grandfathered = parse_kofi_payload(&payload(
            r#", "tier_name":"Vozen Premium (10 servers) 1 year""#,
        ))
        .expect("old");
        assert!(matches!(
            map_kofi_to_grant(&plus, &map),
            Some(KofiGrant {
                plan: KofiPlan::Plus,
                days: 365,
                ..
            })
        ));
        assert!(matches!(
            map_kofi_to_grant(&max, &map),
            Some(KofiGrant {
                seats: PREMIUM_MAX_SEATS,
                ..
            })
        ));
        assert!(matches!(
            map_kofi_to_grant(&grandfathered, &map),
            Some(KofiGrant {
                seats: 10,
                days: 365,
                ..
            })
        ));
    }
}
