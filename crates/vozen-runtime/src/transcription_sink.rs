//! Opt-in message context-menu transcription gateway sink.

use std::sync::{Arc, Mutex};

use serenity::{
    builder::{CreateAllowedMentions, EditInteractionResponse},
    client::Context,
    model::application::Interaction,
};
use vozen_discord::{
    AttachmentTranscriptionLimits, DiscordAudioAttachment, GatewayEventDispatchError,
    GatewayEventSink, parse_transcribe_message_command,
};
use vozen_store::SqliteStore;

use crate::{
    system_now_ms,
    transcription_adapter::{AttachmentTranscriber, TranscriptionError},
};

const FREE_BYTES: u64 = 8 * 1024 * 1024;
const PREMIUM_BYTES: u64 = 20 * 1024 * 1024;
const FREE_SECONDS: u64 = 60;
const PREMIUM_SECONDS: u64 = 120;

pub struct TranscriptionGatewaySink {
    store: Arc<Mutex<SqliteStore>>,
    transcriber: Arc<AttachmentTranscriber>,
}

impl TranscriptionGatewaySink {
    pub fn new(store: Arc<Mutex<SqliteStore>>, transcriber: AttachmentTranscriber) -> Self {
        Self {
            store,
            transcriber: Arc::new(transcriber),
        }
    }

    fn limits(
        &self,
        user_id: &str,
        guild_id: Option<&str>,
    ) -> Result<AttachmentTranscriptionLimits, GatewayEventDispatchError> {
        let now = system_now_ms() / 1_000;
        let store = self.store.lock().map_err(|_| GatewayEventDispatchError)?;
        let user_premium = store
            .is_user_premium(user_id, now)
            .map_err(|_| GatewayEventDispatchError)?;
        let guild_premium = guild_id
            .map(|id| store.is_guild_premium(id, now))
            .transpose()
            .map_err(|_| GatewayEventDispatchError)?
            .unwrap_or(false);
        Ok(if user_premium || guild_premium {
            AttachmentTranscriptionLimits {
                max_bytes: PREMIUM_BYTES,
                max_seconds: PREMIUM_SECONDS,
            }
        } else {
            AttachmentTranscriptionLimits {
                max_bytes: FREE_BYTES,
                max_seconds: FREE_SECONDS,
            }
        })
    }

    fn content(
        result: Result<crate::transcription_adapter::AttachmentTranscript, TranscriptionError>,
    ) -> (String, bool) {
        match result {
            Ok(transcript) if transcript.text.is_empty() => {
                ("No clear speech was found in this audio.".to_owned(), false)
            }
            Ok(transcript) => {
                let language = if transcript.language.is_empty() {
                    String::new()
                } else {
                    format!(" · {}", transcript.language)
                };
                (
                    format!("**Transcript{language}**\n{}", transcript.text),
                    true,
                )
            }
            Err(TranscriptionError::Busy) => (
                "Transcription is busy. Please try again in a moment.".to_owned(),
                false,
            ),
            Err(TranscriptionError::Rejected(reason)) if reason == "duration" => (
                "This audio is longer than the allowed limit.".to_owned(),
                false,
            ),
            Err(TranscriptionError::Rejected(reason)) if reason == "size" => (
                "This audio is larger than the allowed limit.".to_owned(),
                false,
            ),
            Err(TranscriptionError::Rejected(_)) => (
                "Only Discord-hosted MP3, OGG, WAV, M4A or WebM audio is supported.".to_owned(),
                false,
            ),
            Err(TranscriptionError::Unavailable) => (
                "Voice-message transcription is temporarily unavailable.".to_owned(),
                false,
            ),
            Err(TranscriptionError::Processing) => (
                "The audio could not be transcribed. Please try another file.".to_owned(),
                false,
            ),
        }
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for TranscriptionGatewaySink {
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
        let Some(parsed) = parse_transcribe_message_command(&command.data)
            .map_err(|_| GatewayEventDispatchError)?
        else {
            return Ok(());
        };
        command
            .defer_ephemeral(&context)
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        let attachment = parsed.message.attachments.iter().find(|attachment| {
            attachment
                .content_type
                .as_deref()
                .is_some_and(|kind| kind.to_ascii_lowercase().starts_with("audio/"))
        });
        let Some(attachment) = attachment else {
            command
                .edit_response(
                    &context,
                    EditInteractionResponse::new()
                        .content("This message has no supported audio attachment."),
                )
                .await
                .map_err(|_| GatewayEventDispatchError)?;
            return Ok(());
        };
        let limits = self.limits(
            &command.user.id.get().to_string(),
            command.guild_id.map(|id| id.get().to_string()).as_deref(),
        )?;
        let result = self
            .transcriber
            .transcribe(
                DiscordAudioAttachment {
                    url: &attachment.url,
                    content_type: attachment.content_type.as_deref(),
                    size: u64::from(attachment.size),
                },
                limits,
            )
            .await;
        let (content, _success) = Self::content(result);
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
