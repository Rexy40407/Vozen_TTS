//! Opt-in Discord adapter for private `/tts-file` exports.
//!
//! This adapter is intentionally independent of Songbird and voice-state membership: exporting a
//! private attachment is not speaking in a call. It only claims a contract-valid `/tts-file`
//! interaction after `RUST_TTS_FILE_ENABLED=true`; all other traffic remains with Node.

use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
};

use serenity::{
    builder::{CreateAttachment, EditInteractionResponse},
    client::Context,
    model::application::Interaction,
};
use vozen_discord::{
    GatewayEventDispatchError, GatewayEventSink, TtsFileExportInvocation, TtsFileExportOutcome,
    TtsFileExportService, VoiceResponseLocalizer, parse_tts_file_command,
};
use vozen_store::SqliteStore;

use crate::{
    TtsFileRuntimeOptions, engine_router::PerUserCommandSynthesizer,
    piper_adapter::PiperCommandSynthesizer, system_now_ms,
};

pub struct TtsFileGatewaySink {
    service: TtsFileExportService<PerUserCommandSynthesizer>,
    localizer: VoiceResponseLocalizer,
}

impl TtsFileGatewaySink {
    pub fn new(
        store: Arc<Mutex<SqliteStore>>,
        options: TtsFileRuntimeOptions,
    ) -> Result<Self, GatewayEventDispatchError> {
        let synthesizer =
            PerUserCommandSynthesizer::piper_only(PiperCommandSynthesizer::production(
                options.piper_path,
                options.models_dir,
                options.cache_dir,
                options.piper_concurrency,
            ));
        let localizer = VoiceResponseLocalizer::from_generated_contract()
            .map_err(|_| GatewayEventDispatchError)?;
        Ok(Self {
            service: TtsFileExportService::new(
                store,
                synthesizer,
                options.settings,
                Arc::new(system_now_ms),
            ),
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
}

#[async_trait::async_trait]
impl GatewayEventSink for TtsFileGatewaySink {
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
            parse_tts_file_command(&command.data).map_err(|_| GatewayEventDispatchError)?
        else {
            return Ok(());
        };
        // The parser runs before defer, so an interaction outside this exact promotion boundary
        // stays unclaimed for the Node process.
        command
            .defer_ephemeral(&context)
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        let guild_id = command.guild_id.map(|id| id.get().to_string());
        let preference_scope = guild_id.as_deref().unwrap_or("@user-app");
        let user_id = command.user.id.get().to_string();
        let outcome = self
            .service
            .execute(TtsFileExportInvocation {
                guild_id: guild_id.as_deref(),
                preference_scope,
                user_id: &user_id,
                raw: &parsed.text,
            })
            .await;
        let parameters = BTreeMap::new();
        let guild_locale = command.guild_locale.as_deref();
        let content = match &outcome {
            TtsFileExportOutcome::TooLong => {
                let mut parameters = BTreeMap::new();
                parameters.insert("max", vozen_discord::MAX_TTS_FILE_CHARS.to_string());
                self.message(
                    "ttsFile.tooLong",
                    &command.locale,
                    guild_locale,
                    &parameters,
                )?
            }
            TtsFileExportOutcome::Empty => self.message(
                "tts.nothingToRead",
                &command.locale,
                guild_locale,
                &parameters,
            )?,
            TtsFileExportOutcome::RateLimited => {
                self.message("tts.tooFast", &command.locale, guild_locale, &parameters)?
            }
            TtsFileExportOutcome::FullyBlocked => {
                self.message("tts.blocked", &command.locale, guild_locale, &parameters)?
            }
            TtsFileExportOutcome::VoiceUnavailable => self.message(
                "ttsFile.unavailable",
                &command.locale,
                guild_locale,
                &parameters,
            )?,
            TtsFileExportOutcome::SynthesisFailed | TtsFileExportOutcome::StoreUnavailable => {
                self.message("ttsFile.failed", &command.locale, guild_locale, &parameters)?
            }
            TtsFileExportOutcome::Ready(_) => {
                self.message("ttsFile.ready", &command.locale, guild_locale, &parameters)?
            }
        };
        let response = match outcome {
            TtsFileExportOutcome::Ready(path) => {
                // Piper returns an internal cache path. Serenity reads it into the HTTP upload;
                // do not delete that cache entry, and do not create a second temporary copy.
                let attachment = match CreateAttachment::path(path).await {
                    Ok(mut attachment) => {
                        // Keep Node's stable download name instead of exposing the cache key.
                        attachment.filename = "vozen-audio.wav".to_owned();
                        attachment
                    }
                    Err(_) => {
                        let failed = self.message(
                            "ttsFile.failed",
                            &command.locale,
                            guild_locale,
                            &BTreeMap::new(),
                        )?;
                        command
                            .edit_response(&context, EditInteractionResponse::new().content(failed))
                            .await
                            .map_err(|_| GatewayEventDispatchError)?;
                        return Ok(());
                    }
                };
                EditInteractionResponse::new()
                    .content(content)
                    .new_attachment(attachment)
            }
            _ => EditInteractionResponse::new().content(content),
        };
        command
            .edit_response(&context, response)
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        Ok(())
    }

    async fn on_guild_delete(&self, guild_id: &str) -> Result<(), GatewayEventDispatchError> {
        self.service.forget_scope(guild_id);
        Ok(())
    }
}
