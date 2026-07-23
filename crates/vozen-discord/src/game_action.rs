//! Semantic rendering boundary for Rust game actions.
//!
//! Drivers only decide what happened.  This module translates those outcomes into the same
//! message keys and small display values used by the Node catalogue.  A future Discord sink can
//! therefore send the returned message and speech without reimplementing game rules.

use std::collections::BTreeMap;

use vozen_core::{CellState, ChainValidationReason, ChessColor, CoinSide, Mark, MathOperation};

use crate::{GameDriverAction, VoiceResponseLocalizer};

#[derive(Debug, Clone, PartialEq)]
pub struct GameSpeech {
    pub text: String,
    pub model: Option<String>,
    pub speed: Option<f64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RenderedGameAction {
    pub key: &'static str,
    pub parameters: BTreeMap<&'static str, String>,
    pub attachment: Option<String>,
    pub speech: Option<GameSpeech>,
}

impl RenderedGameAction {
    #[must_use]
    pub fn render(
        &self,
        localizer: &VoiceResponseLocalizer,
        interaction_locale: Option<&str>,
        guild_locale: Option<&str>,
    ) -> Option<String> {
        localizer.render_key(self.key, interaction_locale, guild_locale, &self.parameters)
    }

    #[must_use]
    pub fn content(
        &self,
        localizer: &VoiceResponseLocalizer,
        interaction_locale: Option<&str>,
        guild_locale: Option<&str>,
    ) -> Option<String> {
        let message = self.render(localizer, interaction_locale, guild_locale)?;
        Some(match &self.attachment {
            Some(attachment) if !attachment.is_empty() => format!("{message}\n{attachment}"),
            _ => message,
        })
    }
}

/// Converts one driver action into a localizable transport action.
///
/// `None` means that the action is state-only (score award, finish marker, ignored input or a
/// driver transition with no Node-side message).  No user-controlled value is ever interpreted
/// as an i18n key: dynamic values are parameters of one of the static keys below.
#[must_use]
pub fn render_game_action(action: &GameDriverAction) -> Option<RenderedGameAction> {
    match action {
        GameDriverAction::TextQuiz(action) => render_text_quiz(action),
        GameDriverAction::Hangman(action) => render_hangman(action),
        GameDriverAction::Wordle(action) => render_wordle(action),
        GameDriverAction::TicTacToe(action) => render_tictactoe(action),
        GameDriverAction::Roulette(action) => Some(message_with_attachment(
            "game.roulette.header",
            BTreeMap::new(),
            action.prompt.clone(),
            Some(GameSpeech {
                text: action.prompt.clone(),
                model: None,
                speed: None,
            }),
        )),
        GameDriverAction::Chess(action) => render_chess(action),
        GameDriverAction::NumericQuiz(action) => render_numeric(action),
        GameDriverAction::GuessLanguage(action) => render_guess_language(action),
        GameDriverAction::Reflexes(action) => render_reflexes(action),
        GameDriverAction::VozenSays(action) => render_vozen_says(action),
        GameDriverAction::WordChain(action) => render_word_chain(action),
        GameDriverAction::HeadsOrTails(action) => render_heads_or_tails(action),
        GameDriverAction::Ignored | GameDriverAction::Award { .. } | GameDriverAction::Finished => {
            None
        }
    }
}

fn message(key: &'static str, parameters: BTreeMap<&'static str, String>) -> RenderedGameAction {
    RenderedGameAction {
        key,
        parameters,
        attachment: None,
        speech: None,
    }
}

fn message_with_attachment(
    key: &'static str,
    parameters: BTreeMap<&'static str, String>,
    attachment: String,
    speech: Option<GameSpeech>,
) -> RenderedGameAction {
    RenderedGameAction {
        key,
        parameters,
        attachment: Some(attachment),
        speech,
    }
}

fn render_text_quiz(action: &crate::TextQuizDriverAction) -> Option<RenderedGameAction> {
    use crate::TextQuizDriverAction;
    match action {
        TextQuizDriverAction::RoundOpened {
            round,
            total,
            prompt,
            announce_key,
            model,
            speed,
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("n", round.to_string());
            parameters.insert("total", total.to_string());
            Some(RenderedGameAction {
                key: announce_key,
                parameters,
                attachment: None,
                speech: Some(GameSpeech {
                    text: prompt.clone(),
                    model: model.clone(),
                    speed: *speed,
                }),
            })
        }
        TextQuizDriverAction::Accepted {
            name,
            answer,
            correct_key,
            ..
        } => {
            let mut parameters = BTreeMap::new();
            insert_quiz_value(&mut parameters, name, answer);
            Some(message(correct_key, parameters))
        }
        TextQuizDriverAction::TimedOut {
            answer,
            timeout_key,
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("answer", answer.clone());
            parameters.insert("word", answer.clone());
            parameters.insert("phrase", answer.clone());
            Some(message(timeout_key, parameters))
        }
        TextQuizDriverAction::Ignored | TextQuizDriverAction::Finished => None,
    }
}

fn insert_quiz_value(parameters: &mut BTreeMap<&'static str, String>, name: &str, answer: &str) {
    parameters.insert("user", name.to_owned());
    parameters.insert("answer", answer.to_owned());
    parameters.insert("word", answer.to_owned());
    parameters.insert("phrase", answer.to_owned());
}

fn render_hangman(action: &crate::HangmanDriverAction) -> Option<RenderedGameAction> {
    use crate::HangmanDriverAction;
    match action {
        HangmanDriverAction::Intro { masked, .. } => Some(message_with_attachment(
            "game.hangman.intro",
            BTreeMap::new(),
            masked.clone(),
            None,
        )),
        HangmanDriverAction::Hit {
            name,
            letter,
            masked,
            ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("user", name.clone());
            parameters.insert("letter", letter.to_uppercase().collect());
            Some(message_with_attachment(
                "game.hangman.hit",
                parameters,
                masked.clone(),
                None,
            ))
        }
        HangmanDriverAction::Miss {
            name,
            letter,
            masked,
            ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("user", name.clone());
            parameters.insert("letter", letter.to_uppercase().collect());
            Some(message_with_attachment(
                "game.hangman.miss",
                parameters,
                masked.clone(),
                None,
            ))
        }
        HangmanDriverAction::Won {
            name, word, masked, ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("user", name.clone());
            parameters.insert("word", word.to_uppercase());
            Some(message_with_attachment(
                "game.hangman.win",
                parameters,
                masked.clone(),
                None,
            ))
        }
        HangmanDriverAction::Lost { word, masked } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("word", word.to_uppercase());
            Some(message_with_attachment(
                "game.hangman.lose",
                parameters,
                masked.clone(),
                None,
            ))
        }
        HangmanDriverAction::Idle { word, masked } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("word", word.to_uppercase());
            Some(message_with_attachment(
                "game.hangman.idle",
                parameters,
                masked.clone(),
                None,
            ))
        }
        HangmanDriverAction::WrongWord
        | HangmanDriverAction::AlreadyTried
        | HangmanDriverAction::Ignored => None,
    }
}

