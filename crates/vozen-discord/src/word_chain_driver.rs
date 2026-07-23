//! Lifecycle adapter for the turn-based Word Chain game.

use std::collections::BTreeMap;

use vozen_core::{ChainValidationReason, WordChainConfig, WordChainEngine};

use crate::{GameDriver, GameDriverAction, GameMessage};

const LOBBY_MS: i64 = 20_000;
const LIVES: u8 = 2;
const WIN_BONUS: i64 = 3;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WordChainDriverAction {
    LobbyOpened {
        language: String,
        deadline_ms: i64,
    },
    Joined {
        user_id: String,
        name: String,
    },
    Turn {
        user_id: String,
        name: String,
        letter: char,
        min_length: usize,
        turn_ms: u64,
        lives: u8,
    },
    Accepted {
        user_id: String,
        name: String,
        word: String,
        next_letter: char,
    },
    Rejected {
        user_id: String,
        reason: ChainValidationReason,
        letter: char,
        min_length: usize,
    },
    Timeout {
        user_id: String,
        name: String,
        lives: u8,
    },
    Eliminated {
        user_id: String,
        name: String,
    },
    Winner {
        user_id: String,
        name: String,
        chain_length: usize,
    },
    Finished,
    Ignored,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Phase {
    Lobby,
    Playing,
    Ended,
}

#[derive(Debug)]
pub struct WordChainDriver {
    language: String,
    engine: Option<WordChainEngine>,
    words: Vec<String>,
    seed: u64,
    phase: Phase,
    deadline_ms: Option<i64>,
    order: Vec<String>,
    names: BTreeMap<String, String>,
    lives: BTreeMap<String, u8>,
    index: usize,
}

pub struct WordChainGameDriver {
    inner: WordChainDriver,
}

impl WordChainGameDriver {
    #[must_use]
    pub fn new(language: impl Into<String>, words: Vec<String>, seed: u64) -> Self {
        Self {
            inner: WordChainDriver::new(language, words, seed),
        }
    }

    #[must_use]
    pub fn inner(&self) -> &WordChainDriver {
        &self.inner
    }
}

impl GameDriver for WordChainGameDriver {
    fn on_start(&mut self, now_ms: i64) -> Vec<GameDriverAction> {
        self.inner
            .start(now_ms)
            .into_iter()
            .flat_map(to_manager_actions)
            .collect()
    }

    fn on_message(&mut self, message: &GameMessage) -> Vec<GameDriverAction> {
        self.on_message_at(message, 0)
    }

    fn on_message_at(&mut self, message: &GameMessage, now_ms: i64) -> Vec<GameDriverAction> {
        self.inner
            .message(
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
            .advance(now_ms)
            .into_iter()
            .flat_map(to_manager_actions)
            .collect()
    }
}

fn to_manager_actions(action: WordChainDriverAction) -> Vec<GameDriverAction> {
    let award = match &action {
        WordChainDriverAction::Accepted { user_id, .. } => Some((user_id.clone(), 1)),
        WordChainDriverAction::Winner { user_id, .. } => Some((user_id.clone(), WIN_BONUS)),
        _ => None,
    };
    let finished = matches!(action, WordChainDriverAction::Finished);
    let mut actions = Vec::new();
    if let Some((user_id, points)) = award {
        actions.push(GameDriverAction::Award { user_id, points });
    }
    actions.push(GameDriverAction::WordChain(action));
    if finished {
        actions.push(GameDriverAction::Finished);
    }
    actions
}

impl WordChainDriver {
    #[must_use]
    pub fn new(language: impl Into<String>, words: Vec<String>, seed: u64) -> Self {
        Self {
            language: language.into(),
            engine: None,
            words,
            seed,
            phase: Phase::Lobby,
            deadline_ms: None,
            order: Vec::new(),
            names: BTreeMap::new(),
            lives: BTreeMap::new(),
            index: 0,
        }
    }

    pub fn start(&mut self, now_ms: i64) -> Vec<WordChainDriverAction> {
        if self.words.is_empty() {
            self.phase = Phase::Ended;
            self.deadline_ms = None;
            return vec![WordChainDriverAction::Finished];
        }
        self.deadline_ms = Some(now_ms.saturating_add(LOBBY_MS));
        vec![WordChainDriverAction::LobbyOpened {
            language: self.language.clone(),
            deadline_ms: self.deadline_ms.unwrap_or(now_ms),
        }]
    }

    pub fn message(
        &mut self,
        now_ms: i64,
        user_id: &str,
        name: &str,
        raw: &str,
    ) -> Vec<WordChainDriverAction> {
        match self.phase {
            Phase::Lobby => {
                if self.names.contains_key(user_id) {
                    return vec![WordChainDriverAction::Ignored];
                }
                self.order.push(user_id.to_owned());
                self.names.insert(user_id.to_owned(), name.to_owned());
                self.lives.insert(user_id.to_owned(), LIVES);
                vec![WordChainDriverAction::Joined {
                    user_id: user_id.to_owned(),
                    name: name.to_owned(),
                }]
            }
            Phase::Playing => {
                if self.order.get(self.index).map(String::as_str) != Some(user_id) {
                    return vec![WordChainDriverAction::Ignored];
                }
                let Some(engine) = self.engine.as_mut() else {
                    return vec![WordChainDriverAction::Ignored];
                };
                let validation = engine.validate(raw);
                if !validation.ok {
                    return vec![WordChainDriverAction::Rejected {
                        user_id: user_id.to_owned(),
                        reason: validation.reason,
                        letter: engine.required_letter(),
                        min_length: engine.min_length(),
                    }];
                }
                let word = validation.normalized;
                engine.accept(&word);
                self.index = (self.index + 1) % self.order.len();
                self.deadline_ms = Some(now_ms.saturating_add(engine.turn_ms() as i64));
                let next_user = self.order[self.index].clone();
                vec![
                    WordChainDriverAction::Accepted {
                        user_id: user_id.to_owned(),
                        name: name.to_owned(),
                        word,
                        next_letter: engine.required_letter(),
                    },
                    self.turn_action(&next_user),
                ]
            }
            Phase::Ended => vec![WordChainDriverAction::Ignored],
        }
    }

    pub fn advance(&mut self, now_ms: i64) -> Vec<WordChainDriverAction> {
        let Some(deadline) = self.deadline_ms else {
            return vec![WordChainDriverAction::Ignored];
        };
        if now_ms < deadline {
            return vec![WordChainDriverAction::Ignored];
        }
        match self.phase {
            Phase::Lobby => self.begin_play(now_ms),
            Phase::Playing => self.timeout(now_ms),
            Phase::Ended => vec![WordChainDriverAction::Ignored],
        }
    }

    fn begin_play(&mut self, now_ms: i64) -> Vec<WordChainDriverAction> {
        self.deadline_ms = None;
        if self.order.len() < 2 {
            self.phase = Phase::Ended;
            return vec![WordChainDriverAction::Finished];
        }
        self.phase = Phase::Playing;
        self.index = 0;
        self.engine = Some(WordChainEngine::new(
            self.words.clone(),
            self.seed,
            WordChainConfig::default(),
        ));
        self.deadline_ms =
            Some(now_ms.saturating_add(self.engine.as_ref().map_or(0, |e| e.turn_ms() as i64)));
        let user_id = self.order[0].clone();
        vec![self.turn_action(&user_id)]
    }

    fn timeout(&mut self, now_ms: i64) -> Vec<WordChainDriverAction> {
        let user_id = self.order[self.index].clone();
        let name = self.names.get(&user_id).cloned().unwrap_or_default();
        let remaining = self
            .lives
            .get(&user_id)
            .copied()
            .unwrap_or(1)
            .saturating_sub(1);
        self.lives.insert(user_id.clone(), remaining);
        let mut actions = vec![WordChainDriverAction::Timeout {
            user_id: user_id.clone(),
            name: name.clone(),
            lives: remaining,
        }];
        if remaining == 0 {
            self.order.remove(self.index);
            self.lives.remove(&user_id);
            actions.push(WordChainDriverAction::Eliminated {
                user_id: user_id.clone(),
                name,
            });
            if self.order.len() == 1 {
                self.phase = Phase::Ended;
                self.deadline_ms = None;
                let winner_id = self.order[0].clone();
                let winner_name = self.names.get(&winner_id).cloned().unwrap_or_default();
                actions.push(WordChainDriverAction::Winner {
                    user_id: winner_id,
                    name: winner_name,
                    chain_length: self
                        .engine
                        .as_ref()
                        .map_or(0, WordChainEngine::chain_length),
                });
                actions.push(WordChainDriverAction::Finished);
                return actions;
            }
            if self.index >= self.order.len() {
                self.index = 0;
            }
        } else {
            self.index = (self.index + 1) % self.order.len();
        }
        let next_user = self.order[self.index].clone();
        self.deadline_ms =
            Some(now_ms.saturating_add(self.engine.as_ref().map_or(0, |e| e.turn_ms() as i64)));
        actions.push(self.turn_action(&next_user));
        actions
    }

    fn turn_action(&self, user_id: &str) -> WordChainDriverAction {
        let engine = self
            .engine
            .as_ref()
            .expect("playing word chain has an engine");
        WordChainDriverAction::Turn {
            user_id: user_id.to_owned(),
            name: self.names.get(user_id).cloned().unwrap_or_default(),
            letter: engine.required_letter(),
            min_length: engine.min_length(),
            turn_ms: engine.turn_ms(),
            lives: self.lives.get(user_id).copied().unwrap_or(0),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{GameManager, GameManagerEvent, GameSession, StartGameResult};

    fn words() -> Vec<String> {
        vec!["cat".into(), "tea".into(), "apple".into(), "egg".into()]
    }

    #[test]
    fn lobby_requires_two_players_then_accepts_only_the_current_turn() {
        let mut driver = WordChainDriver::new("en", words(), 1);
        assert!(matches!(
            driver.start(0).as_slice(),
            [WordChainDriverAction::LobbyOpened { .. }]
        ));
        assert!(matches!(
            driver.message(1, "u1", "Ana", "join").as_slice(),
            [WordChainDriverAction::Joined { .. }]
        ));
        assert!(matches!(
            driver.message(2, "u2", "Kai", "join").as_slice(),
            [WordChainDriverAction::Joined { .. }]
        ));
        let start = driver.advance(20_000);
        assert!(
            matches!(start.as_slice(), [WordChainDriverAction::Turn { user_id, .. }] if user_id == "u1")
        );
        let letter = match &start[0] {
            WordChainDriverAction::Turn { letter, .. } => *letter,
            _ => unreachable!(),
        };
        let candidate = words()
            .into_iter()
            .find(|word| word.starts_with(letter))
            .expect("candidate");
        assert!(matches!(
            driver.message(20_001, "u2", "Kai", &candidate).as_slice(),
            [WordChainDriverAction::Ignored]
        ));
        assert!(matches!(
            driver.message(20_002, "u1", "Ana", &candidate).as_slice(),
            [
                WordChainDriverAction::Accepted { .. },
                WordChainDriverAction::Turn { .. }
            ]
        ));
    }

    #[test]
    fn two_timeouts_eliminate_a_player_and_award_the_survivor() {
        let mut driver = WordChainDriver::new("en", words(), 1);
        let _ = driver.start(0);
        let _ = driver.message(1, "u1", "Ana", "join");
        let _ = driver.message(2, "u2", "Kai", "join");
        let _ = driver.advance(20_000);
        let first_deadline = driver
            .engine
            .as_ref()
            .map(|engine| engine.turn_ms() as i64)
            .unwrap_or(0)
            + 20_000;
        let _ = driver.advance(first_deadline);
        let second_deadline = first_deadline + 15_000;
        let _ = driver.advance(second_deadline);
        let third_deadline = second_deadline + 15_000;
        let actions = driver.advance(third_deadline);
        assert!(actions.iter().any(|action| matches!(action, WordChainDriverAction::Winner { user_id, .. } if user_id == "u2")));
        assert!(
            actions
                .iter()
                .any(|action| matches!(action, WordChainDriverAction::Finished))
        );
    }

    #[test]
    fn manager_adapter_persists_word_and_winner_points() {
        let mut manager = GameManager::new();
        let session = GameSession {
            guild_id: "guild".into(),
            channel_id: "game".into(),
            game_id: "word-chain".into(),
            starter_id: "starter".into(),
            locale: "en".into(),
            needs_voice: false,
            parent_channel_id: None,
            scores: Vec::new(),
        };
        let (status, _) = manager.start_at(
            session,
            Box::new(WordChainGameDriver::new("en", words(), 1)),
            0,
        );
        assert_eq!(status, StartGameResult::Started);
        let _ = manager.handle_message_at(
            &GameMessage {
                guild_id: "guild".into(),
                channel_id: "game".into(),
                author_id: "u1".into(),
                author_name: "Ana".into(),
                content: "join".into(),
                can_trigger_speech: false,
            },
            1,
        );
        let _ = manager.handle_message_at(
            &GameMessage {
                guild_id: "guild".into(),
                channel_id: "game".into(),
                author_id: "u2".into(),
                author_name: "Kai".into(),
                content: "join".into(),
                can_trigger_speech: false,
            },
            2,
        );
        assert!(matches!(
            manager.advance(20_000).as_slice(),
            [GameManagerEvent::Consumed { .. }]
        ));
    }
}
