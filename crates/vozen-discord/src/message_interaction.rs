//! Projection of Serenity message events into the private auto-read service input.
//!
//! It retains no text and performs no I/O. The event adapter must pass the original message body
//! directly to `MessageVoiceService`; this struct exists only to keep identity, roles and current
//! voice facts consistent with one gateway event.

use serenity::model::channel::Message;

use crate::{DiscordMessageFacts, GatewayState};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiscordMessageFactsOwned {
    pub guild_id: String,
    pub channel_id: String,
    pub author_id: String,
    pub author_is_bot: bool,
    pub mentioned_bot: bool,
    pub replied_to_bot: bool,
    pub author_voice_channel_id: Option<String>,
    pub bot_voice_channel_id: Option<String>,
    pub member_role_ids: Option<Vec<String>>,
}

impl DiscordMessageFactsOwned {
    /// Returns `None` before any policy or content handling when the gateway has no guild/bot
    /// identity yet. This avoids treating a cache race as authorization to speak.
    #[must_use]
    pub fn from_message(gateway_state: &GatewayState, message: &Message) -> Option<Self> {
        let guild_id = message.guild_id?.get().to_string();
        let bot_user_id = gateway_state.bot_user_id()?;
        let author_id = message.author.id.get().to_string();
        Some(Self {
            channel_id: message.channel_id.get().to_string(),
            mentioned_bot: message
                .mentions
                .iter()
                .any(|mentioned| mentioned.id.get().to_string() == bot_user_id),
            replied_to_bot: message
                .referenced_message
                .as_ref()
                .is_some_and(|referenced| referenced.author.id.get().to_string() == bot_user_id),
            author_is_bot: message.author.bot,
            author_voice_channel_id: gateway_state.voice_channel_id(&guild_id, &author_id),
            bot_voice_channel_id: gateway_state.bot_voice_channel_id(&guild_id),
            member_role_ids: message.member.as_ref().map(|member| {
                member
                    .roles
                    .iter()
                    .map(|role_id| role_id.get().to_string())
                    .collect()
            }),
            guild_id,
            author_id,
        })
    }

    #[must_use]
    pub fn as_borrowed(&self) -> DiscordMessageFacts<'_> {
        self.as_borrowed_with_autojoined(false)
    }

    /// Projects the same gateway facts after the runtime successfully auto-joined for this
    /// exact message. The marker is intentionally supplied by the caller and never persisted.
    #[must_use]
    pub fn as_borrowed_with_autojoined(
        &self,
        autojoined_for_author: bool,
    ) -> DiscordMessageFacts<'_> {
        DiscordMessageFacts {
            guild_id: &self.guild_id,
            channel_id: &self.channel_id,
            author_id: &self.author_id,
            author_is_bot: self.author_is_bot,
            mentioned_bot: self.mentioned_bot,
            replied_to_bot: self.replied_to_bot,
            author_voice_channel_id: self.author_voice_channel_id.as_deref(),
            bot_voice_channel_id: self.bot_voice_channel_id.as_deref(),
            member_role_ids: self.member_role_ids.as_deref(),
            autojoined_for_author,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn borrowed_facts_keep_optional_membership_distinct_from_an_empty_role_set() {
        let missing = DiscordMessageFactsOwned {
            guild_id: "guild".into(),
            channel_id: "text".into(),
            author_id: "user".into(),
            author_is_bot: false,
            mentioned_bot: false,
            replied_to_bot: false,
            author_voice_channel_id: Some("voice".into()),
            bot_voice_channel_id: Some("voice".into()),
            member_role_ids: None,
        };
        assert_eq!(missing.as_borrowed().member_role_ids, None);

        let empty = DiscordMessageFactsOwned {
            member_role_ids: Some(Vec::new()),
            ..missing
        };
        assert_eq!(empty.as_borrowed().member_role_ids, Some(&[][..]));
    }
}