fn render_wordle(action: &crate::WordleDriverAction) -> Option<RenderedGameAction> {
    use crate::WordleDriverAction;
    match action {
        WordleDriverAction::Intro { max_guesses } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("max", max_guesses.to_string());
            Some(message("game.wordle.intro", parameters))
        }
        WordleDriverAction::Guess {
            name,
            rows,
            guesses_left,
            present,
            absent,
            ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("user", name.clone());
            parameters.insert("left", guesses_left.to_string());
            let keyboard = wordle_keyboard(present, absent);
            Some(message_with_attachment(
                "game.wordle.guess",
                parameters,
                join_optional_lines(&[render_wordle_grid(rows), keyboard]),
                None,
            ))
        }
        WordleDriverAction::Won {
            name,
            word,
            rows,
            guesses,
            ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("user", name.clone());
            parameters.insert("word", word.to_uppercase());
            parameters.insert("n", guesses.to_string());
            Some(message_with_attachment(
                "game.wordle.win",
                parameters,
                render_wordle_grid(rows),
                None,
            ))
        }
        WordleDriverAction::Lost { word, rows, .. } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("word", word.to_uppercase());
            Some(message_with_attachment(
                "game.wordle.lose",
                parameters,
                render_wordle_grid(rows),
                None,
            ))
        }
        WordleDriverAction::Idle { word, rows } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("word", word.to_uppercase());
            Some(message_with_attachment(
                "game.wordle.idle",
                parameters,
                render_wordle_grid(rows),
                None,
            ))
        }
        WordleDriverAction::Invalid | WordleDriverAction::Ignored => None,
    }
}

