//! Store-backed preparation shared by future message and command adapters.
//!
//! This is deliberately still free of Serenity events and audio playback.  It is the one place
//! where the durable Node-compatible settings are combined with the pure core pipeline, so a
//! gateway handler cannot accidentally use a different precedence for `/tts` and auto-read.

use vozen_core::{
    CleanTextOptions, GcloudBudget, GcloudBudgetScope, MediaAnnouncement, SpeechPreparationInput,
    SynthRequest, SynthesisEngine, VoicePreference, has_readable_text, prepare_speech,
    redact_blocked, redact_request,
};
use vozen_store::{ChannelProfile, GuildConfig, SqliteStore, StoreError, VoiceEffect};

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
    /// Explicit commands bypass per-channel profiles; passive auto-read uses them.
    pub use_channel_profile: bool,
    /// Private user-app tools must not inherit a server's shared pronunciation dictionary.
    pub include_server_pronunciations: bool,
    pub user_id: &'a str,
    pub raw: &'a str,
    /// Explicit tools such as `/tts-file` can use a product-specific cap. `None` retains the
    /// inherited channel/guild max character setting.
    pub max_chars_override: Option<usize>,
    pub available_models: &'a [String],
    pub runtime_default_voice: &'a str,
    pub runtime_default_speed: f64,
    /// Runtime configuration behind legacy `google` preferences. The Rust canary currently
    /// supports Piper only, but this value remains explicit so it cannot silently drift.
    pub runtime_default_engine: SynthesisEngine,
    /// Must be absent unless the caller has already checked the user's opt-in setting.
    pub detected_language: Option<&'a str>,
    pub announce_speaker: Option<&'a str>,
    pub media: &'a [MediaAnnouncement],
    pub resolve_user: &'a (dyn Fn(&str) -> String + Send + Sync),
    pub resolve_channel: &'a (dyn Fn(&str) -> String + Send + Sync),
}

/// Private user content after the safe cleaning step.  The gateway is deliberately unable to
/// construct this itself: only this module can turn raw Discord text into a request candidate.
pub struct MessageSpeechDraft {
    cleaned: String,
    guild: GuildConfig,
    profile: Option<ChannelProfile>,
}

impl MessageSpeechDraft {
    pub fn rate_per_min(&self) -> i64 {
        self.guild.rate_per_min
    }

    pub fn antispam(&self) -> bool {
        self.guild.antispam
    }

    pub fn cleaned_text(&self) -> &str {
        &self.cleaned
    }
}

/// Resolves the configuration needed for cleaning and rejects an empty body before a caller
/// spends its rate-limit token.  The remaining persisted transformations happen in
/// [`finish_message_speech`] so the legacy ordering remains exact.
pub fn begin_message_speech(
    store: &SqliteStore,
    input: &MessagePreparationInput<'_>,
) -> Result<Result<MessageSpeechDraft, MessagePreparationOutcome>, StoreError> {
    let guild = store.guild_config(input.guild_id)?;
    let profile = if input.use_channel_profile {
        store.channel_profile(input.guild_id, input.channel_id)?
    } else {
        None
    };
    let max_chars = input.max_chars_override.unwrap_or_else(|| {
        profile
            .as_ref()
            .and_then(|profile| profile.max_chars)
            .unwrap_or(guild.max_chars)
            .max(0) as usize
    });
    let cleaned = vozen_core::clean_text(
        input.raw,
        &CleanTextOptions {
            max_chars,
            resolve_user: input.resolve_user,
            resolve_channel: input.resolve_channel,
        },
    );
    if !has_readable_text(&cleaned) && input.media.is_empty() {
        return Ok(Err(MessagePreparationOutcome::Empty));
    }
    Ok(Ok(MessageSpeechDraft {
        cleaned,
        guild,
        profile,
    }))
}

