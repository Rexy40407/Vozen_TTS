//! Clock-aware lifecycle adapter for Reflexes.

use vozen_core::{ReflexesEvent, ReflexesGame};

use crate::{GameDriver, GameDriverAction, GameMessage};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReflexesDriverAction {
    RoundReady {
        round: u8,
        delay_ms: i64,
    },
    Opened {
        round: u8,
    },
    FalseStart {
        user_id: String,
        name: String,
    },
    Winner {
        round: u8,
        user_id: String,
        name: String,
    },
    TooSlow {
        round: u8,
    },
    Finished,
    Ignored,
}

#[derive(Debug)]
pub struct ReflexesDriver {
    game: ReflexesGame,
}

pub struct ReflexesGameDriver {
    inner: ReflexesDriver,
}

impl ReflexesGameDriver {
    #[must_use]
    pub fn new(seed: i64) -> Self {
        Self {
            inner: ReflexesDriver::new(seed),
        }
    }

    #[must_use]
    pub fn inner(&self) -> &ReflexesDriver {
        &self.inner
    }
}

impl GameDriver for ReflexesGameDriver {
    fn on_start(&mut self, now_ms: i64) -> Vec<GameDriverAction> {
        to_manager_actions(self.inner.start(now_ms))
    }

    fn on_message(&mut self, message: &GameMessage) -> Vec<GameDriverAction> {
        self.on_message_at(message, 0)
    }

    fn on_message_at(&mut self, message: &GameMessage, now_ms: i64) -> Vec<GameDriverAction> {
        self.inner
            .play_at_actions(now_ms, &message.author_id, &message.author_name)
            .into_iter()
            .flat_map(to_manager_actions)
            .collect()
    }

    fn on_tick(&mut self, now_ms: i64) -> Vec<GameDriverAction> {
        self.inner
            .advance_actions(now_ms)
            .into_iter()
            .flat_map(to_manager_actions)
            .collect()
    }
}

fn to_manager_actions(event: ReflexesDriverAction) -> Vec<GameDriverAction> {
    let award = match &event {
        ReflexesDriverAction::Winner { user_id, .. } => Some(user_id.clone()),
        _ => None,
    };
    let finished = matches!(event, ReflexesDriverAction::Finished);
    let mut actions = Vec::new();
    if let Some(user_id) = award {
        actions.push(GameDriverAction::Award { user_id, points: 1 });
    }
    actions.push(GameDriverAction::Reflexes(event));
    if finished {
        actions.push(GameDriverAction::Finished);
    }
    actions
}

impl ReflexesDriver {
    #[must_use]
    pub fn new(seed: i64) -> Self {
        Self {
            game: ReflexesGame::new(seed),
        }
    }

    #[must_use]
    pub fn game(&self) -> &ReflexesGame {
        &self.game
    }

    #[must_use]
    pub fn deadline_ms(&self) -> i64 {
        self.game.deadline_ms()
    }

    pub fn start(&mut self, now_ms: i64) -> ReflexesDriverAction {
        map_event(self.game.start(now_ms))
    }

    pub fn play_at(&mut self, now_ms: i64, user_id: &str, name: &str) -> ReflexesDriverAction {
        map_event_with_name(self.game.play_at(user_id, name, now_ms), Some(name))
    }

    pub fn play_at_actions(
        &mut self,
        now_ms: i64,
        user_id: &str,
        name: &str,
    ) -> Vec<ReflexesDriverAction> {
        let event = self.game.play_at(user_id, name, now_ms);
        let mut actions = vec![map_event_with_name(event.clone(), Some(name))];
        if matches!(event, ReflexesEvent::Winner { .. }) && !self.game.is_finished() {
            actions.push(self.ready_action(now_ms));
        }
        actions
    }

    pub fn advance(&mut self, now_ms: i64) -> ReflexesDriverAction {
        map_event(self.game.advance(now_ms))
    }

    pub fn advance_actions(&mut self, now_ms: i64) -> Vec<ReflexesDriverAction> {
        let event = self.game.advance(now_ms);
        let mut actions = vec![map_event(event.clone())];
        if matches!(event, ReflexesEvent::TooSlow { .. }) {
            actions.push(self.ready_action(now_ms));
        }
        actions
    }

    fn ready_action(&self, now_ms: i64) -> ReflexesDriverAction {
        ReflexesDriverAction::RoundReady {
            round: self.game.round(),
            delay_ms: self.game.deadline_ms().saturating_sub(now_ms),
        }
    }
}

