use rusqlite::{OptionalExtension, params};

use crate::{SqliteStore, StoreError};

/// The persisted effect vocabulary is shared with Node's `tts/effects.ts`. Effects remain a
/// preference here; Premium authorization is checked by the command/TTS layer, never trusted
/// from this stored value.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VoiceEffect {
    None,
    Robot,
    Echo,
    Deep,
    Chipmunk,
    Radio,
    Phone,
    Underwater,
    Demon,
}

impl VoiceEffect {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::Robot => "robot",
            Self::Echo => "echo",
            Self::Deep => "deep",
            Self::Chipmunk => "chipmunk",
            Self::Radio => "radio",
            Self::Phone => "phone",
            Self::Underwater => "underwater",
            Self::Demon => "demon",
        }
    }

    fn parse(value: &str) -> Option<Self> {
        Some(match value {
            "none" => Self::None,
            "robot" => Self::Robot,
            "echo" => Self::Echo,
            "deep" => Self::Deep,
            "chipmunk" => Self::Chipmunk,
            "radio" => Self::Radio,
            "phone" => Self::Phone,
            "underwater" => Self::Underwater,
            "demon" => Self::Demon,
            _ => return None,
        })
    }
}

impl SqliteStore {
    /// Missing or legacy-invalid values are deliberately a clean voice, matching Node's fail-safe
    /// behaviour rather than passing a new/unknown filter to audio processing.
    pub fn voice_effect(&self, guild_id: &str, user_id: &str) -> Result<VoiceEffect, StoreError> {
        self.connection()
            .query_row(
                "SELECT effect FROM user_effect WHERE guild_id = ?1 AND user_id = ?2",
                params![guild_id, user_id],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map(|effect| {
                effect
                    .and_then(|effect| VoiceEffect::parse(&effect))
                    .unwrap_or(VoiceEffect::None)
            })
            .map_err(StoreError::from)
    }

    pub fn set_voice_effect(
        &self,
        guild_id: &str,
        user_id: &str,
        effect: VoiceEffect,
    ) -> Result<(), StoreError> {
        if effect == VoiceEffect::None {
            return self.clear_voice_effect(guild_id, user_id);
        }
        self.connection().execute(
            "INSERT INTO user_effect (guild_id, user_id, effect) VALUES (?1, ?2, ?3)\n             ON CONFLICT(guild_id, user_id) DO UPDATE SET effect = excluded.effect",
            params![guild_id, user_id, effect.as_str()],
        )?;
        Ok(())
    }

    pub fn clear_voice_effect(&self, guild_id: &str, user_id: &str) -> Result<(), StoreError> {
        self.connection().execute(
            "DELETE FROM user_effect WHERE guild_id = ?1 AND user_id = ?2",
            params![guild_id, user_id],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn effects_are_scoped_and_unknown_legacy_values_fail_to_clean_audio() {
        let store = SqliteStore::open_in_memory().expect("open store");
        store
            .set_voice_effect("guild", "user", VoiceEffect::Robot)
            .expect("save effect");
        assert_eq!(
            store.voice_effect("guild", "user").expect("effect"),
            VoiceEffect::Robot
        );
        assert_eq!(
            store.voice_effect("other", "user").expect("scope"),
            VoiceEffect::None
        );
        store.connection().execute(
            "UPDATE user_effect SET effect = 'obsolete' WHERE guild_id = 'guild' AND user_id = 'user'",
            [],
        ).expect("inject old value");
        assert_eq!(
            store
                .voice_effect("guild", "user")
                .expect("safe legacy effect"),
            VoiceEffect::None
        );
        store
            .set_voice_effect("guild", "user", VoiceEffect::None)
            .expect("clear via none");
        assert_eq!(
            store.voice_effect("guild", "user").expect("cleared effect"),
            VoiceEffect::None
        );
    }
}