fn render_tictactoe(action: &crate::TicTacToeDriverAction) -> Option<RenderedGameAction> {
    use crate::TicTacToeDriverAction;
    match action {
        TicTacToeDriverAction::Intro { board } => Some(message_with_attachment(
            "game.tictactoe.intro",
            BTreeMap::new(),
            render_tictactoe_board(board),
            None,
        )),
        TicTacToeDriverAction::NotYourTurn { name, expected, .. } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("user", name.clone());
            parameters.insert("mark", mark_name(*expected));
            Some(message("game.tictactoe.notYourTurn", parameters))
        }
        TicTacToeDriverAction::Taken { cell } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("cell", cell.to_string());
            Some(message("game.tictactoe.taken", parameters))
        }
        TicTacToeDriverAction::Accepted { board, next, .. } => {
            let mut action = message_with_attachment(
                "game.tictactoe.turn",
                next.map_or_else(BTreeMap::new, |mark| {
                    BTreeMap::from([("mark", mark_name(mark))])
                }),
                render_tictactoe_board(board),
                None,
            );
            if next.is_none() {
                action.key = "game.tictactoe.draw";
            }
            Some(action)
        }
        TicTacToeDriverAction::Won {
            name, mark, board, ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("user", name.clone());
            parameters.insert("mark", mark_name(*mark));
            Some(message_with_attachment(
                "game.tictactoe.win",
                parameters,
                render_tictactoe_board(board),
                None,
            ))
        }
        TicTacToeDriverAction::Draw { board } => Some(message_with_attachment(
            "game.tictactoe.draw",
            BTreeMap::new(),
            render_tictactoe_board(board),
            None,
        )),
        TicTacToeDriverAction::Idle { board } => Some(message_with_attachment(
            "game.tictactoe.idle",
            BTreeMap::new(),
            render_tictactoe_board(board),
            None,
        )),
        TicTacToeDriverAction::Ignored => None,
    }
}

