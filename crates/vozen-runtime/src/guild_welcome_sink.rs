//! Opt-in `GUILD_CREATE` onboarding message.
//!
//! This keeps the migration's welcome behaviour behind its own flag. A Rust shadow process can
//! therefore observe guild lifecycle events without posting a duplicate message while Node is
//! still authoritative.

use std::collections::BTreeMap;

use async_trait::async_trait;
use serenity::{
    builder::{CreateAllowedMentions, CreateEmbed, CreateEmbedFooter, CreateMessage},
    client::Context,
    model::{
        Permissions,
        application::Interaction,
        channel::{ChannelType, GuildChannel},
        guild::{Guild, Member},
    },
};
use vozen_discord::{GatewayEventDispatchError, GatewayEventSink, VoiceResponseLocalizer};

pub struct GuildWelcomeGatewaySink {
    localizer: VoiceResponseLocalizer,
}

impl GuildWelcomeGatewaySink {
    pub fn new() -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            localizer: VoiceResponseLocalizer::from_generated_contract()
                .map_err(|_| GatewayEventDispatchError)?,
        })
    }

    fn render(
        &self,
        key: &str,
        locale: &str,
        parameters: &BTreeMap<&str, String>,
    ) -> Result<String, GatewayEventDispatchError> {
        self.localizer
            .render_key(key, Some(locale), None, parameters)
            .ok_or(GatewayEventDispatchError)
    }

    fn welcome_embed(&self, locale: &str) -> Result<CreateEmbed, GatewayEventDispatchError> {
        let mut parameters = BTreeMap::new();
        parameters.insert("setup", "`/setup`".to_owned());
        parameters.insert("help", "`/help`".to_owned());
        let description = format!(
            "{}\n\n{}",
            self.render("welcome.description", locale, &parameters)?,
            self.render("welcome.enginePlans", locale, &BTreeMap::new())?
        );
        let footer = self.render("welcome.footer", locale, &BTreeMap::new())?;
        Ok(CreateEmbed::new()
            .title(self.render("welcome.title", locale, &BTreeMap::new())?)
            .description(description)
            .field(
                self.render("welcome.stepsTitle", locale, &BTreeMap::new())?,
                self.render("welcome.stepsBody", locale, &BTreeMap::new())?,
                false,
            )
            .footer(CreateEmbedFooter::new(footer)))
    }

    fn can_post(guild: &Guild, channel: &GuildChannel, member: &Member) -> bool {
        channel.kind == ChannelType::Text
            && guild
                .user_permissions_in(channel, member)
                .contains(Permissions::VIEW_CHANNEL | Permissions::SEND_MESSAGES)
    }

    fn pick_channel<'a>(guild: &'a Guild, member: &Member) -> Option<&'a GuildChannel> {
        if let Some(channel_id) = guild.system_channel_id
            && let Some(channel) = guild.channels.get(&channel_id)
            && Self::can_post(guild, channel, member)
        {
            return Some(channel);
        }
        guild
            .channels
            .values()
            .filter(|channel| Self::can_post(guild, channel, member))
            .min_by_key(|channel| (channel.position, channel.id.get()))
    }
}

#[async_trait]
impl GatewayEventSink for GuildWelcomeGatewaySink {
    async fn on_message(
        &self,
        _context: Context,
        _message: serenity::model::channel::Message,
    ) -> Result<(), GatewayEventDispatchError> {
        Ok(())
    }

    async fn on_interaction(
        &self,
        _context: Context,
        _interaction: Interaction,
    ) -> Result<(), GatewayEventDispatchError> {
        Ok(())
    }

    async fn on_guild_create_details(
        &self,
        context: Context,
        guild: Guild,
    ) -> Result<(), GatewayEventDispatchError> {
        let bot = context
            .http
            .get_current_user()
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        let member = match guild.members.get(&bot.id).cloned() {
            Some(member) => member,
            None => guild
                .id
                .member(&context.http, bot.id)
                .await
                .map_err(|_| GatewayEventDispatchError)?,
        };
        let Some(channel) = Self::pick_channel(&guild, &member) else {
            return Ok(());
        };
        let locale = self
            .localizer
            .default_for_discord_locale(Some(&guild.preferred_locale));
        let message = CreateMessage::new()
            .embed(self.welcome_embed(&locale)?)
            .allowed_mentions(no_mentions());
        channel
            .id
            .send_message(&context.http, message)
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        Ok(())
    }

    async fn on_guild_delete(&self, _guild_id: &str) -> Result<(), GatewayEventDispatchError> {
        Ok(())
    }
}

fn no_mentions() -> CreateAllowedMentions {
    CreateAllowedMentions::new()
        .all_users(false)
        .all_roles(false)
        .everyone(false)
}
