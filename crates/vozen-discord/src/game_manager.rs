//! Transport-free lifecycle manager for Rust game adapters.
//!
//! The Node `GameManager` owns one active match per guild, routes only the match channel,
//! cancels voice-dependent games when the bot leaves the call, and persists scores only after a
//! normal finish. This module ports those boundaries without Discord, timers or SQLite; a
//! gateway adapter supplies a `GameDriver` and decides how its actions are rendered.

use std::collections::BTreeMap;

use crate::{GameSession, GameSessionStore, GameStopDenied, StartGameResult};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GameMessage {
    pub guild_id: String,
    pub channel_id: String,
    pub author_id: String,
    pub author_name: String,
    pub content: String,
    pub can_trigger_speech: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub enum GameDriverAction {
    Ignored,
    Award { user_id: String, points: i64 },
    Finished,
    TextQuiz(crate::text_quiz_driver::TextQuizDriverAction),
    Hangman(crate::hangman_driver::HangmanDriverAction),
    Wordle(crate::wordle_driver::WordleDriverAction),
    TicTacToe(crate::tictactoe_driver::TicTacToeDriverAction),
    Roulette(crate::roulette_driver::RouletteDriverAction),
}

/// A single game implementation behind the lifecycle boundary.
pub trait GameDriver: Send {
    fn on_start(&mut self, _now_ms: i64) -> Vec<GameDriverAction> {
        Vec::new()
    }

    fn on_message(&mut self, message: &GameMessage) -> Vec<GameDriverAction>;

    /// Clock-aware message hook for drivers with round deadlines. The compatibility hook keeps
    /// existing adapters source-compatible while runtimes can provide their monotonic timestamp.
    fn on_message_at(&mut self, message: &GameMessage, _now_ms: i64) -> Vec<GameDriverAction> {
        self.on_message(message)
    }

    fn on_tick(&mut self, _now_ms: i64) -> Vec<GameDriverAction> {
        Vec::new()
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum GameManagerEvent {
    Consumed { actions: Vec<GameDriverAction> },
    Finished { session: GameSession },
    Stopped,
    NoActiveGame,
    VoiceLeft,
}

struct ActiveDriver {
    driver: Box<dyn GameDriver>,
}

/// One active game per guild, matching the Node authority boundary.
pub struct GameManager {
    sessions: GameSessionStore,
    drivers: BTreeMap<String, ActiveDriver>,
}

impl Default for GameManager {
    fn default() -> Self {
        Self::new()
    }
}

impl GameManager {
    #[must_use]
    pub fn new() -> Self {
        Self {
            sessions: GameSessionStore::default(),
            drivers: BTreeMap::new(),
        }
    }

    #[must_use]
    pub fn active(&self, guild_id: &str) -> bool {
        self.sessions.active(guild_id)
    }

    #[must_use]
    pub fn channel_of(&self, guild_id: &str) -> Option<&str> {
        self.sessions.channel_of(guild_id)
    }

    #[must_use]
    pub fn is_starter(&self, guild_id: &str, user_id: &str) -> bool {
        self.sessions.is_starter(guild_id, user_id)
    }

    /// Installs the driver only when the session lock is acquired. A rejected start leaves both
    /// the existing session and the supplied driver untouched.
    pub fn start(&mut self, session: GameSession, driver: Box<dyn GameDriver>) -> StartGameResult {
        self.start_at(session, driver, 0).0
    }

    /// Starts a game and returns its initial semantic actions (intro/first round). The original
    /// `start` method remains as a compatibility wrapper for callers that only need the status.
    pub fn start_at(
        &mut self,
        session: GameSession,
        mut driver: Box<dyn GameDriver>,
        now_ms: i64,
    ) -> (StartGameResult, Vec<GameDriverAction>) {
        let guild_id = session.guild_id.clone();
        match self.sessions.start(session) {
            StartGameResult::Started => {
                let actions = driver.on_start(now_ms);
                self.drivers
                    .insert(guild_id.clone(), ActiveDriver { driver });
                // A driver with no content can finish during its initial transition. Apply that
                // transition immediately so an empty game never leaves a ghost session behind.
                if actions
                    .iter()
                    .any(|action| matches!(action, GameDriverAction::Finished))
                {
                    let actions_for_state = actions.clone();
                    let _ = self.apply_actions(&guild_id, actions_for_state);
                }
                (StartGameResult::Started, actions)
            }
            already_active => (already_active, Vec::new()),
        }
    }

    /// Routes only the active match channel. A routed message is consumed even if the driver
    /// ignores its text, so normal TTS never reads player guesses aloud.
    pub fn handle_message(&mut self, message: &GameMessage) -> Option<GameManagerEvent> {
        self.handle_message_at(message, 0)
    }

    /// Routes a message with the caller's monotonic clock. This is the preferred entry point for
    /// timed games; `handle_message` remains as a source-compatible zero-clock wrapper.
    pub fn handle_message_at(
        &mut self,
        message: &GameMessage,
        now_ms: i64,
    ) -> Option<GameManagerEvent> {
        if !self
            .sessions
            .channel_matches(&message.guild_id, &message.channel_id)
        {
            return None;
        }
        let actions = self
            .drivers
            .get_mut(&message.guild_id)
            .map(|active| active.driver.on_message_at(message, now_ms))
            .unwrap_or_default();
        self.apply_actions(&message.guild_id, actions)
    }

    /// Advances all drivers whose adapter has time-based rounds. The caller owns the clock and
    /// can invoke this from one process-wide tick without creating per-game ghost timers.
    pub fn advance(&mut self, now_ms: i64) -> Vec<GameManagerEvent> {
        let guilds = self.drivers.keys().cloned().collect::<Vec<_>>();
        let mut events = Vec::new();
        for guild_id in guilds {
            let actions = self
                .drivers
                .get_mut(&guild_id)
                .map(|active| active.driver.on_tick(now_ms))
                .unwrap_or_default();
            if actions.is_empty() {
                continue;
            }
            if let Some(event) = self.apply_actions(&guild_id, actions) {
                events.push(event);
            }
        }
        events
    }

    pub fn stop(
        &mut self,
        guild_id: &str,
        user_id: &str,
        can_manage_guild: bool,
    ) -> Result<GameManagerEvent, GameStopDenied> {
        match self
            .sessions
            .stop_authorized(guild_id, user_id, can_manage_guild)?
        {
            Some(_) => {
                self.drivers.remove(guild_id);
                Ok(GameManagerEvent::Stopped)
            }
            None => Ok(GameManagerEvent::NoActiveGame),
        }
    }

    pub fn on_voice_left(&mut self, guild_id: &str) -> GameManagerEvent {
        if self.sessions.on_voice_left(guild_id).is_some() {
            self.drivers.remove(guild_id);
            GameManagerEvent::VoiceLeft
        } else {
            GameManagerEvent::NoActiveGame
        }
    }

    pub fn end_guild(&mut self, guild_id: &str) {
        self.sessions.end_guild(guild_id);
        self.drivers.remove(guild_id);
    }

    fn apply_actions(
        &mut self,
        guild_id: &str,
        actions: Vec<GameDriverAction>,
    ) -> Option<GameManagerEvent> {
        let finished = actions
            .iter()
            .any(|action| matches!(action, GameDriverAction::Finished));
        for action in &actions {
            if let GameDriverAction::Award { user_id, points } = action {
                self.sessions.award(guild_id, user_id, *points);
            }
        }
        if finished {
            self.drivers.remove(guild_id);
            return self
                .sessions
                .finish(guild_id)
                .map(|session| GameManagerEvent::Finished { session });
        }
        Some(GameManagerEvent::Consumed { actions })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::GameScore;

    struct FakeGame {
        finish_on: Option<String>,
    }

    impl GameDriver for FakeGame {
        fn on_message(&mut self, message: &GameMessage) -> Vec<GameDriverAction> {
            if self.finish_on.as_deref() == Some(message.content.as_str()) {
                vec![GameDriverAction::Finished]
            } else if message.content == "point" {
                vec![GameDriverAction::Award {
                    user_id: message.author_id.clone(),
                    points: 2,
                }]
            } else {
                vec![GameDriverAction::Ignored]
            }
        }
    }

    fn session(needs_voice: bool) -> GameSession {
        GameSession {
            guild_id: "guild".into(),
            channel_id: "game-channel".into(),
            game_id: "math".into(),
            starter_id: "starter".into(),
            locale: "en".into(),
            needs_voice,
            parent_channel_id: None,
            scores: Vec::new(),
        }
    }

    fn message(channel_id: &str, author_id: &str, content: &str) -> GameMessage {
        GameMessage {
            guild_id: "guild".into(),
            channel_id: channel_id.into(),
            author_id: author_id.into(),
            author_name: author_id.into(),
            content: content.into(),
            can_trigger_speech: true,
        }
    }

    #[test]
    fn routes_only_the_match_channel_and_consumes_ignored_chat() {
        let mut manager = GameManager::new();
        assert_eq!(
            manager.start(session(false), Box::new(FakeGame { finish_on: None })),
            StartGameResult::Started
        );
        assert!(
            manager
                .handle_message(&message("other", "u", "point"))
                .is_none()
        );
        assert_eq!(
            manager.handle_message(&message("game-channel", "u", "hello")),
            Some(GameManagerEvent::Consumed {
                actions: vec![GameDriverAction::Ignored]
            })
        );
    }

    #[test]
    fn normal_finish_returns_scores_and_forced_stop_discards_them() {
        let mut manager = GameManager::new();
        manager.start(
            session(false),
            Box::new(FakeGame {
                finish_on: Some("finish".into()),
            }),
        );
        assert!(matches!(
            manager.handle_message(&message("game-channel", "u", "point")),
            Some(GameManagerEvent::Consumed { .. })
        ));
        assert!(matches!(
            manager.handle_message(&message("game-channel", "u", "finish")),
            Some(GameManagerEvent::Finished { session })
                if session.scores == vec![GameScore { user_id: "u".into(), points: 2 }]
        ));
        assert!(!manager.active("guild"));

        manager.start(session(false), Box::new(FakeGame { finish_on: None }));
        manager.handle_message(&message("game-channel", "u", "point"));
        assert_eq!(manager.stop("guild", "other", false), Err(GameStopDenied));
        assert_eq!(
            manager.stop("guild", "starter", false),
            Ok(GameManagerEvent::Stopped)
        );
        assert!(!manager.active("guild"));
    }

    #[test]
    fn voice_loss_only_removes_voice_games_and_stale_driver_cannot_finish_new_game() {
        let mut manager = GameManager::new();
        manager.start(session(false), Box::new(FakeGame { finish_on: None }));
        assert_eq!(
            manager.on_voice_left("guild"),
            GameManagerEvent::NoActiveGame
        );
        assert!(manager.active("guild"));
        manager.end_guild("guild");

        manager.start(session(true), Box::new(FakeGame { finish_on: None }));
        assert_eq!(manager.on_voice_left("guild"), GameManagerEvent::VoiceLeft);
        assert!(!manager.active("guild"));
        assert_eq!(
            manager.on_voice_left("guild"),
            GameManagerEvent::NoActiveGame
        );
    }
}
