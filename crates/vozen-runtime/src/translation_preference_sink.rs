//! Opt-in ephemeral adapter for individual `/translate` preferences.
//!
//! The adapter changes only the current caller's row in `translation_preference`. It never
//! enables a provider, posts a translated message, changes a mapping, or puts work in the TTS
//! queue. Those behaviours remain in their separate Node/Rust migration slices.

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
    GatewayEventDispatchError, GatewayEventSink, TranslationPreferenceCommand,
    VoiceResponseLocalizer, parse_translation_preference_command,
};
use vozen_store::{SqliteStore, TranslationPreferencePatch};

const USER_APP_TRANSLATION_SCOPE: &str = "@user-app";

pub struct TranslationPreferenceGatewaySink {
    store: Arc<Mutex<SqliteStore>>,
    localizer: VoiceResponseLocalizer,
}

impl TranslationPreferenceGatewaySink {
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            store,
            localizer: VoiceResponseLocalizer::from_generated_contract()
                .map_err(|_| GatewayEventDispatchError)?,
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

    fn update(
        &self,
        scope: &str,
        user_id: &str,
        patch: TranslationPreferencePatch,
    ) -> Result<(), GatewayEventDispatchError> {
        self.store
            .lock()
            .map_err(|_| GatewayEventDispatchError)?
            .update_translation_preference(scope, user_id, patch)
            .map(|_| ())
            .map_err(|_| GatewayEventDispatchError)
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for TranslationPreferenceGatewaySink {
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
        let Some(parsed) = parse_translation_preference_command(&command.data)
            .map_err(|_| GatewayEventDispatchError)?
        else {
            return Ok(());
        };
        command
            .defer_ephemeral(&context)
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        let guild_id = command.guild_id.map(|id| id.get().to_string());
        let scope = guild_id.as_deref().unwrap_or(USER_APP_TRANSLATION_SCOPE);
        let user_id = command.user.id.get().to_string();
        let guild_locale = command.guild_locale.as_deref();
        let parameters = BTreeMap::new();
        let content = match parsed {
            TranslationPreferenceCommand::DefaultLocale { locale } => {
                if !self.localizer.supports_explicit_locale(&locale) {
                    self.message(
                        "translation.invalidLocale",
                        &command.locale,
                        guild_locale,
                        &parameters,
                    )?
                } else if self
                    .update(
                        scope,
                        &user_id,
                        TranslationPreferencePatch {
                            locale: Some(Some(locale.clone())),
                            ..TranslationPreferencePatch::default()
                        },
                    )
                    .is_err()
                {
                    self.message(
                        "translation.unavailable",
                        &command.locale,
                        guild_locale,
                        &parameters,
                    )?
                } else {
                    let mut parameters = BTreeMap::new();
                    parameters.insert("locale", locale);
                    self.message(
                        "translation.defaultSaved",
                        &command.locale,
                        guild_locale,
                        &parameters,
                    )?
                }
            }
            TranslationPreferenceCommand::SpeakLocale { locale } => {
                if let Some(guild_id) = guild_id.as_deref() {
                    let locale = locale.to_ascii_lowercase();
                    if locale != "off" && !self.localizer.supports_explicit_locale(&locale) {
                        self.message(
                            "translation.invalidSpeakLocale",
                            &command.locale,
                            guild_locale,
                            &parameters,
                        )?
                    } else if self
                        .update(
                            guild_id,
                            &user_id,
                            TranslationPreferencePatch {
                                speak_locale: Some((locale != "off").then_some(locale.clone())),
                                ..TranslationPreferencePatch::default()
                            },
                        )
                        .is_err()
                    {
                        self.message(
                            "translation.unavailable",
                            &command.locale,
                            guild_locale,
                            &parameters,
                        )?
                    } else if locale == "off" {
                        self.message(
                            "translation.speakOff",
                            &command.locale,
                            guild_locale,
                            &parameters,
                        )?
                    } else {
                        let mut parameters = BTreeMap::new();
                        parameters.insert("locale", locale);
                        self.message(
                            "translation.speakOn",
                            &command.locale,
                            guild_locale,
                            &parameters,
                        )?
                    }
                } else {
                    self.message(
                        "translation.guildOnly",
                        &command.locale,
                        guild_locale,
                        &parameters,
                    )?
                }
            }
            TranslationPreferenceCommand::OptOut { active } => {
                if let Some(guild_id) = guild_id.as_deref() {
                    if self
                        .update(
                            guild_id,
                            &user_id,
                            TranslationPreferencePatch {
                                opted_out: Some(active),
                                ..TranslationPreferencePatch::default()
                            },
                        )
                        .is_err()
                    {
                        self.message(
                            "translation.unavailable",
                            &command.locale,
                            guild_locale,
                            &parameters,
                        )?
                    } else {
                        self.message(
                            if active {
                                "translation.optedOut"
                            } else {
                                "translation.optedIn"
                            },
                            &command.locale,
                            guild_locale,
                            &parameters,
                        )?
                    }
                } else {
                    self.message(
                        "translation.guildOnly",
                        &command.locale,
                        guild_locale,
                        &parameters,
                    )?
                }
            }
        };
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preference_updates_preserve_unrelated_translation_fields() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let sink = TranslationPreferenceGatewaySink::new(Arc::clone(&store)).expect("sink");
        sink.update(
            "guild",
            "user",
            TranslationPreferencePatch {
                locale: Some(Some("pt".into())),
                ..TranslationPreferencePatch::default()
            },
        )
        .expect("locale");
        sink.update(
            "guild",
            "user",
            TranslationPreferencePatch {
                opted_out: Some(true),
                ..TranslationPreferencePatch::default()
            },
        )
        .expect("opt out");
        let preference = store
            .lock()
            .expect("store")
            .translation_preference("guild", "user")
            .expect("preference");
        assert_eq!(preference.locale.as_deref(), Some("pt"));
        assert!(preference.opted_out);
        assert_eq!(preference.speak_locale, None);
    }
}
