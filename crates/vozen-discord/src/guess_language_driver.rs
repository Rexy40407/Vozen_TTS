//! Lifecycle adapter for Guess the Language.

use std::collections::BTreeMap;

use vozen_core::{GuessLanguageEvent, GuessLanguageGame, LanguagePrompt};

use crate::{GameAnnouncementAction, GameDriver, GameDriverAction, GameMessage};

const ROUND_MS: i64 = 25_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GuessLanguageDriverAction {
    RoundOpened {
        round: u8,
        total: u8,
        phrase: String,
        language: String,
        model: Option<String>,
    },
    Accepted {
        user_id: String,
        name: String,
        language: String,
    },
    TimedOut {
        language: String,
    },
    Finished,
    Ignored,
}

#[derive(Debug)]
pub struct GuessLanguageDriver {
    game: GuessLanguageGame,
    models: Vec<Option<String>>,
    deadline_ms: Option<i64>,
}

pub struct GuessLanguageGameDriver {
    inner: GuessLanguageDriver,
}

impl GuessLanguageGameDriver {
    #[must_use]
    pub fn new(prompts: Vec<LanguagePrompt>, models: Vec<Option<String>>) -> Self {
        Self {
            inner: GuessLanguageDriver::new(prompts, models),
        }
    }

    #[must_use]
    pub fn inner(&self) -> &GuessLanguageDriver {
        &self.inner
    }
}

impl GameDriver for GuessLanguageGameDriver {
    fn on_start(&mut self, now_ms: i64) -> Vec<GameDriverAction> {
        let rounds = self.inner.game.rounds();
        let round_actions = self.inner.start(now_ms);
        if rounds == 0 {
            return round_actions
                .into_iter()
                .flat_map(to_manager_actions)
                .collect();
        }
        let mut parameters = BTreeMap::new();
        parameters.insert("rounds", rounds.to_string());
        let mut actions = vec![GameDriverAction::Announcement(
            GameAnnouncementAction::message("game.guessLanguage.intro", parameters),
        )];
        actions.extend(round_actions.into_iter().flat_map(to_manager_actions));
        actions
    }

    fn on_message(&mut self, message: &GameMessage) -> Vec<GameDriverAction> {
        self.on_message_at(message, 0)
    }

    fn on_message_at(&mut self, message: &GameMessage, now_ms: i64) -> Vec<GameDriverAction> {
        self.inner
            .answer(
                now_ms,
                &message.author_id,
                &message.author_name,
                &message.content,
            )
            .into_iter()
            .flat_map(to_manager_actions)
            .collect()
    }

    fn on_tick(&mut self, now_ms: i64) -> Vec<GameDriverAction> {
        self.inner
            .tick(now_ms)
            .into_iter()
            .flat_map(to_manager_actions)
            .collect()
    }
}

fn to_manager_actions(action: GuessLanguageDriverAction) -> Vec<GameDriverAction> {
    let award = match &action {
        GuessLanguageDriverAction::Accepted { user_id, .. } => Some(user_id.clone()),
        _ => None,
    };
    let finished = matches!(action, GuessLanguageDriverAction::Finished);
    let mut actions = Vec::new();
    if let Some(user_id) = award {
        actions.push(GameDriverAction::Award { user_id, points: 1 });
    }
    actions.push(GameDriverAction::GuessLanguage(action));
    if finished {
        actions.push(GameDriverAction::Finished);
    }
    actions
}

impl GuessLanguageDriver {
    #[must_use]
    pub fn new(prompts: Vec<LanguagePrompt>, models: Vec<Option<String>>) -> Self {
        Self {
            game: GuessLanguageGame::new(prompts),
            models,
            deadline_ms: None,
        }
    }

    #[must_use]
    pub fn deadline_ms(&self) -> Option<i64> {
        self.deadline_ms
    }

    pub fn start(&mut self, now_ms: i64) -> Vec<GuessLanguageDriverAction> {
        vec![self.open_next(now_ms)]
    }

    pub fn answer(
        &mut self,
        now_ms: i64,
        user_id: &str,
        name: &str,
        raw: &str,
    ) -> Vec<GuessLanguageDriverAction> {
        match self.game.answer(user_id, name, raw) {
            GuessLanguageEvent::Accepted {
                user_id,
                name,
                language,
            } => {
                self.deadline_ms = None;
                vec![
                    GuessLanguageDriverAction::Accepted {
                        user_id,
                        name,
                        language,
                    },
                    self.open_next(now_ms),
                ]
            }
            GuessLanguageEvent::Wrong
            | GuessLanguageEvent::Invalid
            | GuessLanguageEvent::Closed => vec![GuessLanguageDriverAction::Ignored],
            GuessLanguageEvent::RoundOpened { .. }
            | GuessLanguageEvent::TimedOut { .. }
            | GuessLanguageEvent::Finished { .. } => vec![GuessLanguageDriverAction::Ignored],
        }
    }

