//! Opt-in ephemeral adapter for `/translate text`.
//!
//! It claims only the private leaf already parsed by `vozen-discord`. Automatic translation,
//! member preferences beyond the default locale, channel mappings and translate-before-speaking
//! remain Node-owned until each has its own parity boundary.

use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
};

use serenity::{
    builder::{CreateAllowedMentions, EditInteractionResponse},
    client::Context,
    model::application::Interaction,
};
use vozen_discord::{
    ExplicitTranslationInvocation, ExplicitTranslationOutcome, ExplicitTranslationService,
    GatewayEventDispatchError, GatewayEventSink, VoiceResponseLocalizer,
    parse_translate_text_command,
};
use vozen_store::SqliteStore;

use crate::{system_now_ms, translation_provider::RuntimeTranslationProvider};

const USER_APP_TRANSLATION_SCOPE: &str = "@user-app";
const MAX_TRANSLATION_RESPONSE_UTF16: usize = 1_800;

pub struct TranslationTextGatewaySink {
    store: Arc<Mutex<SqliteStore>>,
    service: ExplicitTranslationService<RuntimeTranslationProvider>,
    localizer: VoiceResponseLocalizer,
}

impl TranslationTextGatewaySink {
    pub fn new(
        store: Arc<Mutex<SqliteStore>>,
        provider: RuntimeTranslationProvider,
    ) -> Result<Self, GatewayEventDispatchError> {
        let localizer = VoiceResponseLocalizer::from_generated_contract()
            .map_err(|_| GatewayEventDispatchError)?;
        Ok(Self {
            service: ExplicitTranslationService::new(
                Arc::clone(&store),
                provider,
                Arc::new(system_now_ms),
            ),
            store,
            localizer,
        })
    }

    fn message(
        &self,
        key: &str,
        interaction_locale: &str,
        guild_locale: Option<&str>,
        parameters: &BTreeMap<&str, String>,
    ) -> Result<String, GatewayEventDispatchError> {
        self.localizer
            .render_key(key, Some(interaction_locale), guild_locale, parameters)
            .ok_or(GatewayEventDispatchError)
    }

    fn target_locale(
        &self,
        explicit_locale: Option<String>,
        preference_scope: &str,
        user_id: &str,
        interaction_locale: &str,
    ) -> Result<String, GatewayEventDispatchError> {
        let configured_locale = if explicit_locale.is_none() {
            self.store
                .lock()
                .map_err(|_| GatewayEventDispatchError)?
                .translation_preference(preference_scope, user_id)
                .map_err(|_| GatewayEventDispatchError)?
                .locale
        } else {
            None
        };
        Ok(explicit_locale.or(configured_locale).unwrap_or_else(|| {
            self.localizer
                .default_for_discord_locale(Some(interaction_locale))
        }))
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for TranslationTextGatewaySink {
    async fn on_message(
        &self,
        _context: Context,
        _message: serenity::model::channel::Message,
    ) -> Result<(), GatewayEventDispatchError> {
        Ok(())
    }

    async fn on_interaction(
        &self,
        context: Context,
        interaction: Interaction,
    ) -> Result<(), GatewayEventDispatchError> {
        let Interaction::Command(command) = interaction else {
            return Ok(());
        };
        let Some(parsed) =
            parse_translate_text_command(&command.data).map_err(|_| GatewayEventDispatchError)?
        else {
            return Ok(());
        };
        // Parse before defer: every non-text `/translate` subcommand remains Node-owned.
        command
            .defer_ephemeral(&context)
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        let guild_id = command.guild_id.map(|id| id.get().to_string());
        let preference_scope = guild_id.as_deref().unwrap_or(USER_APP_TRANSLATION_SCOPE);
        let user_id = command.user.id.get().to_string();
        let guild_locale = command.guild_locale.as_deref();
        let parameters = BTreeMap::new();
        let content = match self.target_locale(
            parsed.target_locale,
            preference_scope,
            &user_id,
            &command.locale,
        ) {
            // The interaction has already been deferred, so a transient SQLite failure must
            // still receive a bounded public response instead of silently timing out.
            Err(_) => self.message(
                "translation.unavailable",
                &command.locale,
                guild_locale,
                &parameters,
            )?,
            Ok(target_locale) if !self.localizer.supports_explicit_locale(&target_locale) => self
                .message(
                "translation.invalidLocale",
                &command.locale,
                guild_locale,
                &parameters,
            )?,
            Ok(target_locale) => match self
                .service
                .execute(ExplicitTranslationInvocation {
                    guild_id: guild_id.as_deref(),
                    user_id: &user_id,
                    text: &parsed.text,
                    target_locale: &target_locale,
                })
                .await
            {
                ExplicitTranslationOutcome::Ready { text, .. } => {
                    let mut parameters = BTreeMap::new();
                    parameters.insert("locale", target_locale);
                    parameters.insert(
                        "text",
                        truncate_utf16(&text, MAX_TRANSLATION_RESPONSE_UTF16),
                    );
                    self.message(
                        "translation.ready",
                        &command.locale,
                        guild_locale,
                        &parameters,
                    )?
                }
                ExplicitTranslationOutcome::Empty => self.message(
                    "translation.empty",
                    &command.locale,
                    guild_locale,
                    &parameters,
                )?,
                ExplicitTranslationOutcome::Disabled => self.message(
                    "translation.disabled",
                    &command.locale,
                    guild_locale,
                    &parameters,
                )?,
                ExplicitTranslationOutcome::QuotaExceeded => self.message(
                    "translation.quota",
                    &command.locale,
                    guild_locale,
                    &parameters,
                )?,
                ExplicitTranslationOutcome::Unavailable
                | ExplicitTranslationOutcome::StoreUnavailable => self.message(
                    "translation.unavailable",
                    &command.locale,
                    guild_locale,
                    &parameters,
                )?,
            },
        };
        // Provider text is never trusted to control mentions. The Node automatic-translation
        // sender also uses an empty parse set; keep the private response equally non-pinging.
        command
            .edit_response(
                &context,
                EditInteractionResponse::new()
                    .content(content)
                    .allowed_mentions(
                        CreateAllowedMentions::new()
                            .all_users(false)
                            .all_roles(false)
                            .everyone(false),
                    ),
            )
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        Ok(())
    }

    async fn on_guild_delete(&self, _guild_id: &str) -> Result<(), GatewayEventDispatchError> {
        Ok(())
    }
}

fn truncate_utf16(input: &str, max_units: usize) -> String {
    let mut units = 0;
    let mut end = input.len();
    for (index, character) in input.char_indices() {
        let character_units = character.len_utf16();
        if units + character_units > max_units {
            end = index;
            break;
        }
        units += character_units;
    }
    input[..end].to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn truncates_provider_output_without_splitting_unicode() {
        assert_eq!(truncate_utf16("ab😀", 3), "ab");
        assert_eq!(truncate_utf16("ab😀", 4), "ab😀");
    }
}
