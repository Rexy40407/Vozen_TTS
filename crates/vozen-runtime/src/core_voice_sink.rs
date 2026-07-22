//! Opt-in gateway sink for the first fully migrated voice slash commands.
//!
//! Construction is lazy because Serenity only exposes a valid [`Context`] from a gateway event.
//! Until the runtime explicitly installs this sink, Node remains the interaction authority.

use std::{
    collections::BTreeMap,
    path::PathBuf,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
};

use async_trait::async_trait;
use serenity::{
    builder::{
        CreateInteractionResponse, CreateInteractionResponseMessage, EditInteractionResponse,
    },
    client::Context,
    model::application::Interaction,
};
use vozen_core::{SynthesisEngine, detect_language};
use vozen_discord::{
    CoreVoiceInteractionExecution, CoreVoiceInteractionExecutor, CoreVoiceInteractionFacts,
    DiscordDashboardOptionsProvider, DiscordMessageFactsOwned, GatewayEventDispatchError,
    GatewayEventSink, GatewayState, GuildSynthesisCoordinator, MessageVoiceInvocation,
    MessageVoiceOutcome, MessageVoiceService, PlannedRejoinService, RejoinChannelState,
    SongbirdCommandPlayback, SongbirdVoiceSessionTransport, collect_message_media,
    consume_planned_rejoin_marker,
};
use vozen_store::SqliteStore;

use crate::{
    CoreVoiceRuntimeOptions, engine_router::PerUserCommandSynthesizer,
    piper_adapter::PiperCommandSynthesizer, system_now_ms,
};

type Executor = CoreVoiceInteractionExecutor<
    SongbirdVoiceSessionTransport,
    PerUserCommandSynthesizer,
    SongbirdCommandPlayback,
>;
type MessageService = MessageVoiceService<PerUserCommandSynthesizer, SongbirdCommandPlayback>;

struct VoiceDependencies {
    synthesizer: PerUserCommandSynthesizer,
    playback: SongbirdCommandPlayback,
    synthesis: GuildSynthesisCoordinator,
}

pub struct CoreVoiceGatewaySink {
    store: Arc<Mutex<SqliteStore>>,
    gateway_state: GatewayState,
    options: CoreVoiceRuntimeOptions,
    dependencies: Mutex<Option<Arc<VoiceDependencies>>>,
    executor: Mutex<Option<Arc<Executor>>>,
    message_service: Mutex<Option<Arc<MessageService>>>,
    last_speakers: Mutex<BTreeMap<String, String>>,
    rejoin_attempted: AtomicBool,
}

impl CoreVoiceGatewaySink {
    #[must_use]
    pub fn new(
        store: Arc<Mutex<SqliteStore>>,
        gateway_state: GatewayState,
        options: CoreVoiceRuntimeOptions,
    ) -> Self {
        Self {
            store,
            gateway_state,
            options,
            dependencies: Mutex::new(None),
            executor: Mutex::new(None),
            message_service: Mutex::new(None),
            last_speakers: Mutex::new(BTreeMap::new()),
            rejoin_attempted: AtomicBool::new(false),
        }
    }

    fn dependencies(
        &self,
        context: &Context,
    ) -> Result<Arc<VoiceDependencies>, GatewayEventDispatchError> {
        let mut current = self
            .dependencies
            .lock()
            .map_err(|_| GatewayEventDispatchError)?;
        if let Some(dependencies) = &*current {
            return Ok(dependencies.clone());
        }
        let options = &self.options;
        let dependencies = Arc::new(VoiceDependencies {
            synthesizer: PerUserCommandSynthesizer::piper_only(
                PiperCommandSynthesizer::production(
                    options.piper_path.clone(),
                    options.models_dir.clone(),
                    options.cache_dir.clone(),
                    options.piper_concurrency,
                ),
            ),
            playback: SongbirdCommandPlayback::new(context.clone(), options.queue_cap),
            synthesis: GuildSynthesisCoordinator::default(),
        });
        *current = Some(dependencies.clone());
        Ok(dependencies)
    }

