//! Store-backed preparation shared by future message and command adapters.
//!
//! This is deliberately still free of Serenity events and audio playback.  It is the one place
//! where the durable Node-compatible settings are combined with the pure core pipeline, so a
//! gateway handler cannot accidentally use a different precedence for `/tts` and auto-read.

use vozen_core::{
    CleanTextOptions, MediaAnnouncement, SpeechPreparationInput, SynthRequest, VoicePreference,
    has_readable_text, prepare_speech, redact_blocked, redact_request,
};
use vozen_store::{ChannelProfile, SqliteStore, StoreError, VoiceEffect};

#[derive(Debug, Clone, PartialEq)]
pub struct PreparedMessageSpeech {
    pub request: SynthRequest,
    /// A stored personal preference is returned as data only.  Premium entitlement and audio
    /// filter support must be checked by the playback adapter before it can alter a WAV.
    pub personal_effect: VoiceEffect,
}

#[derive(Debug, Clone, PartialEq)]
pub enum MessagePreparationOutcome {
    Ready(PreparedMessageSpeech),
    Empty,
    FullyBlocked,
}

/// Inputs that are intentionally not persisted: Discord cache name resolution, an optional
/// consented language result, and the media actually attached to this one message.
pub struct MessagePreparationInput<'a> {
    pub guild_id: &'a str,
    pub channel_id: &'a str,
    pub user_id: &'a str,
    pub raw: &'a str,
    pub available_models: &'a [String],
    pub runtime_default_voice: &'a str,
    pub runtime_default_speed: f64,
    /// Must be absent unless the caller has already checked the user's opt-in setting.
    pub detected_language: Option<&'a str>,
    pub announce_speaker: Option<&'a str>,
    pub media: &'a [MediaAnnouncement],
    pub resolve_user: &'a dyn Fn(&str) -> String,
    pub resolve_channel: &'a dyn Fn(&str) -> String,
}

/// Applies the current Node precedence exactly once:
///
/// user voice > channel voice > guild voice > channel locale voice > runtime default,
/// and user speed > channel speed > runtime default.  Pronunciations remain personal first,
/// then server-wide.  A blocklist redacts speech rather than dropping a whole mixed message.
pub fn prepare_message_speech(
    store: &SqliteStore,
    input: MessagePreparationInput<'_>,
) -> Result<MessagePreparationOutcome, StoreError> {
    let guild = store.guild_config(input.guild_id)?;
    let profile = store.channel_profile(input.guild_id, input.channel_id)?;
    let max_chars = profile
        .as_ref()
        .and_then(|profile| profile.max_chars)
        .unwrap_or(guild.max_chars)
        .max(0) as usize;
    let cleaned = vozen_core::clean_text(
        input.raw,
        &CleanTextOptions {
            max_chars,
            resolve_user: input.resolve_user,
            resolve_channel: input.resolve_channel,
        },
    );
    if !has_readable_text(&cleaned) && input.media.is_empty() {
        return Ok(MessagePreparationOutcome::Empty);
    }

    let blocklist = store.get_blocklist(input.guild_id)?;
    // Do this before speaker/media decoration. A message made solely of blocked words must not
    // turn into "Alice said" and look like it was accepted.
    if input.media.is_empty() && !has_readable_text(&redact_blocked(&cleaned, &blocklist)) {
        return Ok(MessagePreparationOutcome::FullyBlocked);
    }

    let user_voice = store.get_user_voice(input.guild_id, input.user_id)?;
    let user_pronunciations = store.get_user_pronunciations(input.user_id)?;
    let server_pronunciations = store.get_server_pronunciations(input.guild_id)?;
    let configured_voice = profile
        .as_ref()
        .and_then(|profile| non_empty(profile.default_voice.as_deref()))
        .or_else(|| non_empty(Some(guild.default_voice.as_str())))
        .or_else(|| locale_voice(profile.as_ref(), input.available_models));
    let profile_speed = profile.as_ref().and_then(|profile| profile.speed);
    let voice_preference = user_voice.as_ref().map(|voice| VoicePreference {
        model: voice.model.clone(),
        speed: voice.speed,
    });
    let pronunciations = user_pronunciations
        .into_iter()
        .chain(server_pronunciations)
        .collect::<Vec<_>>();
    let prepared = prepare_speech(SpeechPreparationInput {
        personal: &cleaned,
        pronunciations: &pronunciations,
        user_voice: voice_preference.as_ref(),
        available_models: input.available_models,
        guild_default_voice: configured_voice,
        default_voice: input.runtime_default_voice,
        default_speed: profile_speed.unwrap_or(input.runtime_default_speed),
        auto_detect: store.is_detection_on(input.guild_id, input.user_id)?,
        detected_language: input.detected_language,
        announce_speaker: input.announce_speaker,
        media: input.media,
    });
    let request = redact_request(&prepared.request, &blocklist);
    if !has_readable_text(&request.text)
        && !request.segments.as_deref().is_some_and(|segments| {
            segments
                .iter()
                .any(|segment| has_readable_text(&segment.text))
        })
    {
        return Ok(MessagePreparationOutcome::FullyBlocked);
    }

    Ok(MessagePreparationOutcome::Ready(PreparedMessageSpeech {
        request,
        personal_effect: store.voice_effect(input.guild_id, input.user_id)?,
    }))
}

