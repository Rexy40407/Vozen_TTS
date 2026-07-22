//! SQLite-backed policy for the mutation-only subset of `/voice`.
//!
//! Outcomes are semantic and content-free.  Discord adapters own localization and responses,
//! while this layer makes the authorization and persistence decisions testable before cutover.

use std::sync::{Arc, Mutex};

use vozen_store::{SqliteStore, UserEngine, UserVoice, VoiceEffect};

use crate::VoicePreferenceCommand;

#[derive(Debug, Clone)]
pub struct VoicePreferenceSettings {
    pub available_models: Vec<String>,
    pub default_speed: f64,
}

pub struct VoicePreferenceInvocation<'a> {
    pub guild_id: Option<&'a str>,
    pub user_id: &'a str,
    pub now_ms: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub enum VoicePreferenceOutcome {
    SavedVoice {
        model: String,
        speed: f64,
        engine: UserEngine,
    },
    Reset,
    Detection {
        enabled: bool,
    },
    OptedOut,
    OptedIn,
    NicknameSet {
        nickname: String,
    },
    NicknameCleared,
    EffectSet {
        effect: VoiceEffect,
    },
    EffectCleared,
    UnknownModel,
    InvalidSpeed,
    InvalidEngine,
    InvalidNickname,
    InvalidEffect,
    PremiumEngineLocked {
        engine: UserEngine,
    },
    PremiumEffectLocked {
        effect: VoiceEffect,
    },
    GuildRequired,
    StoreUnavailable,
}

pub struct VoicePreferenceService {
    store: Arc<Mutex<SqliteStore>>,
    settings: VoicePreferenceSettings,
}

impl VoicePreferenceService {
    #[must_use]
    pub fn new(store: Arc<Mutex<SqliteStore>>, settings: VoicePreferenceSettings) -> Self {
        Self { store, settings }
    }

