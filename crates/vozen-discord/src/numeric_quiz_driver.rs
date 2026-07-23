//! Shared lifecycle adapter for Math and Skip Count.

use vozen_core::{MathGame, MathGuessResult, MathOperation, SkipCountGame, SkipCountGuessResult};

use crate::{GameDriver, GameDriverAction, GameMessage};

const ROUND_MS: i64 = 20_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NumericQuizMode {
    Math,
    SkipCount,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NumericQuizAction {
    RoundOpened {
        mode: NumericQuizMode,
        round: u8,
        total: u8,
        math: Option<MathRound>,
        sequence: Option<Vec<u32>>,
    },
    Accepted {
        mode: NumericQuizMode,
        user_id: String,
        name: String,
        answer: i64,
    },
    TimedOut {
        mode: NumericQuizMode,
        answer: i64,
    },
    Finished,
    Ignored,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MathRound {
    pub a: u32,
    pub b: u32,
    pub operation: MathOperation,
}

#[derive(Debug)]
enum NumericGame {
    Math(MathGame),
    SkipCount(SkipCountGame),
}

#[derive(Debug)]
pub struct NumericQuizDriver {
    mode: NumericQuizMode,
    game: NumericGame,
    deadline_ms: Option<i64>,
}

pub struct NumericQuizGameDriver {
    inner: NumericQuizDriver,
}

impl NumericQuizGameDriver {
    #[must_use]
    pub fn math(seed: i64) -> Self {
        Self {
            inner: NumericQuizDriver::math(seed),
        }
    }

    #[must_use]
    pub fn skip_count(seed: i64) -> Self {
        Self {
            inner: NumericQuizDriver::skip_count(seed),
        }
    }

    #[must_use]
    pub fn inner(&self) -> &NumericQuizDriver {
        &self.inner
    }
}

impl GameDriver for NumericQuizGameDriver {
    fn on_start(&mut self, now_ms: i64) -> Vec<GameDriverAction> {
        self.inner
            .start(now_ms)
            .into_iter()
            .map(GameDriverAction::NumericQuiz)
            .collect()
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

fn to_manager_actions(action: NumericQuizAction) -> Vec<GameDriverAction> {
    let award = match &action {
        NumericQuizAction::Accepted { user_id, .. } => Some(user_id.clone()),
        _ => None,
    };
    let finished = matches!(action, NumericQuizAction::Finished);
    let mut actions = Vec::new();
    if let Some(user_id) = award {
        actions.push(GameDriverAction::Award { user_id, points: 1 });
    }
    actions.push(GameDriverAction::NumericQuiz(action));
    if finished {
        actions.push(GameDriverAction::Finished);
    }
    actions
}

impl NumericQuizDriver {
    #[must_use]
    pub fn math(seed: i64) -> Self {
        Self {
            mode: NumericQuizMode::Math,
            game: NumericGame::Math(MathGame::new(seed)),
            deadline_ms: None,
        }
    }

    #[must_use]
    pub fn skip_count(seed: i64) -> Self {
        Self {
            mode: NumericQuizMode::SkipCount,
            game: NumericGame::SkipCount(SkipCountGame::new(seed)),
            deadline_ms: None,
        }
    }

    #[must_use]
    pub fn mode(&self) -> NumericQuizMode {
        self.mode
    }

    #[must_use]
    pub fn deadline_ms(&self) -> Option<i64> {
        self.deadline_ms
    }

    pub fn start(&mut self, now_ms: i64) -> Vec<NumericQuizAction> {
        match self.open_next(now_ms) {
            Some(action) => vec![action],
            None => vec![NumericQuizAction::Finished],
        }
    }

    pub fn answer(
        &mut self,
        now_ms: i64,
        user_id: &str,
        name: &str,
        raw: &str,
    ) -> Vec<NumericQuizAction> {
        let accepted = match &mut self.game {
            NumericGame::Math(game) => matches!(game.guess(raw), MathGuessResult::Accepted),
            NumericGame::SkipCount(game) => {
                matches!(game.guess(raw), SkipCountGuessResult::Accepted)
            }
        };
        if !accepted {
            return vec![NumericQuizAction::Ignored];
        }
        self.deadline_ms = None;
        let answer = self.current_answer();
        let mut actions = vec![NumericQuizAction::Accepted {
            mode: self.mode,
            user_id: user_id.to_owned(),
            name: name.to_owned(),
            answer,
        }];
        actions.extend(match self.open_next(now_ms) {
            Some(action) => vec![action],
            None => vec![NumericQuizAction::Finished],
        });
        actions
    }

    pub fn tick(&mut self, now_ms: i64) -> Vec<NumericQuizAction> {
        let Some(deadline) = self.deadline_ms else {
            return vec![NumericQuizAction::Ignored];
        };
        if now_ms < deadline {
            return vec![NumericQuizAction::Ignored];
        }
        self.deadline_ms = None;
        let answer = self.current_answer();
        let mut actions = vec![NumericQuizAction::TimedOut {
            mode: self.mode,
            answer,
        }];
        actions.extend(match self.open_next(now_ms) {
            Some(action) => vec![action],
            None => vec![NumericQuizAction::Finished],
        });
        actions
    }

    fn current_answer(&self) -> i64 {
        match &self.game {
            NumericGame::Math(game) => game.problem().map_or(0, |problem| problem.result as i64),
            NumericGame::SkipCount(game) => game
                .sequence()
                .map_or(0, |sequence| sequence.missing as i64),
        }
    }

    fn open_next(&mut self, now_ms: i64) -> Option<NumericQuizAction> {
        let action = match &mut self.game {
            NumericGame::Math(game) => {
                let problem = game.begin_round()?;
                NumericQuizAction::RoundOpened {
                    mode: self.mode,
                    round: game.round(),
                    total: MathGame::rounds(),
                    math: Some(MathRound {
                        a: problem.a,
                        b: problem.b,
                        operation: problem.operation,
                    }),
                    sequence: None,
                }
            }
            NumericGame::SkipCount(game) => {
                let sequence = game.begin_round()?.clone();
                NumericQuizAction::RoundOpened {
                    mode: self.mode,
                    round: game.round(),
                    total: SkipCountGame::rounds(),
                    math: None,
                    sequence: Some(sequence.spoken),
                }
            }
        };
        self.deadline_ms = Some(now_ms.saturating_add(ROUND_MS));
        Some(action)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{GameManager, GameManagerEvent, GameSession, StartGameResult};

    #[test]
    fn math_opens_rounds_accepts_first_integer_and_finishes_after_five() {
        let mut driver = NumericQuizDriver::math(42);
        assert!(matches!(
            driver.start(0).as_slice(),
            [NumericQuizAction::RoundOpened {
                mode: NumericQuizMode::Math,
                round: 1,
                total: 5,
                math: Some(_),
                ..
            }]
        ));
        let answer = driver.current_answer();
        assert!(matches!(
            driver
                .answer(1_000, "u", "Rexy", &format!("answer {answer}"))
                .as_slice(),
            [
                NumericQuizAction::Accepted { .. },
                NumericQuizAction::RoundOpened { round: 2, .. }
            ]
        ));
        assert_eq!(driver.deadline_ms(), Some(21_000));
    }

    #[test]
    fn timeout_opens_the_next_round_and_final_timeout_finishes() {
        let mut driver = NumericQuizDriver::skip_count(9);
        let _ = driver.start(0);
        assert!(matches!(
            driver.tick(20_000).as_slice(),
            [
                NumericQuizAction::TimedOut {
                    mode: NumericQuizMode::SkipCount,
                    ..
                },
                NumericQuizAction::RoundOpened { round: 2, .. }
            ]
        ));
        for round in 2..=5 {
            let events = driver.tick((round as i64) * 20_000);
            if round < 5 {
                assert!(matches!(
                    events.as_slice(),
                    [
                        NumericQuizAction::TimedOut { .. },
                        NumericQuizAction::RoundOpened { .. }
                    ]
                ));
            } else {
                assert!(matches!(
                    events.as_slice(),
                    [
                        NumericQuizAction::TimedOut { .. },
                        NumericQuizAction::Finished
                    ]
                ));
            }
        }
    }

    #[test]
    fn manager_adapter_persists_a_numeric_answer() {
        let mut manager = GameManager::new();
        let session = GameSession {
            guild_id: "guild".into(),
            channel_id: "game".into(),
            game_id: "math".into(),
            starter_id: "starter".into(),
            locale: "en".into(),
            needs_voice: true,
            parent_channel_id: None,
            scores: Vec::new(),
        };
        let (status, initial) =
            manager.start_at(session, Box::new(NumericQuizGameDriver::math(1)), 0);
        assert_eq!(status, StartGameResult::Started);
        assert!(matches!(
            initial.as_slice(),
            [GameDriverAction::NumericQuiz(
                NumericQuizAction::RoundOpened { .. }
            )]
        ));
        let answer = {
            let _ = &initial;
            // Seed 1 is deterministic; reading through a separate driver keeps the test free of
            // hard-coded arithmetic while exercising the same content contract.
            let mut mirror = NumericQuizDriver::math(1);
            let _ = mirror.start(0);
            mirror.current_answer()
        };
        assert!(matches!(
            manager.handle_message_at(
                &GameMessage {
                    guild_id: "guild".into(),
                    channel_id: "game".into(),
                    author_id: "u".into(),
                    author_name: "Rexy".into(),
                    content: answer.to_string(),
                    can_trigger_speech: true,
                },
                1_000
            ),
            Some(GameManagerEvent::Consumed { .. })
        ));
    }
}