fn render_chess(action: &crate::ChessDriverAction) -> Option<RenderedGameAction> {
    use crate::ChessDriverAction;
    match action {
        ChessDriverAction::Intro { fen, .. } => Some(message_with_attachment(
            "game.chess.intro",
            BTreeMap::new(),
            fen.clone(),
            None,
        )),
        ChessDriverAction::NotYourTurn { name, color, .. } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("user", name.clone());
            parameters.insert("color", chess_color_name(*color));
            Some(message("game.chess.notYourTurn", parameters))
        }
        ChessDriverAction::IllegalMove { text, fen } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("move", text.clone());
            Some(message_with_attachment(
                "game.chess.illegalMove",
                parameters,
                fen.clone(),
                None,
            ))
        }
        ChessDriverAction::Spectator => None,
        ChessDriverAction::Moved {
            text,
            next,
            in_check,
            fen,
            ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("move", text.clone());
            parameters.insert("color", chess_color_name(*next));
            let attachment = if *in_check {
                format!("{}\n{}", fen, "check")
            } else {
                fen.clone()
            };
            Some(message_with_attachment(
                "game.chess.turn",
                parameters,
                attachment,
                None,
            ))
        }
        ChessDriverAction::Checkmate {
            winner_name,
            text,
            fen,
            ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("user", winner_name.clone());
            parameters.insert("move", text.clone());
            Some(message_with_attachment(
                "game.chess.checkmate",
                parameters,
                fen.clone(),
                None,
            ))
        }
        ChessDriverAction::Draw { text, fen, .. } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("move", text.clone());
            Some(message_with_attachment(
                "game.chess.draw",
                parameters,
                fen.clone(),
                None,
            ))
        }
        ChessDriverAction::Resigned {
            user_name,
            winner_name,
            fen,
            ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("user", user_name.clone());
            parameters.insert("winner", winner_name.clone());
            Some(message_with_attachment(
                "game.chess.resigned",
                parameters,
                fen.clone(),
                None,
            ))
        }
        ChessDriverAction::Idle { fen } => Some(message_with_attachment(
            "game.chess.idle",
            BTreeMap::new(),
            fen.clone(),
            None,
        )),
        ChessDriverAction::Ignored => None,
    }
}

fn render_numeric(action: &crate::NumericQuizAction) -> Option<RenderedGameAction> {
    use crate::{MathRound, NumericQuizAction, NumericQuizMode};
    match action {
        NumericQuizAction::RoundOpened {
            mode: NumericQuizMode::Math,
            round,
            total,
            math: Some(MathRound { a, b, operation }),
            ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("n", round.to_string());
            parameters.insert("total", total.to_string());
            parameters.insert("a", a.to_string());
            parameters.insert("b", b.to_string());
            parameters.insert("op", math_symbol(*operation).to_owned());
            Some(message("game.math.round", parameters))
        }
        NumericQuizAction::RoundOpened {
            mode: NumericQuizMode::SkipCount,
            round,
            total,
            sequence: Some(sequence),
            ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("n", round.to_string());
            parameters.insert("total", total.to_string());
            let mut action = message("game.skipCount.round", parameters);
            action.attachment = Some(
                sequence
                    .iter()
                    .map(ToString::to_string)
                    .collect::<Vec<_>>()
                    .join(", "),
            );
            Some(action)
        }
        NumericQuizAction::Accepted {
            mode: NumericQuizMode::Math,
            name,
            answer,
            ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("user", name.clone());
            parameters.insert("answer", answer.to_string());
            Some(message("game.math.correct", parameters))
        }
        NumericQuizAction::Accepted {
            mode: NumericQuizMode::SkipCount,
            name,
            answer,
            ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("user", name.clone());
            parameters.insert("answer", answer.to_string());
            Some(message("game.skipCount.correct", parameters))
        }
        NumericQuizAction::TimedOut {
            mode: NumericQuizMode::Math,
            answer,
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("answer", answer.to_string());
            Some(message("game.math.timeout", parameters))
        }
        NumericQuizAction::TimedOut {
            mode: NumericQuizMode::SkipCount,
            answer,
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("answer", answer.to_string());
            Some(message("game.skipCount.timeout", parameters))
        }
        NumericQuizAction::RoundOpened { .. }
        | NumericQuizAction::Finished
        | NumericQuizAction::Ignored => None,
    }
}

fn render_guess_language(action: &crate::GuessLanguageDriverAction) -> Option<RenderedGameAction> {
    use crate::GuessLanguageDriverAction;
    match action {
        GuessLanguageDriverAction::RoundOpened {
            round,
            total,
            phrase,
            model,
            ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("n", round.to_string());
            parameters.insert("total", total.to_string());
            Some(RenderedGameAction {
                key: "game.guessLanguage.round",
                parameters,
                attachment: None,
                speech: Some(GameSpeech {
                    text: phrase.clone(),
                    model: model.clone(),
                    speed: None,
                }),
            })
        }
        GuessLanguageDriverAction::Accepted { name, language, .. } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("user", name.clone());
            parameters.insert("language", language.clone());
            Some(message("game.guessLanguage.correct", parameters))
        }
        GuessLanguageDriverAction::TimedOut { language } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("language", language.clone());
            Some(message("game.guessLanguage.timeout", parameters))
        }
        GuessLanguageDriverAction::Finished | GuessLanguageDriverAction::Ignored => None,
    }
}

