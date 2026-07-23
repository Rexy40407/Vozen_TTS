//! Pure timing state for the three-round Reflexes game.

const ROUNDS: u8 = 3;
const MIN_DELAY_MS: i64 = 2_000;
const MAX_EXTRA_MS: i64 = 4_000;
const OPEN_WINDOW_MS: i64 = 10_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Phase {
    Waiting,
    Open,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReflexesScore {
    pub user_id: String,
    pub points: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReflexesEvent {
    RoundReady {
        round: u8,
        delay_ms: i64,
    },
    Opened {
        round: u8,
    },
    FalseStart {
        user_id: String,
    },
    Winner {
        round: u8,
        user_id: String,
        name: String,
    },
    TooSlow {
        round: u8,
    },
    Finished {
        scores: Vec<ReflexesScore>,
    },
    Ignored,
}

#[derive(Debug)]
pub struct ReflexesGame {
    round: u8,
    phase: Option<Phase>,
    done: bool,
    deadline_ms: i64,
    rng: XorShift,
    scores: Vec<ReflexesScore>,
}

impl ReflexesGame {
    #[must_use]
    pub fn new(seed: i64) -> Self {
        Self {
            round: 0,
            phase: None,
            done: false,
            deadline_ms: 0,
            rng: XorShift::new(seed),
            scores: Vec::new(),
        }
    }

    pub fn start(&mut self, now_ms: i64) -> ReflexesEvent {
        self.next_round(now_ms)
            .expect("a new reflexes game has an opening round")
    }

    /// Opens the delayed reaction window or expires the current window. The caller should call
    /// this with a monotonic timestamp and schedule its next invocation at the returned deadline.
    pub fn advance(&mut self, now_ms: i64) -> ReflexesEvent {
        if self.phase.is_none() || self.done || now_ms < self.deadline_ms {
            return ReflexesEvent::Ignored;
        }
        match self.phase {
            Some(Phase::Waiting) => {
                self.phase = Some(Phase::Open);
                self.done = false;
                self.deadline_ms = now_ms.saturating_add(OPEN_WINDOW_MS);
                ReflexesEvent::Opened { round: self.round }
            }
            Some(Phase::Open) => {
                self.done = true;
                let round = self.round;
                if round >= ROUNDS {
                    self.phase = None;
                    return ReflexesEvent::Finished {
                        scores: self.scores.clone(),
                    };
                }
                let event = ReflexesEvent::TooSlow { round };
                let _ = self.next_round(now_ms);
                event
            }
            None => ReflexesEvent::Ignored,
        }
    }

    #[must_use]
    pub fn play(&mut self, user_id: &str, name: &str) -> ReflexesEvent {
        if self.phase.is_none() || self.done {
            return ReflexesEvent::Ignored;
        }
        if self.phase == Some(Phase::Waiting) {
            return ReflexesEvent::FalseStart {
                user_id: user_id.to_owned(),
            };
        }
        self.done = true;
        self.add_point(user_id);
        let round = self.round;
        let event = ReflexesEvent::Winner {
            round,
            user_id: user_id.to_owned(),
            name: name.to_owned(),
        };
        if self.round >= ROUNDS {
            self.phase = None;
        } else {
            let _ = self.next_round(self.deadline_ms);
        }
        event
    }

    #[must_use]
    pub fn is_finished(&self) -> bool {
        self.phase.is_none() && self.round >= ROUNDS
    }

    #[must_use]
    pub fn scores(&self) -> &[ReflexesScore] {
        &self.scores
    }

    fn next_round(&mut self, now_ms: i64) -> Option<ReflexesEvent> {
        if self.round >= ROUNDS {
            self.phase = None;
            self.done = true;
            return None;
        }
        self.round += 1;
        self.phase = Some(Phase::Waiting);
        self.done = false;
        let delay_ms = MIN_DELAY_MS + i64::from(self.rng.next() % MAX_EXTRA_MS as u32);
        self.deadline_ms = now_ms.saturating_add(delay_ms);
        Some(ReflexesEvent::RoundReady {
            round: self.round,
            delay_ms,
        })
    }

    fn add_point(&mut self, user_id: &str) {
        if let Some(score) = self
            .scores
            .iter_mut()
            .find(|score| score.user_id == user_id)
        {
            score.points += 1;
        } else {
            self.scores.push(ReflexesScore {
                user_id: user_id.to_owned(),
                points: 1,
            });
        }
    }
}

#[derive(Debug, Clone, Copy)]
struct XorShift {
    state: i32,
}

impl XorShift {
    fn new(seed: i64) -> Self {
        let state = seed as i32;
        Self {
            state: if state == 0 {
                0x9e37_79b9u32 as i32
            } else {
                state
            },
        }
    }

    fn next(&mut self) -> u32 {
        self.state ^= self.state.wrapping_shl(13);
        self.state ^= self.state.wrapping_shr(17);
        self.state ^= self.state.wrapping_shl(5);
        self.state.unsigned_abs()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn false_start_does_not_resolve_the_round_and_open_window_awards_one_point() {
        let mut game = ReflexesGame::new(42);
        let delay = match game.start(0) {
            ReflexesEvent::RoundReady { round: 1, delay_ms } => delay_ms,
            _ => unreachable!(),
        };
        assert_eq!(
            game.play("early", "Early"),
            ReflexesEvent::FalseStart {
                user_id: "early".into()
            }
        );
        assert!(matches!(game.advance(delay - 1), ReflexesEvent::Ignored));
        assert!(matches!(
            game.advance(delay),
            ReflexesEvent::Opened { round: 1 }
        ));
        assert!(matches!(
            game.play("winner", "Winner"),
            ReflexesEvent::Winner { round: 1, .. }
        ));
        assert!(matches!(
            game.advance(delay + 100_000),
            ReflexesEvent::Opened { round: 2 }
        ));
        assert_eq!(game.scores()[0].points, 1);
    }

    #[test]
    fn timeout_progresses_through_three_rounds_and_then_finishes() {
        let mut game = ReflexesGame::new(3);
        let mut now = 0;
        let _ = game.start(now);
        for round in 1..=ROUNDS {
            let open_at = now + 100_000;
            let ready = game.advance(open_at);
            assert!(matches!(ready, ReflexesEvent::Opened { .. }));
            now = open_at + OPEN_WINDOW_MS + 1;
            let result = game.advance(now);
            if round < ROUNDS {
                assert!(matches!(result, ReflexesEvent::TooSlow { .. }));
            }
        }
        assert!(game.is_finished());
        assert!(game.scores().is_empty());
    }
}
