//! Opt-in gateway adapter for the read-only `/game list` leaf.

use std::collections::BTreeMap;

use serenity::{
    builder::{CreateInteractionResponse, CreateInteractionResponseMessage},
    client::Context,
    model::application::Interaction,
};
use vozen_discord::{
    GatewayEventDispatchError, GatewayEventSink, VoiceResponseLocalizer, parse_game_list_command,
};

const GAME_KEYS: &[(&str, &str)] = &[
    ("game.guessLanguage.name", "game.guessLanguage.desc"),
    ("game.math.name", "game.math.desc"),
    ("game.skipCount.name", "game.skipCount.desc"),
    ("game.spelling.name", "game.spelling.desc"),
    ("game.spellOut.name", "game.spellOut.desc"),
    ("game.fastSpeech.name", "game.fastSpeech.desc"),
    ("game.accentSwap.name", "game.accentSwap.desc"),
    ("game.reflexes.name", "game.reflexes.desc"),
    ("game.vozenSays.name", "game.vozenSays.desc"),
    ("game.roulette.name", "game.roulette.desc"),
    ("game.hangman.name", "game.hangman.desc"),
    ("game.wordle.name", "game.wordle.desc"),
    ("game.tictactoe.name", "game.tictactoe.desc"),
    ("game.chess.name", "game.chess.desc"),
    ("game.wordChain.name", "game.wordChain.descr"),
    ("game.headsOrTails.name", "game.headsOrTails.desc"),
];

pub struct GameListGatewaySink {
    localizer: VoiceResponseLocalizer,
}

impl GameListGatewaySink {
    pub fn new() -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            localizer: VoiceResponseLocalizer::from_generated_contract()
                .map_err(|_| GatewayEventDispatchError)?,
        })
    }

    fn render(
        &self,
        key: &str,
        command: &serenity::model::application::CommandInteraction,
        parameters: &BTreeMap<&str, String>,
    ) -> Result<String, GatewayEventDispatchError> {
        self.localizer
            .render_key(
                key,
                Some(&command.locale),
                command.guild_locale.as_deref(),
                parameters,
            )
            .ok_or(GatewayEventDispatchError)
    }

    fn response(
        &self,
        command: &serenity::model::application::CommandInteraction,
    ) -> Result<String, GatewayEventDispatchError> {
        let mut lines = vec![self.render("game.list.title", command, &BTreeMap::new())?];
        for &(name_key, desc_key) in GAME_KEYS {
            let mut parameters = BTreeMap::new();
            parameters.insert("name", self.render(name_key, command, &BTreeMap::new())?);
            parameters.insert("desc", self.render(desc_key, command, &BTreeMap::new())?);
            lines.push(self.render("game.list.line", command, &parameters)?);
        }
        Ok(lines.join("\n"))
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for GameListGatewaySink {
    async fn on_message(
        &self,
        _context: Context,
        _message: serenity::model::channel::Message,
    ) -> Result<(), GatewayEventDispatchError> {
        Ok(())
    }

    async fn on_interaction(
        &self,
        context: Context,
        interaction: Interaction,
    ) -> Result<(), GatewayEventDispatchError> {
        let Interaction::Command(command) = interaction else {
            return Ok(());
        };
        if parse_game_list_command(&command.data)
            .map_err(|_| GatewayEventDispatchError)?
            .is_none()
        {
            return Ok(());
        }
        command
            .create_response(
                &context,
                CreateInteractionResponse::Message(
                    CreateInteractionResponseMessage::new().content(self.response(&command)?),
                ),
            )
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        Ok(())
    }

    async fn on_guild_delete(&self, _guild_id: &str) -> Result<(), GatewayEventDispatchError> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn game_registry_matches_node_order_and_size() {
        assert_eq!(GAME_KEYS.len(), 16);
        assert_eq!(
            GAME_KEYS[0],
            ("game.guessLanguage.name", "game.guessLanguage.desc")
        );
        assert_eq!(GAME_KEYS[14].1, "game.wordChain.descr");
        assert_eq!(GAME_KEYS[15].0, "game.headsOrTails.name");
    }
}