fn render_reflexes(action: &crate::ReflexesDriverAction) -> Option<RenderedGameAction> {
    use crate::ReflexesDriverAction;
    match action {
        ReflexesDriverAction::RoundReady { round, .. } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("n", round.to_string());
            parameters.insert("total", "3".to_owned());
            Some(message("game.reflexes.ready", parameters))
        }
        ReflexesDriverAction::Opened { .. } => Some(message("game.reflexes.go", BTreeMap::new())),
        ReflexesDriverAction::FalseStart { name, .. } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("user", name.clone());
            Some(message("game.reflexes.tooSoon", parameters))
        }
        ReflexesDriverAction::Winner { name, .. } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("user", name.clone());
            Some(message("game.reflexes.win", parameters))
        }
        ReflexesDriverAction::TooSlow { .. } => {
            Some(message("game.reflexes.tooSlow", BTreeMap::new()))
        }
        ReflexesDriverAction::Finished | ReflexesDriverAction::Ignored => None,
    }
}

fn render_vozen_says(action: &crate::VozenSaysDriverAction) -> Option<RenderedGameAction> {
    use crate::VozenSaysDriverAction;
    match action {
        VozenSaysDriverAction::RoundOpened {
            round,
            total,
            item,
            real,
            model,
            ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("n", round.to_string());
            parameters.insert("total", total.to_string());
            parameters.insert("command", item.clone());
            Some(RenderedGameAction {
                key: if *real {
                    "game.vozenSays.real"
                } else {
                    "game.vozenSays.trap"
                },
                parameters,
                attachment: None,
                speech: Some(GameSpeech {
                    text: item.clone(),
                    model: model.clone(),
                    speed: None,
                }),
            })
        }
        VozenSaysDriverAction::Obeyed { name, .. } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("user", name.clone());
            Some(message("game.vozenSays.obeyed", parameters))
        }
        VozenSaysDriverAction::Caught { name, .. } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("user", name.clone());
            Some(message("game.vozenSays.caught", parameters))
        }
        VozenSaysDriverAction::Nobody { item } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("word", item.clone());
            Some(message("game.vozenSays.nobody", parameters))
        }
        VozenSaysDriverAction::TrapCleared { item } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("word", item.clone());
            Some(message("game.vozenSays.trapCleared", parameters))
        }
        VozenSaysDriverAction::Finished | VozenSaysDriverAction::Ignored => None,
    }
}