    fn executor(&self, context: &Context) -> Result<Arc<Executor>, GatewayEventDispatchError> {
        let mut current = self
            .executor
            .lock()
            .map_err(|_| GatewayEventDispatchError)?;
        if let Some(executor) = &*current {
            return Ok(executor.clone());
        }
        let options = &self.options;
        let dependencies = self.dependencies(context)?;
        let executor = CoreVoiceInteractionExecutor::new_with_synthesis_coordinator(
            self.store.clone(),
            self.gateway_state.clone(),
            SongbirdVoiceSessionTransport::new(context.clone()),
            dependencies.synthesizer.clone(),
            dependencies.playback.clone(),
            dependencies.synthesis.clone(),
            options.settings.clone(),
            Arc::new(system_now_ms),
        )
        .map_err(|_| GatewayEventDispatchError)?;
        let executor = Arc::new(executor);
        *current = Some(executor.clone());
        Ok(executor)
    }

    fn message_service(
        &self,
        context: &Context,
    ) -> Result<Arc<MessageService>, GatewayEventDispatchError> {
        let mut current = self
            .message_service
            .lock()
            .map_err(|_| GatewayEventDispatchError)?;
        if let Some(service) = &*current {
            return Ok(service.clone());
        }
        let dependencies = self.dependencies(context)?;
        let service = Arc::new(MessageVoiceService::new_with_synthesis_coordinator(
            self.store.clone(),
            dependencies.synthesizer.clone(),
            dependencies.playback.clone(),
            dependencies.synthesis.clone(),
            self.options.settings.clone(),
            Arc::new(system_now_ms),
        ));
        *current = Some(service.clone());
        Ok(service)
    }

    /// Restores calls only once per process and only after checking every persisted channel
    /// against Discord's live REST state. This is intentionally separate from the gateway's
    /// small transient state: no stale voice presence can authorize a join by itself.
    async fn recover_planned_sessions(
        &self,
        context: &Context,
    ) -> Result<(), GatewayEventDispatchError> {
        if self.rejoin_attempted.swap(true, Ordering::AcqRel) {
            return Ok(());
        }
        let marker_directory = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let scope = consume_planned_rejoin_marker(&marker_directory, std::time::SystemTime::now());
        let presences = self
            .store
            .lock()
            .map_err(|_| GatewayEventDispatchError)?
            .voice_presences()
            .map_err(|_| GatewayEventDispatchError)?;
        if presences.is_empty() {
            return Ok(());
        }

        // Persisted voice rows are active-call hints, not guild-scale data. Bound the startup
        // lookups anyway so a damaged database cannot burst Discord's REST rate limit.
        const REJOIN_LOOKUP_CONCURRENCY: usize = 4;
        let provider = DiscordDashboardOptionsProvider::new(self.gateway_state.clone());
        let mut states = BTreeMap::new();
        for batch in presences.chunks(REJOIN_LOOKUP_CONCURRENCY) {
            let mut tasks = tokio::task::JoinSet::new();
            for presence in batch {
                let provider = provider.clone();
                let guild_id = presence.guild_id.clone();
                let channel_id = presence.channel_id.clone();
                tasks.spawn(async move {
                    let state = provider.rejoin_channel_state(&guild_id, &channel_id).await;
                    (guild_id, channel_id, state)
                });
            }
            while let Some(result) = tasks.join_next().await {
                if let Ok((guild_id, channel_id, state)) = result {
                    states.insert((guild_id, channel_id), state);
                }
            }
        }

        PlannedRejoinService::new(
            self.store.clone(),
            self.gateway_state.clone(),
            SongbirdVoiceSessionTransport::new(context.clone()),
        )
        .recover(scope.as_ref(), system_now_ms(), |guild_id, channel_id| {
            states
                .get(&(guild_id.to_owned(), channel_id.to_owned()))
                .copied()
                .unwrap_or(RejoinChannelState::NoPermissions)
        })
        .await
        .map_err(|_| GatewayEventDispatchError)?;
        Ok(())
    }
}

#[async_trait]
impl GatewayEventSink for CoreVoiceGatewaySink {
    async fn on_ready(&self, context: Context) -> Result<(), GatewayEventDispatchError> {
        self.recover_planned_sessions(&context).await
    }

