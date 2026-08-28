//! Localised rendering for promoted voice command responses.
//!
//! The source strings are generated from the Node catalogue. This adapter owns no user content
//! and makes no network request; callers pass only already-sanitised display values for the small
//! set of existing placeholders.

use std::collections::BTreeMap;

use thiserror::Error;
use vozen_contracts::{VoiceResponseCatalog, VoiceResponseContractError};

use crate::CoreVoiceResponse;

const VOICE_RESPONSE_I18N: &str = include_str!("../../../contracts/voice-response-i18n.json");

#[derive(Debug, Error)]
pub enum VoiceResponseLocalizerError {
    #[error("generated voice response i18n contract is invalid: {0}")]
    Contract(#[from] VoiceResponseContractError),
}

#[derive(Clone)]
pub struct VoiceResponseLocalizer {
    catalog: VoiceResponseCatalog,
}

impl VoiceResponseLocalizer {
    pub fn from_generated_contract() -> Result<Self, VoiceResponseLocalizerError> {
        Ok(Self {
            catalog: VoiceResponseCatalog::from_json(VOICE_RESPONSE_I18N)?,
        })
    }

    /// Uses Node's locale ordering and keeps an unresolved placeholder literal, matching the
    /// existing TypeScript `t()` function. A `NotPromoted` response intentionally renders no
    /// text so an event handler cannot accidentally claim ownership of it.
    #[must_use]
    pub fn render(
        &self,
        response: CoreVoiceResponse,
        interaction_locale: Option<&str>,
        guild_locale: Option<&str>,
        parameters: &BTreeMap<&str, String>,
    ) -> Option<String> {
        let key = response.catalog_key()?;
        self.render_key(key, interaction_locale, guild_locale, parameters)
    }

    /// Renders a generated Node catalogue key for a separately promoted voice-adjacent feature.
    /// Callers still need a typed outcome before selecting a key; this function never accepts
    /// user-provided key material.
    #[must_use]
    pub fn render_key(
        &self,
        key: &str,
        interaction_locale: Option<&str>,
        guild_locale: Option<&str>,
        parameters: &BTreeMap<&str, String>,
    ) -> Option<String> {
        let locale = self
            .catalog
            .resolve_locale(interaction_locale, guild_locale);
        // The reward policy changed from a lifetime grant to a short rolling limit. Keep the
        // current operational copy here until the historical Node catalogue is regenerated, so
        // no supported locale can receive a stale "48h once ever" promise.
        if let Some(copy) = current_vote_reward_copy(key, locale, parameters) {
            return Some(copy);
        }
        self.catalog
            .message(key, locale)
            .map(|template| interpolate(template, parameters))
    }

    /// Checks an explicit command locale exactly, matching Node's command validation. Discord
    /// client locales may contain a region variant, but an explicit `/translate locale:pt-BR`
    /// is intentionally rejected because the command contract stores base locale ids only.
    #[must_use]
    pub fn supports_explicit_locale(&self, locale: &str) -> bool {
        self.catalog
            .supported_locales
            .iter()
            .any(|supported| supported == locale)
    }