fn map_event(event: ReflexesEvent) -> ReflexesDriverAction {
    map_event_with_name(event, None)
}

fn map_event_with_name(event: ReflexesEvent, actor_name: Option<&str>) -> ReflexesDriverAction {
    match event {
        ReflexesEvent::RoundReady { round, delay_ms } => {
            ReflexesDriverAction::RoundReady { round, delay_ms }
        }
        ReflexesEvent::Opened { round } => ReflexesDriverAction::Opened { round },
        ReflexesEvent::FalseStart { user_id } => ReflexesDriverAction::FalseStart {
            name: actor_name.unwrap_or(&user_id).to_owned(),
            user_id,
        },
        ReflexesEvent::Winner {
            round,
            user_id,
            name,
        } => ReflexesDriverAction::Winner {
            round,
            user_id,
            name,
        },
        ReflexesEvent::TooSlow { round } => ReflexesDriverAction::TooSlow { round },
        ReflexesEvent::Finished { .. } => ReflexesDriverAction::Finished,
        ReflexesEvent::Ignored => ReflexesDriverAction::Ignored,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{GameManager, GameManagerEvent, GameSession, StartGameResult};

    #[test]
    fn false_start_does_not_change_deadline_and_winner_uses_message_clock() {
        let mut driver = ReflexesDriver::new(42);
        let ready = driver.start(1_000);
        let deadline = driver.deadline_ms();
        assert!(matches!(
            ready,
            ReflexesDriverAction::RoundReady { round: 1, .. }
        ));
        assert_eq!(
            driver.play_at(2_000, "early", "Early"),
            ReflexesDriverAction::FalseStart {
                user_id: "early".into(),
                name: "Early".into(),
            }
        );
        assert_eq!(driver.deadline_ms(), deadline);
        assert!(matches!(
            driver.advance(deadline),
            ReflexesDriverAction::Opened { round: 1 }
        ));
        assert!(matches!(
            driver.play_at(deadline + 100, "winner", "Winner"),
            ReflexesDriverAction::Winner { round: 1, .. }
        ));
        assert!(driver.deadline_ms() > deadline + 100);
    }

    #[test]
    fn timeout_progresses_and_finishes_after_three_rounds() {
        let mut driver = ReflexesDriver::new(3);
        let mut now = 0;
        let _ = driver.start(now);
        for round in 1..=3 {
            let open_at = driver.deadline_ms();
            assert!(matches!(
                driver.advance(open_at),
                ReflexesDriverAction::Opened { .. }
            ));
            let close_at = driver.deadline_ms();
            let event = driver.advance(close_at);
            if round < 3 {
                assert!(matches!(event, ReflexesDriverAction::TooSlow { .. }));
            } else {
                assert_eq!(event, ReflexesDriverAction::Finished);
            }
            now = close_at;
        }
        let _ = now;
    }

    #[test]
    fn manager_adapter_persists_a_reaction_point() {
        let mut manager = GameManager::new();
        let session = GameSession {
            guild_id: "guild".into(),
            channel_id: "game".into(),
            game_id: "reflexes".into(),
            starter_id: "starter".into(),
            locale: "en".into(),
            needs_voice: true,
            parent_channel_id: None,
            scores: Vec::new(),
        };
        let (status, initial) = manager.start_at(session, Box::new(ReflexesGameDriver::new(1)), 0);
        assert_eq!(status, StartGameResult::Started);
        assert!(matches!(
            initial.as_slice(),
            [GameDriverAction::Reflexes(
                ReflexesDriverAction::RoundReady { .. }
            )]
        ));
        let ready = {
            let mut mirror = ReflexesDriver::new(1);
            let _ = mirror.start(0);
            mirror.deadline_ms()
        };
        let _ = manager.advance(ready);
        let event = manager.handle_message_at(
            &GameMessage {
                guild_id: "guild".into(),
                channel_id: "game".into(),
                author_id: "u".into(),
                author_name: "Rexy".into(),
                content: "anything".into(),
                can_trigger_speech: true,
            },
            ready + 1,
        );
        assert!(
            matches!(event, Some(GameManagerEvent::Consumed { actions }) if actions.iter().any(|a| matches!(a, GameDriverAction::Award { user_id, points: 1 } if user_id == "u")))
        );
    }
}
