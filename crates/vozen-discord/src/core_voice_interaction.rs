//! Projection of a real Serenity command into the narrow core-voice invocation boundary.
//!
//! The projection deliberately carries only the Discord facts needed by the service. It does not
//! fetch members, request the privileged member intent, or infer a voice channel from the command
//! text: `GatewayState` remains the sole current-call source.

use serenity::model::application::CommandInteraction;

use crate::CoreVoiceInvocation;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoreVoiceInteractionFacts {
    pub guild_id: String,
    pub channel_id: String,
    pub user_id: String,
    /// `None` has a precise security meaning: the interaction did not include a member object.
    /// The core service consequently fails closed if the guild configured a role policy.
    pub member_role_ids: Option<Vec<String>>,
}

impl CoreVoiceInteractionFacts {
    /// DMs and user-app contexts never produce in-call speech. They are rejected before any
    /// service/voice work rather than being assigned a fabricated guild scope.
    #[must_use]
    pub fn from_command(command: &CommandInteraction) -> Option<Self> {
        let guild_id = command.guild_id?;
        Some(Self {
            guild_id: guild_id.get().to_string(),
            channel_id: command.channel_id.get().to_string(),
            user_id: command.user.id.get().to_string(),
            member_role_ids: command.member.as_ref().map(|member| {
                member
                    .roles
                    .iter()
                    .map(|role_id| role_id.get().to_string())
                    .collect()
            }),
        })
    }

    /// Borrows explicit cache resolvers only for this request. The projection itself has no
    /// content/name cache, so a future gateway adapter can use conservative fallbacks when a
    /// member or channel is unavailable without persisting stale display names.
    #[must_use]
    pub fn invocation<'a>(
        &'a self,
        resolve_user: &'a (dyn Fn(&str) -> String + Send + Sync),
        resolve_channel: &'a (dyn Fn(&str) -> String + Send + Sync),
    ) -> CoreVoiceInvocation<'a> {
        CoreVoiceInvocation {
            guild_id: &self.guild_id,
            channel_id: &self.channel_id,
            user_id: &self.user_id,
            member_role_ids: self.member_role_ids.as_deref(),
            resolve_user,
            resolve_channel,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn facts_keep_roles_scoped_to_the_current_interaction() {
        let facts = CoreVoiceInteractionFacts {
            guild_id: "guild".into(),
            channel_id: "text".into(),
            user_id: "user".into(),
            member_role_ids: Some(vec!["reader".into()]),
        };
        let user = |id: &str| format!("user-{id}");
        let channel = |id: &str| format!("channel-{id}");
        let invocation = facts.invocation(&user, &channel);

        assert_eq!(invocation.guild_id, "guild");
        assert_eq!(invocation.member_role_ids, Some(&["reader".to_owned()][..]));
        assert_eq!((invocation.resolve_user)("42"), "user-42");
    }
}
