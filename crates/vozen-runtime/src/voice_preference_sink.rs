//! Opt-in ephemeral adapter for the textual preference leaves of `/voice`.
//!
//! The mixed `/voice` surface also contains a model browser, preview playback and an interactive
//! panel. Those remain Node-owned. This sink can therefore be enabled independently without
//! consuming a command whose UI contract Rust does not yet implement.

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
    GatewayEventDispatchError, GatewayEventSink, VoiceDisplayCatalog, VoicePreferenceCommand,
    VoicePreferenceInvocation, VoicePreferenceOutcome, VoicePreferenceService,
    VoicePreferenceSettings, VoiceResponseLocalizer, parse_voice_preference_command,
};
use vozen_store::{SqliteStore, UserEngine, VoiceEffect};

use crate::system_now_ms;

pub struct VoicePreferenceGatewaySink {
    service: VoicePreferenceService,
    localizer: VoiceResponseLocalizer,
    displays: VoiceDisplayCatalog,
    available_models: Vec<String>,
}

impl VoicePreferenceGatewaySink {
    pub fn new(
        store: Arc<Mutex<SqliteStore>>,
        settings: VoicePreferenceSettings,
    ) -> Result<Self, GatewayEventDispatchError> {
        let available_models = settings.available_models.clone();
        Ok(Self {
            service: VoicePreferenceService::new(store, settings),
            localizer: VoiceResponseLocalizer::from_generated_contract()
                .map_err(|_| GatewayEventDispatchError)?,
            displays: VoiceDisplayCatalog::from_generated_contract()
                .map_err(|_| GatewayEventDispatchError)?,
            available_models,
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
}

fn is_promoted(command: &VoicePreferenceCommand) -> bool {
    matches!(
        command,
        VoicePreferenceCommand::Reset
            | VoicePreferenceCommand::Set { .. }
            | VoicePreferenceCommand::Detection { .. }
            | VoicePreferenceCommand::OptOut
            | VoicePreferenceCommand::OptIn
            | VoicePreferenceCommand::Nickname { .. }
            | VoicePreferenceCommand::Effect { .. }
    )
}

fn engine_label(engine: UserEngine) -> &'static str {
    match engine {
        UserEngine::Google => "google",
        UserEngine::Piper => "piper",
        UserEngine::Kokoro => "kokoro",
        UserEngine::Gcloud => "gcloud",
    }
}

fn effect_label(effect: VoiceEffect) -> &'static str {
    match effect {
        VoiceEffect::None => "None (normal)",
        VoiceEffect::Robot => "🤖 Robot",
        VoiceEffect::Echo => "🔊 Echo",
        VoiceEffect::Deep => "🕳️ Deep",
        VoiceEffect::Chipmunk => "🐿️ Chipmunk",
        VoiceEffect::Radio => "📻 Radio",
        VoiceEffect::Phone => "📞 Phone",
        VoiceEffect::Underwater => "🌊 Underwater",
        VoiceEffect::Demon => "😈 Demon",
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for VoicePreferenceGatewaySink {
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
            parse_voice_preference_command(&command.data).map_err(|_| GatewayEventDispatchError)?
        else {
            return Ok(());
        };
        if !is_promoted(&parsed) {
            return Ok(());
        }
        command
            .defer_ephemeral(&context)
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        let guild_id = command.guild_id.map(|id| id.get().to_string());
        let user_id = command.user.id.get().to_string();
        let guild_locale = command.guild_locale.as_deref();
        let outcome = self.service.execute(
            VoicePreferenceInvocation {
                guild_id: guild_id.as_deref(),
                user_id: &user_id,
                now_ms: system_now_ms(),
            },
            parsed,
        );
        let mut parameters = BTreeMap::new();
        let key = match outcome {
            VoicePreferenceOutcome::SavedVoice {
                model,
                speed,
                engine,
            } => {
                parameters.insert(
                    "name",
                    self.displays
                        .voice_name(Some(&command.locale), &self.available_models, &model),
                );
                parameters.insert("model", model);
                parameters.insert("speed", speed.to_string());
                parameters.insert("engine", engine_label(engine).to_owned());
                "voice.set"
            }
            VoicePreferenceOutcome::Reset => "voice.reset",
            VoicePreferenceOutcome::Detection { enabled: true } => "voice.detection.on",
            VoicePreferenceOutcome::Detection { enabled: false } => "voice.detection.off",
            VoicePreferenceOutcome::OptedOut => "voice.optout",
            VoicePreferenceOutcome::OptedIn => "voice.optin",
            VoicePreferenceOutcome::NicknameSet { nickname } => {
                parameters.insert("name", nickname);
                "voice.nickname.set"
            }
            VoicePreferenceOutcome::NicknameCleared => "voice.nickname.cleared",
            VoicePreferenceOutcome::InvalidNickname => "voice.nickname.invalid",
            VoicePreferenceOutcome::EffectSet { effect } => {
                parameters.insert("effect", effect_label(effect).to_owned());
                "voice.effect.set"
            }
            VoicePreferenceOutcome::EffectCleared => "voice.effect.cleared",
            VoicePreferenceOutcome::PremiumEffectLocked { effect } => {
                parameters.insert("effect", effect_label(effect).to_owned());
                "voice.effect.locked"
            }
            VoicePreferenceOutcome::UnknownModel => "voice.unknownModel",
            VoicePreferenceOutcome::InvalidSpeed => "voice.badSpeed",
            VoicePreferenceOutcome::PremiumEngineLocked {
                engine: UserEngine::Kokoro,
            } => "voice.engine.kokoroLocked",
            VoicePreferenceOutcome::PremiumEngineLocked {
                engine: UserEngine::Gcloud,
            } => "voice.engine.gcloudLocked",
            // Any other condition is a malformed command or an unavailable dependency. Keep
            // the response generic rather than leaking storage/provider detail.
            VoicePreferenceOutcome::InvalidEngine
            | VoicePreferenceOutcome::InvalidEffect
            | VoicePreferenceOutcome::PremiumEngineLocked { .. }
            | VoicePreferenceOutcome::GuildRequired
            | VoicePreferenceOutcome::StoreUnavailable => "error.generic",
        };
        let content = self.message(key, &command.locale, guild_locale, &parameters)?;
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
    fn only_textual_preference_leaves_can_be_claimed() {
        assert!(is_promoted(&VoicePreferenceCommand::Reset));
        assert!(is_promoted(&VoicePreferenceCommand::Set {
            model: "en_US-amy-medium".into(),
            speed: None,
            engine: None,
        }));
        assert!(is_promoted(&VoicePreferenceCommand::Effect {
            effect: "robot".into()
        }));
    }

    #[test]
    fn preserves_the_node_engine_tokens_in_a_voice_set_response() {
        assert_eq!(engine_label(UserEngine::Google), "google");
        assert_eq!(engine_label(UserEngine::Piper), "piper");
        assert_eq!(engine_label(UserEngine::Kokoro), "kokoro");
        assert_eq!(engine_label(UserEngine::Gcloud), "gcloud");
    }
}
