//! Pure admission gates for `/game play`.
//!
//! This mirrors the Node command's pre-session checks. It is deliberately transport-free so
//! the Discord adapter can enforce the same gates before creating a live game session.

use crate::{GameDefinition, game_by_id};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct GamePlayAdmissionFacts<'a> {
    pub guild_id: Option<&'a str>,
    pub game_id: Option<&'a str>,
    pub bot_voice_channel_id: Option<&'a str>,
    pub active_channel_id: Option<&'a str>,
    pub user_premium: bool,
    pub guild_premium: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GamePlayAdmission {
    GuildOnly,
    PickRequired,
    UnknownGame,
    AlreadyActive,
    VoiceUnavailable,
    PremiumRequired,
    Allowed { game_id: &'static str },
}

#[must_use]
pub fn admit_game_play(facts: GamePlayAdmissionFacts<'_>) -> GamePlayAdmission {
    if facts.guild_id.is_none() {
        return GamePlayAdmission::GuildOnly;
    }

    let Some(game_id) = facts.game_id.map(str::trim).filter(|id| !id.is_empty()) else {
        return GamePlayAdmission::PickRequired;
    };
    let Some(definition) = game_by_id(game_id) else {
        return GamePlayAdmission::UnknownGame;
    };

    if facts.active_channel_id.is_some() {
        return GamePlayAdmission::AlreadyActive;
    }
    if definition.needs_voice && facts.bot_voice_channel_id.is_none() {
        return GamePlayAdmission::VoiceUnavailable;
    }
    if definition.premium && !facts.user_premium && !facts.guild_premium {
        return GamePlayAdmission::PremiumRequired;
    }
    GamePlayAdmission::Allowed {
        game_id: definition.id,
    }
}

#[must_use]
pub fn game_definition(id: &str) -> Option<&'static GameDefinition> {
    game_by_id(id.trim())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn facts() -> GamePlayAdmissionFacts<'static> {
        GamePlayAdmissionFacts {
            guild_id: Some("guild"),
            game_id: Some("headsOrTails"),
            bot_voice_channel_id: Some("voice"),
            active_channel_id: None,
            user_premium: false,
            guild_premium: false,
        }
    }

    #[test]
    fn mirrors_all_pre_session_gates() {
        let mut value = facts();
        value.guild_id = None;
        assert_eq!(admit_game_play(value), GamePlayAdmission::GuildOnly);
        let mut value = facts();
        value.game_id = None;
        assert_eq!(admit_game_play(value), GamePlayAdmission::PickRequired);
        let mut value = facts();
        value.game_id = Some("missing");
        assert_eq!(admit_game_play(value), GamePlayAdmission::UnknownGame);
        let mut value = facts();
        value.active_channel_id = Some("channel");
        assert_eq!(admit_game_play(value), GamePlayAdmission::AlreadyActive);
        let mut value = facts();
        value.bot_voice_channel_id = None;
        assert_eq!(admit_game_play(value), GamePlayAdmission::VoiceUnavailable);
        let mut value = facts();
        value.game_id = Some("wordle");
        assert_eq!(admit_game_play(value), GamePlayAdmission::PremiumRequired);
    }

    #[test]
    fn allows_free_voice_game_with_voice_and_premium_games_with_entitlement() {
        assert_eq!(
            admit_game_play(facts()),
            GamePlayAdmission::Allowed {
                game_id: "headsOrTails"
            }
        );
        let mut value = facts();
        value.game_id = Some("wordle");
        value.guild_premium = true;
        value.bot_voice_channel_id = None;
        assert_eq!(
            admit_game_play(value),
            GamePlayAdmission::Allowed { game_id: "wordle" }
        );
    }
}