    async fn on_message(
        &self,
        context: Context,
        message: serenity::model::channel::Message,
    ) -> Result<(), GatewayEventDispatchError> {
        if !self.options.message_autoread
            || self
                .gateway_state
                .bot_user_id()
                .is_some_and(|bot_id| bot_id == message.author.id.get().to_string())
        {
            return Ok(());
        }
        let Some(facts) = DiscordMessageFactsOwned::from_message(&self.gateway_state, &message)
        else {
            return Ok(());
        };
        let media = collect_message_media(&message);
        let service = self.message_service(&context)?;
        let announce_speaker = self.announce_speaker(&facts, &message);
        let detected_language = self.detected_language(&facts, &message.content);
        let mentioned_users = message
            .mentions
            .iter()
            .map(|user| (user.id.get().to_string(), user.name.clone()))
            .collect::<BTreeMap<_, _>>();
        let mentioned_channels = message
            .mention_channels
            .iter()
            .map(|channel| (channel.id.get().to_string(), channel.name.clone()))
            .collect::<BTreeMap<_, _>>();
        // These maps are derived only from this gateway payload. They avoid a guild-wide member
        // cache and are discarded after the message is prepared.
        let resolve_user = |id: &str| {
            mentioned_users
                .get(id)
                .cloned()
                .unwrap_or_else(|| "someone".to_owned())
        };
        let resolve_channel = |id: &str| {
            mentioned_channels
                .get(id)
                .cloned()
                .unwrap_or_else(|| "a channel".to_owned())
        };
        let outcome = service
            .execute(MessageVoiceInvocation {
                facts: facts.as_borrowed(),
                raw: &message.content,
                media: &media,
                detected_language,
                announce_speaker: announce_speaker.as_deref(),
                resolve_user: &resolve_user,
                resolve_channel: &resolve_channel,
            })
            .await;
        if outcome == MessageVoiceOutcome::Queued
            && let Ok(mut speakers) = self.last_speakers.lock()
        {
            speakers.insert(facts.guild_id, facts.author_id);
        }
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
        let Some(facts) = CoreVoiceInteractionFacts::from_command(&command) else {
            return Ok(());
        };
        let executor = self.executor(&context)?;
        let defer = Executor::requires_ephemeral_defer(&command.data)
            .map_err(|_| GatewayEventDispatchError)?;
        if defer {
            command
                .defer_ephemeral(&context)
                .await
                .map_err(|_| GatewayEventDispatchError)?;
        }
        let response = executor
            .execute(
                &command.data,
                &facts,
                Some(&command.locale),
                &|_| "someone".into(),
                &|_| "channel".into(),
            )
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        let CoreVoiceInteractionExecution::Reply { content, .. } = response else {
            return Ok(());
        };
        if defer {
            command
                .edit_response(&context, EditInteractionResponse::new().content(content))
                .await
                .map_err(|_| GatewayEventDispatchError)?;
        } else {
            command
                .create_response(
                    &context,
                    CreateInteractionResponse::Message(
                        CreateInteractionResponseMessage::new().content(content),
                    ),
                )
                .await
                .map_err(|_| GatewayEventDispatchError)?;
        }
        Ok(())
    }

    async fn on_guild_delete(&self, guild_id: &str) -> Result<(), GatewayEventDispatchError> {
        if let Ok(executor) = self.executor.lock() {
            if let Some(executor) = executor.as_ref() {
                executor.forget_guild(guild_id);
            }
        }
        if let Ok(service) = self.message_service.lock() {
            if let Some(service) = service.as_ref() {
                service.forget_guild(guild_id);
            }
        }
        if let Ok(mut speakers) = self.last_speakers.lock() {
            speakers.remove(guild_id);
        }
        Ok(())
    }
}

