//! Pure validation for dashboard configuration updates.
//!
//! Authorization and Discord option discovery stay outside this module. Callers must provide
//! only live, authorised options after proving both Manage Guild and bot presence.

use std::collections::HashSet;

use serde_json::Value;
use vozen_store::{GuildConfig, GuildConfigPatch};

pub const SUPPORTED_LOCALES: &[&str] = &[
    "en", "pt", "es", "fr", "de", "nl", "pl", "tr", "cs", "sv", "fi", "da", "ro", "hu", "cy", "is",
    "lb", "lv", "sk", "sl", "sw", "vi", "ca", "it", "el", "ru", "uk", "kk", "sr", "ar", "fa", "ka",
    "ne", "zh", "ja",
];

#[derive(Debug, Clone, Default)]
pub struct DashboardValidationOptions {
    pub channel_ids: HashSet<String>,
    pub voice_ids: HashSet<String>,
    pub role_ids: HashSet<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InvalidDashboardSetting {
    TtsChannelId,
    DefaultVoice,
    PriorityRoleId,
    BlockedRoleId,
}

#[derive(Debug, Clone, PartialEq)]
pub enum SanitizeDashboardPatch {
    Valid(Box<GuildConfigPatch>),
    Invalid(InvalidDashboardSetting),
}

/// Mirrors the legacy dashboard whitelist, including its deliberate coercion of boolean fields.
/// A channel choice automatically enables Auto-read; clearing it always disables Auto-read.
pub fn sanitize_dashboard_patch(
    input: &Value,
    options: &DashboardValidationOptions,
    current: &GuildConfig,
) -> SanitizeDashboardPatch {
    let Some(source) = input.as_object() else {
        return SanitizeDashboardPatch::Valid(Box::default());
    };
    let mut patch = GuildConfigPatch::default();
    set_boolean_fields(source, &mut patch);

    if let Some(number) = source.get("maxChars").and_then(Value::as_f64) {
        patch.max_chars = Some(clamp_number(number, 1, 2_000));
    }
    if let Some(number) = source.get("ratePerMin").and_then(Value::as_f64) {
        patch.rate_per_min = Some(clamp_number(number, 1, 120));
    }
    if let Some(locale) = source.get("locale").and_then(Value::as_str)
        && SUPPORTED_LOCALES.contains(&locale)
    {
        patch.locale = Some(locale.to_owned());
    }

    if let Some(value) = source.get("ttsChannelId") {
        match nullable_authorised_id(value, &options.channel_ids) {
            Some(id) => patch.tts_channel_id = Some(id),
            None => return SanitizeDashboardPatch::Invalid(InvalidDashboardSetting::TtsChannelId),
        }
    }
    if let Some(value) = source.get("defaultVoice") {
        let Some(model) = value.as_str() else {
            return SanitizeDashboardPatch::Invalid(InvalidDashboardSetting::DefaultVoice);
        };
        if !model.is_empty() && !options.voice_ids.contains(model) {
            return SanitizeDashboardPatch::Invalid(InvalidDashboardSetting::DefaultVoice);
        }
        patch.default_voice = Some(model.to_owned());
    }
    if let Some(value) = source.get("priorityRoleId") {
        match nullable_authorised_id(value, &options.role_ids) {
            Some(id) => patch.priority_role_id = Some(id),
            None => {
                return SanitizeDashboardPatch::Invalid(InvalidDashboardSetting::PriorityRoleId);
            }
        }
    }
    if let Some(value) = source.get("blockedRoleId") {
        match nullable_authorised_id(value, &options.role_ids) {
            Some(id) => patch.blocked_role_id = Some(id),
            None => return SanitizeDashboardPatch::Invalid(InvalidDashboardSetting::BlockedRoleId),
        }
    }

    let priority = patch
        .priority_role_id
        .as_ref()
        .unwrap_or(&current.priority_role_id);
    let blocked = patch
        .blocked_role_id
        .as_ref()
        .unwrap_or(&current.blocked_role_id);
    if priority.is_some() && priority == blocked {
        return SanitizeDashboardPatch::Invalid(InvalidDashboardSetting::BlockedRoleId);
    }

    let effective_channel = patch
        .tts_channel_id
        .as_ref()
        .unwrap_or(&current.tts_channel_id);
    let channel_was_supplied = source.contains_key("ttsChannelId");
    let autoread_was_supplied = source.contains_key("autoread");
    if channel_was_supplied && effective_channel.is_some() && !autoread_was_supplied {
        patch.autoread = Some(true);
    }
    if effective_channel.is_none() && (channel_was_supplied || autoread_was_supplied) {
        patch.autoread = Some(false);
    }
    SanitizeDashboardPatch::Valid(Box::new(patch))
}

fn set_boolean_fields(source: &serde_json::Map<String, Value>, patch: &mut GuildConfigPatch) {
    macro_rules! bool_field {
        ($json:literal, $field:ident) => {
            if let Some(value) = source.get($json) {
                patch.$field = Some(js_truthy(value));
            }
        };
    }
    bool_field!("autoread", autoread);
    bool_field!("xsaid", xsaid);
    bool_field!("autojoin", autojoin);
    bool_field!("readBots", read_bots);
    bool_field!("textInVoice", text_in_voice);
    bool_field!("antispam", antispam);
    bool_field!("streakAnnounce", streak_announce);
    bool_field!("soundboard", soundboard);
    bool_field!("greetOnJoin", greet_on_join);
    bool_field!("translationEnabled", translation_enabled);
    bool_field!("votePromos", vote_promos);
    bool_field!("stayInCall", stay_in_call);
}

fn nullable_authorised_id(value: &Value, authorised: &HashSet<String>) -> Option<Option<String>> {
    if value.is_null() {
        return Some(None);
    }
    let id = value.as_str()?;
    authorised.contains(id).then(|| Some(id.to_owned()))
}

fn clamp_number(value: f64, lower: i64, upper: i64) -> i64 {
    value.floor().clamp(lower as f64, upper as f64) as i64
}

fn js_truthy(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Bool(value) => *value,
        Value::Number(value) => value.as_f64().is_some_and(|number| number != 0.0),
        Value::String(value) => !value.is_empty(),
        Value::Array(_) | Value::Object(_) => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn options() -> DashboardValidationOptions {
        DashboardValidationOptions {
            channel_ids: ["text".to_owned()].into_iter().collect(),
            voice_ids: ["en_US-amy-medium".to_owned()].into_iter().collect(),
            role_ids: ["priority".to_owned(), "blocked".to_owned()]
                .into_iter()
                .collect(),
        }
    }

    #[test]
    fn uses_live_option_ids_and_keeps_unknown_client_keys_out() {
        let clean = sanitize_dashboard_patch(
            &json!({
                "ttsChannelId":"text", "defaultVoice":"en_US-amy-medium", "maxChars":2000.9,
                "ratePerMin":0, "unknown":"must not persist", "readBots":[]
            }),
            &options(),
            &GuildConfig::default(),
        );
        let SanitizeDashboardPatch::Valid(patch) = clean else {
            panic!("valid")
        };
        assert_eq!(patch.tts_channel_id, Some(Some("text".into())));
        assert_eq!(patch.autoread, Some(true));
        assert_eq!(patch.max_chars, Some(2_000));
        assert_eq!(patch.rate_per_min, Some(1));
        assert_eq!(patch.read_bots, Some(true));
    }

    #[test]
    fn clear_channel_beats_autoread_and_invalid_values_fail_closed() {
        let current = GuildConfig {
            tts_channel_id: Some("text".into()),
            autoread: true,
            ..GuildConfig::default()
        };
        let clean = sanitize_dashboard_patch(
            &json!({"ttsChannelId":null,"autoread":true}),
            &options(),
            &current,
        );
        let SanitizeDashboardPatch::Valid(patch) = clean else {
            panic!("valid")
        };
        assert_eq!(patch.tts_channel_id, Some(None));
        assert_eq!(patch.autoread, Some(false));

        assert_eq!(
            sanitize_dashboard_patch(&json!({"ttsChannelId":"forged"}), &options(), &current),
            SanitizeDashboardPatch::Invalid(InvalidDashboardSetting::TtsChannelId)
        );
        assert_eq!(
            sanitize_dashboard_patch(&json!({"defaultVoice":"forged"}), &options(), &current),
            SanitizeDashboardPatch::Invalid(InvalidDashboardSetting::DefaultVoice)
        );
    }

    #[test]
    fn roles_cannot_be_identical_even_when_one_comes_from_storage() {
        let current = GuildConfig {
            priority_role_id: Some("priority".into()),
            ..GuildConfig::default()
        };
        assert_eq!(
            sanitize_dashboard_patch(&json!({"blockedRoleId":"priority"}), &options(), &current),
            SanitizeDashboardPatch::Invalid(InvalidDashboardSetting::BlockedRoleId)
        );
        assert_eq!(
            sanitize_dashboard_patch(
                &json!({"priorityRoleId":null,"blockedRoleId":"blocked"}),
                &options(),
                &current
            ),
            SanitizeDashboardPatch::Valid(Box::new(GuildConfigPatch {
                priority_role_id: Some(None),
                blocked_role_id: Some(Some("blocked".into())),
                ..GuildConfigPatch::default()
            }))
        );
    }
}