    pub fn tick(&mut self, now_ms: i64) -> Vec<GuessLanguageDriverAction> {
        let Some(deadline) = self.deadline_ms else {
            return vec![GuessLanguageDriverAction::Ignored];
        };
        if now_ms < deadline {
            return vec![GuessLanguageDriverAction::Ignored];
        }
        self.deadline_ms = None;
        let timeout = self.game.timeout();
        let GuessLanguageEvent::TimedOut { language } = timeout else {
            return vec![GuessLanguageDriverAction::Ignored];
        };
        vec![
            GuessLanguageDriverAction::TimedOut { language },
            self.open_next(now_ms),
        ]
    }

    fn open_next(&mut self, now_ms: i64) -> GuessLanguageDriverAction {
        match self.game.begin_round() {
            GuessLanguageEvent::RoundOpened {
                round,
                total,
                phrase,
            } => {
                self.deadline_ms = Some(now_ms.saturating_add(ROUND_MS));
                let prompt = self.game.current_prompt();
                GuessLanguageDriverAction::RoundOpened {
                    round,
                    total,
                    phrase,
                    language: prompt.map_or_else(String::new, |p| p.language.clone()),
                    model: prompt
                        .and_then(|_| self.models.get((round - 1) as usize))
                        .cloned()
                        .flatten(),
                }
            }
            GuessLanguageEvent::Finished { .. } => {
                self.deadline_ms = None;
                GuessLanguageDriverAction::Finished
            }
            GuessLanguageEvent::Accepted { .. }
            | GuessLanguageEvent::Wrong
            | GuessLanguageEvent::Invalid
            | GuessLanguageEvent::Closed
            | GuessLanguageEvent::TimedOut { .. } => GuessLanguageDriverAction::Ignored,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{GameManager, GameManagerEvent, GameSession, StartGameResult};

    fn prompt() -> LanguagePrompt {
        LanguagePrompt {
            phrase: "hola mundo".into(),
            language: "Spanish".into(),
            accepted_answers: vec!["es".into(), "spanish".into()],
        }
    }

    #[test]
    fn opens_with_the_matching_model_and_advances_after_a_correct_answer() {
        let mut driver =
            GuessLanguageDriver::new(vec![prompt(), prompt()], vec![Some("es-model".into())]);
        assert!(matches!(
            driver.start(0).as_slice(),
            [GuessLanguageDriverAction::RoundOpened { round: 1, total: 2, model: Some(model), language, .. }]
                if model == "es-model" && language == "Spanish"
        ));
        assert_eq!(driver.deadline_ms(), Some(25_000));
        assert!(matches!(
            driver.answer(1_000, "u", "Rexy", "spanish").as_slice(),
            [
                GuessLanguageDriverAction::Accepted { .. },
                GuessLanguageDriverAction::RoundOpened {
                    round: 2,
                    model: None,
                    ..
                }
            ]
        ));
    }

    #[test]
    fn timeout_reveals_the_language_and_empty_content_finishes() {
        let mut driver = GuessLanguageDriver::new(vec![prompt()], Vec::new());
        let _ = driver.start(0);
        assert!(matches!(
            driver.tick(25_000).as_slice(),
            [GuessLanguageDriverAction::TimedOut { language }, GuessLanguageDriverAction::Finished]
                if language == "Spanish"
        ));
        assert_eq!(driver.deadline_ms(), None);
        let mut empty = GuessLanguageDriver::new(Vec::new(), Vec::new());
        assert_eq!(empty.start(0), vec![GuessLanguageDriverAction::Finished]);
    }

    #[test]
    fn manager_adapter_awards_a_correct_language_answer() {
        let mut manager = GameManager::new();
        let session = GameSession {
            guild_id: "guild".into(),
            channel_id: "game".into(),
            game_id: "guess-language".into(),
            starter_id: "starter".into(),
            locale: "en".into(),
            needs_voice: true,
            parent_channel_id: None,
            scores: Vec::new(),
        };
        let (status, _) = manager.start_at(
            session,
            Box::new(GuessLanguageGameDriver::new(vec![prompt()], Vec::new())),
            0,
        );
        assert_eq!(status, StartGameResult::Started);
        assert!(matches!(
            manager.handle_message_at(&GameMessage {
                guild_id: "guild".into(),
                channel_id: "game".into(),
                author_id: "u".into(),
                author_name: "Rexy".into(),
                content: "es".into(),
                can_trigger_speech: true,
            }, 1_000),
            Some(GameManagerEvent::Finished { session, .. })
                if session.scores.iter().any(|score| score.user_id == "u" && score.points == 1)
        ));
    }
}