fn render_word_chain(action: &crate::WordChainDriverAction) -> Option<RenderedGameAction> {
    use crate::WordChainDriverAction;
    match action {
        WordChainDriverAction::LobbyOpened {
            language,
            duration_ms,
            ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("lang", language.clone());
            parameters.insert("seconds", (duration_ms / 1000).to_string());
            Some(message("game.wordChain.lobby", parameters))
        }
        WordChainDriverAction::Joined { .. } => None,
        WordChainDriverAction::Turn {
            name,
            language,
            letter,
            min_length: _,
            turn_ms,
            lives,
            ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("name", name.clone());
            parameters.insert("lang", language.clone());
            parameters.insert("letter", letter.to_uppercase().collect());
            parameters.insert("hearts", "❤️".repeat(*lives as usize));
            parameters.insert("seconds", (turn_ms / 1000).to_string());
            Some(message("game.wordChain.turn", parameters))
        }
        WordChainDriverAction::Accepted {
            word, next_letter, ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("word", word.clone());
            parameters.insert("letter", next_letter.to_uppercase().collect());
            Some(message("game.wordChain.accepted", parameters))
        }
        WordChainDriverAction::Rejected {
            reason,
            letter,
            min_length,
            ..
        } => {
            let key = match reason {
                ChainValidationReason::WrongLetter => "game.wordChain.bad.letter",
                ChainValidationReason::TooShort => "game.wordChain.bad.short",
                ChainValidationReason::Repeated => "game.wordChain.bad.repeated",
                ChainValidationReason::NotAWord => "game.wordChain.bad.word",
                ChainValidationReason::NotLatin => "game.wordChain.bad.latin",
                ChainValidationReason::Ok => return None,
            };
            let mut parameters = BTreeMap::new();
            parameters.insert("letter", letter.to_uppercase().collect());
            parameters.insert("min", min_length.to_string());
            Some(message(key, parameters))
        }
        WordChainDriverAction::Timeout { name, lives, .. } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("name", name.clone());
            parameters.insert("hearts", "❤️".repeat(*lives as usize));
            Some(message("game.wordChain.timeout", parameters))
        }
        WordChainDriverAction::Eliminated { name, .. } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("name", name.clone());
            Some(message("game.wordChain.eliminated", parameters))
        }
        WordChainDriverAction::Winner {
            name, chain_length, ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("name", name.clone());
            parameters.insert("chain", chain_length.to_string());
            Some(message("game.wordChain.winner", parameters))
        }
        WordChainDriverAction::Finished | WordChainDriverAction::Ignored => None,
    }
}

fn render_heads_or_tails(action: &crate::HeadsOrTailsDriverAction) -> Option<RenderedGameAction> {
    use crate::HeadsOrTailsDriverAction;
    match action {
        HeadsOrTailsDriverAction::RoundOpened { round, total } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("n", round.to_string());
            parameters.insert("total", total.to_string());
            Some(message("game.headsOrTails.round", parameters))
        }
        HeadsOrTailsDriverAction::Revealed { side, winners, .. } => {
            let side = coin_side_name(*side);
            let mut parameters = BTreeMap::new();
            parameters.insert("side", side);
            let key = if winners.is_empty() {
                "game.headsOrTails.noWinners"
            } else {
                parameters.insert(
                    "users",
                    winners
                        .iter()
                        .map(|winner| winner.name.as_str())
                        .collect::<Vec<_>>()
                        .join(", "),
                );
                "game.headsOrTails.winners"
            };
            Some(message(key, parameters))
        }
        HeadsOrTailsDriverAction::GuessAccepted { .. }
        | HeadsOrTailsDriverAction::RoundPaused { .. }
        | HeadsOrTailsDriverAction::Finished
        | HeadsOrTailsDriverAction::Ignored => None,
    }
}

fn mark_name(mark: Mark) -> String {
    match mark {
        Mark::X => "X".to_owned(),
        Mark::O => "O".to_owned(),
    }
}

fn chess_color_name(color: ChessColor) -> String {
    match color {
        ChessColor::White => "White".to_owned(),
        ChessColor::Black => "Black".to_owned(),
    }
}

fn coin_side_name(side: CoinSide) -> String {
    match side {
        CoinSide::Heads => "heads".to_owned(),
        CoinSide::Tails => "tails".to_owned(),
    }
}

fn math_symbol(operation: MathOperation) -> &'static str {
    match operation {
        MathOperation::Plus => "+",
        MathOperation::Minus => "−",
        MathOperation::Times => "×",
    }
}

fn render_tictactoe_board(board: &[Option<Mark>; 9]) -> String {
    let cell = |index: usize| match board[index] {
        Some(mark) => mark_name(mark),
        None => (index + 1).to_string(),
    };
    format!(
        "```\n {} │ {} │ {}\n───┼───┼───\n {} │ {} │ {}\n───┼───┼───\n {} │ {} │ {}\n```",
        cell(0),
        cell(1),
        cell(2),
        cell(3),
        cell(4),
        cell(5),
        cell(6),
        cell(7),
        cell(8)
    )
}