fn non_empty(value: Option<&str>) -> Option<&str> {
    value.filter(|value| !value.is_empty())
}

fn locale_voice<'a>(
    profile: Option<&ChannelProfile>,
    available_models: &'a [String],
) -> Option<&'a str> {
    let locale = profile
        .and_then(|profile| profile.locale.as_deref())?
        .to_ascii_lowercase();
    available_models
        .iter()
        .find(|model| {
            let model = model.to_ascii_lowercase();
            model.starts_with(&format!("{locale}_")) || model.starts_with(&format!("{locale}-"))
        })
        .map(String::as_str)
}

#[cfg(test)]
mod tests {
    use super::*;
    use vozen_core::MediaAnnouncementKind;
    use vozen_store::{ChannelProfilePatch, GuildConfigPatch, UserEngine, UserVoice};

    fn models() -> Vec<String> {
        vec![
            "en_US-amy-medium".into(),
            "pt_PT-tugao-medium".into(),
            "es_ES-sharvard-medium".into(),
        ]
    }

    fn input<'a>(models: &'a [String]) -> MessagePreparationInput<'a> {
        MessagePreparationInput {
            guild_id: "guild",
            channel_id: "channel",
            user_id: "user",
            raw: "hello <@42>",
            available_models: models,
            runtime_default_voice: "en_US-amy-medium",
            runtime_default_speed: 1.0,
            detected_language: None,
            announce_speaker: None,
            media: &[],
            resolve_user: &|id| format!("user-{id}"),
            resolve_channel: &|id| format!("channel-{id}"),
        }
    }

    #[test]
    fn persistent_preferences_have_one_tested_precedence() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .update_guild_config(
                "guild",
                GuildConfigPatch {
                    default_voice: Some("en_US-amy-medium".into()),
                    ..GuildConfigPatch::default()
                },
            )
            .expect("guild config");
        store
            .save_channel_profile(
                "guild",
                "channel",
                &ChannelProfilePatch {
                    default_voice: Some("pt_PT-tugao-medium".into()),
                    speed: Some(1.3),
                    ..ChannelProfilePatch::default()
                },
            )
            .expect("profile");
        store
            .set_user_voice(
                "guild",
                "user",
                &UserVoice {
                    model: "es_ES-sharvard-medium".into(),
                    speed: 0.8,
                    engine: UserEngine::Piper,
                },
            )
            .expect("voice");
        store
            .add_user_pronunciation("user", "hello", "hola", 3)
            .expect("user pronunciation");
        store
            .add_server_pronunciation("guild", "user-42", "friend", 3)
            .expect("server pronunciation");

        let available = models();
        let MessagePreparationOutcome::Ready(prepared) =
            prepare_message_speech(&store, input(&available)).expect("prepare")
        else {
            panic!("prepared request expected");
        };
        assert_eq!(prepared.request.model, "es_ES-sharvard-medium");
        assert_eq!(prepared.request.speed, 0.8);
        assert_eq!(prepared.request.text, "hola friend");
    }

    #[test]
    fn channel_locale_is_only_a_fallback_after_explicit_defaults() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .save_channel_profile(
                "guild",
                "channel",
                &ChannelProfilePatch {
                    locale: Some("pt".into()),
                    ..ChannelProfilePatch::default()
                },
            )
            .expect("profile");
        let available = models();
        let mut request = input(&available);
        request.raw = "olá";
        request.runtime_default_voice = "";
        let MessagePreparationOutcome::Ready(prepared) =
            prepare_message_speech(&store, request).expect("prepare")
        else {
            panic!("prepared request expected");
        };
        assert_eq!(prepared.request.model, "pt_PT-tugao-medium");
    }

    #[test]
    fn blocklist_redacts_mixed_text_and_drops_a_fully_blocked_body() {
        let store = SqliteStore::open_in_memory().expect("store");
        store.add_blockword("guild", "secret").expect("block");
        let available = models();
        let mut mixed = input(&available);
        mixed.raw = "secret hello";
        let MessagePreparationOutcome::Ready(prepared) =
            prepare_message_speech(&store, mixed).expect("mixed")
        else {
            panic!("mixed speech should remain");
        };
        assert_eq!(prepared.request.text, "hello");

        let mut blocked = input(&available);
        blocked.raw = "secret";
        assert_eq!(
            prepare_message_speech(&store, blocked).expect("blocked"),
            MessagePreparationOutcome::FullyBlocked
        );
    }

    #[test]
    fn media_is_speakable_without_a_text_body() {
        let store = SqliteStore::open_in_memory().expect("store");
        let available = models();
        let media = [MediaAnnouncement {
            kind: MediaAnnouncementKind::Gif,
            text: None,
        }];
        let mut request = input(&available);
        request.raw = "";
        request.media = &media;
        let MessagePreparationOutcome::Ready(prepared) =
            prepare_message_speech(&store, request).expect("media")
        else {
            panic!("media should be announced");
        };
        assert!(prepared.request.text.contains("gif"));
    }
}
