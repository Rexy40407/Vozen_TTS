//! Pure one-shot state for the Roulette (truth-or-dare) game.
//!
//! Prompt localisation and the Discord voice/message adapter stay outside this module. Selection
//! is deterministic for a supplied seed, matching the Node `seededIndex` contract.

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RouletteEvent {
    Prompt { text: String },
    Empty,
    Closed,
}

#[derive(Debug, Clone)]
pub struct RouletteGame {
    prompt: Option<String>,
    done: bool,
}

impl RouletteGame {
    #[must_use]
    pub fn new<I, S>(prompts: I, seed: u64) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        let prompts = prompts.into_iter().map(Into::into).collect::<Vec<_>>();
        let prompt = (!prompts.is_empty()).then(|| {
            let index = seeded_index(seed, prompts.len());
            prompts[index].clone()
        });
        Self {
            prompt,
            done: false,
        }
    }

    #[must_use]
    pub fn start(&mut self) -> RouletteEvent {
        if self.done {
            return RouletteEvent::Closed;
        }
        self.done = true;
        match &self.prompt {
            Some(prompt) => RouletteEvent::Prompt {
                text: prompt.clone(),
            },
            None => RouletteEvent::Empty,
        }
    }

    #[must_use]
    pub fn is_done(&self) -> bool {
        self.done
    }
}

fn seeded_index(seed: u64, length: usize) -> usize {
    if length == 0 {
        return 0;
    }
    let mut state = seed as i32;
    if state == 0 {
        state = 0x9e37_79b9u32 as i32;
    }
    state ^= state.wrapping_shl(13);
    state ^= state.wrapping_shr(17);
    state ^= state.wrapping_shl(5);
    state.unsigned_abs() as usize % length
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seed_selects_one_prompt_and_the_one_shot_closes() {
        let mut first = RouletteGame::new(["truth", "dare"], 42);
        let mut second = RouletteGame::new(["truth", "dare"], 42);
        assert_eq!(first.start(), second.start());
        assert!(first.is_done());
        assert_eq!(first.start(), RouletteEvent::Closed);
    }

    #[test]
    fn no_prompts_is_explicitly_empty() {
        let mut game = RouletteGame::new(Vec::<String>::new(), 1);
        assert_eq!(game.start(), RouletteEvent::Empty);
        assert!(game.is_done());
    }
}
