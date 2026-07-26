//! Opt-in gateway adapter for the personal `/birthday` command.

use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
};

use crate::ui::message_embed;
use serenity::{
    builder::{CreateInteractionResponse, CreateInteractionResponseMessage},
    client::Context,
    model::application::Interaction,
};
use vozen_discord::{
    BirthdayCommand, GatewayEventDispatchError, GatewayEventSink, VoiceResponseLocalizer,
    parse_birthday_command,
};
use vozen_store::{Birthday, SqliteStore, is_valid_birthday};

pub struct BirthdayGatewaySink {
    store: Arc<Mutex<SqliteStore>>,
    localizer: VoiceResponseLocalizer,
}

impl BirthdayGatewaySink {
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            store,
            localizer: VoiceResponseLocalizer::from_generated_contract()
                .map_err(|_| GatewayEventDispatchError)?,
        })
    }

    fn message(
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
        parsed: BirthdayCommand,
    ) -> Result<String, GatewayEventDispatchError> {
        let Some(guild_id) = command.guild_id else {
            return self.message("error.guildOnly", command, &BTreeMap::new());
        };
        let guild_id = guild_id.get().to_string();
        let user_id = command.user.id.get().to_string();
        let store = self.store.lock().map_err(|_| GatewayEventDispatchError)?;
        match parsed {
            BirthdayCommand::Set { day, month } => {
                let (day, month) = (u8::try_from(day), u8::try_from(month));
                let (Ok(day), Ok(month)) = (day, month) else {
                    return self.message("birthday.invalid", command, &BTreeMap::new());
                };
                if !is_valid_birthday(month, day) {
                    return self.message("birthday.invalid", command, &BTreeMap::new());
                }
                store
                    .set_birthday(&guild_id, &user_id, Birthday { day, month })
                    .map_err(|_| GatewayEventDispatchError)?;
                let mut parameters = BTreeMap::new();
                parameters.insert("day", day.to_string());
                parameters.insert("month", month.to_string());
                self.message("birthday.set", command, &parameters)
            }
            BirthdayCommand::Clear => {
                store
                    .clear_birthday(&guild_id, &user_id)
                    .map_err(|_| GatewayEventDispatchError)?;
                self.message("birthday.cleared", command, &BTreeMap::new())
            }
            BirthdayCommand::Show => {
                let birthday = store
                    .birthday(&guild_id, &user_id)
                    .map_err(|_| GatewayEventDispatchError)?;
                let Some(birthday) = birthday else {
                    return self.message("birthday.none", command, &BTreeMap::new());
                };
                let mut parameters = BTreeMap::new();
                parameters.insert("day", birthday.day.to_string());
                parameters.insert("month", birthday.month.to_string());
                self.message("birthday.show", command, &parameters)
            }
        }
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for BirthdayGatewaySink {
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
        let Some(parsed) =
            parse_birthday_command(&command.data).map_err(|_| GatewayEventDispatchError)?
        else {
            return Ok(());
        };
        let response = CreateInteractionResponseMessage::new()
            .embeds(vec![message_embed(self.response(&command, parsed)?)])
            .ephemeral(true);
        command
            .create_response(&context, CreateInteractionResponse::Message(response))
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        Ok(())
    }

    async fn on_guild_delete(&self, _guild_id: &str) -> Result<(), GatewayEventDispatchError> {
        Ok(())
    }
}
