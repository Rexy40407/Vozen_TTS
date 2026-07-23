//! One-shot Roulette (truth-or-dare) game adapter.

use crate::{GameDriver, GameDriverAction, GameMessage};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RouletteDriverAction {
    pub prompt: String,
}

/// A roulette round has no message or timer lifecycle: it emits one prompt and closes.
pub struct RouletteGameDriver {
    prompt: String,
}

impl RouletteGameDriver {
    #[must_use]
    pub fn new(prompt: impl Into<String>) -> Self {
        Self {
            prompt: prompt.into(),
        }
    }
}

impl GameDriver for RouletteGameDriver {
    fn on_start(&mut self, _now_ms: i64) -> Vec<GameDriverAction> {
        vec![
            GameDriverAction::Roulette(RouletteDriverAction {
                prompt: self.prompt.clone(),
            }),
            GameDriverAction::Finished,
        ]
    }

    fn on_message(&mut self, _message: &GameMessage) -> Vec<GameDriverAction> {
        vec![GameDriverAction::Ignored]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{GameManager, GameSession, StartGameResult};

    #[test]
    fn starts_as_a_one_shot_and_releases_the_session_lock() {
        let mut manager = GameManager::new();
        let session = GameSession {
            guild_id: "guild".into(),
            channel_id: "game".into(),
            game_id: "roulette".into(),
            starter_id: "starter".into(),
            locale: "en".into(),
            needs_voice: true,
            parent_channel_id: None,
            scores: Vec::new(),
        };
        let (status, initial) = manager.start_at(
            session,
            Box::new(RouletteGameDriver::new("take a sip of water")),
            0,
        );
        assert_eq!(status, StartGameResult::Started);
        assert!(matches!(
            initial.as_slice(),
            [
                GameDriverAction::Roulette(RouletteDriverAction { prompt }),
                GameDriverAction::Finished
            ] if prompt == "take a sip of water"
        ));
        assert!(!manager.active("guild"));
        assert_eq!(
            manager.handle_message(&GameMessage {
                guild_id: "guild".into(),
                channel_id: "game".into(),
                author_id: "u".into(),
                author_name: "User".into(),
                content: "hello".into(),
                can_trigger_speech: false,
            }),
            None
        );
        assert!(matches!(
            manager.start_at(
                GameSession {
                    guild_id: "guild".into(),
                    channel_id: "game".into(),
                    game_id: "roulette".into(),
                    starter_id: "starter".into(),
                    locale: "en".into(),
                    needs_voice: true,
                    parent_channel_id: None,
                    scores: Vec::new(),
                },
                Box::new(RouletteGameDriver::new("again")),
                0,
            ),
            (StartGameResult::Started, _)
        ));
        assert!(manager.advance(1).is_empty());
    }
}
