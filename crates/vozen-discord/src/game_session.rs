//! Pure in-memory session boundary for the Rust game manager.
//!
//! Discord transport, timers and game rules stay outside this type. It owns only the durable
//! invariants that the Node `GameManager` currently provides: one match per guild, scoped stop
//! authorization, voice-loss teardown and insertion-ordered score accumulation.

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GameScore {
    pub user_id: String,
    pub points: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GameSession {
    pub guild_id: String,
    pub channel_id: String,
    pub game_id: String,
    pub starter_id: String,
    pub locale: String,
    pub needs_voice: bool,
    pub parent_channel_id: Option<String>,
    pub scores: Vec<GameScore>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StartGameResult {
    Started,
    AlreadyActive { channel_id: String },
}

#[derive(Debug, Default)]
pub struct GameSessionStore {
    sessions: std::collections::BTreeMap<String, GameSession>,
}

impl GameSessionStore {
    pub fn active(&self, guild_id: &str) -> bool {
        self.sessions.contains_key(guild_id)
    }

    pub fn channel_of(&self, guild_id: &str) -> Option<&str> {
        self.sessions
            .get(guild_id)
            .map(|session| session.channel_id.as_str())
    }

    /// Returns whether an incoming message belongs to the active match. The Node manager uses
    /// this exact guild + channel boundary so guesses in another channel still follow normal
    /// message handling.
    pub fn channel_matches(&self, guild_id: &str, channel_id: &str) -> bool {
        self.sessions
            .get(guild_id)
            .is_some_and(|session| session.channel_id == channel_id)
    }

    /// Borrows the active session without exposing the internal guild map. Runtime adapters use
    /// this for authorization and for rebuilding their response after a state transition.
    pub fn session(&self, guild_id: &str) -> Option<&GameSession> {
        self.sessions.get(guild_id)
    }

    pub fn is_starter(&self, guild_id: &str, user_id: &str) -> bool {
        self.sessions
            .get(guild_id)
            .is_some_and(|session| session.starter_id == user_id)
    }

    pub fn start(&mut self, session: GameSession) -> StartGameResult {
        if let Some(existing) = self.sessions.get(&session.guild_id) {
            return StartGameResult::AlreadyActive {
                channel_id: existing.channel_id.clone(),
            };
        }
        self.sessions.insert(session.guild_id.clone(), session);
        StartGameResult::Started
    }

    pub fn award(&mut self, guild_id: &str, user_id: &str, points: i64) -> bool {
        let Some(session) = self.sessions.get_mut(guild_id) else {
            return false;
        };
        if let Some(score) = session
            .scores
            .iter_mut()
            .find(|score| score.user_id == user_id)
        {
            score.points += points;
        } else {
            session.scores.push(GameScore {
                user_id: user_id.to_owned(),
                points,
            });
        }
        true
    }

    pub fn stop(&mut self, guild_id: &str) -> Option<GameSession> {
        self.sessions.remove(guild_id)
    }

    /// Applies the Node `/game stop` authorization rule and removes the match only when the
    /// caller is the starter or has Manage Guild. A denied stop leaves the session untouched.
    pub fn stop_authorized(
        &mut self,
        guild_id: &str,
        user_id: &str,
        can_manage_guild: bool,
    ) -> Result<Option<GameSession>, GameStopDenied> {
        let Some(session) = self.sessions.get(guild_id) else {
            return Ok(None);
        };
        if !can_manage_guild && session.starter_id != user_id {
            return Err(GameStopDenied);
        }
        Ok(self.sessions.remove(guild_id))
    }

    pub fn on_voice_left(&mut self, guild_id: &str) -> Option<GameSession> {
        let should_stop = self
            .sessions
            .get(guild_id)
            .is_some_and(|session| session.needs_voice);
        should_stop.then(|| self.sessions.remove(guild_id).expect("session exists"))
    }

    pub fn end_guild(&mut self, guild_id: &str) -> Option<GameSession> {
        self.sessions.remove(guild_id)
    }

    pub fn finish(&mut self, guild_id: &str) -> Option<GameSession> {
        self.sessions.remove(guild_id)
    }

    /// Finishes a normal match and returns its accumulated points for one transactional SQLite
    /// write. Forced teardown must use `stop`/`end_guild` and deliberately discard this value.
    pub fn finish_scores(&mut self, guild_id: &str) -> Option<Vec<GameScore>> {
        self.finish(guild_id).map(|session| session.scores)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct GameStopDenied;

#[cfg(test)]
mod tests {
    use super::*;

    fn session(needs_voice: bool) -> GameSession {
        GameSession {
            guild_id: "guild".into(),
            channel_id: "thread".into(),
            game_id: "headsOrTails".into(),
            starter_id: "starter".into(),
            locale: "en-US".into(),
            needs_voice,
            parent_channel_id: Some("parent".into()),
            scores: Vec::new(),
        }
    }

    #[test]
    fn enforces_one_session_per_guild_and_scoped_stop_identity() {
        let mut store = GameSessionStore::default();
        assert_eq!(store.start(session(true)), StartGameResult::Started);
        assert_eq!(store.channel_of("guild"), Some("thread"));
        assert!(store.is_starter("guild", "starter"));
        assert!(!store.is_starter("guild", "other"));
        assert_eq!(
            store.start(session(true)),
            StartGameResult::AlreadyActive {
                channel_id: "thread".into()
            }
        );
    }

    #[test]
    fn awards_keep_insertion_order_and_voice_loss_only_ends_voice_games() {
        let mut store = GameSessionStore::default();
        store.start(session(false));
        store.award("guild", "first", 1);
        store.award("guild", "second", 2);
        store.award("guild", "first", 1);
        assert_eq!(
            store.sessions["guild"].scores,
            vec![
                GameScore {
                    user_id: "first".into(),
                    points: 2
                },
                GameScore {
                    user_id: "second".into(),
                    points: 2
                }
            ]
        );
        assert!(store.on_voice_left("guild").is_none());
        assert!(store.active("guild"));
        assert!(store.stop("guild").is_some());

        store.start(session(true));
        assert!(store.on_voice_left("guild").is_some());
        assert!(!store.active("guild"));
    }

    #[test]
    fn message_routing_and_normal_finish_return_only_the_active_match_scores() {
        let mut store = GameSessionStore::default();
        store.start(session(false));
        assert!(store.channel_matches("guild", "thread"));
        assert!(!store.channel_matches("guild", "other"));
        store.award("guild", "winner", 3);
        assert_eq!(
            store.finish_scores("guild"),
            Some(vec![GameScore {
                user_id: "winner".into(),
                points: 3,
            }])
        );
        assert!(!store.active("guild"));
        assert_eq!(store.finish_scores("guild"), None);
    }

    #[test]
    fn stop_authorization_is_scoped_and_denial_preserves_the_match() {
        let mut store = GameSessionStore::default();
        store.start(session(false));
        assert_eq!(
            store.stop_authorized("guild", "other", false),
            Err(GameStopDenied)
        );
        assert!(store.active("guild"));
        assert!(
            store
                .stop_authorized("guild", "starter", false)
                .expect("starter may stop")
                .is_some()
        );

        store.start(session(false));
        assert!(
            store
                .stop_authorized("guild", "manager", true)
                .expect("manager may stop")
                .is_some()
        );
        assert_eq!(store.stop_authorized("guild", "missing", true), Ok(None));
    }
}
