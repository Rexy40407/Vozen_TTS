//! Transport-free authority boundary for the live game lifecycle.
//!
//! The Discord adapter still owns threads, ephemeral replies and permissions. This coordinator
//! owns the part that must not be duplicated by either transport: admission, driver creation,
//! one-session-per-guild, message routing, timer advancement and the distinction between a
//! normal finish (scores may be persisted) and a forced teardown (scores are discarded).

use thiserror::Error;

use crate::{
    GameDriverAction, GameDriverFactory, GameFactoryError, GameManager, GameManagerEvent,
    GameMessage, GamePlayAdmission, GamePlayAdmissionFacts, GameSession, StartGameResult,
    admit_game_play, game_definition,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GamePlayRequest {
    pub guild_id: Option<String>,
    pub parent_channel_id: String,
    pub game_channel_id: String,
    pub starter_id: String,
    pub game_id: Option<String>,
    pub language: Option<String>,
    pub locale: String,
    pub bot_voice_channel_id: Option<String>,
    pub user_premium: bool,
    pub guild_premium: bool,
    pub seed: i64,
    pub now_ms: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub enum GameStartOutcome {
    PickRequired,
    Rejected(GamePlayAdmission),
    Started {
        game_id: String,
        game_channel_id: String,
        parent_channel_id: Option<String>,
        needs_voice: bool,
        actions: Vec<GameDriverAction>,
    },
}

#[derive(Debug, Error)]
pub enum GameCoordinatorError {
    #[error("game driver could not be created: {0}")]
    Factory(#[from] GameFactoryError),
    #[error("game definition disappeared after admission: {0}")]
    MissingDefinition(String),
}

/// Single in-memory owner for Rust game sessions. It deliberately has no Discord or SQLite
/// dependency; callers persist the `GameScore` rows returned in `GameManagerEvent::Finished`.
pub struct GameCoordinator {
    factory: GameDriverFactory,
    manager: GameManager,
}

impl GameCoordinator {
    #[must_use]
    pub fn new(factory: GameDriverFactory) -> Self {
        Self {
            factory,
            manager: GameManager::new(),
        }
    }

    #[must_use]
    pub fn active(&self, guild_id: &str) -> bool {
        self.manager.active(guild_id)
    }

    #[must_use]
    pub fn channel_of(&self, guild_id: &str) -> Option<&str> {
        self.manager.channel_of(guild_id)
    }

    #[must_use]
    pub fn is_starter(&self, guild_id: &str, user_id: &str) -> bool {
        self.manager.is_starter(guild_id, user_id)
    }

    #[must_use]
    pub fn session(&self, guild_id: &str) -> Option<GameSession> {
        self.manager.session(guild_id)
    }

    /// Runs every pre-session gate before creating a driver or mutating the session lock.
    pub fn start(
        &mut self,
        request: GamePlayRequest,
    ) -> Result<GameStartOutcome, GameCoordinatorError> {
        let admission = admit_game_play(GamePlayAdmissionFacts {
            guild_id: request.guild_id.as_deref(),
            game_id: request.game_id.as_deref(),
            bot_voice_channel_id: request.bot_voice_channel_id.as_deref(),
            active_channel_id: self
                .manager
                .channel_of(request.guild_id.as_deref().unwrap_or_default()),
            user_premium: request.user_premium,
            guild_premium: request.guild_premium,
        });

        let GamePlayAdmission::Allowed { game_id } = admission else {
            return Ok(match admission {
                GamePlayAdmission::PickRequired => GameStartOutcome::PickRequired,
                rejected => GameStartOutcome::Rejected(rejected),
            });
        };

        let definition = game_definition(game_id)
            .ok_or_else(|| GameCoordinatorError::MissingDefinition(game_id.to_owned()))?;
        let driver = self.factory.create_for_locale(
            game_id,
            request.language.as_deref(),
            &request.locale,
            request.seed,
        )?;
        let parent_channel_id = (request.game_channel_id != request.parent_channel_id)
            .then_some(request.parent_channel_id.clone());
        let session = GameSession {
            guild_id: request.guild_id.expect("allowed games are guild-only"),
            channel_id: request.game_channel_id.clone(),
            game_id: game_id.to_owned(),
            starter_id: request.starter_id,
            locale: request.locale,
            needs_voice: definition.needs_voice,
            parent_channel_id: parent_channel_id.clone(),
            scores: Vec::new(),
        };
        let (result, actions) = self.manager.start_at(session, driver, request.now_ms);
        match result {
            StartGameResult::Started => Ok(GameStartOutcome::Started {
                game_id: game_id.to_owned(),
                game_channel_id: request.game_channel_id,
                parent_channel_id,
                needs_voice: definition.needs_voice,
                actions,
            }),
            StartGameResult::AlreadyActive { .. } => {
                unreachable!("admission and session start must share the same manager lock")
            }
        }
    }

    pub fn handle_message_at(
        &mut self,
        message: &GameMessage,
        now_ms: i64,
    ) -> Option<GameManagerEvent> {
        self.manager.handle_message_at(message, now_ms)
    }

    pub fn advance(&mut self, now_ms: i64) -> Vec<GameManagerEvent> {
        self.manager.advance(now_ms)
    }

    pub fn advance_with_guild(&mut self, now_ms: i64) -> Vec<(String, GameManagerEvent)> {
        self.manager.advance_with_guild(now_ms)
    }

    pub fn stop(
        &mut self,
        guild_id: &str,
        user_id: &str,
        can_manage_guild: bool,
    ) -> Result<GameManagerEvent, crate::GameStopDenied> {
        self.manager.stop(guild_id, user_id, can_manage_guild)
    }

    pub fn on_voice_left(&mut self, guild_id: &str) -> GameManagerEvent {
        self.manager.on_voice_left(guild_id)
    }

    pub fn end_guild(&mut self, guild_id: &str) {
        self.manager.end_guild(guild_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{GameManagerEvent, GameMessage, GamePlayAdmission};

    fn factory() -> GameDriverFactory {
        GameDriverFactory::new(
            vec!["en_US-amy-medium".into(), "pt_PT-cadu-medium".into()],
            "en_US-amy-medium",
            "en",
        )
    }

    fn request(game_id: Option<&str>) -> GamePlayRequest {
        GamePlayRequest {
            guild_id: Some("guild".into()),
            parent_channel_id: "parent".into(),
            game_channel_id: "thread".into(),
            starter_id: "starter".into(),
            game_id: game_id.map(str::to_owned),
            language: None,
            locale: "en".into(),
            bot_voice_channel_id: Some("voice".into()),
            user_premium: false,
            guild_premium: false,
            seed: 7,
            now_ms: 100,
        }
    }

    #[test]
    fn admission_happens_before_driver_creation_or_state_mutation() {
        let mut coordinator = GameCoordinator::new(factory());
        assert_eq!(
            coordinator.start(request(None)).expect("admission"),
            GameStartOutcome::PickRequired
        );
        assert!(!coordinator.active("guild"));

        let mut missing_voice = request(Some("headsOrTails"));
        missing_voice.bot_voice_channel_id = None;
        assert_eq!(
            coordinator.start(missing_voice).expect("admission"),
            GameStartOutcome::Rejected(GamePlayAdmission::VoiceUnavailable)
        );
        assert!(!coordinator.active("guild"));
    }

    #[test]
    fn start_routes_initial_actions_and_second_start_is_rejected() {
        let mut coordinator = GameCoordinator::new(factory());
        let outcome = coordinator.start(request(Some("math"))).expect("start");
        assert!(
            matches!(outcome, GameStartOutcome::Started { actions, .. } if !actions.is_empty())
        );
        assert_eq!(coordinator.channel_of("guild"), Some("thread"));

        let second = coordinator
            .start(request(Some("math")).clone())
            .expect("lock");
        assert_eq!(
            second,
            GameStartOutcome::Rejected(GamePlayAdmission::AlreadyActive)
        );
    }

    #[test]
    fn messages_are_scoped_to_game_channel_and_finish_is_explicit() {
        let mut coordinator = GameCoordinator::new(factory());
        coordinator.start(request(Some("math"))).expect("start");
        let outside = GameMessage {
            guild_id: "guild".into(),
            channel_id: "other".into(),
            author_id: "u".into(),
            author_name: "User".into(),
            content: "1".into(),
            can_trigger_speech: true,
        };
        assert!(coordinator.handle_message_at(&outside, 110).is_none());

        let inside = GameMessage {
            channel_id: "thread".into(),
            ..outside
        };
        assert!(matches!(
            coordinator.handle_message_at(&inside, 110),
            Some(GameManagerEvent::Consumed { .. })
        ));
    }

    #[test]
    fn forced_stop_discards_the_in_memory_session_without_a_finish_event() {
        let mut coordinator = GameCoordinator::new(factory());
        coordinator.start(request(Some("math"))).expect("start");
        assert_eq!(
            coordinator.stop("guild", "starter", false).expect("stop"),
            GameManagerEvent::Stopped
        );
        assert!(!coordinator.active("guild"));
    }
}
