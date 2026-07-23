//! Opt-in adapter for the direct `/pronunciation` and `/server-pronunciation` leaves.
//!
//! The add-without-options form remains Node-owned because Node opens and waits for a modal.
//! Rust therefore only claims list/remove and adds that already contain both strings. This keeps
//! the staged gateway boundary response-safe while sharing the same SQLite rows as Node's speech
//! pipeline.

use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
};

use serenity::{
    builder::{CreateInteractionResponse, CreateInteractionResponseMessage},
    client::Context,
    model::{Permissions, application::Interaction},
};
use vozen_discord::{
    GatewayEventDispatchError, GatewayEventSink, PronunciationCommand, PronunciationInvocation,
    PronunciationOutcome, PronunciationScope, PronunciationService, VoiceResponseLocalizer,
    parse_pronunciation_command,
};
use vozen_store::SqliteStore;

use crate::system_now_ms;

pub struct PronunciationGatewaySink {
    service: PronunciationService,
    localizer: VoiceResponseLocalizer,
    kofi_url: String,
}

impl PronunciationGatewaySink {
    pub fn new(
        store: Arc<Mutex<SqliteStore>>,
        kofi_url: String,
    ) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            service: PronunciationService::new(store),
            localizer: VoiceResponseLocalizer::from_generated_contract()
                .map_err(|_| GatewayEventDispatchError)?,
            kofi_url,
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
        outcome: PronunciationOutcome,
    ) -> Result<String, GatewayEventDispatchError> {
        let mut parameters = BTreeMap::new();
        match outcome {
            PronunciationOutcome::List {
                scope,
                entries,
                limit,
            } => {
                parameters.insert("count", entries.len().to_string());
                parameters.insert("limit", limit.to_string());
                let key = match scope {
                    PronunciationScope::Personal => "pron.listHeader",
                    PronunciationScope::Server => "spron.listHeader",
                };
                let header = self.message(key, command, &parameters)?;
                let empty_key = match scope {
                    PronunciationScope::Personal => "pron.listEmpty",
                    PronunciationScope::Server => "spron.listEmpty",
                };
                let body = if entries.is_empty() {
                    self.message(empty_key, command, &BTreeMap::new())?
                } else {
                    entries
                        .iter()
                        .map(|entry| format!("- {} -> {}", entry.term, entry.replacement))
                        .collect::<Vec<_>>()
                        .join("\n")
                };
                Ok(format!("{header}\n{body}"))
            }
            PronunciationOutcome::OpenAddForm { .. } => {
                // This branch is intentionally not promoted; Node owns the modal workflow.
                Err(GatewayEventDispatchError)
            }
            PronunciationOutcome::Added {
                scope,
                term,
                replacement,
                ..
            } => {
                parameters.insert("term", term);
                parameters.insert("replacement", replacement);
                self.message(
                    match scope {
                        PronunciationScope::Personal => "pron.set",
                        PronunciationScope::Server => "spron.set",
                    },
                    command,
                    &parameters,
                )
            }
            PronunciationOutcome::Limit { scope, limit } => {
                parameters.insert("limit", limit.to_string());
                let mut content = self.message(
                    match scope {
                        PronunciationScope::Personal => "pron.limitHit",
                        PronunciationScope::Server => "spron.limitHit",
                    },
                    command,
                    &parameters,
                )?;
                if scope == PronunciationScope::Personal && limit == 3 {
                    let mut upsell = BTreeMap::new();
                    upsell.insert("url", self.kofi_url.clone());
                    content.push('\n');
                    content.push_str(&self.message("pron.limitUpsell", command, &upsell)?);
                }
                Ok(content)
            }
            PronunciationOutcome::Removed { scope, term } => {
                parameters.insert("term", term);
                self.message(
                    match scope {
                        PronunciationScope::Personal => "pron.removed",
                        PronunciationScope::Server => "spron.removed",
                    },
                    command,
                    &parameters,
                )
            }
            PronunciationOutcome::NotFound { scope, term } => {
                parameters.insert("term", term);
                self.message(
                    match scope {
                        PronunciationScope::Personal => "pron.notFound",
                        PronunciationScope::Server => "spron.notFound",
                    },
                    command,
                    &parameters,
                )
            }
            PronunciationOutcome::NeedsManageGuild | PronunciationOutcome::GuildRequired => {
                self.message("error.needManageGuild", command, &BTreeMap::new())
            }
            PronunciationOutcome::StoreUnavailable => {
                self.message("error.generic", command, &BTreeMap::new())
            }
        }
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for PronunciationGatewaySink {
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
            parse_pronunciation_command(&command.data).map_err(|_| GatewayEventDispatchError)?
        else {
            return Ok(());
        };
        if matches!(parsed, PronunciationCommand::OpenAddForm { .. }) {
            return Ok(());
        }
        let guild_id = command.guild_id.map(|id| id.get().to_string());
        let user_id = command.user.id.get().to_string();
        let can_manage_guild = command
            .member
            .as_ref()
            .and_then(|member| member.permissions)
            .is_some_and(|permissions| permissions.contains(Permissions::MANAGE_GUILD));
        let outcome = self.service.execute(
            PronunciationInvocation {
                user_id: &user_id,
                guild_id: guild_id.as_deref(),
                can_manage_guild,
                now_ms: system_now_ms(),
            },
            parsed.clone(),
        );
        let content = self.response(&command, outcome)?;
        command
            .create_response(
                &context,
                CreateInteractionResponse::Message(
                    CreateInteractionResponseMessage::new()
                        .content(content)
                        .ephemeral(true),
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
    use vozen_core::PronunciationEntry;

    #[test]
    fn list_response_keeps_node_shape_and_scope_copy() {
        let sink = PronunciationGatewaySink::new(
            Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store"))),
            "https://ko-fi.com/vozen".into(),
        )
        .expect("sink");
        let command: serenity::model::application::CommandInteraction = serde_json::from_str(
            r#"{"id":"1","application_id":"1","data":{"id":"1","name":"pronunciation","type":1,"options":[{"name":"list","type":1,"options":[]}]},"guild_id":"2","channel_id":"3","member":null,"user":{"id":"4","username":"user","discriminator":"0"},"token":"token","version":1,"app_permissions":null,"locale":"en-US","guild_locale":null,"entitlements":[],"authorizing_integration_owners":{},"context":null,"attachment_size_limit":0}"#,
        ).expect("command");
        let content = sink
            .response(
                &command,
                PronunciationOutcome::List {
                    scope: PronunciationScope::Personal,
                    entries: vec![PronunciationEntry {
                        term: "gg".into(),
                        replacement: "good game".into(),
                    }],
                    limit: 3,
                },
            )
            .expect("response");
        assert!(content.contains("Your pronunciations"));
        assert!(content.contains("- gg -> good game"));
    }
}
