//! Transport-free adapter for the four `QuizGame`-style games.
//!
//! The pure core validates answers and owns scores. This layer owns only the lifecycle that the
//! Node `QuizGame` used to provide: a bounded round list, a deadline per open round, semantic
//! i18n keys for feedback, and the deliberate voice request for each prompt.

use vozen_core::{TextQuizEvent, TextQuizGame};

use crate::{GameDriver, GameDriverAction, GameMessage};

const ROUND_MS: i64 = 25_000;
const FAST_SPEECH_MS: i64 = 20_000;
const FAST_SPEECH_RATIO: f64 = 0.7;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextQuizMode {
    Spelling,
    SpellOut,
    AccentSwap,
    FastSpeech,
}

impl TextQuizMode {
    fn round_key(self) -> &'static str {
        match self {
            Self::Spelling => "game.spelling.round",
            Self::SpellOut => "game.spellOut.round",
            Self::AccentSwap => "game.accentSwap.round",
            Self::FastSpeech => "game.fastSpeech.round",
        }
    }

    fn correct_key(self) -> &'static str {
        match self {
            Self::Spelling => "game.spelling.correct",
            Self::SpellOut => "game.spellOut.correct",
            Self::AccentSwap => "game.accentSwap.correct",
            Self::FastSpeech => "game.fastSpeech.correct",
        }
    }

    fn timeout_key(self) -> &'static str {
        match self {
            Self::Spelling => "game.spelling.timeout",
            Self::SpellOut => "game.spellOut.timeout",
            Self::AccentSwap => "game.accentSwap.timeout",
            Self::FastSpeech => "game.fastSpeech.timeout",
        }
    }

    fn round_ms(self) -> i64 {
        if matches!(self, Self::FastSpeech) {
            FAST_SPEECH_MS
        } else {
            ROUND_MS
        }
    }

    fn speech_speed(self) -> Option<f64> {
        matches!(self, Self::FastSpeech).then_some(2.0)
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum TextQuizDriverAction {
    Ignored,
    RoundOpened {
        round: u8,
        total: u8,
        prompt: String,
        announce_key: &'static str,
        model: Option<String>,
        speed: Option<f64>,
    },
    Accepted {
        user_id: String,
        name: String,
        answer: String,
        correct_key: &'static str,
    },
    TimedOut {
        answer: String,
        timeout_key: &'static str,
    },
    Finished,
}

#[derive(Debug)]
pub struct TextQuizDriver {
    mode: TextQuizMode,
    game: TextQuizGame,
    model: Option<String>,
    deadline_ms: Option<i64>,
}

/// Adapter that lets [`TextQuizDriver`] run inside the generic [`crate::GameManager`]. Semantic
/// quiz actions are retained for the gateway, while accepted answers additionally become the
/// generic score award consumed by the manager.
pub struct TextQuizGameDriver {
    inner: TextQuizDriver,
}

impl TextQuizGameDriver {
    #[must_use]
    pub fn new(mode: TextQuizMode, prompts: Vec<(String, String)>, model: Option<String>) -> Self {
        Self {
            inner: TextQuizDriver::new(mode, prompts, model),
        }
    }

    #[must_use]
    pub fn inner(&self) -> &TextQuizDriver {
        &self.inner
    }
}

impl GameDriver for TextQuizGameDriver {
    fn on_start(&mut self, now_ms: i64) -> Vec<GameDriverAction> {
        to_manager_actions(self.inner.start(now_ms))
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

fn to_manager_actions(action: TextQuizDriverAction) -> Vec<GameDriverAction> {
    match action.clone() {
        TextQuizDriverAction::Accepted { user_id, .. } => vec![
            GameDriverAction::Award {
                user_id: user_id.clone(),
                points: 1,
            },
            GameDriverAction::TextQuiz(action),
        ],
        TextQuizDriverAction::Finished => {
            vec![
                GameDriverAction::TextQuiz(action),
                GameDriverAction::Finished,
            ]
        }
        other => vec![GameDriverAction::TextQuiz(other)],
    }
}

impl TextQuizDriver {
    #[must_use]
    pub fn new(mode: TextQuizMode, prompts: Vec<(String, String)>, model: Option<String>) -> Self {
        Self {
            mode,
            game: TextQuizGame::new(prompts),
            model,
            deadline_ms: None,
        }
    }

    #[must_use]
    pub fn mode(&self) -> TextQuizMode {
        self.mode
    }

    #[must_use]
    pub fn deadline_ms(&self) -> Option<i64> {
        self.deadline_ms
    }

    /// Opens the first round. `now_ms` is supplied by the runtime's monotonic clock.
    pub fn start(&mut self, now_ms: i64) -> TextQuizDriverAction {
        self.open_next(now_ms)
    }

    pub fn answer(
        &mut self,
        now_ms: i64,
        user_id: &str,
        name: &str,
        raw: &str,
    ) -> Vec<TextQuizDriverAction> {
        let event = if matches!(self.mode, TextQuizMode::FastSpeech) {
            self.game
                .answer_with_jaccard(user_id, name, raw, FAST_SPEECH_RATIO)
        } else {
            self.game.answer(user_id, name, raw)
        };
        match event {
            TextQuizEvent::Accepted {
                user_id,
                name,
                answer,
            } => {
                self.deadline_ms = None;
                vec![
                    TextQuizDriverAction::Accepted {
                        user_id,
                        name,
                        answer,
                        correct_key: self.mode.correct_key(),
                    },
                    self.open_next(now_ms),
                ]
            }
            TextQuizEvent::Finished { .. } => {
                self.deadline_ms = None;
                vec![TextQuizDriverAction::Finished]
            }
            TextQuizEvent::Wrong | TextQuizEvent::Invalid | TextQuizEvent::Closed => {
                vec![TextQuizDriverAction::Ignored]
            }
            TextQuizEvent::RoundOpened { .. } | TextQuizEvent::TimedOut { .. } => {
                // `answer` never opens or times out a round; keeping this branch explicit makes
                // the mapping exhaustive if the core event enum gains another transition.
                vec![TextQuizDriverAction::Ignored]
            }
        }
    }

    /// Resolves a due round. A stale tick is a no-op, so an old timer cannot advance a newer
    /// round after a correct answer.
    pub fn tick(&mut self, now_ms: i64) -> Vec<TextQuizDriverAction> {
        let Some(deadline) = self.deadline_ms else {
            return vec![TextQuizDriverAction::Ignored];
        };
        if now_ms < deadline {
            return vec![TextQuizDriverAction::Ignored];
        }
        self.deadline_ms = None;
        match self.game.timeout() {
            TextQuizEvent::TimedOut { answer } => vec![
                TextQuizDriverAction::TimedOut {
                    answer,
                    timeout_key: self.mode.timeout_key(),
                },
                self.open_next(now_ms),
            ],
            TextQuizEvent::Closed => vec![TextQuizDriverAction::Ignored],
            _ => vec![TextQuizDriverAction::Ignored],
        }
    }

    #[must_use]
    pub fn scores(&self) -> Vec<vozen_core::TextQuizScore> {
        self.game.scoreboard()
    }

    fn open_next(&mut self, now_ms: i64) -> TextQuizDriverAction {
        match self.game.begin_round() {
            TextQuizEvent::RoundOpened {
                round,
                total,
                prompt,
            } => {
                self.deadline_ms = Some(now_ms.saturating_add(self.mode.round_ms()));
                TextQuizDriverAction::RoundOpened {
                    round,
                    total,
                    prompt,
                    announce_key: self.mode.round_key(),
                    model: self.model.clone(),
                    speed: self.mode.speech_speed(),
                }
            }
            TextQuizEvent::Finished { .. } => {
                self.deadline_ms = None;
                TextQuizDriverAction::Finished
            }
            TextQuizEvent::Accepted { .. }
            | TextQuizEvent::Wrong
            | TextQuizEvent::Invalid
            | TextQuizEvent::Closed
            | TextQuizEvent::TimedOut { .. } => TextQuizDriverAction::Ignored,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{GameManager, GameManagerEvent, GameMessage, GameSession, StartGameResult};

    #[test]
    fn opens_rounds_with_mode_specific_voice_and_deadline() {
        let mut driver = TextQuizDriver::new(
            TextQuizMode::FastSpeech,
            vec![("the cat sat".into(), "the cat sat".into())],
            Some("en_US-model".into()),
        );
        assert_eq!(
            driver.start(1_000),
            TextQuizDriverAction::RoundOpened {
                round: 1,
                total: 1,
                prompt: "the cat sat".into(),
                announce_key: "game.fastSpeech.round",
                model: Some("en_US-model".into()),
                speed: Some(2.0),
            }
        );
        assert_eq!(driver.deadline_ms(), Some(21_000));
    }

    #[test]
    fn correct_answer_advances_and_final_tick_finishes_without_ghost_round() {
        let mut driver = TextQuizDriver::new(
            TextQuizMode::Spelling,
            vec![("computer".into(), "computer".into())],
            None,
        );
        assert!(matches!(
            driver.start(0),
            TextQuizDriverAction::RoundOpened { .. }
        ));
        let actions = driver.answer(100, "u1", "Ana", "COMPUTER");
        assert!(matches!(actions[0], TextQuizDriverAction::Accepted { .. }));
        assert!(matches!(actions[1], TextQuizDriverAction::Finished));
        assert_eq!(driver.tick(100_000), vec![TextQuizDriverAction::Ignored]);
        assert_eq!(driver.scores()[0].points, 1);
    }

    #[test]
    fn timeout_reveals_answer_then_opens_the_next_round() {
        let mut driver = TextQuizDriver::new(
            TextQuizMode::AccentSwap,
            vec![
                ("bonjour".into(), "bonjour".into()),
                ("hola".into(), "hola".into()),
            ],
            None,
        );
        let _ = driver.start(0);
        assert!(matches!(
            driver.tick(24_999).as_slice(),
            [TextQuizDriverAction::Ignored]
        ));
        let actions = driver.tick(25_000);
        assert!(matches!(
            actions.as_slice(),
            [
                TextQuizDriverAction::TimedOut { answer, .. },
                TextQuizDriverAction::RoundOpened { round: 2, .. }
            ] if answer == "bonjour"
        ));
    }

    #[test]
    fn fast_speech_uses_the_node_jaccard_threshold() {
        let mut driver = TextQuizDriver::new(
            TextQuizMode::FastSpeech,
            vec![(
                "the cat sat on the mat".into(),
                "the cat sat on the mat".into(),
            )],
            None,
        );
        let _ = driver.start(0);
        let actions = driver.answer(1, "u", "Rexy", "the cat sat on mat");
        assert!(matches!(actions[0], TextQuizDriverAction::Accepted { .. }));
    }

    #[test]
    fn manager_adapter_turns_acceptance_into_a_persistable_score() {
        let mut manager = GameManager::new();
        let session = GameSession {
            guild_id: "guild".into(),
            channel_id: "game".into(),
            game_id: "spelling".into(),
            starter_id: "starter".into(),
            locale: "en".into(),
            needs_voice: true,
            parent_channel_id: None,
            scores: Vec::new(),
        };
        let (status, initial) = manager.start_at(
            session,
            Box::new(TextQuizGameDriver::new(
                TextQuizMode::Spelling,
                vec![("computer".into(), "computer".into())],
                None,
            )),
            0,
        );
        assert_eq!(status, StartGameResult::Started);
        assert!(matches!(
            initial.as_slice(),
            [GameDriverAction::TextQuiz(
                TextQuizDriverAction::RoundOpened { .. }
            )]
        ));
        let event = manager.handle_message(&GameMessage {
            guild_id: "guild".into(),
            channel_id: "game".into(),
            author_id: "u1".into(),
            author_name: "Ana".into(),
            content: "computer".into(),
            can_trigger_speech: true,
        });
        assert!(matches!(
            event,
            Some(GameManagerEvent::Finished { session, .. })
                if session.scores.iter().any(|score| score.user_id == "u1" && score.points == 1)
        ));
    }

    #[test]
    fn manager_adapter_uses_message_clock_for_the_next_deadline() {
        let mut manager = GameManager::new();
        let session = GameSession {
            guild_id: "guild".into(),
            channel_id: "game".into(),
            game_id: "spelling".into(),
            starter_id: "starter".into(),
            locale: "en".into(),
            needs_voice: true,
            parent_channel_id: None,
            scores: Vec::new(),
        };
        let (_, initial) = manager.start_at(
            session,
            Box::new(TextQuizGameDriver::new(
                TextQuizMode::Spelling,
                vec![
                    ("first".into(), "first".into()),
                    ("second".into(), "second".into()),
                ],
                None,
            )),
            10_000,
        );
        assert!(matches!(
            initial.as_slice(),
            [GameDriverAction::TextQuiz(
                TextQuizDriverAction::RoundOpened { .. }
            )]
        ));
        let event = manager.handle_message_at(
            &GameMessage {
                guild_id: "guild".into(),
                channel_id: "game".into(),
                author_id: "u1".into(),
                author_name: "Ana".into(),
                content: "first".into(),
                can_trigger_speech: true,
            },
            20_000,
        );
        assert!(matches!(event, Some(GameManagerEvent::Consumed { .. })));
        assert!(matches!(
            manager.advance(44_999).as_slice(),
            [GameManagerEvent::Consumed { .. }]
        ));
        assert!(matches!(
            manager.advance(45_000).as_slice(),
            [GameManagerEvent::Finished { .. }]
        ));
    }

    #[test]
    fn empty_quiz_finishes_during_start_without_a_ghost_session() {
        let mut manager = GameManager::new();
        let session = GameSession {
            guild_id: "guild".into(),
            channel_id: "game".into(),
            game_id: "spelling".into(),
            starter_id: "starter".into(),
            locale: "en".into(),
            needs_voice: false,
            parent_channel_id: None,
            scores: Vec::new(),
        };
        let (status, actions) = manager.start_at(
            session,
            Box::new(TextQuizGameDriver::new(
                TextQuizMode::Spelling,
                Vec::new(),
                None,
            )),
            0,
        );
        assert_eq!(status, StartGameResult::Started);
        assert!(matches!(
            actions.as_slice(),
            [
                GameDriverAction::TextQuiz(TextQuizDriverAction::Finished),
                GameDriverAction::Finished
            ]
        ));
        assert!(!manager.active("guild"));
    }
}