/// Completes preparation after the caller has accepted the message's rate-limit cost.
pub fn finish_message_speech(
    store: &SqliteStore,
    input: MessagePreparationInput<'_>,
    draft: MessageSpeechDraft,
) -> Result<MessagePreparationOutcome, StoreError> {
    let blocklist = store.get_blocklist(input.guild_id)?;
    // Do this before speaker/media decoration. A message made solely of blocked words must not
    // turn into "Alice said" and look like it was accepted.
    if input.media.is_empty() && !has_readable_text(&redact_blocked(&draft.cleaned, &blocklist)) {
        return Ok(MessagePreparationOutcome::FullyBlocked);
    }

    let user_voice = store.get_user_voice(input.guild_id, input.user_id)?;
    let user_pronunciations = store.get_user_pronunciations(input.user_id)?;
    let server_pronunciations = if input.include_server_pronunciations {
        store.get_server_pronunciations(input.guild_id)?
    } else {
        Vec::new()
    };
    let configured_voice = draft
        .profile
        .as_ref()
        .and_then(|profile| non_empty(profile.default_voice.as_deref()))
        .or_else(|| non_empty(Some(draft.guild.default_voice.as_str())))
        .or_else(|| locale_voice(draft.profile.as_ref(), input.available_models));
    let profile_speed = draft.profile.as_ref().and_then(|profile| profile.speed);
    let voice_preference = user_voice.as_ref().map(|voice| VoicePreference {
        model: voice.model.clone(),
        speed: voice.speed,
        engine: synthesis_engine(voice.engine),
    });
    let pronunciations = user_pronunciations
        .into_iter()
        .chain(server_pronunciations)
        .collect::<Vec<_>>();
    let prepared = prepare_speech(SpeechPreparationInput {
        personal: &draft.cleaned,
        pronunciations: &pronunciations,
        user_voice: voice_preference.as_ref(),
        available_models: input.available_models,
        guild_default_voice: configured_voice,
        channel_engine: draft
            .profile
            .as_ref()
            .and_then(|profile| profile.engine)
            .map(synthesis_engine),
        default_voice: input.runtime_default_voice,
        default_speed: profile_speed.unwrap_or(input.runtime_default_speed),
        default_engine: input.runtime_default_engine,
        auto_detect: store.is_detection_on(input.guild_id, input.user_id)?,
        detected_language: input.detected_language,
        announce_speaker: input.announce_speaker,
        media: input.media,
    });
    let mut request = redact_request(&prepared.request, &blocklist);
    request.gcloud_budget = gcloud_budget_for(
        store,
        input.guild_id,
        input.user_id,
        request.engine,
        system_now_ms(),
    );
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

/// Resolves the same paid-pool precedence as the Node engine resolver. Returning `None` is
/// intentional: the Google adapter must reject before network I/O when entitlement lookup fails.
pub fn gcloud_budget_for(
    store: &SqliteStore,
    guild_id: &str,
    user_id: &str,
    engine: SynthesisEngine,
    now_ms: i64,
) -> Option<GcloudBudget> {
    if engine != SynthesisEngine::Gcloud {
        return None;
    }
    if store.is_user_premium(user_id, now_ms).unwrap_or(false) {
        return Some(GcloudBudget {
            scope: GcloudBudgetScope::User,
            key: user_id.to_owned(),
            seats: None,
        });
    }
    if let Some(owner) = store
        .resolve_guild_pass_owner(guild_id, now_ms)
        .ok()
        .flatten()
    {
        return Some(GcloudBudget {
            scope: GcloudBudgetScope::Pass,
            key: owner.owner_id,
            seats: Some(owner.seats),
        });
    }
    if store.is_guild_premium(guild_id, now_ms).unwrap_or(false) {
        return Some(GcloudBudget {
            scope: GcloudBudgetScope::Guild,
            key: guild_id.to_owned(),
            seats: None,
        });
    }
    None
}

fn system_now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(i64::MAX as u128) as i64
}

fn synthesis_engine(engine: vozen_store::UserEngine) -> SynthesisEngine {
    match engine {
        vozen_store::UserEngine::Google => SynthesisEngine::Default,
        vozen_store::UserEngine::Piper => SynthesisEngine::Piper,
        vozen_store::UserEngine::Kokoro => SynthesisEngine::Kokoro,
        vozen_store::UserEngine::Gcloud => SynthesisEngine::Gcloud,
    }
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
    match begin_message_speech(store, &input)? {
        Ok(draft) => finish_message_speech(store, input, draft),
        Err(outcome) => Ok(outcome),
    }
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
            use_channel_profile: true,
            include_server_pronunciations: true,
            user_id: "user",
            raw: "hello <@42>",
            max_chars_override: None,
            available_models: models,
            runtime_default_voice: "en_US-amy-medium",
            runtime_default_speed: 1.0,
            runtime_default_engine: SynthesisEngine::Piper,
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