impl CoreVoiceGatewaySink {
    /// Returns a detection only for members who explicitly enabled automatic language detection.
    /// Store faults and uncertain text deliberately fall back to the configured voice.
    fn detected_language(
        &self,
        facts: &DiscordMessageFactsOwned,
        message: &str,
    ) -> Option<&'static str> {
        let enabled = self
            .store
            .lock()
            .ok()
            .and_then(|store| {
                store
                    .is_detection_on(&facts.guild_id, &facts.author_id)
                    .ok()
            })
            .unwrap_or(false);
        enabled.then(|| detect_language(message)).flatten()
    }

    fn announce_speaker(
        &self,
        facts: &DiscordMessageFactsOwned,
        message: &serenity::model::channel::Message,
    ) -> Option<String> {
        let (xsaid, nickname) = self.store.lock().ok().and_then(|store| {
            let config = store.guild_config(&facts.guild_id).ok()?;
            let nickname = store.nickname(&facts.guild_id, &facts.author_id).ok()?;
            Some((config.xsaid, nickname))
        })?;
        if !xsaid
            || self
                .last_speakers
                .lock()
                .ok()
                .and_then(|speakers| speakers.get(&facts.guild_id).cloned())
                .is_some_and(|last| last == facts.author_id)
        {
            return None;
        }
        let raw = nickname
            .or_else(|| {
                message
                    .member
                    .as_ref()
                    .and_then(|member| member.nick.clone())
            })
            .unwrap_or_else(|| message.author.name.clone());
        sanitize_speaker_name(&raw)
    }
}

fn sanitize_speaker_name(raw: &str) -> Option<String> {
    let mut output = String::with_capacity(raw.len().min(40));
    let mut last_was_space = true;
    for character in raw.chars() {
        let allowed = character.is_alphanumeric() || matches!(character, '-' | '\'' | '\u{2019}');
        if allowed {
            output.push(character);
            last_was_space = false;
        } else if character.is_whitespace() || character == '_' {
            if !last_was_space && !output.is_empty() {
                output.push(' ');
                last_was_space = true;
            }
        }
        if output.chars().count() >= 40 {
            break;
        }
    }
    let value = output.trim();
    value
        .chars()
        .any(char::is_alphanumeric)
        .then(|| value.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn promotion_options_preserve_distinct_queue_and_synthesis_limits() {
        let options = CoreVoiceRuntimeOptions {
            piper_path: "piper".into(),
            models_dir: "models".into(),
            cache_dir: "cache".into(),
            piper_concurrency: 2,
            queue_cap: 20,
            message_autoread: false,
            settings: CoreVoiceSettings {
                available_models: vec!["en_US-amy-medium".into()],
                default_voice: "en_US-amy-medium".into(),
                default_speed: 1.0,
                default_engine: SynthesisEngine::Piper,
            },
        };
        assert_eq!(options.piper_concurrency, 2);
        assert_eq!(options.queue_cap, 20);
    }

    #[test]
    fn speaker_names_keep_only_pronounceable_characters() {
        assert_eq!(
            sanitize_speaker_name("🔥xX_Pro_Xx🔥").as_deref(),
            Some("xX Pro Xx")
        );
        assert_eq!(sanitize_speaker_name("---").as_deref(), None);
        assert_eq!(
            sanitize_speaker_name("Rexy’s test").as_deref(),
            Some("Rexy’s test")
        );
    }

    #[test]
    fn language_detection_requires_the_members_opt_in() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let sink = CoreVoiceGatewaySink::new(
            store.clone(),
            GatewayState::default(),
            CoreVoiceRuntimeOptions {
                piper_path: "piper".into(),
                models_dir: "models".into(),
                cache_dir: "cache".into(),
                piper_concurrency: 1,
                queue_cap: 1,
                message_autoread: true,
                settings: CoreVoiceSettings {
                    available_models: vec!["en_US-amy-medium".into()],
                    default_voice: "en_US-amy-medium".into(),
                    default_speed: 1.0,
                    default_engine: SynthesisEngine::Piper,
                },
            },
        );
        let facts = DiscordMessageFactsOwned {
            guild_id: "guild".into(),
            channel_id: "text".into(),
            author_id: "user".into(),
            author_is_bot: false,
            mentioned_bot: false,
            replied_to_bot: false,
            author_voice_channel_id: Some("voice".into()),
            bot_voice_channel_id: Some("voice".into()),
            member_role_ids: Some(Vec::new()),
        };
        assert_eq!(sink.detected_language(&facts, "Olá!"), None);
        store
            .lock()
            .expect("store lock")
            .set_detection_on("guild", "user", true)
            .expect("enable");
        assert_eq!(sink.detected_language(&facts, "Olá!"), Some("por"));
    }
}