    /// Resolves a Discord client locale to a supported base code or canonical English. This is
    /// used only when a command omits its target locale; it never broadens explicit input.
    #[must_use]
    pub fn default_for_discord_locale(&self, locale: Option<&str>) -> String {
        self.catalog.resolve_locale(locale, None).to_owned()
    }
}

fn current_vote_reward_copy(
    key: &str,
    locale: &str,
    parameters: &BTreeMap<&str, String>,
) -> Option<String> {
    let url = parameters.get("url").map(String::as_str).unwrap_or("{url}");
    let copy = match key {
        "vote.upsell" | "vote.link" => match locale {
            "pt" => format!(
                "🗳️ Vota no Vozen no top.gg → **24h de Plus grátis**. Máximo de **4 recompensas em 30 dias** e nunca mais de 48h de Plus acumulado: {url}"
            ),
            "es" => format!(
                "🗳️ Vota por Vozen en top.gg → **24 h de Plus gratis**. Máximo de **4 recompensas en 30 días** y nunca más de 48 h acumuladas: {url}"
            ),
            "fr" => format!(
                "🗳️ Votez pour Vozen sur top.gg → **24 h de Plus gratuit**. Maximum de **4 récompenses sur 30 jours** et jamais plus de 48 h cumulées : {url}"
            ),
            "de" => format!(
                "🗳️ Stimme für Vozen auf top.gg ab → **24 Stunden Plus gratis**. Maximal **4 Belohnungen in 30 Tagen** und nie mehr als 48 Stunden angesammelt: {url}"
            ),
            "tr" => format!(
                "🗳️ top.gg'de Vozen için oy ver → **24 saat ücretsiz Plus**. **30 günde en fazla 4 ödül** ve toplamda en fazla 48 saat: {url}"
            ),
            "ru" => format!(
                "🗳️ Голосуйте за Vozen на top.gg → **24 часа Plus бесплатно**. Не более **4 наград за 30 дней** и не более 48 часов накопленного Plus: {url}"
            ),
            "ar" => format!(
                "🗳️ صوّت لـ Vozen على top.gg → **24 ساعة Plus مجاناً**. بحد أقصى **4 مكافآت خلال 30 يوماً** ولا يزيد الرصيد عن 48 ساعة: {url}"
            ),
            "zh" => format!(
                "🗳️ 在 top.gg 为 Vozen 投票 → **免费 Plus 24 小时**。每 30 天最多 **4 次奖励**，累计不超过 48 小时：{url}"
            ),
            "ja" => format!(
                "🗳️ top.gg で Vozen に投票 → **Plus を24時間無料**。30日間で最大 **4回**、累積は48時間までです：{url}"
            ),
            _ => format!(
                "🗳️ Vote for Vozen on top.gg → **24h of Plus free**. Maximum **4 rewards in 30 days** and never more than 48h accumulated: {url}"
            ),
        },
        "vote.cooldownStatus" => match locale {
            "pt" => "🗳️ Esta conta atingiu o limite de 4 recompensas em 30 dias. Ainda podes votar para apoiar o Vozen.".to_owned(),
            "es" => "🗳️ Esta cuenta alcanzó el límite de 4 recompensas en 30 días. Aún puedes votar para apoyar a Vozen.".to_owned(),
            "fr" => "🗳️ Ce compte a atteint la limite de 4 récompenses sur 30 jours. Vous pouvez toujours voter pour soutenir Vozen.".to_owned(),
            "de" => "🗳️ Dieses Konto hat das Limit von 4 Belohnungen in 30 Tagen erreicht. Du kannst Vozen weiterhin mit deiner Stimme unterstützen.".to_owned(),
            "tr" => "🗳️ Bu hesap 30 günde 4 ödül sınırına ulaştı. Vozen'i desteklemek için yine de oy verebilirsin.".to_owned(),
            "ru" => "🗳️ Этот аккаунт достиг лимита в 4 награды за 30 дней. Вы всё ещё можете голосовать в поддержку Vozen.".to_owned(),
            "ar" => "🗳️ وصل هذا الحساب إلى حد 4 مكافآت خلال 30 يوماً. لا يزال بإمكانك التصويت لدعم Vozen.".to_owned(),
            "zh" => "🗳️ 此账号已达到每 30 天 4 次奖励的上限。你仍可投票支持 Vozen。".to_owned(),
            "ja" => "🗳️ このアカウントは30日間で4回の報酬上限に達しました。Vozenを応援するために投票はできます。".to_owned(),
            _ => "🗳️ This account has reached the limit of 4 rewards in 30 days. You can still vote to support Vozen.".to_owned(),
        },
        _ => return None,
    };
    Some(copy)
}

fn interpolate(template: &str, parameters: &BTreeMap<&str, String>) -> String {
    let mut output = String::with_capacity(template.len());
    let mut remaining = template;
    while let Some(open) = remaining.find('{') {
        output.push_str(&remaining[..open]);
        let after_open = &remaining[open + 1..];
        let Some(close) = after_open.find('}') else {
            output.push_str(&remaining[open..]);
            return output;
        };
        let key = &after_open[..close];
        if !key.is_empty()
            && key
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
        {
            if let Some(value) = parameters.get(key) {
                output.push_str(value);
            } else {
                output.push_str(&remaining[open..open + close + 2]);
            }
        } else {
            output.push_str(&remaining[open..open + close + 2]);
        }
        remaining = &after_open[close + 1..];
    }
    output.push_str(remaining);
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn localizer_uses_node_locale_fallback_and_preserves_missing_placeholders() {
        let localizer = VoiceResponseLocalizer::from_generated_contract().expect("catalog");
        let mut parameters = BTreeMap::new();
        parameters.insert("channel", "#general".into());

        let french = localizer
            .render(
                CoreVoiceResponse::JoinPermissionDenied,
                Some("fr-CA"),
                Some("pt"),
                &parameters,
            )
            .expect("French response");
        assert!(french.contains("#general"));

        let fallback = localizer
            .render(
                CoreVoiceResponse::JoinPermissionDenied,
                Some("ko"),
                Some("pt-BR"),
                &BTreeMap::new(),
            )
            .expect("Portuguese fallback");
        assert!(fallback.contains("{channel}"));
    }

    #[test]
    fn localizer_renders_the_generated_private_file_messages() {
        let localizer = VoiceResponseLocalizer::from_generated_contract().expect("catalog");
        let mut parameters = BTreeMap::new();
        parameters.insert("max", "500".into());
        let french = localizer
            .render_key("ttsFile.tooLong", Some("fr-CA"), None, &parameters)
            .expect("French file message");
        assert!(french.contains("500"));
        assert_ne!(
            french,
            "Your text is too long for a file (max 500 characters)."
        );
    }

    #[test]
    fn distinguishes_explicit_locale_validation_from_discord_locale_fallback() {
        let localizer = VoiceResponseLocalizer::from_generated_contract().expect("catalog");
        assert!(localizer.supports_explicit_locale("pt"));
        assert!(!localizer.supports_explicit_locale("pt-BR"));
        assert_eq!(localizer.default_for_discord_locale(Some("pt-BR")), "pt");
        assert_eq!(localizer.default_for_discord_locale(Some("unknown")), "en");
    }

    #[test]
    fn localizer_renders_the_generated_private_translation_message() {
        let localizer = VoiceResponseLocalizer::from_generated_contract().expect("catalog");
        let mut parameters = BTreeMap::new();
        parameters.insert("locale", "pt".into());
        parameters.insert("text", "olá".into());
        assert_eq!(
            localizer.render_key("translation.ready", Some("en-US"), None, &parameters),
            Some("**Translation · pt**\nolá".into())
        );
    }

    #[test]
    fn vote_copy_uses_the_current_rolling_reward_policy_for_all_locales() {
        let localizer = VoiceResponseLocalizer::from_generated_contract().expect("catalog");
        let mut parameters = BTreeMap::new();
        parameters.insert("url", "https://top.gg/bot/123/vote".to_owned());
        for locale in [
            "en", "pt", "es", "fr", "de", "tr", "ru", "ar", "zh", "ja", "nl",
        ] {
            let copy = localizer
                .render_key("vote.link", Some(locale), None, &parameters)
                .expect("vote copy");
            assert!(copy.contains("24") || copy.contains("٢٤"));
            assert!(copy.contains("4") || copy.contains("４"));
            assert!(!copy.to_ascii_lowercase().contains("once per account"));
        }
        let portuguese = localizer
            .render_key("vote.cooldownStatus", Some("pt-PT"), None, &parameters)
            .expect("cooldown copy");
        assert!(portuguese.contains("4 recompensas"));
    }
}
