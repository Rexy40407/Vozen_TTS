//! Pure state for the six-round Vozen Says game.

const ROUNDS: u8 = 6;
const REAL_IN_TEN: u32 = 6;
const REACT_WINDOW_MS: i64 = 12_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VozenSaysScore {
    pub user_id: String,
    pub points: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VozenSaysEvent {
    RoundOpened { round: u8, item: String, real: bool },
    Obeyed { user_id: String, name: String },
    Caught { user_id: String, name: String },
    Nobody { item: String },
    TrapCleared { item: String },
    Finished { scores: Vec<VozenSaysScore> },
    Ignored,
}

#[derive(Debug)]
pub struct VozenSaysGame {
    items: Vec<String>,
    round: u8,
    item: String,
    real: bool,
    done: bool,
    deadline_ms: i64,
    rng: XorShift,
    caught: Vec<String>,
    scores: Vec<VozenSaysScore>,
}

impl VozenSaysGame {
    #[must_use]
    pub fn new(items: Vec<String>, seed: i64) -> Self {
        let mut rng = XorShift::new(seed);
        let items = seeded_shuffle(items, &mut rng);
        Self {
            items,
            round: 0,
            item: String::new(),
            real: false,
            done: false,
            deadline_ms: 0,
            rng,
            caught: Vec::new(),
            scores: Vec::new(),
        }
    }

    pub fn start(&mut self, now_ms: i64) -> VozenSaysEvent {
        if self.items.is_empty() {
            self.round = ROUNDS;
            self.done = true;
            return VozenSaysEvent::Finished { scores: Vec::new() };
        }
        self.next_round(now_ms)
    }

    #[must_use]
    pub fn play(&mut self, user_id: &str, name: &str, raw: &str) -> VozenSaysEvent {
        self.play_at(user_id, name, raw, self.deadline_ms)
    }

    pub fn advance(&mut self, now_ms: i64) -> VozenSaysEvent {
        if self.done || now_ms < self.deadline_ms || self.round == 0 {
            return VozenSaysEvent::Ignored;
        }
        self.done = true;
        let item = self.item.clone();
        let event = if self.real {
            VozenSaysEvent::Nobody { item }
        } else {
            VozenSaysEvent::TrapCleared { item }
        };
        if self.round < ROUNDS {
            let _ = self.next_round(now_ms);
        }
        event
    }

    #[must_use]
    pub fn is_finished(&self) -> bool {
        self.round >= ROUNDS && self.done
    }

    #[must_use]
    pub fn round(&self) -> u8 {
        self.round
    }

    #[must_use]
    pub fn item(&self) -> &str {
        &self.item
    }

    #[must_use]
    pub fn real(&self) -> bool {
        self.real
    }

    #[must_use]
    pub fn deadline_ms(&self) -> i64 {
        self.deadline_ms
    }

    /// Clock-aware answer hook. The old `play` method remains as a compatibility wrapper.
    #[must_use]
    pub fn play_at(&mut self, user_id: &str, name: &str, raw: &str, now_ms: i64) -> VozenSaysEvent {
        if self.done || self.round == 0 || self.round > ROUNDS {
            return VozenSaysEvent::Ignored;
        }
        if normalize_answer(raw) != normalize_answer(&self.item) {
            return VozenSaysEvent::Ignored;
        }
        if self.real {
            self.done = true;
            self.add_point(user_id);
            let event = VozenSaysEvent::Obeyed {
                user_id: user_id.to_owned(),
                name: name.to_owned(),
            };
            if self.round < ROUNDS {
                let _ = self.next_round(now_ms);
            }
            return event;
        }
        if self.caught.iter().any(|caught| caught == user_id) {
            return VozenSaysEvent::Ignored;
        }
        self.caught.push(user_id.to_owned());
        VozenSaysEvent::Caught {
            user_id: user_id.to_owned(),
            name: name.to_owned(),
        }
    }

    #[must_use]
    pub fn scores(&self) -> &[VozenSaysScore] {
        &self.scores
    }

    fn next_round(&mut self, now_ms: i64) -> VozenSaysEvent {
        self.round += 1;
        self.item = self.items[(self.round as usize - 1) % self.items.len()].clone();
        self.real = self.rng.next() % 10 < REAL_IN_TEN;
        self.done = false;
        self.caught.clear();
        self.deadline_ms = now_ms.saturating_add(REACT_WINDOW_MS);
        VozenSaysEvent::RoundOpened {
            round: self.round,
            item: self.item.clone(),
            real: self.real,
        }
    }

    fn add_point(&mut self, user_id: &str) {
        if let Some(score) = self
            .scores
            .iter_mut()
            .find(|score| score.user_id == user_id)
        {
            score.points += 1;
        } else {
            self.scores.push(VozenSaysScore {
                user_id: user_id.to_owned(),
                points: 1,
            });
        }
    }
}

fn normalize_answer(input: &str) -> String {
    input
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn seeded_shuffle(mut items: Vec<String>, rng: &mut XorShift) -> Vec<String> {
    for index in (1..items.len()).rev() {
        let swap = rng.next() as usize % (index + 1);
        items.swap(index, swap);
    }
    items
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
    fn trap_catches_each_user_once_and_timeout_clears_it() {
        let mut game = VozenSaysGame::new(vec!["alpha".into(), "beta".into()], 1);
        let opened = game.start(0);
        let VozenSaysEvent::RoundOpened { item, real, .. } = opened else {
            unreachable!()
        };
        if real {
            assert!(matches!(
                game.play("u", "User", &item),
                VozenSaysEvent::Obeyed { .. }
            ));
        } else {
            assert!(matches!(
                game.play("u", "User", &item),
                VozenSaysEvent::Caught { .. }
            ));
            assert_eq!(game.play("u", "User", &item), VozenSaysEvent::Ignored);
            assert!(matches!(
                game.advance(12_000),
                VozenSaysEvent::TrapCleared { .. }
            ));
        }
    }

    #[test]
    fn seeded_order_is_repeatable_and_real_rounds_award_points() {
        let items = vec!["one".into(), "two".into(), "three".into()];
        let mut first = VozenSaysGame::new(items.clone(), 55);
        let mut second = VozenSaysGame::new(items, 55);
        assert_eq!(first.start(0), second.start(0));
        assert_eq!(first.scores(), second.scores());
        assert!(matches!(
            VozenSaysGame::new(Vec::new(), 55).start(0),
            VozenSaysEvent::Finished { scores } if scores.is_empty()
        ));
    }
}
