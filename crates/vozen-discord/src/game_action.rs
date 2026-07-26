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
    pub key: Option<&'static str>,
    pub parameters: BTreeMap<&'static str, String>,
    pub parts: Option<Vec<RenderedTextPart>>,
    pub model: Option<String>,
    pub speed: Option<f64>,
}

impl GameSpeech {
    #[must_use]
    pub fn raw(text: impl Into<String>, model: Option<String>, speed: Option<f64>) -> Self {
        Self {
            text: text.into(),
            key: None,
            parameters: BTreeMap::new(),
            parts: None,
            model,
            speed,
        }
    }

    #[must_use]
    pub fn localized(
        key: &'static str,
        parameters: BTreeMap<&'static str, String>,
        model: Option<String>,
        speed: Option<f64>,
    ) -> Self {
        Self {
            text: String::new(),
            key: Some(key),
            parameters,
            parts: None,
            model,
            speed,
        }
    }

    #[must_use]
    pub fn composed(
        parts: Vec<RenderedTextPart>,
        model: Option<String>,
        speed: Option<f64>,
    ) -> Self {
        Self {
            text: String::new(),
            key: None,
            parameters: BTreeMap::new(),
            parts: Some(parts),
            model,
            speed,
        }
    }

    #[must_use]
    pub fn render(
        &self,
        localizer: &VoiceResponseLocalizer,
        interaction_locale: Option<&str>,
        guild_locale: Option<&str>,
    ) -> Option<String> {
        if let Some(parts) = &self.parts {
            return render_text_parts(parts, localizer, interaction_locale, guild_locale);
        }
        match self.key {
            Some(key) => {
                localizer.render_key(key, interaction_locale, guild_locale, &self.parameters)
            }
            None => Some(self.text.clone()),
        }
    }
}

