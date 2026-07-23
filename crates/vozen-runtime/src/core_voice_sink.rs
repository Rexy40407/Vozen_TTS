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

use uuid::Uuid;

use async_trait::async_trait;
use serenity::{
    builder::{
        CreateActionRow, CreateAllowedMentions, CreateButton, CreateInputText,
        CreateInteractionResponse, CreateInteractionResponseFollowup,
        CreateInteractionResponseMessage, CreateModal, CreateSelectMenu, CreateSelectMenuKind,
        CreateSelectMenuOption, EditInteractionResponse,
    },
    client::Context,
    model::{
        Permissions,
        application::{ButtonStyle, ComponentInteractionDataKind, InputTextStyle, Interaction},
        channel::ChannelType,
        id::{ChannelId, GuildId, UserId},
    },
};
use vozen_core::{PublicQueueItem, QueueLane, QueueSource, SynthesisEngine, detect_language};
use vozen_discord::{
    CAST_LANGUAGE_CHOICES, CAST_MAX_MEMBERS, CAST_THEMES, CastAction, CastMember, CastSession,
    CoreTtsOutcome, CoreVoiceCommand, CoreVoiceInteractionExecution, CoreVoiceInteractionExecutor,
    CoreVoiceInteractionFacts, CoreVoiceOutcome, DiscordDashboardOptionsProvider,
    DiscordMessageFactsOwned, GatewayEventDispatchError, GatewayEventSink, GatewayState,
    GuildSynthesisCoordinator, JoinVoiceOutcome, MessageVoiceInvocation, MessageVoiceOutcome,
    MessageVoiceService, PlannedRejoinService, QueueControlInvocation, QueueControlOutcome,
    QueueControlService, RandomizerCommand, RandomizerSession, RejoinChannelState,
    SongbirdCommandPlayback, SongbirdVoiceSessionTransport, VoiceResponseLocalizer,
    collect_message_media, consume_planned_rejoin_marker, parse_amount_component_id,
    parse_cast_component_id, parse_fill_component_id, parse_modal_options, parse_queue_command,
    parse_randomizer_command, parse_setup_command, pick_option,
};
use vozen_store::{GuildConfigPatch, SqliteStore};

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
    randomizer_sessions: Mutex<BTreeMap<String, RandomizerSession>>,
    cast_sessions: Mutex<BTreeMap<String, CastSession>>,
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
            randomizer_sessions: Mutex::new(BTreeMap::new()),
            cast_sessions: Mutex::new(BTreeMap::new()),
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
                PiperCommandSynthesizer::production_with_metrics(
                    options.piper_path.clone(),
                    options.models_dir.clone(),
                    options.cache_dir.clone(),
                    options.piper_concurrency,
                    self.gateway_state.metrics(),
                ),
            ),
            playback: SongbirdCommandPlayback::new(
                context.clone(),
                options.queue_cap,
                self.gateway_state.message_counter(),
            ),
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

    fn prune_randomizer_sessions(&self, now_ms: i64) {
        if let Ok(mut sessions) = self.randomizer_sessions.lock() {
            sessions.retain(|_, session| session.valid_at(now_ms));
            // A Discord interaction can be replayed or abandoned. Keep the transient map bounded
            // even if a guild sends a large number of unfinished modal flows.
            if sessions.len() > 1024 {
                let mut entries = sessions
                    .iter()
                    .map(|(id, session)| (id.clone(), session.issued_at_ms))
                    .collect::<Vec<_>>();
                entries.sort_by_key(|(_, issued_at)| *issued_at);
                for (id, _) in entries.into_iter().take(sessions.len() - 1024) {
                    sessions.remove(&id);
                }
            }
        }
    }

    fn randomizer_localizer(&self) -> Result<VoiceResponseLocalizer, GatewayEventDispatchError> {
        VoiceResponseLocalizer::from_generated_contract().map_err(|_| GatewayEventDispatchError)
    }

    fn randomizer_session_matches(
        session: &RandomizerSession,
        user_id: &str,
        guild_id: &str,
        now_ms: i64,
    ) -> bool {
        session.user_id == user_id && session.guild_id == guild_id && session.valid_at(now_ms)
    }

    fn randomizer_facts(
        guild_id: &str,
        channel_id: &str,
        user_id: &str,
        member: Option<&serenity::model::guild::Member>,
    ) -> CoreVoiceInteractionFacts {
        CoreVoiceInteractionFacts {
            guild_id: guild_id.to_owned(),
            channel_id: channel_id.to_owned(),
            user_id: user_id.to_owned(),
            member_role_ids: member.map(|member| {
                member
                    .roles
                    .iter()
                    .map(|role_id| role_id.get().to_string())
                    .collect()
            }),
        }
    }

    async fn randomizer_result(
        &self,
        context: &Context,
        facts: &CoreVoiceInteractionFacts,
        locale: Option<&str>,
        guild_locale: Option<&str>,
        options: &[String],
    ) -> Result<String, GatewayEventDispatchError> {
        let winner = pick_option(options).ok_or(GatewayEventDispatchError)?;
        let localizer = self.randomizer_localizer()?;
        let mut parameters = BTreeMap::new();
        parameters.insert("winner", winner.to_owned());
        parameters.insert("count", options.len().to_string());
        let line = localizer
            .render_key("rand.result", locale, guild_locale, &parameters)
            .ok_or(GatewayEventDispatchError)?;
        parameters.clear();
        parameters.insert("winner", winner.to_owned());
        let speak_text = localizer
            .render_key("rand.speak", locale, guild_locale, &parameters)
            .ok_or(GatewayEventDispatchError)?;
        let spoke = self.executor(context)?.speak_text(facts, &speak_text).await
            == CoreVoiceOutcome::Tts(CoreTtsOutcome::Queued);
        let mut content = format!("🎲 {line}");
        if !spoke {
            let not_in_voice = localizer
                .render_key("rand.notInVoice", locale, guild_locale, &BTreeMap::new())
                .ok_or(GatewayEventDispatchError)?;
            content.push('\n');
            content.push_str(&not_in_voice);
        }
        Ok(content)
    }

    fn randomizer_modal(
        &self,
        interaction_id: &str,
        amount: usize,
        locale: Option<&str>,
        guild_locale: Option<&str>,
    ) -> Result<CreateInteractionResponse, GatewayEventDispatchError> {
        let localizer = self.randomizer_localizer()?;
        let mut title_parameters = BTreeMap::new();
        title_parameters.insert("amount", amount.to_string());
        let title = localizer
            .render_key("rand.modalTitle", locale, guild_locale, &title_parameters)
            .ok_or(GatewayEventDispatchError)?;
        let mut rows = Vec::with_capacity(amount);
        for index in 1..=amount {
            let mut parameters = BTreeMap::new();
            parameters.insert("n", index.to_string());
            let label = localizer
                .render_key("rand.modalOption", locale, guild_locale, &parameters)
                .ok_or(GatewayEventDispatchError)?;
            rows.push(CreateActionRow::InputText(
                CreateInputText::new(InputTextStyle::Short, label, format!("opt{index}"))
                    .max_length(vozen_discord::MAX_OPTION_CHARS as u16)
                    .required(true),
            ));
        }
        Ok(CreateInteractionResponse::Modal(
            CreateModal::new(format!("randFill:{interaction_id}"), title).components(rows),
        ))
    }

    async fn handle_randomizer_command(
        &self,
        context: &Context,
        command: &serenity::model::application::CommandInteraction,
    ) -> Result<(), GatewayEventDispatchError> {
        let Some(guild_id) = command.guild_id else {
            return Ok(());
        };
        let Some(facts) = CoreVoiceInteractionFacts::from_command(command) else {
            return Ok(());
        };
        let parsed =
            parse_randomizer_command(&command.data).map_err(|_| GatewayEventDispatchError)?;
        let Some(parsed) = parsed else {
            return Ok(());
        };
        let now_ms = system_now_ms();
        self.prune_randomizer_sessions(now_ms);
        let guild_id = guild_id.get().to_string();
        let user_id = command.user.id.get().to_string();
        let issued = RandomizerSession {
            user_id,
            guild_id,
            amount: None,
            locale: command.locale.clone(),
            issued_at_ms: now_ms,
        };
        match parsed {
            RandomizerCommand::Direct { options } => {
                command
                    .defer(context)
                    .await
                    .map_err(|_| GatewayEventDispatchError)?;
                let content = self
                    .randomizer_result(
                        context,
                        &facts,
                        Some(&command.locale),
                        command.guild_locale.as_deref(),
                        &options,
                    )
                    .await?;
                command
                    .edit_response(
                        context,
                        EditInteractionResponse::new()
                            .content(content)
                            .allowed_mentions(
                                CreateAllowedMentions::new()
                                    .all_users(false)
                                    .all_roles(false)
                                    .everyone(false),
                            ),
                    )
                    .await
                    .map_err(|_| GatewayEventDispatchError)?;
            }
            RandomizerCommand::ChooseAmount => {
                if let Ok(mut sessions) = self.randomizer_sessions.lock() {
                    sessions.insert(command.id.get().to_string(), issued);
                }
                let localizer = self.randomizer_localizer()?;
                let prompt = localizer
                    .render_key(
                        "rand.selectPrompt",
                        Some(&command.locale),
                        command.guild_locale.as_deref(),
                        &BTreeMap::new(),
                    )
                    .ok_or(GatewayEventDispatchError)?;
                let placeholder = localizer
                    .render_key(
                        "rand.selectPlaceholder",
                        Some(&command.locale),
                        command.guild_locale.as_deref(),
                        &BTreeMap::new(),
                    )
                    .ok_or(GatewayEventDispatchError)?;
                let options = (vozen_discord::MIN_OPTIONS..=vozen_discord::MAX_MODAL_OPTIONS)
                    .map(|amount| {
                        let mut parameters = BTreeMap::new();
                        parameters.insert("n", amount.to_string());
                        let label = localizer
                            .render_key(
                                "rand.selectOption",
                                Some(&command.locale),
                                command.guild_locale.as_deref(),
                                &parameters,
                            )
                            .unwrap_or_else(|| amount.to_string());
                        CreateSelectMenuOption::new(label, amount.to_string())
                    })
                    .collect();
                let select = CreateSelectMenu::new(
                    format!("randAmount:{}", command.id.get()),
                    CreateSelectMenuKind::String { options },
                )
                .placeholder(placeholder)
                .min_values(1)
                .max_values(1);
                command
                    .create_response(
                        context,
                        CreateInteractionResponse::Message(
                            CreateInteractionResponseMessage::new()
                                .content(prompt)
                                .ephemeral(true)
                                .components(vec![CreateActionRow::SelectMenu(select)]),
                        ),
                    )
                    .await
                    .map_err(|_| GatewayEventDispatchError)?;
            }
            RandomizerCommand::Modal { amount } => {
                if let Ok(mut sessions) = self.randomizer_sessions.lock() {
                    let mut session = issued;
                    session.amount = Some(amount);
                    sessions.insert(command.id.get().to_string(), session);
                }
                command
                    .create_response(
                        context,
                        self.randomizer_modal(
                            &command.id.get().to_string(),
                            amount,
                            Some(&command.locale),
                            command.guild_locale.as_deref(),
                        )?,
                    )
                    .await
                    .map_err(|_| GatewayEventDispatchError)?;
            }
        }
        Ok(())
    }

    async fn handle_randomizer_component(
        &self,
        context: &Context,
        component: serenity::model::application::ComponentInteraction,
    ) -> Result<bool, GatewayEventDispatchError> {
        let Some(session_id) = parse_amount_component_id(&component.data.custom_id) else {
            return Ok(false);
        };
        let Some(guild_id) = component.guild_id else {
            return Ok(true);
        };
        let now_ms = system_now_ms();
        self.prune_randomizer_sessions(now_ms);
        let amount = match &component.data.kind {
            ComponentInteractionDataKind::StringSelect { values } if values.len() == 1 => values
                .first()
                .and_then(|value| value.parse::<usize>().ok())
                .filter(|value| {
                    (vozen_discord::MIN_OPTIONS..=vozen_discord::MAX_MODAL_OPTIONS).contains(value)
                }),
            _ => None,
        };
        let Some(amount) = amount else {
            return Ok(true);
        };
        let guild_id = guild_id.get().to_string();
        let user_id = component.user.id.get().to_string();
        let response = {
            let mut sessions = self
                .randomizer_sessions
                .lock()
                .map_err(|_| GatewayEventDispatchError)?;
            let Some(session) = sessions.get_mut(&session_id) else {
                return Ok(true);
            };
            if !Self::randomizer_session_matches(session, &user_id, &guild_id, now_ms) {
                sessions.remove(&session_id);
                return Ok(true);
            }
            session.amount = Some(amount);
            self.randomizer_modal(
                &session_id,
                amount,
                Some(&component.locale),
                component.guild_locale.as_deref(),
            )?
        };
        component
            .create_response(context, response)
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        Ok(true)
    }

    async fn handle_randomizer_modal(
        &self,
        context: &Context,
        modal: serenity::model::application::ModalInteraction,
    ) -> Result<bool, GatewayEventDispatchError> {
        let Some(session_id) = parse_fill_component_id(&modal.data.custom_id) else {
            return Ok(false);
        };
        let Some(guild_id) = modal.guild_id else {
            return Ok(true);
        };
        let now_ms = system_now_ms();
        self.prune_randomizer_sessions(now_ms);
        let guild_id = guild_id.get().to_string();
        let user_id = modal.user.id.get().to_string();
        let session = self
            .randomizer_sessions
            .lock()
            .map_err(|_| GatewayEventDispatchError)?
            .remove(&session_id);
        let Some(session) = session else {
            return Ok(true);
        };
        let Some(amount) = session.amount else {
            return Ok(true);
        };
        if !Self::randomizer_session_matches(&session, &user_id, &guild_id, now_ms) {
            return Ok(true);
        }
        let options = parse_modal_options(&modal, amount).map_err(|_| GatewayEventDispatchError)?;
        let facts = Self::randomizer_facts(
            &guild_id,
            &modal.channel_id.get().to_string(),
            &user_id,
            modal.member.as_ref(),
        );
        modal
            .defer(context)
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        let content = self
            .randomizer_result(
                context,
                &facts,
                Some(&modal.locale),
                modal.guild_locale.as_deref(),
                &options,
            )
            .await?;
        modal
            .edit_response(
                context,
                EditInteractionResponse::new()
                    .content(content)
                    .allowed_mentions(
                        CreateAllowedMentions::new()
                            .all_users(false)
                            .all_roles(false)
                            .everyone(false),
                    ),
            )
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        Ok(true)
    }

    fn prune_cast_sessions(&self, now_ms: i64) {
        if let Ok(mut sessions) = self.cast_sessions.lock() {
            sessions.retain(|_, session| session.valid_at(now_ms));
            if sessions.len() > 256 {
                let mut entries = sessions
                    .iter()
                    .map(|(id, session)| (id.clone(), session.issued_at_ms))
                    .collect::<Vec<_>>();
                entries.sort_by_key(|(_, issued_at)| *issued_at);
                for (id, _) in entries.into_iter().take(sessions.len() - 256) {
                    sessions.remove(&id);
                }
            }
        }
    }

    fn cast_panel_content(session: &CastSession) -> String {
        let theme = session
            .theme_key
            .as_deref()
            .and_then(vozen_discord::cast_theme_by_key)
            .map(|theme| theme.label)
            .unwrap_or("choose a theme");
        let language = CAST_LANGUAGE_CHOICES
            .iter()
            .find(|choice| choice.value == session.language)
            .map(|choice| choice.name)
            .unwrap_or("English");
        let engine = match session.engine.as_str() {
            "piper" => "Piper",
            "kokoro" => "Kokoro",
            _ => "Google",
        };
        let mut content = format!(
            "🎭 **Create a cast for your voice call**\nTheme: {theme}\nLanguage: {language}\nEngine: {engine}"
        );
        if session.theme_key.as_deref() == Some("pokemon") {
            content.push_str(
                "\n-# Unofficial fan reference; not affiliated with Nintendo, Game Freak, or The Pokémon Company.",
            );
        }
        content
    }

    fn cast_panel_response(
        interaction_id: &str,
        session: &CastSession,
    ) -> CreateInteractionResponse {
        let themes = CAST_THEMES
            .iter()
            .map(|theme| {
                CreateSelectMenuOption::new(theme.label, theme.key)
                    .default_selection(session.theme_key.as_deref() == Some(theme.key))
            })
            .collect();
        let languages = CAST_LANGUAGE_CHOICES
            .iter()
            .map(|choice| {
                CreateSelectMenuOption::new(choice.name, choice.value)
                    .default_selection(choice.value == session.language)
            })
            .collect();
        let engines = [
            ("Google", "google"),
            ("Piper", "piper"),
            ("Kokoro", "kokoro"),
        ]
        .into_iter()
        .map(|(label, value)| {
            CreateSelectMenuOption::new(label, value).default_selection(value == session.engine)
        })
        .collect();
        let theme_menu = CreateSelectMenu::new(
            format!("cast:theme:{interaction_id}"),
            CreateSelectMenuKind::String { options: themes },
        )
        .placeholder("Choose a theme")
        .min_values(1)
        .max_values(1);
        let language_menu = CreateSelectMenu::new(
            format!("cast:language:{interaction_id}"),
            CreateSelectMenuKind::String { options: languages },
        )
        .placeholder("Choose a language")
        .min_values(1)
        .max_values(1);
        let engine_menu = CreateSelectMenu::new(
            format!("cast:engine:{interaction_id}"),
            CreateSelectMenuKind::String { options: engines },
        )
        .placeholder("Choose a voice engine")
        .min_values(1)
        .max_values(1);
        let reveal = CreateButton::new(format!("cast:reveal:{interaction_id}"))
            .label("Reveal cast")
            .style(ButtonStyle::Primary)
            .disabled(session.theme_key.is_none());
        let cancel = CreateButton::new(format!("cast:cancel:{interaction_id}"))
            .label("Cancel")
            .style(ButtonStyle::Secondary);
        CreateInteractionResponse::Message(
            CreateInteractionResponseMessage::new()
                .content(Self::cast_panel_content(session))
                .ephemeral(true)
                .components(vec![
                    CreateActionRow::SelectMenu(theme_menu),
                    CreateActionRow::SelectMenu(language_menu),
                    CreateActionRow::SelectMenu(engine_menu),
                    CreateActionRow::Buttons(vec![reveal, cancel]),
                ]),
        )
    }

    async fn setup_reply(
        command: &serenity::model::application::CommandInteraction,
        context: &Context,
        content: String,
    ) -> Result<(), GatewayEventDispatchError> {
        command
            .create_response(
                context,
                CreateInteractionResponse::Message(
                    CreateInteractionResponseMessage::new()
                        .content(content)
                        .ephemeral(true)
                        .allowed_mentions(
                            CreateAllowedMentions::new()
                                .all_users(false)
                                .all_roles(false)
                                .everyone(false),
                        ),
                ),
            )
            .await
            .map_err(|_| GatewayEventDispatchError)
    }

    async fn handle_setup_command(
        &self,
        context: &Context,
        command: &serenity::model::application::CommandInteraction,
    ) -> Result<(), GatewayEventDispatchError> {
        let Some(parsed) =
            parse_setup_command(&command.data).map_err(|_| GatewayEventDispatchError)?
        else {
            return Ok(());
        };
        let Some(guild_id) = command.guild_id else {
            return Ok(());
        };
        let can_manage = command
            .member
            .as_ref()
            .and_then(|member| member.permissions)
            .is_some_and(|permissions| permissions.contains(Permissions::MANAGE_GUILD));
        let localizer = VoiceResponseLocalizer::from_generated_contract()
            .map_err(|_| GatewayEventDispatchError)?;
        let render = |key: &str, parameters: &BTreeMap<&str, String>| {
            localizer
                .render_key(
                    key,
                    Some(&command.locale),
                    command.guild_locale.as_deref(),
                    parameters,
                )
                .ok_or(GatewayEventDispatchError)
        };
        if !can_manage {
            return Self::setup_reply(
                command,
                context,
                render("error.needManageGuild", &BTreeMap::new())?,
            )
            .await;
        }

        let target_id = parsed
            .channel_id
            .unwrap_or_else(|| command.channel_id.get());
        let channels = guild_id
            .channels(&context.http)
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        let Some(target) = channels.get(&ChannelId::new(target_id)) else {
            return Self::setup_reply(
                command,
                context,
                render("setup.noChannel", &BTreeMap::new())?,
            )
            .await;
        };
        if target.kind != ChannelType::Text {
            return Self::setup_reply(
                command,
                context,
                render("setup.channelWrongType", &BTreeMap::new())?,
            )
            .await;
        }

        let guild = guild_id
            .to_partial_guild(&context.http)
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        let bot = context
            .http
            .get_current_user()
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        let bot_member = guild_id
            .member(&context.http, bot.id)
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        let text_permissions = guild.user_permissions_in(target, &bot_member);
        let can_view = text_permissions.contains(Permissions::VIEW_CHANNEL);
        let can_send = text_permissions.contains(Permissions::SEND_MESSAGES);

        let voice_id = self.gateway_state.voice_channel_id(
            &guild_id.get().to_string(),
            &command.user.id.get().to_string(),
        );
        let (can_connect, can_speak) = if let Some(voice_id) = voice_id.as_deref() {
            match channels.get(&ChannelId::new(voice_id.parse().unwrap_or_default())) {
                Some(voice) => {
                    let permissions = guild.user_permissions_in(voice, &bot_member);
                    (
                        permissions.contains(Permissions::CONNECT),
                        permissions.contains(Permissions::SPEAK),
                    )
                }
                None => (false, false),
            }
        } else {
            (false, false)
        };

        self.store
            .lock()
            .map_err(|_| GatewayEventDispatchError)?
            .update_guild_config(
                &guild_id.get().to_string(),
                GuildConfigPatch {
                    tts_channel_id: Some(Some(target_id.to_string())),
                    autoread: Some(true),
                    ..Default::default()
                },
            )
            .map_err(|_| GatewayEventDispatchError)?;

        let facts =
            CoreVoiceInteractionFacts::from_command(command).ok_or(GatewayEventDispatchError)?;
        let joined = if can_connect && can_speak {
            matches!(
                self.executor(context)?.join_for_setup(&facts).await,
                CoreVoiceOutcome::Joined(JoinVoiceOutcome::Joined)
            )
        } else {
            false
        };
        let voice_test = if parsed.test_voice && joined {
            matches!(
                self.executor(context)?
                    .speak_text_with_voice(
                        &facts,
                        "Vozen is ready.",
                        &self.options.settings.default_voice,
                        self.options.settings.default_speed,
                        SynthesisEngine::Piper,
                        false,
                    )
                    .await,
                CoreVoiceOutcome::Tts(CoreTtsOutcome::Queued)
            )
        } else {
            false
        };

        let mut lines = Vec::new();
        lines.push(render("setup.done", &BTreeMap::new())?);
        let mut parameters = BTreeMap::new();
        parameters.insert("channel", format!("<#{}>", target_id));
        lines.push(render("setup.channelLine", &parameters)?);
        lines.push(render("setup.autoreadOn", &BTreeMap::new())?);
        lines.push(String::new());
        lines.push(render("setup.permsHeader", &BTreeMap::new())?);
        for (label_key, state) in [
            ("setup.permView", Some(can_view)),
            ("setup.permSend", Some(can_send)),
            ("setup.permConnect", voice_id.as_ref().map(|_| can_connect)),
            ("setup.permSpeak", voice_id.as_ref().map(|_| can_speak)),
        ] {
            let label = render(label_key, &BTreeMap::new())?;
            let mut params = BTreeMap::new();
            params.insert("label", label);
            let key = if state == Some(true) {
                "setup.permOk"
            } else if state == Some(false) {
                "setup.permMissing"
            } else {
                "setup.permUnchecked"
            };
            lines.push(render(key, &params)?);
        }
        if joined {
            let mut params = BTreeMap::new();
            params.insert(
                "channel",
                format!("<#{}>", voice_id.as_deref().unwrap_or_default()),
            );
            lines.push(String::new());
            lines.push(render("setup.joinedVoice", &params)?);
        }
        if voice_test {
            lines.push("🔊 Voice test queued with the local Piper engine.".to_owned());
        }
        if !can_view || !can_send || (voice_id.is_some() && (!can_connect || !can_speak)) {
            lines.push(String::new());
            lines.push(render("setup.fixHint", &BTreeMap::new())?);
        }
        if voice_id.is_none() {
            lines.push(String::new());
            lines.push(render("setup.voiceUncheckedNote", &BTreeMap::new())?);
        }
        if can_view && can_send && voice_id.is_some() && can_connect && can_speak {
            lines.push(String::new());
            lines.push(render(
                if joined {
                    "setup.readyTalk"
                } else {
                    "setup.allGood"
                },
                &BTreeMap::new(),
            )?);
        }
        lines.push(String::new());
        lines.push(render("setup.membersHeader", &BTreeMap::new())?);
        lines.push(render("setup.membersBody", &BTreeMap::new())?);
        Self::setup_reply(command, context, lines.join("\n")).await
    }

    async fn fetch_cast_members(
        &self,
        context: &Context,
        guild_id: &str,
        voice_channel_id: &str,
    ) -> Vec<CastMember> {
        let Ok(guild_number) = guild_id.parse::<u64>() else {
            return Vec::new();
        };
        let ids = self
            .gateway_state
            .voice_member_ids(guild_id, voice_channel_id);
        let mut members = Vec::new();
        // Fetch only one more than the product limit. This keeps a malformed/stale gateway map
        // from turning a reveal into an unbounded REST fan-out.
        for id in ids.into_iter().take(CAST_MAX_MEMBERS + 1) {
            let Ok(user_number) = id.parse::<u64>() else {
                continue;
            };
            let Ok(member) = context
                .http
                .get_member(GuildId::new(guild_number), UserId::new(user_number))
                .await
            else {
                continue;
            };
            members.push(CastMember {
                id,
                display_name: member.display_name().to_owned(),
                bot: member.user.bot,
            });
        }
        members
    }

    fn cast_voice_settings(
        &self,
        guild_id: &str,
        user_id: &str,
        session: &CastSession,
    ) -> Option<(String, f64, SynthesisEngine)> {
        let language = session.language.to_ascii_lowercase();
        let compatible = self
            .options
            .settings
            .available_models
            .iter()
            .filter(|model| {
                let model = model.to_ascii_lowercase();
                model.starts_with(&format!("{language}_"))
                    || model.starts_with(&format!("{language}-"))
            })
            .cloned()
            .collect::<Vec<_>>();
        let store = self.store.lock().ok()?;
        let config = store.guild_config(guild_id).ok()?;
        let stored = store.get_user_voice(guild_id, user_id).ok().flatten();
        let preferred = stored
            .as_ref()
            .map(|voice| voice.model.clone())
            .filter(|model| compatible.iter().any(|candidate| candidate == model));
        let model = preferred
            .or_else(|| compatible.first().cloned())
            .or_else(|| {
                (!config.default_voice.trim().is_empty())
                    .then(|| config.default_voice.clone())
                    .filter(|model| {
                        self.options
                            .settings
                            .available_models
                            .iter()
                            .any(|candidate| candidate == model)
                    })
            })
            .unwrap_or_else(|| self.options.settings.default_voice.clone());
        if session.engine == "piper" && !compatible.iter().any(|candidate| candidate == &model) {
            return None;
        }
        let speed = stored
            .as_ref()
            .map(|voice| voice.speed)
            .filter(|speed| speed.is_finite())
            .unwrap_or(self.options.settings.default_speed);
        let engine = match session.engine.as_str() {
            "piper" => SynthesisEngine::Piper,
            "kokoro" => SynthesisEngine::Kokoro,
            _ => SynthesisEngine::Default,
        };
        Some((model, speed, engine))
    }

    async fn handle_cast_command(
        &self,
        context: &Context,
        command: &serenity::model::application::CommandInteraction,
    ) -> Result<(), GatewayEventDispatchError> {
        let Some(guild_id) = command.guild_id else {
            return Ok(());
        };
        if !command.data.options.is_empty() {
            return Ok(());
        }
        let Some(facts) = CoreVoiceInteractionFacts::from_command(command) else {
            return Ok(());
        };
        let guild_id = guild_id.get().to_string();
        let user_id = command.user.id.get().to_string();
        let Some(user_voice) = self.gateway_state.voice_channel_id(&guild_id, &user_id) else {
            command
                .create_response(
                    context,
                    CreateInteractionResponse::Message(
                        CreateInteractionResponseMessage::new()
                            .content("You must be in Vozen's voice call to use this command.")
                            .ephemeral(true),
                    ),
                )
                .await
                .map_err(|_| GatewayEventDispatchError)?;
            return Ok(());
        };
        if self
            .gateway_state
            .bot_voice_channel_id(&guild_id)
            .as_deref()
            != Some(&user_voice)
        {
            command
                .create_response(
                    context,
                    CreateInteractionResponse::Message(
                        CreateInteractionResponseMessage::new()
                            .content("You must be in Vozen's voice call to use this command.")
                            .ephemeral(true),
                    ),
                )
                .await
                .map_err(|_| GatewayEventDispatchError)?;
            return Ok(());
        }
        let engine = self
            .store
            .lock()
            .ok()
            .and_then(|store| store.get_user_voice(&guild_id, &user_id).ok().flatten())
            .map(|voice| match voice.engine {
                vozen_store::UserEngine::Piper => "piper",
                vozen_store::UserEngine::Kokoro => "kokoro",
                _ => "google",
            })
            .unwrap_or("piper")
            .to_owned();
        let session = CastSession {
            user_id,
            guild_id: guild_id.clone(),
            channel_id: command.channel_id.get().to_string(),
            voice_channel_id: user_voice,
            theme_key: None,
            language: "en".to_owned(),
            engine,
            issued_at_ms: system_now_ms(),
        };
        self.prune_cast_sessions(system_now_ms());
        if let Ok(mut sessions) = self.cast_sessions.lock() {
            sessions.insert(command.id.get().to_string(), session.clone());
        }
        let _ = facts;
        command
            .create_response(
                context,
                Self::cast_panel_response(&command.id.get().to_string(), &session),
            )
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        Ok(())
    }

    async fn handle_cast_component(
        &self,
        context: &Context,
        component: serenity::model::application::ComponentInteraction,
    ) -> Result<bool, GatewayEventDispatchError> {
        let Some((action, session_id)) = parse_cast_component_id(&component.data.custom_id) else {
            return Ok(false);
        };
        let Some(guild_id) = component.guild_id else {
            return Ok(true);
        };
        self.prune_cast_sessions(system_now_ms());
        let guild_id = guild_id.get().to_string();
        let user_id = component.user.id.get().to_string();
        let channel_id = component.channel_id.get().to_string();
        let mut session = {
            let mut sessions = self
                .cast_sessions
                .lock()
                .map_err(|_| GatewayEventDispatchError)?;
            let Some(session) = sessions.get(&session_id) else {
                return Ok(true);
            };
            if session.user_id != user_id
                || session.guild_id != guild_id
                || session.channel_id != channel_id
                || !session.valid_at(system_now_ms())
            {
                sessions.remove(&session_id);
                return Ok(true);
            }
            session.clone()
        };

        let selected = match &component.data.kind {
            ComponentInteractionDataKind::StringSelect { values } if values.len() == 1 => {
                values.first().cloned()
            }
            _ => None,
        };
        match action {
            CastAction::Theme => {
                if selected
                    .as_deref()
                    .and_then(vozen_discord::cast_theme_by_key)
                    .is_none()
                {
                    return Ok(true);
                }
                session.theme_key = selected;
            }
            CastAction::Language => {
                if selected.as_deref().is_none_or(|value| {
                    !CAST_LANGUAGE_CHOICES
                        .iter()
                        .any(|choice| choice.value == value)
                }) {
                    return Ok(true);
                }
                session.language = selected.expect("validated language");
            }
            CastAction::Engine => {
                if selected
                    .as_deref()
                    .is_none_or(|value| !matches!(value, "google" | "piper" | "kokoro"))
                {
                    return Ok(true);
                }
                session.engine = selected.expect("validated engine");
            }
            CastAction::Cancel => {
                if let Ok(mut sessions) = self.cast_sessions.lock() {
                    sessions.remove(&session_id);
                }
                component
                    .defer(context)
                    .await
                    .map_err(|_| GatewayEventDispatchError)?;
                component
                    .edit_response(
                        context,
                        EditInteractionResponse::new().content("Cast cancelled."),
                    )
                    .await
                    .map_err(|_| GatewayEventDispatchError)?;
                return Ok(true);
            }
            CastAction::Reveal => {
                if session.theme_key.is_none() {
                    return Ok(true);
                }
                if let Ok(mut sessions) = self.cast_sessions.lock() {
                    sessions.remove(&session_id);
                }
                component
                    .defer(context)
                    .await
                    .map_err(|_| GatewayEventDispatchError)?;
                return self
                    .finish_cast_reveal(context, &component, &session)
                    .await
                    .map(|()| true);
            }
        }

        if let Ok(mut sessions) = self.cast_sessions.lock() {
            sessions.insert(session_id.clone(), session.clone());
        }
        component
            .defer(context)
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        component
            .edit_response(
                context,
                EditInteractionResponse::new()
                    .content(Self::cast_panel_content(&session))
                    .components(Self::cast_panel_components(&session_id, &session)),
            )
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        Ok(true)
    }

    fn cast_panel_components(interaction_id: &str, session: &CastSession) -> Vec<CreateActionRow> {
        let themes = CAST_THEMES
            .iter()
            .map(|theme| {
                CreateSelectMenuOption::new(theme.label, theme.key)
                    .default_selection(session.theme_key.as_deref() == Some(theme.key))
            })
            .collect();
        let languages = CAST_LANGUAGE_CHOICES
            .iter()
            .map(|choice| {
                CreateSelectMenuOption::new(choice.name, choice.value)
                    .default_selection(choice.value == session.language)
            })
            .collect();
        let engines = [
            ("Google", "google"),
            ("Piper", "piper"),
            ("Kokoro", "kokoro"),
        ]
        .into_iter()
        .map(|(label, value)| {
            CreateSelectMenuOption::new(label, value).default_selection(value == session.engine)
        })
        .collect();
        let theme_menu = CreateSelectMenu::new(
            format!("cast:theme:{interaction_id}"),
            CreateSelectMenuKind::String { options: themes },
        )
        .placeholder("Choose a theme")
        .min_values(1)
        .max_values(1);
        let language_menu = CreateSelectMenu::new(
            format!("cast:language:{interaction_id}"),
            CreateSelectMenuKind::String { options: languages },
        )
        .placeholder("Choose a language")
        .min_values(1)
        .max_values(1);
        let engine_menu = CreateSelectMenu::new(
            format!("cast:engine:{interaction_id}"),
            CreateSelectMenuKind::String { options: engines },
        )
        .placeholder("Choose a voice engine")
        .min_values(1)
        .max_values(1);
        let reveal = CreateButton::new(format!("cast:reveal:{interaction_id}"))
            .label("Reveal cast")
            .style(ButtonStyle::Primary)
            .disabled(session.theme_key.is_none());
        let cancel = CreateButton::new(format!("cast:cancel:{interaction_id}"))
            .label("Cancel")
            .style(ButtonStyle::Secondary);
        vec![
            CreateActionRow::SelectMenu(theme_menu),
            CreateActionRow::SelectMenu(language_menu),
            CreateActionRow::SelectMenu(engine_menu),
            CreateActionRow::Buttons(vec![reveal, cancel]),
        ]
    }

    async fn finish_cast_reveal(
        &self,
        context: &Context,
        component: &serenity::model::application::ComponentInteraction,
        session: &CastSession,
    ) -> Result<(), GatewayEventDispatchError> {
        if self
            .gateway_state
            .voice_channel_id(&session.guild_id, &session.user_id)
            .as_deref()
            != Some(session.voice_channel_id.as_str())
            || self
                .gateway_state
                .bot_voice_channel_id(&session.guild_id)
                .as_deref()
                != Some(session.voice_channel_id.as_str())
        {
            component
                .edit_response(
                    context,
                    EditInteractionResponse::new()
                        .content("You must still be in Vozen's voice call to reveal this cast."),
                )
                .await
                .map_err(|_| GatewayEventDispatchError)?;
            return Ok(());
        }
        let members = self
            .fetch_cast_members(context, &session.guild_id, &session.voice_channel_id)
            .await;
        let humans = members
            .into_iter()
            .filter(|member| !member.bot)
            .collect::<Vec<_>>();
        if humans.is_empty() || humans.len() > CAST_MAX_MEMBERS {
            let message = if humans.len() > CAST_MAX_MEMBERS {
                "There are too many people in this call. `/cast` supports up to 25 humans."
            } else {
                "Nobody else is available in the voice call."
            };
            component
                .edit_response(context, EditInteractionResponse::new().content(message))
                .await
                .map_err(|_| GatewayEventDispatchError)?;
            return Ok(());
        }
        let mut seed = Uuid::new_v4().as_u128();
        let assignments = vozen_discord::assign_cast(
            &humans,
            session.theme_key.as_deref().unwrap_or_default(),
            || {
                seed = seed.rotate_left(17);
                (seed as f64) / (u128::MAX as f64)
            },
        )
        .ok_or(GatewayEventDispatchError)?;
        let Some((model, speed, engine)) =
            self.cast_voice_settings(&session.guild_id, &session.user_id, session)
        else {
            component
                .edit_response(
                    context,
                    EditInteractionResponse::new().content(
                        "The selected language has no installed Piper voice. Choose another language and run `/cast` again.",
                    ),
                )
                .await
                .map_err(|_| GatewayEventDispatchError)?;
            return Ok(());
        };
        let speech_assignments = assignments
            .iter()
            .map(|assignment| vozen_discord::CastAssignment {
                user_id: assignment.user_id.clone(),
                display_name: assignment.display_name.clone(),
                entry: assignment.entry,
            })
            .collect::<Vec<_>>();
        let speech = vozen_discord::build_cast_speech(&speech_assignments, &session.language);
        let chunks = vozen_discord::chunk_cast_speech(&speech, 260);
        let facts = CoreVoiceInteractionFacts {
            guild_id: session.guild_id.clone(),
            channel_id: session.channel_id.clone(),
            user_id: session.user_id.clone(),
            member_role_ids: component.member.as_ref().map(|member| {
                member
                    .roles
                    .iter()
                    .map(|role_id| role_id.get().to_string())
                    .collect()
            }),
        };
        let executor = self.executor(context)?;
        let first_outcome = executor
            .speak_text_with_voice(&facts, &chunks[0], &model, speed, engine, true)
            .await;
        let CoreVoiceOutcome::Tts(first_tts) = first_outcome else {
            return Ok(());
        };
        if matches!(
            first_tts,
            CoreTtsOutcome::NotInSameVoice
                | CoreTtsOutcome::Blocked
                | CoreTtsOutcome::RateLimited
                | CoreTtsOutcome::Empty
                | CoreTtsOutcome::FullyBlocked
                | CoreTtsOutcome::StoreUnavailable
        ) {
            let message = match first_tts {
                CoreTtsOutcome::NotInSameVoice => {
                    "You must still be in Vozen's voice call to reveal this cast."
                }
                CoreTtsOutcome::Blocked => "You cannot use voice commands in this server.",
                CoreTtsOutcome::RateLimited => {
                    "You're doing that too quickly. Try again in a moment."
                }
                _ => "This cast could not be spoken right now. Run `/cast` again.",
            };
            component
                .edit_response(context, EditInteractionResponse::new().content(message))
                .await
                .map_err(|_| GatewayEventDispatchError)?;
            return Ok(());
        }
        let theme_label = session
            .theme_key
            .as_deref()
            .and_then(vozen_discord::cast_theme_by_key)
            .map(|theme| theme.label)
            .unwrap_or("Cast");
        let language_label = CAST_LANGUAGE_CHOICES
            .iter()
            .find(|choice| choice.value == session.language)
            .map(|choice| choice.name)
            .unwrap_or("English");
        let mut public = format!("🎭 **Cast revealed — {theme_label} · {language_label}**");
        for assignment in &assignments {
            public.push_str(&format!(
                "\n• <@{}> → {}",
                assignment.user_id, assignment.entry.label
            ));
        }
        if session.theme_key.as_deref() == Some("pokemon") {
            public.push_str(
                "\n-# Unofficial fan reference; not affiliated with Nintendo, Game Freak, or The Pokémon Company.",
            );
        }
        component
            .create_followup(
                context,
                CreateInteractionResponseFollowup::new()
                    .content(public)
                    .allowed_mentions(
                        CreateAllowedMentions::new()
                            .all_users(false)
                            .all_roles(false)
                            .everyone(false),
                    ),
            )
            .await
            .map_err(|_| GatewayEventDispatchError)?;

        let spoken = first_tts == CoreTtsOutcome::Queued;
        if spoken {
            for chunk in chunks.into_iter().skip(1) {
                let outcome = executor
                    .speak_text_with_voice(&facts, &chunk, &model, speed, engine, false)
                    .await;
                if outcome != CoreVoiceOutcome::Tts(CoreTtsOutcome::Queued) {
                    break;
                }
            }
        }
        component
            .edit_response(
                context,
                EditInteractionResponse::new().content(if spoken {
                    "Cast revealed and spoken in the call."
                } else {
                    "Cast revealed in chat; voice is busy."
                }),
            )
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
        if self.options.setup_enabled
            && matches!(&interaction, Interaction::Command(command) if command.data.name == "setup")
        {
            if let Interaction::Command(command) = interaction {
                return self.handle_setup_command(&context, &command).await;
            }
        }
        if self.options.randomizer_enabled || self.options.cast_enabled {
            match &interaction {
                Interaction::Component(component) => {
                    if self.options.randomizer_enabled
                        && self
                            .handle_randomizer_component(&context, component.clone())
                            .await?
                    {
                        return Ok(());
                    }
                    if self.options.cast_enabled
                        && self
                            .handle_cast_component(&context, component.clone())
                            .await?
                    {
                        return Ok(());
                    }
                    return Ok(());
                }
                Interaction::Modal(modal) => {
                    if self.options.randomizer_enabled
                        && self
                            .handle_randomizer_modal(&context, modal.clone())
                            .await?
                    {
                        return Ok(());
                    }
                    return Ok(());
                }
                Interaction::Command(command) if command.data.name == "randomizer" => {
                    return self.handle_randomizer_command(&context, command).await;
                }
                Interaction::Command(command) if command.data.name == "cast" => {
                    if self.options.cast_enabled {
                        return self.handle_cast_command(&context, command).await;
                    }
                    return Ok(());
                }
                _ => {}
            }
        }
        let Interaction::Command(command) = interaction else {
            return Ok(());
        };
        let Some(facts) = CoreVoiceInteractionFacts::from_command(&command) else {
            return Ok(());
        };
        if self.options.queue_enabled
            && let Some(queue) =
                parse_queue_command(&command.data).map_err(|_| GatewayEventDispatchError)?
        {
            return self
                .handle_queue_interaction(&context, &command, &facts, queue)
                .await;
        }
        let executor = self.executor(&context)?;
        let defer_ephemeral = Executor::requires_ephemeral_defer(&command.data)
            .map_err(|_| GatewayEventDispatchError)?;
        let defer_public = Executor::requires_public_defer(&command.data)
            .map_err(|_| GatewayEventDispatchError)?;
        if defer_ephemeral {
            command
                .defer_ephemeral(&context)
                .await
                .map_err(|_| GatewayEventDispatchError)?;
        } else if defer_public {
            command
                .defer(&context)
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
        if defer_ephemeral || defer_public {
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
        if let Ok(executor) = self.executor.lock()
            && let Some(executor) = executor.as_ref()
        {
            executor.forget_guild(guild_id);
        }
        if let Ok(service) = self.message_service.lock()
            && let Some(service) = service.as_ref()
        {
            service.forget_guild(guild_id);
        }
        if let Ok(mut speakers) = self.last_speakers.lock() {
            speakers.remove(guild_id);
        }
        if let Ok(mut sessions) = self.cast_sessions.lock() {
            sessions.retain(|_, session| session.guild_id != guild_id);
        }
        Ok(())
    }
}

impl CoreVoiceGatewaySink {
    async fn handle_queue_interaction(
        &self,
        context: &Context,
        command: &serenity::model::application::CommandInteraction,
        facts: &CoreVoiceInteractionFacts,
        queue: vozen_discord::QueueCommand,
    ) -> Result<(), GatewayEventDispatchError> {
        let dependencies = self.dependencies(context)?;
        let can_manage_guild = command
            .member
            .as_ref()
            .and_then(|member| member.permissions)
            .is_some_and(|permissions| permissions.contains(Permissions::MANAGE_GUILD));
        let caller_voice_channel = self
            .gateway_state
            .voice_channel_id(&facts.guild_id, &facts.user_id);
        let bot_voice_channel = self.gateway_state.bot_voice_channel_id(&facts.guild_id);
        let outcome = QueueControlService::new(dependencies.playback.clone())
            .execute(
                QueueControlInvocation {
                    guild_id: &facts.guild_id,
                    user_id: &facts.user_id,
                    can_manage_guild,
                    caller_voice_channel_id: caller_voice_channel.as_deref(),
                    bot_voice_channel_id: bot_voice_channel.as_deref(),
                    now_ms: system_now_ms().try_into().unwrap_or_default(),
                },
                queue,
            )
            .await;
        command
            .create_response(
                context,
                CreateInteractionResponse::Message(
                    CreateInteractionResponseMessage::new()
                        .content(queue_response(outcome))
                        .ephemeral(true),
                ),
            )
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        Ok(())
    }

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
        } else if (character.is_whitespace() || character == '_')
            && !last_was_space
            && !output.is_empty()
        {
            output.push(' ');
            last_was_space = true;
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

fn queue_response(outcome: QueueControlOutcome) -> String {
    match outcome {
        QueueControlOutcome::Empty => "The queue is empty.".to_owned(),
        QueueControlOutcome::Snapshot(items) => {
            let lines = items.iter().map(queue_item_line).collect::<Vec<_>>();
            if lines.is_empty() {
                "The queue is empty.".to_owned()
            } else {
                format!("Pending queue ({}):\n{}", lines.len(), lines.join("\n"))
            }
        }
        QueueControlOutcome::Removed => "Removed that queued item.".to_owned(),
        QueueControlOutcome::Unavailable => "That queue item is unavailable.".to_owned(),
        QueueControlOutcome::RequiresManageGuild => {
            "You need Manage Server to control the queue.".to_owned()
        }
        QueueControlOutcome::NotInSameVoice => {
            "Join Vozen's voice channel to control audio.".to_owned()
        }
        QueueControlOutcome::Cleared => "Cleared the queue.".to_owned(),
        QueueControlOutcome::Paused => "Audio paused.".to_owned(),
        QueueControlOutcome::NothingToPause => "There is no audio to pause.".to_owned(),
        QueueControlOutcome::Resumed => "Audio resumed.".to_owned(),
        QueueControlOutcome::NotPaused => "Audio is not paused.".to_owned(),
        QueueControlOutcome::Skipped => "Skipped the current audio.".to_owned(),
        QueueControlOutcome::NothingPlaying => "There is no audio to skip.".to_owned(),
        QueueControlOutcome::PlaybackFailed => "The queue is unavailable right now.".to_owned(),
    }
}

fn queue_item_line(item: &PublicQueueItem) -> String {
    format!(
        "- `{}` - {}, {}, {}s waiting",
        item.id,
        queue_source_label(item.source),
        queue_lane_label(item.lane),
        item.age_ms / 1_000
    )
}

fn queue_source_label(source: QueueSource) -> &'static str {
    match source {
        QueueSource::Message => "message",
        QueueSource::Command => "command",
        QueueSource::Game => "game",
        QueueSource::Sound => "sound",
        QueueSource::System => "system",
    }
}

fn queue_lane_label(lane: QueueLane) -> &'static str {
    match lane {
        QueueLane::Standard => "standard",
        QueueLane::Accessibility => "accessibility",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use vozen_discord::CoreVoiceSettings;

    #[test]
    fn queue_responses_keep_items_opaque_and_match_node_wording() {
        assert_eq!(
            queue_response(QueueControlOutcome::Snapshot(vec![PublicQueueItem {
                id: "opaque".into(),
                source: QueueSource::Message,
                lane: QueueLane::Standard,
                age_ms: 3_200,
            }])),
            "Pending queue (1):\n- `opaque` - message, standard, 3s waiting"
        );
        assert_eq!(
            queue_response(QueueControlOutcome::NotInSameVoice),
            "Join Vozen's voice channel to control audio."
        );
    }

    #[test]
    fn promotion_options_preserve_distinct_queue_and_synthesis_limits() {
        let options = CoreVoiceRuntimeOptions {
            piper_path: "piper".into(),
            models_dir: "models".into(),
            cache_dir: "cache".into(),
            piper_concurrency: 2,
            queue_cap: 20,
            queue_enabled: true,
            message_autoread: false,
            randomizer_enabled: false,
            cast_enabled: false,
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
                queue_enabled: true,
                message_autoread: true,
                randomizer_enabled: false,
                cast_enabled: false,
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
