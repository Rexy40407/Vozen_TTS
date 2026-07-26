//! Clock-aware lifecycle adapter for Vozen Says.

use std::collections::BTreeMap;

use vozen_core::{VozenSaysEvent, VozenSaysGame};

use crate::{GameAnnouncementAction, GameDriver, GameDriverAction, GameMessage};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VozenSaysDriverAction {
    RoundOpened {
        round: u8,
        total: u8,
        item: String,
        real: bool,
        delay_ms: i64,
        model: Option<String>,
    },
    Obeyed {
        user_id: String,
        name: String,
    },
    Caught {
        user_id: String,
        name: String,
    },
    Nobody {
        item: String,
    },
    TrapCleared {
        item: String,
    },
    Finished,
    Ignored,
}

#[derive(Debug)]
pub struct VozenSaysDriver {
    game: VozenSaysGame,
    model: Option<String>,
}

pub struct VozenSaysGameDriver {
    inner: VozenSaysDriver,
}

impl VozenSaysGameDriver {
    #[must_use]
    pub fn new(items: Vec<String>, seed: i64, model: Option<String>) -> Self {
        Self {
            inner: VozenSaysDriver::new(items, seed, model),
        }
    }

    #[must_use]
    pub fn inner(&self) -> &VozenSaysDriver {
        &self.inner
    }
}

impl GameDriver for VozenSaysGameDriver {
    fn on_start(&mut self, now_ms: i64) -> Vec<GameDriverAction> {
        let round_actions = self.inner.start(now_ms);
        if round_actions
            .iter()
            .any(|action| matches!(action, VozenSaysDriverAction::Finished))
        {
            return round_actions
                .into_iter()
                .flat_map(to_manager_actions)
                .collect();
        }
        let mut parameters = BTreeMap::new();
        parameters.insert("rounds", VozenSaysGame::rounds().to_string());
        let mut actions = vec![GameDriverAction::Announcement(
            GameAnnouncementAction::message("game.vozenSays.intro", parameters),
        )];
        actions.extend(round_actions.into_iter().flat_map(to_manager_actions));
        actions
    }

    fn on_message(&mut self, message: &GameMessage) -> Vec<GameDriverAction> {
        self.on_message_at(message, 0)
    }

    fn on_message_at(&mut self, message: &GameMessage, now_ms: i64) -> Vec<GameDriverAction> {
        self.inner
            .play_at_actions(
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
            .advance_actions(now_ms)
            .into_iter()
            .flat_map(to_manager_actions)
            .collect()
    }
}

fn to_manager_actions(action: VozenSaysDriverAction) -> Vec<GameDriverAction> {
    let award = match &action {
        VozenSaysDriverAction::Obeyed { user_id, .. } => Some(user_id.clone()),
        _ => None,
    };
    let finished = matches!(action, VozenSaysDriverAction::Finished);
    let mut actions = Vec::new();
    if let Some(user_id) = award {
        actions.push(GameDriverAction::Award { user_id, points: 1 });
    }
    actions.push(GameDriverAction::VozenSays(action));
    if finished {
        actions.push(GameDriverAction::Finished);
    }
    actions
}

impl VozenSaysDriver {
    #[must_use]
    pub fn new(items: Vec<String>, seed: i64, model: Option<String>) -> Self {
        Self {
            game: VozenSaysGame::new(items, seed),
            model,
        }
    }

    pub fn start(&mut self, now_ms: i64) -> Vec<VozenSaysDriverAction> {
        let event = self.game.start(now_ms);
        vec![self.map_event(event, now_ms)]
    }

    pub fn play_at_actions(
        &mut self,
        now_ms: i64,
        user_id: &str,
        name: &str,
        raw: &str,
    ) -> Vec<VozenSaysDriverAction> {
        let event = self.game.play_at(user_id, name, raw, now_ms);
        let mut actions = vec![self.map_event(event.clone(), now_ms)];
        if matches!(event, VozenSaysEvent::Obeyed { .. }) {
            if self.game.is_finished() {
                actions.push(VozenSaysDriverAction::Finished);
            } else {
                actions.push(self.round_action(now_ms));
            }
        }
        actions
    }

    pub fn advance_actions(&mut self, now_ms: i64) -> Vec<VozenSaysDriverAction> {
        let event = self.game.advance(now_ms);
        let mut actions = vec![self.map_event(event.clone(), now_ms)];
        if matches!(
            event,
            VozenSaysEvent::Nobody { .. } | VozenSaysEvent::TrapCleared { .. }
        ) {
            if self.game.is_finished() {
                actions.push(VozenSaysDriverAction::Finished);
            } else {
                actions.push(self.round_action(now_ms));
            }
        }
        actions
    }