fn render_wordle_grid(rows: &[vozen_core::WordleRow]) -> String {
    rows.iter()
        .map(|row| {
            row.letters
                .chars()
                .zip(row.states)
                .map(|(letter, state)| {
                    let tile = match state {
                        CellState::Green => "🟩",
                        CellState::Yellow => "🟨",
                        CellState::Gray => "⬛",
                    };
                    format!("{tile}{letter}")
                })
                .collect::<String>()
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn wordle_keyboard(present: &[char], absent: &[char]) -> String {
    let mut lines = Vec::new();
    if !present.is_empty() {
        lines.push(format!(
            "🟢 in word: {}",
            present.iter().collect::<String>()
        ));
    }
    if !absent.is_empty() {
        lines.push(format!("🚫 out: ~~{}~~", absent.iter().collect::<String>()));
    }
    lines.join("   ")
}

fn join_optional_lines(lines: &[String]) -> String {
    lines
        .iter()
        .filter(|line| !line.is_empty())
        .cloned()
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        GameDriverAction, HangmanDriverAction, VoiceResponseLocalizer, WordleDriverAction,
    };
    use vozen_core::{CellState, WordleRow};

    #[test]
    fn quiz_round_keeps_prompt_as_speech_and_uses_static_announcement_key() {
        let action = GameDriverAction::TextQuiz(crate::TextQuizDriverAction::RoundOpened {
            round: 2,
            total: 5,
            prompt: "bonjour".into(),
            announce_key: "game.spelling.round",
            model: Some("fr-model".into()),
            speed: None,
        });
        let rendered = render_game_action(&action).expect("rendered");
        assert_eq!(rendered.key, "game.spelling.round");
        assert_eq!(rendered.parameters["n"], "2");
        assert_eq!(rendered.speech.as_ref().expect("speech").text, "bonjour");
    }

    #[test]
    fn wordle_content_contains_grid_and_keyboard_without_debug_text() {
        let action = GameDriverAction::Wordle(WordleDriverAction::Guess {
            user_id: "u".into(),
            name: "Ana".into(),
            row: WordleRow {
                letters: "allee".into(),
                states: [
                    CellState::Green,
                    CellState::Yellow,
                    CellState::Gray,
                    CellState::Gray,
                    CellState::Green,
                ],
            },
            rows: vec![],
            guesses_left: 7,
            present: vec!['a'],
            absent: vec!['z'],
        });
        let rendered = render_game_action(&action).expect("rendered");
        assert_eq!(rendered.parameters["left"], "7");
        assert!(rendered.attachment.as_deref().unwrap().contains("in word"));
        assert!(
            !rendered
                .attachment
                .as_deref()
                .unwrap()
                .contains("WordleDriverAction")
        );
    }

    #[test]
    fn rendered_content_uses_the_generated_localizer() {
        let localizer = VoiceResponseLocalizer::from_generated_contract().expect("catalog");
        let action = render_game_action(&GameDriverAction::Hangman(HangmanDriverAction::Won {
            user_id: "u".into(),
            name: "Ana".into(),
            word: "cat".into(),
            masked: "c a t".into(),
        }))
        .expect("rendered");
        let content = action
            .content(&localizer, Some("en"), None)
            .expect("content");
        assert!(content.contains("Ana"));
        assert!(content.contains("CAT"));
    }

    #[test]
    fn state_only_actions_do_not_claim_a_discord_message() {
        assert!(
            render_game_action(&GameDriverAction::Award {
                user_id: "u".into(),
                points: 1,
            })
            .is_none()
        );
        assert!(render_game_action(&GameDriverAction::Finished).is_none());
    }
}