/// Display name and points captured during one match. The durable score store keeps only the
/// Discord id; this short-lived value preserves the name needed by the final in-channel summary.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GameStanding {
    pub name: String,
    pub points: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RenderedGameAction {
    pub key: &'static str,
    pub parameters: BTreeMap<&'static str, String>,
    pub attachment: Option<String>,
    pub segments: Option<Vec<RenderedGameSegment>>,
    pub speech: Option<GameSpeech>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RenderedGameSegment {
    Text(String),
    Localized {
        key: &'static str,
        parameters: BTreeMap<&'static str, String>,
    },
    LocalizedWithParameter {
        key: &'static str,
        parameters: BTreeMap<&'static str, String>,
        parameter: &'static str,
        parts: Vec<RenderedTextPart>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RenderedTextPart {
    Text(String),
    Localized {
        key: &'static str,
        parameters: BTreeMap<&'static str, String>,
    },
    LocalizedWithParameter {
        key: &'static str,
        parameters: BTreeMap<&'static str, String>,
        parameter: &'static str,
        parts: Vec<RenderedTextPart>,
    },
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
        if let Some(segments) = &self.segments {
            let mut output = Vec::new();
            for segment in segments {
                match segment {
                    RenderedGameSegment::Text(text) => output.push(text.clone()),
                    RenderedGameSegment::Localized { key, parameters } => output.push(
                        localizer.render_key(key, interaction_locale, guild_locale, parameters)?,
                    ),
                    RenderedGameSegment::LocalizedWithParameter {
                        key,
                        parameters,
                        parameter,
                        parts,
                    } => {
                        let mut parameters = parameters.clone();
                        parameters.insert(
                            parameter,
                            render_text_parts(parts, localizer, interaction_locale, guild_locale)?,
                        );
                        output.push(localizer.render_key(
                            key,
                            interaction_locale,
                            guild_locale,
                            &parameters,
                        )?);
                    }
                }
            }
            return Some(output.join("\n"));
        }
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
        GameDriverAction::Announcement(action) => {
            let speech = action
                .speech_key
                .map(|key| {
                    GameSpeech::localized(
                        key,
                        action.speech_parameters.clone(),
                        action.model.clone(),
                        action.speed,
                    )
                })
                .or_else(|| {
                    action.speech_text.as_ref().map(|text| {
                        GameSpeech::raw(text.clone(), action.model.clone(), action.speed)
                    })
                });
            Some(RenderedGameAction {
                key: action.key,
                parameters: action.parameters.clone(),
                attachment: None,
                segments: None,
                speech,
            })
        }
        GameDriverAction::TextQuiz(action) => render_text_quiz(action),
        GameDriverAction::Hangman(action) => render_hangman(action),
        GameDriverAction::Wordle(action) => render_wordle(action),
        GameDriverAction::TicTacToe(action) => render_tictactoe(action),
        GameDriverAction::Roulette(action) => Some(message_with_attachment(
            "game.roulette.header",
            BTreeMap::new(),
            action.prompt.clone(),
            Some(GameSpeech::raw(action.prompt.clone(), None, None)),
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

/// Builds the shared final scoreboard used by every game family. The caller renders each
/// returned action with the interaction/guild locale and joins the resulting lines with newlines,
/// matching Node's `sendStandings` without embedding locale-specific text in Rust.
#[must_use]
pub fn render_game_finish(standings: &[GameStanding]) -> Vec<RenderedGameAction> {
    if standings.is_empty() {
        return vec![message("game.finish.noScores", BTreeMap::new())];
    }
    let mut ranked = standings.to_vec();
    ranked.sort_by_key(|standing| std::cmp::Reverse(standing.points));
    let winner = ranked
        .first()
        .filter(|standing| standing.points > 0)
        .cloned();
    let mut segments = vec![RenderedGameSegment::Localized {
        key: "game.finish.title",
        parameters: BTreeMap::new(),
    }];
    segments.extend(ranked.into_iter().enumerate().map(|(index, standing)| {
        let mut parameters = BTreeMap::new();
        parameters.insert("rank", rank_medal(index + 1));
        parameters.insert("user", standing.name);
        parameters.insert("points", standing.points.to_string());
        RenderedGameSegment::Localized {
            key: "game.finish.line",
            parameters,
        }
    }));
    vec![RenderedGameAction {
        key: "game.finish.title",
        parameters: BTreeMap::new(),
        attachment: None,
        segments: Some(segments),
        speech: winner.map(|standing| winner_speech(&standing.name)),
    }]
}

fn message(key: &'static str, parameters: BTreeMap<&'static str, String>) -> RenderedGameAction {
    RenderedGameAction {
        key,
        parameters,
        attachment: None,
        segments: None,
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
        segments: None,
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
                segments: None,
                speech: Some(GameSpeech::raw(prompt.clone(), model.clone(), *speed)),
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
        HangmanDriverAction::Intro {
            masked,
            remaining,
            wrong,
        } => Some(hangman_card(
            "game.hangman.intro",
            BTreeMap::new(),
            masked,
            *remaining,
            wrong,
        )),
        HangmanDriverAction::Hit {
            name,
            letter,
            masked,
            remaining,
            wrong,
            ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("user", name.clone());
            parameters.insert("letter", letter.to_uppercase().collect());
            Some(hangman_card(
                "game.hangman.hit",
                parameters,
                masked,
                *remaining,
                wrong,
            ))
        }
        HangmanDriverAction::Miss {
            name,
            letter,
            masked,
            remaining,
            wrong,
            ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("user", name.clone());
            parameters.insert("letter", letter.to_uppercase().collect());
            Some(hangman_card(
                "game.hangman.miss",
                parameters,
                masked,
                *remaining,
                wrong,
            ))
        }
        HangmanDriverAction::Won {
            name,
            word,
            masked,
            wrong,
            ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("user", name.clone());
            parameters.insert("word", word.to_uppercase());
            let mut rendered = hangman_card(
                "game.hangman.win",
                parameters,
                masked,
                6_u8.saturating_sub(wrong.len() as u8),
                wrong,
            );
            rendered.speech = Some(winner_speech(name));
            Some(rendered)
        }
        HangmanDriverAction::Lost {
            word,
            masked,
            wrong,
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("word", word.to_uppercase());
            Some(hangman_card(
                "game.hangman.lose",
                parameters,
                masked,
                0,
                wrong,
            ))
        }
        HangmanDriverAction::Idle { word, .. } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("word", word.to_uppercase());
            Some(message("game.hangman.idle", parameters))
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
            Some(wordle_card(
                "game.wordle.guess",
                parameters,
                Some(rows),
                present,
                absent,
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
            let mut rendered = wordle_card("game.wordle.win", parameters, Some(rows), &[], &[]);
            rendered.speech = Some(winner_speech(name));
            Some(rendered)
        }
        WordleDriverAction::Lost { word, rows, .. } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("word", word.to_uppercase());
            Some(wordle_card(
                "game.wordle.lose",
                parameters,
                Some(rows),
                &[],
                &[],
            ))
        }
        WordleDriverAction::Idle { word, .. } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("word", word.to_uppercase());
            Some(message("game.wordle.idle", parameters))
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
            let key = if next.is_some() {
                "game.tictactoe.turn"
            } else {
                "game.tictactoe.draw"
            };
            let parameters = next.map_or_else(BTreeMap::new, |mark| {
                BTreeMap::from([("mark", mark_name(mark))])
            });
            Some(RenderedGameAction {
                key,
                parameters: parameters.clone(),
                attachment: None,
                segments: Some(vec![
                    RenderedGameSegment::Text(render_tictactoe_board(board)),
                    RenderedGameSegment::Localized { key, parameters },
                ]),
                speech: None,
            })
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
                Some(winner_speech(name)),
            ))
        }
        TicTacToeDriverAction::Draw { board } => Some(message_with_attachment(
            "game.tictactoe.draw",
            BTreeMap::new(),
            render_tictactoe_board(board),
            None,
        )),
        TicTacToeDriverAction::Idle { .. } => Some(message("game.tictactoe.idle", BTreeMap::new())),
        TicTacToeDriverAction::Ignored => None,
    }
}

fn render_chess(action: &crate::ChessDriverAction) -> Option<RenderedGameAction> {
    use crate::ChessDriverAction;
    match action {
        ChessDriverAction::Intro {
            fen,
            white_name,
            black_name,
            ..
        } => Some(chess_card(
            "game.chess.intro",
            BTreeMap::new(),
            fen,
            white_name.as_deref(),
            black_name.as_deref(),
            true,
            false,
        )),
        ChessDriverAction::NotYourTurn { name, color, .. } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("user", name.clone());
            let color_key = match color {
                ChessColor::White => "game.chess.white",
                ChessColor::Black => "game.chess.black",
            };
            Some(RenderedGameAction {
                key: "game.chess.notYourTurn",
                parameters: parameters.clone(),
                attachment: None,
                segments: Some(vec![RenderedGameSegment::LocalizedWithParameter {
                    key: "game.chess.notYourTurn",
                    parameters,
                    parameter: "color",
                    parts: vec![RenderedTextPart::Localized {
                        key: color_key,
                        parameters: BTreeMap::new(),
                    }],
                }]),
                speech: None,
            })
        }
        ChessDriverAction::IllegalMove { text, .. } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("move", text.clone());
            Some(message("game.chess.illegalMove", parameters))
        }
        ChessDriverAction::Spectator => None,
        ChessDriverAction::Moved {
            text,
            next,
            in_check,
            fen,
            white_name,
            black_name,
            ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("move", text.clone());
            let color_key = match next {
                ChessColor::White => "game.chess.white",
                ChessColor::Black => "game.chess.black",
            };
            let mut rendered = chess_card(
                "game.chess.turn",
                parameters,
                fen,
                white_name.as_deref(),
                black_name.as_deref(),
                false,
                *in_check,
            );
            if let Some(segments) = rendered.segments.as_mut() {
                let note = segments
                    .iter_mut()
                    .find(|segment| {
                        matches!(
                            segment,
                            RenderedGameSegment::Localized {
                                key: "game.chess.turn",
                                ..
                            }
                        )
                    })
                    .expect("turn note is part of the chess card");
                let parameters = match note {
                    RenderedGameSegment::Localized { parameters, .. } => parameters.clone(),
                    _ => unreachable!(),
                };
                *note = RenderedGameSegment::LocalizedWithParameter {
                    key: "game.chess.turn",
                    parameters,
                    parameter: "color",
                    parts: vec![RenderedTextPart::Localized {
                        key: color_key,
                        parameters: BTreeMap::new(),
                    }],
                };
            }
            Some(rendered)
        }
        ChessDriverAction::Checkmate {
            winner_name,
            text,
            fen,
            white_name,
            black_name,
            ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("user", winner_name.clone());
            parameters.insert("move", text.clone());
            let mut rendered = chess_card(
                "game.chess.checkmate",
                parameters,
                fen,
                white_name.as_deref(),
                black_name.as_deref(),
                true,
                false,
            );
            rendered.speech = Some(winner_speech(winner_name));
            Some(rendered)
        }
        ChessDriverAction::Draw {
            text,
            fen,
            white_name,
            black_name,
            ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("move", text.clone());
            Some(chess_card(
                "game.chess.draw",
                parameters,
                fen,
                white_name.as_deref(),
                black_name.as_deref(),
                true,
                false,
            ))
        }
        ChessDriverAction::Resigned {
            user_name,
            winner_name,
            ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("user", user_name.clone());
            parameters.insert("winner", winner_name.clone());
            let mut rendered = message("game.chess.resigned", parameters);
            rendered.speech = Some(winner_speech(winner_name));
            Some(rendered)
        }
        ChessDriverAction::Idle { .. } => Some(message("game.chess.idle", BTreeMap::new())),
        ChessDriverAction::Ignored => None,
    }
}

fn render_text_parts(
    parts: &[RenderedTextPart],
    localizer: &VoiceResponseLocalizer,
    interaction_locale: Option<&str>,
    guild_locale: Option<&str>,
) -> Option<String> {
    let mut output = String::new();
    for part in parts {
        match part {
            RenderedTextPart::Text(text) => output.push_str(text),
            RenderedTextPart::Localized { key, parameters } => output.push_str(
                &localizer.render_key(key, interaction_locale, guild_locale, parameters)?,
            ),
            RenderedTextPart::LocalizedWithParameter {
                key,
                parameters,
                parameter,
                parts,
            } => {
                let mut parameters = parameters.clone();
                parameters.insert(
                    parameter,
                    render_text_parts(parts, localizer, interaction_locale, guild_locale)?,
                );
                output.push_str(&localizer.render_key(
                    key,
                    interaction_locale,
                    guild_locale,
                    &parameters,
                )?);
            }
        }
    }
    Some(output)
}

#[allow(clippy::too_many_arguments)]
fn chess_card(
    key: &'static str,
    parameters: BTreeMap<&'static str, String>,
    fen: &str,
    white_name: Option<&str>,
    black_name: Option<&str>,
    note_first: bool,
    in_check: bool,
) -> RenderedGameAction {
    let seats = RenderedGameSegment::Localized {
        key: "game.chess.seats",
        parameters: BTreeMap::from([
            ("white", white_name.unwrap_or("?").to_owned()),
            ("black", black_name.unwrap_or("?").to_owned()),
        ]),
    };
    let note = RenderedGameSegment::Localized {
        key,
        parameters: parameters.clone(),
    };
    let mut board = vec![seats, RenderedGameSegment::Text(render_chess_board(fen))];
    let mut segments = if note_first {
        let mut result = vec![note];
        result.append(&mut board);
        result
    } else {
        board.push(note);
        board
    };
    if in_check {
        segments.push(RenderedGameSegment::Localized {
            key: "game.chess.check",
            parameters: BTreeMap::new(),
        });
    }
    RenderedGameAction {
        key,
        parameters,
        attachment: None,
        segments: Some(segments),
        speech: None,
    }
}

fn render_chess_board(fen: &str) -> String {
    let board = fen.split_whitespace().next().unwrap_or_default();
    let files = "a b c d e f g h";
    let mut lines = vec![format!("  {files}")];
    for (index, row) in board.split('/').take(8).enumerate() {
        let mut cells = Vec::new();
        for character in row.chars() {
            if let Some(empty) = character.to_digit(10) {
                cells.extend(std::iter::repeat_n(".".to_owned(), empty as usize));
            } else {
                cells.push(character.to_string());
            }
        }
        let rank = 8_usize.saturating_sub(index);
        lines.push(format!("{rank} {} {rank}", cells.join(" ")));
    }
    lines.push(format!("  {files}"));
    format!("```\n{}\n```", lines.join("\n"))
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
            let operation_key = match operation {
                MathOperation::Plus => "game.math.plus",
                MathOperation::Minus => "game.math.minus",
                MathOperation::Times => "game.math.times",
            };
            Some(RenderedGameAction {
                key: "game.math.round",
                parameters,
                attachment: None,
                segments: None,
                speech: Some(GameSpeech::composed(
                    vec![
                        RenderedTextPart::Text(format!("{a} ")),
                        RenderedTextPart::Localized {
                            key: operation_key,
                            parameters: BTreeMap::new(),
                        },
                        RenderedTextPart::Text(format!(" {b}")),
                    ],
                    None,
                    None,
                )),
            })
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
            Some(RenderedGameAction {
                key: "game.skipCount.round",
                parameters,
                // The missing number is the answer. Node only speaks this sequence; showing it
                // in the card gives the puzzle away.
                attachment: None,
                segments: None,
                speech: Some(GameSpeech::raw(
                    sequence
                        .iter()
                        .map(ToString::to_string)
                        .collect::<Vec<_>>()
                        .join(", "),
                    None,
                    None,
                )),
            })
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
                segments: None,
                speech: Some(GameSpeech::raw(phrase.clone(), model.clone(), None)),
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
            Some(RenderedGameAction {
                key: "game.reflexes.ready",
                parameters,
                attachment: None,
                segments: None,
                speech: Some(GameSpeech::localized(
                    "game.reflexes.countdown",
                    BTreeMap::new(),
                    None,
                    None,
                )),
            })
        }
        ReflexesDriverAction::Opened { .. } => Some(RenderedGameAction {
            key: "game.reflexes.go",
            parameters: BTreeMap::new(),
            attachment: None,
            segments: None,
            speech: Some(GameSpeech::localized(
                "game.reflexes.goVoice",
                BTreeMap::new(),
                None,
                None,
            )),
        }),
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
            let mut command = Vec::new();
            if *real {
                command.push(RenderedTextPart::Localized {
                    key: "game.vozenSays.prefix",
                    parameters: BTreeMap::new(),
                });
                command.push(RenderedTextPart::Text(", ".to_owned()));
            }
            command.push(RenderedTextPart::Localized {
                key: "game.vozenSays.verb",
                parameters: BTreeMap::new(),
            });
            command.push(RenderedTextPart::Text(format!(" {item}")));
            let key = if *real {
                "game.vozenSays.real"
            } else {
                "game.vozenSays.trap"
            };
            Some(RenderedGameAction {
                key,
                parameters: parameters.clone(),
                attachment: None,
                segments: Some(vec![RenderedGameSegment::LocalizedWithParameter {
                    key,
                    parameters,
                    parameter: "command",
                    parts: command.clone(),
                }]),
                speech: Some(GameSpeech::composed(command, model.clone(), None)),
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
            parameters.insert("lang", word_chain_language_name(language).to_owned());
            parameters.insert("seconds", (duration_ms / 1000).to_string());
            Some(message("game.wordChain.lobby", parameters))
        }
        WordChainDriverAction::Joined { .. } => None,
        WordChainDriverAction::Started {
            players,
            language,
            welcome,
            model,
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("players", players.clone());
            parameters.insert("lang", word_chain_language_name(language).to_owned());
            Some(RenderedGameAction {
                key: "game.wordChain.begin",
                parameters,
                attachment: None,
                segments: None,
                speech: Some(GameSpeech::raw(welcome.clone(), model.clone(), None)),
            })
        }
        WordChainDriverAction::NotEnough => {
            Some(message("game.wordChain.notEnough", BTreeMap::new()))
        }
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
            word,
            next_letter,
            model,
            ..
        } => {
            let mut parameters = BTreeMap::new();
            parameters.insert("word", word.clone());
            parameters.insert("letter", next_letter.to_uppercase().collect());
            Some(RenderedGameAction {
                key: "game.wordChain.accepted",
                parameters,
                attachment: None,
                segments: None,
                speech: Some(GameSpeech::raw(word.clone(), model.clone(), None)),
            })
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
            Some(RenderedGameAction {
                key: "game.headsOrTails.round",
                parameters,
                attachment: None,
                segments: None,
                speech: Some(GameSpeech::localized(
                    "game.headsOrTails.roundVoice",
                    BTreeMap::new(),
                    None,
                    None,
                )),
            })
        }
        HeadsOrTailsDriverAction::Revealed { side, winners, .. } => {
            let side_key = match side {
                CoinSide::Heads => "game.headsOrTails.heads",
                CoinSide::Tails => "game.headsOrTails.tails",
            };
            let mut parameters = BTreeMap::new();
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
            Some(RenderedGameAction {
                key,
                parameters: parameters.clone(),
                attachment: None,
                segments: Some(vec![RenderedGameSegment::LocalizedWithParameter {
                    key,
                    parameters,
                    parameter: "side",
                    parts: vec![RenderedTextPart::Localized {
                        key: side_key,
                        parameters: BTreeMap::new(),
                    }],
                }]),
                speech: Some(GameSpeech::composed(
                    vec![RenderedTextPart::LocalizedWithParameter {
                        key: "game.headsOrTails.resultVoice",
                        parameters: BTreeMap::new(),
                        parameter: "side",
                        parts: vec![RenderedTextPart::Localized {
                            key: side_key,
                            parameters: BTreeMap::new(),
                        }],
                    }],
                    None,
                    None,
                )),
            })
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

fn winner_speech(name: &str) -> GameSpeech {
    GameSpeech::localized(
        "game.finish.winnerVoice",
        BTreeMap::from([("user", name.to_owned())]),
        None,
        None,
    )
}

fn wordle_card(
    key: &'static str,
    parameters: BTreeMap<&'static str, String>,
    rows: Option<&[vozen_core::WordleRow]>,
    present: &[char],
    absent: &[char],
) -> RenderedGameAction {
    let mut segments = Vec::new();
    if let Some(rows) = rows {
        segments.push(RenderedGameSegment::Text(render_wordle_grid(rows)));
    }
    segments.push(RenderedGameSegment::Localized {
        key,
        parameters: parameters.clone(),
    });
    if !present.is_empty() {
        segments.push(RenderedGameSegment::Localized {
            key: "game.wordle.inWord",
            parameters: BTreeMap::from([("letters", spaced_uppercase(present))]),
        });
    }
    if !absent.is_empty() {
        segments.push(RenderedGameSegment::Localized {
            key: "game.wordle.out",
            parameters: BTreeMap::from([("letters", spaced_uppercase(absent))]),
        });
    }
    RenderedGameAction {
        key,
        parameters,
        attachment: None,
        segments: Some(segments),
        speech: None,
    }
}

fn spaced_uppercase(letters: &[char]) -> String {
    letters
        .iter()
        .flat_map(|letter| letter.to_uppercase())
        .map(|letter| letter.to_string())
        .collect::<Vec<_>>()
        .join(" ")
}

fn word_chain_language_name(language: &str) -> &str {
    match language {
        "pt" => "Português",
        "es" => "Español",
        "fr" => "Français",
        _ => "English",
    }
}

fn hangman_card(
    key: &'static str,
    parameters: BTreeMap<&'static str, String>,
    masked: &str,
    remaining: u8,
    wrong: &[char],
) -> RenderedGameAction {
    let mut segments = vec![
        RenderedGameSegment::Localized {
            key,
            parameters: parameters.clone(),
        },
        RenderedGameSegment::Text(format!("`{masked}`")),
        RenderedGameSegment::Text(format!(
            "{}{}",
            "❤️".repeat(remaining as usize),
            "🖤".repeat(wrong.len())
        )),
    ];
    if !wrong.is_empty() {
        let wrong = wrong
            .iter()
            .flat_map(|letter| letter.to_uppercase())
            .map(|letter| letter.to_string())
            .collect::<Vec<_>>()
            .join(" ");
        segments.push(RenderedGameSegment::Localized {
            key: "game.hangman.wrongLetters",
            parameters: BTreeMap::from([("letters", wrong)]),
        });
    }
    RenderedGameAction {
        key,
        parameters,
        attachment: None,
        segments: Some(segments),
        speech: None,
    }
}

fn rank_medal(rank: usize) -> String {
    match rank {
        1 => "🥇".to_owned(),
        2 => "🥈".to_owned(),
        3 => "🥉".to_owned(),
        _ => format!("#{rank}"),
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
    let rows = rows
        .iter()
        .map(|row| {
            row.letters
                .chars()
                .zip(row.states)
                .map(|(letter, state)| {
                    let sgr = match state {
                        CellState::Green => "1;30;42",
                        CellState::Yellow => "1;30;43",
                        CellState::Gray => "1;37;40",
                    };
                    format!("\u{1b}[{sgr}m {} \u{1b}[0m", letter.to_uppercase())
                })
                .collect::<String>()
        })
        .collect::<Vec<_>>()
        .join("\n");
    format!("```ansi\n{rows}\n```")
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
    fn composed_game_text_reuses_the_original_locale_keys() {
        let localizer = VoiceResponseLocalizer::from_generated_contract().expect("catalog");

        let math = render_game_action(&GameDriverAction::NumericQuiz(
            crate::NumericQuizAction::RoundOpened {
                mode: crate::NumericQuizMode::Math,
                round: 1,
                total: 5,
                math: Some(crate::MathRound {
                    a: 12,
                    b: 4,
                    operation: MathOperation::Plus,
                }),
                sequence: None,
            },
        ))
        .expect("math");
        assert_eq!(
            math.speech
                .as_ref()
                .and_then(|speech| speech.render(&localizer, Some("pt"), None))
                .as_deref(),
            Some("12 mais 4")
        );

        let says = render_game_action(&GameDriverAction::VozenSays(
            crate::VozenSaysDriverAction::RoundOpened {
                round: 2,
                total: 6,
                item: "batata".into(),
                real: true,
                delay_ms: 12_000,
                model: None,
            },
        ))
        .expect("vozen says");
        assert_eq!(
            says.content(&localizer, Some("pt"), None).as_deref(),
            Some("🗣️ Ronda 2/6 — «Vozen diz, escrevam batata»")
        );
        assert_eq!(
            says.speech
                .as_ref()
                .and_then(|speech| speech.render(&localizer, Some("pt"), None))
                .as_deref(),
            Some("Vozen diz, escrevam batata")
        );
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
        let localizer = VoiceResponseLocalizer::from_generated_contract().expect("catalog");
        let content = rendered
            .content(&localizer, Some("en"), None)
            .expect("content");
        assert!(content.contains("in word"));
        assert!(!content.contains("WordleDriverAction"));
    }

    #[test]
    fn rendered_content_uses_the_generated_localizer() {
        let localizer = VoiceResponseLocalizer::from_generated_contract().expect("catalog");
        let action = render_game_action(&GameDriverAction::Hangman(HangmanDriverAction::Won {
            user_id: "u".into(),
            name: "Ana".into(),
            word: "cat".into(),
            masked: "c a t".into(),
            wrong: Vec::new(),
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

    #[test]
    fn finish_renderer_matches_node_order_and_empty_state() {
        let empty = render_game_finish(&[]);
        assert_eq!(empty.len(), 1);
        assert_eq!(empty[0].key, "game.finish.noScores");

        let rendered = render_game_finish(&[
            GameStanding {
                name: "Kai".into(),
                points: 1,
            },
            GameStanding {
                name: "Ana".into(),
                points: 3,
            },
            GameStanding {
                name: "Bea".into(),
                points: 3,
            },
            GameStanding {
                name: "Leo".into(),
                points: 0,
            },
        ]);
        assert_eq!(rendered.len(), 1);
        assert_eq!(rendered[0].key, "game.finish.title");
        let segments = rendered[0].segments.as_ref().expect("scoreboard segments");
        assert_eq!(segments.len(), 5);
        let RenderedGameSegment::Localized { parameters, .. } = &segments[1] else {
            panic!("first ranking line");
        };
        assert_eq!(parameters["rank"], "🥇");
        assert_eq!(parameters["user"], "Ana");
        let RenderedGameSegment::Localized { parameters, .. } = &segments[4] else {
            panic!("fourth ranking line");
        };
        assert_eq!(parameters["rank"], "#4");
        assert_eq!(
            rendered[0].speech.as_ref().and_then(|speech| speech.key),
            Some("game.finish.winnerVoice")
        );
    }
}