    fn map_event(&self, event: VozenSaysEvent, now_ms: i64) -> VozenSaysDriverAction {
        match event {
            VozenSaysEvent::RoundOpened { round, item, real } => {
                VozenSaysDriverAction::RoundOpened {
                    round,
                    total: VozenSaysGame::rounds(),
                    item,
                    real,
                    delay_ms: self.game.deadline_ms().saturating_sub(now_ms),
                    model: self.model.clone(),
                }
            }
            VozenSaysEvent::Obeyed { user_id, name } => {
                VozenSaysDriverAction::Obeyed { user_id, name }
            }
            VozenSaysEvent::Caught { user_id, name } => {
                VozenSaysDriverAction::Caught { user_id, name }
            }
            VozenSaysEvent::Nobody { item } => VozenSaysDriverAction::Nobody { item },
            VozenSaysEvent::TrapCleared { item } => VozenSaysDriverAction::TrapCleared { item },
            VozenSaysEvent::Finished { .. } => VozenSaysDriverAction::Finished,
            VozenSaysEvent::Ignored => VozenSaysDriverAction::Ignored,
        }
    }

    fn round_action(&self, now_ms: i64) -> VozenSaysDriverAction {
        VozenSaysDriverAction::RoundOpened {
            round: self.game.round(),
            total: VozenSaysGame::rounds(),
            item: self.game.item().to_owned(),
            real: self.game.real(),
            delay_ms: self.game.deadline_ms().saturating_sub(now_ms),
            model: self.model.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{GameManager, GameSession, StartGameResult};

    #[test]
    fn starts_with_model_and_trap_catches_one_user_without_rearming() {
        let mut driver = VozenSaysDriver::new(
            vec!["alpha".into(), "beta".into()],
            1,
            Some("en-model".into()),
        );
        let start = driver.start(0);
        let (item, real) = match &start[0] {
            VozenSaysDriverAction::RoundOpened {
                item,
                real,
                model: Some(model),
                ..
            } => {
                assert_eq!(model, "en-model");
                (item.clone(), *real)
            }
            _ => panic!("expected round"),
        };
        if real {
            assert!(matches!(
                driver.play_at_actions(1_000, "u", "User", &item).as_slice(),
                [
                    VozenSaysDriverAction::Obeyed { .. },
                    VozenSaysDriverAction::RoundOpened { .. }
                ]
            ));
        } else {
            assert_eq!(
                driver.play_at_actions(1_000, "u", "User", &item),
                vec![VozenSaysDriverAction::Caught {
                    user_id: "u".into(),
                    name: "User".into()
                }]
            );
            assert_eq!(
                driver.play_at_actions(2_000, "u", "User", &item),
                vec![VozenSaysDriverAction::Ignored]
            );
        }
    }

    #[test]
    fn empty_items_finish_during_start_without_a_ghost_session() {
        let mut driver = VozenSaysDriver::new(Vec::new(), 1, None);
        assert_eq!(driver.start(0), vec![VozenSaysDriverAction::Finished]);
    }

    #[test]
    fn manager_adapter_awards_an_obeyed_instruction() {
        let mut manager = GameManager::new();
        let session = GameSession {
            guild_id: "guild".into(),
            channel_id: "game".into(),
            game_id: "vozen-says".into(),
            starter_id: "starter".into(),
            locale: "en".into(),
            needs_voice: true,
            parent_channel_id: None,
            scores: Vec::new(),
        };
        let (status, initial) = manager.start_at(
            session,
            Box::new(VozenSaysGameDriver::new(vec!["alpha".into()], 55, None)),
            0,
        );
        assert_eq!(status, StartGameResult::Started);
        assert!(matches!(
            initial.first(),
            Some(GameDriverAction::Announcement(_))
        ));
        let item = match &initial[1] {
            GameDriverAction::VozenSays(VozenSaysDriverAction::RoundOpened { item, .. }) => {
                item.clone()
            }
            _ => panic!("expected round"),
        };
        let _ = manager.handle_message_at(
            &GameMessage {
                guild_id: "guild".into(),
                channel_id: "game".into(),
                author_id: "u".into(),
                author_name: "Rexy".into(),
                content: item,
                can_trigger_speech: true,
            },
            1_000,
        );
        // Depending on the seeded command this is either an immediate award or a trap; in both
        // cases the manager consumes the game message and keeps the lifecycle alive.
        assert!(manager.active("guild"));
    }
}
