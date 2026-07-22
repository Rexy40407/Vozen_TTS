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
    GatewayEventDispatchError, GatewayEventSink, VoicePreferenceCommand, VoicePreferenceInvocation,
    VoicePreferenceOutcome, VoicePreferenceService, VoicePreferenceSettings,
    VoiceResponseLocalizer, parse_voice_preference_command,
};
use vozen_store::{SqliteStore, VoiceEffect};

use crate::system_now_ms;

pub struct VoicePreferenceGatewaySink {
    service: VoicePreferenceService,
    localizer: VoiceResponseLocalizer,
}

impl VoicePreferenceGatewaySink {
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            // Promoted leaves do not select a model. An empty catalogue means an accidental
            // future `/voice set` promotion fails closed rather than trusting stale config.
            service: VoicePreferenceService::new(
                store,
                VoicePreferenceSettings {
                    available_models: Vec::new(),
                    default_speed: 1.0,
                },
            ),
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
}

fn is_promoted(command: &VoicePreferenceCommand) -> bool {
    matches!(
        command,
        VoicePreferenceCommand::Reset
            | VoicePreferenceCommand::Detection { .. }
            | VoicePreferenceCommand::OptOut
            | VoicePreferenceCommand::OptIn
            | VoicePreferenceCommand::Nickname { .. }
            | VoicePreferenceCommand::Effect { .. }
    )
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
            // These outcomes are impossible for this promoted subset, or are a fail-closed
            // storage/contract condition. Do not expose implementation detail.
            VoicePreferenceOutcome::SavedVoice { .. }
            | VoicePreferenceOutcome::UnknownModel
            | VoicePreferenceOutcome::InvalidSpeed
            | VoicePreferenceOutcome::InvalidEngine
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
        assert!(is_promoted(&VoicePreferenceCommand::Effect {
            effect: "robot".into()
        }));
        assert!(!is_promoted(&VoicePreferenceCommand::Set {
            model: "en_US-amy-medium".into(),
            speed: None,
            engine: None,
        }));
    }
}