    pub fn execute(
        &self,
        invocation: VoicePreferenceInvocation<'_>,
        command: VoicePreferenceCommand,
    ) -> VoicePreferenceOutcome {
        let Some(guild_id) = invocation.guild_id else {
            return VoicePreferenceOutcome::GuildRequired;
        };
        let store = match self.store.lock() {
            Ok(store) => store,
            Err(_) => return VoicePreferenceOutcome::StoreUnavailable,
        };
        match command {
            VoicePreferenceCommand::Set {
                model,
                speed,
                engine,
            } => self.set_voice(
                &store,
                guild_id,
                invocation.user_id,
                invocation.now_ms,
                model,
                speed,
                engine,
            ),
            VoicePreferenceCommand::Reset => {
                match store.reset_user_voice(guild_id, invocation.user_id) {
                    Ok(()) => VoicePreferenceOutcome::Reset,
                    Err(_) => VoicePreferenceOutcome::StoreUnavailable,
                }
            }
            VoicePreferenceCommand::Detection { enabled } => {
                match store.set_detection_on(guild_id, invocation.user_id, enabled) {
                    Ok(()) => VoicePreferenceOutcome::Detection { enabled },
                    Err(_) => VoicePreferenceOutcome::StoreUnavailable,
                }
            }
            VoicePreferenceCommand::OptOut => match store.set_opt_out(guild_id, invocation.user_id)
            {
                Ok(()) => VoicePreferenceOutcome::OptedOut,
                Err(_) => VoicePreferenceOutcome::StoreUnavailable,
            },
            VoicePreferenceCommand::OptIn => match store.set_opt_in(guild_id, invocation.user_id) {
                Ok(()) => VoicePreferenceOutcome::OptedIn,
                Err(_) => VoicePreferenceOutcome::StoreUnavailable,
            },
            VoicePreferenceCommand::Nickname { nickname } => {
                self.set_nickname(&store, guild_id, invocation.user_id, nickname)
            }
            VoicePreferenceCommand::Effect { effect } => self.set_effect(
                &store,
                guild_id,
                invocation.user_id,
                invocation.now_ms,
                effect,
            ),
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn set_voice(
        &self,
        store: &SqliteStore,
        guild_id: &str,
        user_id: &str,
        now_ms: i64,
        model: String,
        speed: Option<f64>,
        engine: Option<String>,
    ) -> VoicePreferenceOutcome {
        if !self
            .settings
            .available_models
            .iter()
            .any(|available| available == &model)
        {
            return VoicePreferenceOutcome::UnknownModel;
        }
        // Node rejects an explicit out-of-range input, but preserves its historic clamp for an
        // operator-configured default. This prevents an omitted speed from failing because of a
        // deployment configuration mistake.
        let speed = match speed {
            Some(speed) if speed.is_finite() && (0.5..=2.0).contains(&speed) => speed,
            Some(_) => return VoicePreferenceOutcome::InvalidSpeed,
            None if self.settings.default_speed.is_finite() => {
                self.settings.default_speed.clamp(0.5, 2.0)
            }
            None => 1.0,
        };
        let current_engine = match store.get_user_voice(guild_id, user_id) {
            Ok(Some(voice)) => voice.engine,
            Ok(None) => UserEngine::Google,
            Err(_) => return VoicePreferenceOutcome::StoreUnavailable,
        };
        let engine = match engine {
            Some(engine) => match parse_engine(&engine) {
                Some(engine) => engine,
                None => return VoicePreferenceOutcome::InvalidEngine,
            },
            None => current_engine,
        };
        if is_premium_engine(engine) {
            let unlocked = store.is_user_premium(user_id, now_ms).and_then(|user| {
                store
                    .is_guild_premium(guild_id, now_ms)
                    .map(|guild| user || guild)
            });
            match unlocked {
                Ok(true) => {}
                Ok(false) => return VoicePreferenceOutcome::PremiumEngineLocked { engine },
                Err(_) => return VoicePreferenceOutcome::StoreUnavailable,
            }
        }
        let voice = UserVoice {
            model: model.clone(),
            speed,
            engine,
        };
        match store.set_user_voice(guild_id, user_id, &voice) {
            Ok(()) => match store.record_recent_voice(user_id, &model, now_ms) {
                Ok(()) => VoicePreferenceOutcome::SavedVoice {
                    model,
                    speed,
                    engine,
                },
                Err(_) => VoicePreferenceOutcome::StoreUnavailable,
            },
            Err(_) => VoicePreferenceOutcome::StoreUnavailable,
        }
    }

    fn set_nickname(
        &self,
        store: &SqliteStore,
        guild_id: &str,
        user_id: &str,
        nickname: Option<String>,
    ) -> VoicePreferenceOutcome {
        let Some(nickname) = nickname.map(|nickname| sanitize_nickname(&nickname)) else {
            return match store.clear_nickname(guild_id, user_id) {
                Ok(()) => VoicePreferenceOutcome::NicknameCleared,
                Err(_) => VoicePreferenceOutcome::StoreUnavailable,
            };
        };
        if nickname.is_empty() {
            return VoicePreferenceOutcome::InvalidNickname;
        }
        match store.set_nickname(guild_id, user_id, &nickname) {
            Ok(()) => VoicePreferenceOutcome::NicknameSet { nickname },
            Err(_) => VoicePreferenceOutcome::StoreUnavailable,
        }
    }

    fn set_effect(
        &self,
        store: &SqliteStore,
        guild_id: &str,
        user_id: &str,
        now_ms: i64,
        value: String,
    ) -> VoicePreferenceOutcome {
        let Some(effect) = parse_effect(&value) else {
            return VoicePreferenceOutcome::InvalidEffect;
        };
        if is_premium_effect(effect) {
            let unlocked = store.is_user_premium(user_id, now_ms).and_then(|user| {
                store
                    .is_guild_premium(guild_id, now_ms)
                    .map(|guild| user || guild)
            });
            match unlocked {
                Ok(true) => {}
                Ok(false) => return VoicePreferenceOutcome::PremiumEffectLocked { effect },
                Err(_) => return VoicePreferenceOutcome::StoreUnavailable,
            }
        }
        match store.set_voice_effect(guild_id, user_id, effect) {
            Ok(()) if effect == VoiceEffect::None => VoicePreferenceOutcome::EffectCleared,
            Ok(()) => VoicePreferenceOutcome::EffectSet { effect },
            Err(_) => VoicePreferenceOutcome::StoreUnavailable,
        }
    }
}

fn parse_engine(value: &str) -> Option<UserEngine> {
    Some(match value {
        "google" => UserEngine::Google,
        "piper" => UserEngine::Piper,
        "kokoro" => UserEngine::Kokoro,
        "gcloud" => UserEngine::Gcloud,
        _ => return None,
    })
}

fn is_premium_engine(engine: UserEngine) -> bool {
    matches!(engine, UserEngine::Kokoro | UserEngine::Gcloud)
}

fn parse_effect(value: &str) -> Option<VoiceEffect> {
    Some(match value {
        "none" => VoiceEffect::None,
        "robot" => VoiceEffect::Robot,
        "echo" => VoiceEffect::Echo,
        "deep" => VoiceEffect::Deep,
        "chipmunk" => VoiceEffect::Chipmunk,
        "radio" => VoiceEffect::Radio,
        "phone" => VoiceEffect::Phone,
        "underwater" => VoiceEffect::Underwater,
        "demon" => VoiceEffect::Demon,
        _ => return None,
    })
}

fn is_premium_effect(effect: VoiceEffect) -> bool {
    !matches!(
        effect,
        VoiceEffect::None | VoiceEffect::Robot | VoiceEffect::Echo
    )
}

/// Mirrors Node's `sanitizeSpeakerName`: retain pronounceable Unicode letters/numbers and soft
/// separators, normalize decoration to spaces, collapse whitespace, and cap at 40 characters.
/// Accents must survive unchanged, otherwise a Portuguese or Spanish name becomes a different
/// spoken identity merely because the preference was written through Rust.
fn sanitize_nickname(value: &str) -> String {
    let characters = value.chars().collect::<Vec<_>>();
    let mut normalized = String::new();
    let mut index = 0;
    while index < characters.len() {
        if let Some(length) = custom_emoji_length(&characters[index..]) {
            normalized.push(' ');
            index += length;
            continue;
        }
        let character = characters[index];
        normalized.push(if character == '_' {
            ' '
        } else if character.is_alphanumeric()
            || character.is_whitespace()
            || matches!(character, '-' | '\'' | '’')
        {
            character
        } else {
            ' '
        });
        index += 1;
    }
    let collapsed = normalized.split_whitespace().collect::<Vec<_>>().join(" ");
    let truncated = collapsed.chars().take(40).collect::<String>();
    if truncated.chars().any(char::is_alphanumeric) {
        truncated
    } else {
        String::new()
    }
}

/// Detects Discord's `<:name:123>` and `<a:name:123>` markup so its readable identifiers do
/// not accidentally become part of a spoken nickname.  This is intentionally narrower than
/// removing arbitrary angle-bracket text, matching Node's custom-emoji-specific replacement.
fn custom_emoji_length(input: &[char]) -> Option<usize> {
    if input.first() != Some(&'<') {
        return None;
    }
    let end = input.iter().position(|character| *character == '>')?;
    let mut body = &input[1..end];
    if body.first() == Some(&'a') {
        body = &body[1..];
    }
    let (colon, rest) = body.split_first()?;
    if *colon != ':' {
        return None;
    }
    let separator = rest.iter().position(|character| *character == ':')?;
    let (name, id_with_colon) = rest.split_at(separator);
    let id = &id_with_colon[1..];
    (!name.is_empty()
        && name
            .iter()
            .all(|character| character.is_ascii_alphanumeric() || *character == '_')
        && !id.is_empty()
        && id.iter().all(|character| character.is_ascii_digit()))
    .then_some(end + 1)
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 1_700_000_000_000;

    fn service() -> (Arc<Mutex<SqliteStore>>, VoicePreferenceService) {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let settings = VoicePreferenceSettings {
            available_models: vec!["en_US-amy-medium".into(), "pt_PT-tugao-medium".into()],
            default_speed: 1.0,
        };
        (store.clone(), VoicePreferenceService::new(store, settings))
    }

    fn invocation() -> VoicePreferenceInvocation<'static> {
        VoicePreferenceInvocation {
            guild_id: Some("guild"),
            user_id: "user",
            now_ms: NOW,
        }
    }

    #[test]
    fn saves_only_available_models_valid_speeds_and_preserves_the_existing_engine() {
        let (store, service) = service();
        store
            .lock()
            .expect("store")
            .set_user_voice(
                "guild",
                "user",
                &UserVoice {
                    model: "en_US-amy-medium".into(),
                    speed: 1.0,
                    engine: UserEngine::Piper,
                },
            )
            .expect("seed");
        assert_eq!(
            service.execute(
                invocation(),
                VoicePreferenceCommand::Set {
                    model: "pt_PT-tugao-medium".into(),
                    speed: Some(1.2),
                    engine: None
                }
            ),
            VoicePreferenceOutcome::SavedVoice {
                model: "pt_PT-tugao-medium".into(),
                speed: 1.2,
                engine: UserEngine::Piper
            }
        );
        assert_eq!(
            store
                .lock()
                .expect("store")
                .list_recent_voices("user")
                .expect("recent voices"),
            ["pt_PT-tugao-medium"]
        );
        assert_eq!(
            service.execute(
                invocation(),
                VoicePreferenceCommand::Set {
                    model: "missing".into(),
                    speed: None,
                    engine: None
                }
            ),
            VoicePreferenceOutcome::UnknownModel
        );
        assert_eq!(
            service.execute(
                invocation(),
                VoicePreferenceCommand::Set {
                    model: "en_US-amy-medium".into(),
                    speed: Some(2.1),
                    engine: None
                }
            ),
            VoicePreferenceOutcome::InvalidSpeed
        );
    }

    #[test]
    fn premium_choices_fail_closed_until_a_current_entitlement_exists() {
        let (store, service) = service();
        assert_eq!(
            service.execute(
                invocation(),
                VoicePreferenceCommand::Set {
                    model: "en_US-amy-medium".into(),
                    speed: None,
                    engine: Some("kokoro".into())
                }
            ),
            VoicePreferenceOutcome::PremiumEngineLocked {
                engine: UserEngine::Kokoro
            }
        );
        assert_eq!(
            service.execute(
                invocation(),
                VoicePreferenceCommand::Effect {
                    effect: "deep".into()
                }
            ),
            VoicePreferenceOutcome::PremiumEffectLocked {
                effect: VoiceEffect::Deep
            }
        );
        store
            .lock()
            .expect("store")
            .grant_user_premium("user", 1, "test", NOW)
            .expect("premium");
        assert!(matches!(
            service.execute(
                invocation(),
                VoicePreferenceCommand::Set {
                    model: "en_US-amy-medium".into(),
                    speed: None,
                    engine: Some("kokoro".into())
                }
            ),
            VoicePreferenceOutcome::SavedVoice {
                engine: UserEngine::Kokoro,
                ..
            }
        ));
        assert_eq!(
            service.execute(
                invocation(),
                VoicePreferenceCommand::Effect {
                    effect: "deep".into()
                }
            ),
            VoicePreferenceOutcome::EffectSet {
                effect: VoiceEffect::Deep
            }
        );
    }

    #[test]
    fn non_sensitive_preferences_are_guild_scoped_and_require_a_guild() {
        let (_store, service) = service();
        assert_eq!(
            service.execute(
                VoicePreferenceInvocation {
                    guild_id: None,
                    user_id: "user",
                    now_ms: NOW
                },
                VoicePreferenceCommand::OptOut,
            ),
            VoicePreferenceOutcome::GuildRequired
        );
        assert_eq!(
            service.execute(
                invocation(),
                VoicePreferenceCommand::Detection { enabled: true }
            ),
            VoicePreferenceOutcome::Detection { enabled: true }
        );
        assert_eq!(
            service.execute(
                invocation(),
                VoicePreferenceCommand::Nickname {
                    nickname: Some("Rexy_404 ✨ João".into())
                }
            ),
            VoicePreferenceOutcome::NicknameSet {
                nickname: "Rexy 404 João".into()
            }
        );
        assert_eq!(
            service.execute(
                invocation(),
                VoicePreferenceCommand::Effect {
                    effect: "robot".into()
                }
            ),
            VoicePreferenceOutcome::EffectSet {
                effect: VoiceEffect::Robot
            }
        );
    }

    #[test]
    fn nickname_sanitization_preserves_accents_and_removes_discord_decoration() {
        assert_eq!(
            sanitize_nickname("<a:party_fox:123> _João_ ★ L'Été"),
            "João L'Été"
        );
        assert_eq!(sanitize_nickname("✨"), "");
    }
}
