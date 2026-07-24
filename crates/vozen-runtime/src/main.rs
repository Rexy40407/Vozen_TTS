#![forbid(unsafe_code)]

//! Opt-in Rust process entry point used during the Node-to-Rust shadow migration.
//!
//! It deliberately starts only the safe shared foundations (SQLite migration, Discord gateway,
//! optional loopback HTTP route). Account, receipt-claim, Ko-fi webhook, dashboard and admin
//! adapters are individually opt-in. Voice/message ownership still requires its own canary flag.

mod automatic_translation_sink;
mod birthday_sink;
mod bot_stats_sink;
mod config_blockword_sink;
mod config_channel_sink;
mod config_default_voice_sink;
mod config_greet_language_sink;
mod config_language_sink;
mod config_numeric_sink;
mod config_queue_role_sink;
mod config_reset_sink;
mod config_role_sink;
mod config_show_sink;
mod config_toggle_sink;
#[cfg(feature = "voice-driver")]
mod core_voice_sink;
mod engine_router;
mod error_reporter;
mod file_export_sink;
mod game_list_sink;
mod game_score_sink;
#[cfg(feature = "voice-driver")]
mod gcloud_adapter;
#[cfg(feature = "voice-driver")]
mod gtts_adapter;
mod guild_lifecycle_sink;
mod guild_welcome_sink;
mod help_sink;
mod invite_sink;
#[cfg(feature = "voice-driver")]
mod kokoro_adapter;
#[cfg(feature = "voice-driver")]
mod live_transcription_sink;
mod loop_lag;
#[cfg(feature = "voice-driver")]
mod neural_adapter;
mod owner_command_sink;
mod piper_adapter;
mod premium_sink;
mod privacy_sink;
mod pronunciation_sink;
mod redeem_sink;
mod runtime_mode;
mod server_stats_sink;
mod stats_sink;
mod top_speakers_sink;
mod topgg_metrics;
mod transcription_adapter;
mod transcription_control_sink;
mod transcription_sink;
mod translation_preference_sink;
mod translation_provider;
mod translation_text_sink;
mod uptime_sink;
mod voice_preference_sink;
mod vote_sink;

use std::{
    env,
    net::SocketAddr,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use std::fs;

use thiserror::Error;
use vozen_api::{
    ProviderHealth as PublicProviderHealth, PublicStatusInput, PublicStatusProvider,
    RuntimeRouterConfig,
    account_api::AccountApiConfig,
    admin_api::AdminApiConfig,
    admin_router::AdminRouterConfig,
    dashboard_api::{
        DashboardApiConfig, DashboardOption, DashboardOptions, DashboardOptionsError,
        DashboardOptionsProvider,
    },
    dashboard_oauth::DiscordDashboardAuthorizer,
    discord_oauth::DiscordOAuthVerifier,
    kofi_webhook::KofiWebhookConfig,
    map_public_status,
    premium_api::{ClaimHelpNotifier, DiscordClaimHelpNotifier, PremiumApiConfig},
    runtime_router,
    topgg_webhook::TopggWebhookConfig,
};
use vozen_contracts::DiscordCommandCatalog;
use vozen_core::{SynthesisEngine, parse_kofi_shop_map};
use vozen_discord::{
    CommandRegistrationConfig, CompositeGatewayEventSink, CoreVoiceSettings,
    DiscordDashboardOptionsProvider, DiscordHttpCommandRegistrationClient, DiscordRuntimeConfig,
    DiscordRuntimeError, GatewayEventSink, GatewayState, locale_display_options, register_commands,
    run_discord_gateway_with_state_and_sink, voice_display_options, write_planned_rejoin_marker,
};
use vozen_store::{
    DEPARTURE_GRACE_MS, ProviderHealth as StoreProviderHealth, SqliteStore, month_key_utc,
};

use crate::owner_command_sink::OwnerCommandRuntimeOptions;
use crate::runtime_mode::RuntimeMode;
use crate::topgg_metrics::{
    ReqwestTopggMetricsHttp, TOPGG_POST_INTERVAL, post_topgg_stats, sync_topgg_commands,
};
use crate::transcription_adapter::TranscriptionRuntimeOptions;
use crate::transcription_control_sink::SttConsentRegistry;

const DISCORD_COMMAND_CONTRACT: &str = include_str!("../../../contracts/discord-commands.json");

struct RuntimeConfig {
    discord_token: String,
    database_path: PathBuf,
    health_bind: Option<SocketAddr>,
    public_status: Option<PublicStatusConfig>,
    premium_http: Option<PremiumHttpConfig>,
    topgg_webhook: Option<TopggWebhookRuntimeConfig>,
    topgg_metrics: Option<TopggMetricsRuntimeConfig>,
    vote_redemption_secret: Option<String>,
    owner_commands: Option<OwnerCommandRuntimeOptions>,
    core_voice: Option<CoreVoiceRuntimeOptions>,
    tts_file: Option<TtsFileRuntimeOptions>,
    transcription: Option<TranscriptionRuntimeOptions>,
    transcription_control: bool,
    #[cfg(feature = "voice-driver")]
    transcription_live: bool,
    translation_text: Option<TranslationTextRuntimeOptions>,
    translation_preferences: bool,
    voice_preferences: Option<VoicePreferenceRuntimeOptions>,
    config_default_voice: Option<ConfigDefaultVoiceRuntimeOptions>,
    config_channel: bool,
    config_queue_roles: bool,
    config_greet_language: bool,
    config_blockword: bool,
    pronunciation: bool,
    config_language: bool,
    config_toggles: bool,
    config_numeric: bool,
    config_role: bool,
    config_reset: bool,
    config_show: bool,
    uptime: bool,
    invite: bool,
    invite_client_id: Option<String>,
    help: bool,
    help_support_url: String,
    welcome: bool,
    vote: bool,
    vote_client_id: Option<String>,
    top_speakers: bool,
    birthday: bool,
    bot_stats: bool,
    server_stats: bool,
    stats: bool,
    premium: bool,
    redeem: bool,
    privacy: bool,
    game_list: bool,
    game_scores: bool,
    automatic_translation: Option<AutomaticTranslationRuntimeOptions>,
    dashboard: Option<DashboardRuntimeOptions>,
    admin: Option<AdminRuntimeOptions>,
}

struct PublicStatusConfig {
    incident: Option<String>,
}

struct PremiumHttpConfig {
    browser_api_enabled: bool,
    client_id: Option<String>,
    origin: String,
    kofi_webhook_token: Option<String>,
    kofi_shop_map: Option<String>,
    claim_help_webhook_url: Option<String>,
}

struct TopggWebhookRuntimeConfig {
    client_id: String,
    webhook_secret: String,
    redemption_secret: String,
}

struct TopggMetricsRuntimeConfig {
    client_id: String,
    token: String,
}

/// Browser dashboard migration is separate from the command promotion. It stays disabled unless
/// the operator explicitly enables it, so a loopback Rust shadow process cannot take ownership
/// of account configuration accidentally.
struct DashboardRuntimeOptions {
    models_dir: PathBuf,
}

/// Owner console routes are a separate, explicit promotion. Missing values keep the API inert;
/// the runtime never invents an owner, session secret or OAuth audience.
struct AdminRuntimeOptions {
    panel_origin: String,
    session_secret: Option<String>,
    owner_id: Option<String>,
    client_id: Option<String>,
}

struct RuntimeDashboardOptionsProvider {
    discord: DiscordDashboardOptionsProvider,
    voices: Vec<DashboardOption>,
    locales: Vec<DashboardOption>,
}

impl RuntimeDashboardOptionsProvider {
    fn new(gateway_state: GatewayState, models: Vec<String>) -> Self {
        Self {
            discord: DiscordDashboardOptionsProvider::new(gateway_state),
            voices: dashboard_options(voice_display_options(&models)),
            locales: dashboard_options(locale_display_options()),
        }
    }
}

#[async_trait::async_trait]
impl DashboardOptionsProvider for RuntimeDashboardOptionsProvider {
    async fn options_for_guild(
        &self,
        guild_id: &str,
    ) -> Result<DashboardOptions, DashboardOptionsError> {
        let options = self
            .discord
            .options_for_guild(guild_id)
            .await
            .ok_or(DashboardOptionsError::Unavailable)?;
        Ok(DashboardOptions {
            channels: dashboard_options(options.channels),
            voices: self.voices.clone(),
            locales: self.locales.clone(),
            voice_channels: dashboard_options(options.voice_channels),
            roles: dashboard_options(options.roles),
        })
    }
}

fn dashboard_options(options: Vec<vozen_discord::DiscordDashboardOption>) -> Vec<DashboardOption> {
    options
        .into_iter()
        .map(|option| DashboardOption {
            id: option.id,
            label: option.label,
            unavailable: false,
        })
        .collect()
}

/// Explicit opt-in configuration for the first Rust-owned Discord voice commands.
///
/// It shares Node's established Piper values, but it is never inferred from their presence:
/// `RUST_CORE_VOICE_ENABLED=true` is required so a normal Rust shadow process cannot claim
/// interactions by accident.
#[derive(Clone)]
#[cfg_attr(not(feature = "voice-driver"), allow(dead_code))]
struct CoreVoiceRuntimeOptions {
    piper_path: PathBuf,
    models_dir: PathBuf,
    cache_dir: PathBuf,
    gtts_cache_dir: PathBuf,
    ffmpeg: PathBuf,
    openai_api_key: Option<String>,
    neural_cache_dir: PathBuf,
    gcloud_api_key: Option<String>,
    gcloud_cache_dir: PathBuf,
    gcloud_limits: vozen_tts::GcloudLimits,
    kokoro_command: Option<vozen_tts::KokoroCommand>,
    kokoro_cache_dir: PathBuf,
    kokoro_languages: Option<Vec<String>>,
    piper_concurrency: usize,
    queue_cap: usize,
    queue_enabled: bool,
    message_autoread: bool,
    randomizer_enabled: bool,
    cast_enabled: bool,
    setup_enabled: bool,
    speak_context_enabled: bool,
    game_play_enabled: bool,
    settings: CoreVoiceSettings,
}

/// File export deliberately has a separate flag from in-call playback: it never joins a call or
/// requires Songbird, and can therefore be canaried independently while Node remains authority
/// for every other command.
#[derive(Clone)]
struct TtsFileRuntimeOptions {
    piper_path: PathBuf,
    models_dir: PathBuf,
    cache_dir: PathBuf,
    piper_concurrency: usize,
    settings: CoreVoiceSettings,
}

/// `/voice` preference mutations do not need the audio driver, but `/voice set` must validate
/// against the exact Piper model catalogue available to this process. Keeping that catalogue in
/// startup configuration prevents a stale Discord option from becoming a stored preference.
struct VoicePreferenceRuntimeOptions {
    available_models: Vec<String>,
    default_speed: f64,
}

/// `/config default-voice` shares the discovered Piper catalogue but has an independent canary
/// so preference migrations cannot accidentally claim an admin command.
struct ConfigDefaultVoiceRuntimeOptions {
    available_models: Vec<String>,
}

/// This is separate from automatic channel translation and is disabled unless the exact flag
/// is enabled alongside the matching Node ownership boundary.
struct TranslationTextRuntimeOptions {
    provider: translation_provider::RuntimeTranslationProvider,
    text_enabled: bool,
    admin_enabled: bool,
    context_enabled: bool,
}

/// Automatic channel translation is a separate, explicitly promoted message path. It has no
/// relationship to speaking or `/translate text`, so it remains off until its own flag is set.
struct AutomaticTranslationRuntimeOptions {
    provider: translation_provider::RuntimeTranslationProvider,
}

impl RuntimeConfig {
    fn from_environment() -> Result<Self, RuntimeError> {
        let runtime_mode = RuntimeMode::from_environment()?;
        runtime_mode.validate_environment()?;
        let discord_token = env::var("DISCORD_TOKEN").map_err(|_| RuntimeError::MissingToken)?;
        if discord_token.trim().is_empty() {
            return Err(RuntimeError::MissingToken);
        }
        let database_path = env::var_os("DB_PATH")
            .filter(|value| !value.is_empty())
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("./tts.db"));
        let health_bind = match env::var("HEALTH_PORT") {
            Ok(raw) if raw.trim().is_empty() => None,
            Ok(raw) => {
                let port = raw
                    .trim()
                    .parse::<u16>()
                    .ok()
                    .filter(|port| *port != 0)
                    .ok_or(RuntimeError::InvalidHealthPort)?;
                Some(SocketAddr::from(([127, 0, 0, 1], port)))
            }
            Err(env::VarError::NotPresent) => None,
            Err(env::VarError::NotUnicode(_)) => return Err(RuntimeError::InvalidHealthPort),
        };
        let premium_http = premium_http_from_environment()?;
        let public_status = public_status_from_environment();
        let topgg_webhook = topgg_webhook_from_environment()?;
        let topgg_metrics = topgg_metrics_from_environment()?;
        let vote_redemption_secret = nonempty_env("VOTE_REDEMPTION_SECRET");
        let owner_commands = owner_commands_from_environment();
        let core_voice = core_voice_from_environment()?;
        let tts_file = tts_file_from_environment()?;
        let transcription = transcription_from_environment()?;
        let transcription_live_requested =
            live_transcription_enabled(env::var("RUST_TRANSCRIBE_LIVE_ENABLED").ok().as_deref());
        #[cfg(not(feature = "voice-driver"))]
        if transcription_live_requested {
            return Err(RuntimeError::LiveTranscriptionVoiceDriverRequired);
        }
        #[cfg(feature = "voice-driver")]
        let transcription_live = transcription_live_requested;
        let transcription_control = transcription_control_enabled(
            env::var("RUST_TRANSCRIBE_CONTROL_ENABLED").ok().as_deref(),
        ) || {
            #[cfg(feature = "voice-driver")]
            {
                transcription_live
            }
            #[cfg(not(feature = "voice-driver"))]
            {
                false
            }
        };
        let translation_text = translation_text_from_environment();
        let translation_preferences = translation_preferences_enabled(
            env::var("RUST_TRANSLATION_PREFERENCES_ENABLED")
                .ok()
                .as_deref(),
        );
        let voice_preferences = voice_preferences_from_environment()?;
        let config_default_voice = config_default_voice_from_environment()?;
        let config_channel =
            config_channel_enabled(env::var("RUST_CONFIG_CHANNEL_ENABLED").ok().as_deref());
        let config_queue_roles =
            config_queue_roles_enabled(env::var("RUST_CONFIG_QUEUE_ROLES_ENABLED").ok().as_deref());
        let config_greet_language = config_greet_language_enabled(
            env::var("RUST_CONFIG_GREET_LANGUAGE_ENABLED")
                .ok()
                .as_deref(),
        );
        let config_blockword =
            config_blockword_enabled(env::var("RUST_CONFIG_BLOCKWORD_ENABLED").ok().as_deref());
        let pronunciation =
            pronunciation_enabled(env::var("RUST_PRONUNCIATION_ENABLED").ok().as_deref());
        let config_language =
            config_language_enabled(env::var("RUST_CONFIG_LANGUAGE_ENABLED").ok().as_deref());
        let config_toggles =
            config_toggles_enabled(env::var("RUST_CONFIG_TOGGLES_ENABLED").ok().as_deref());
        let config_numeric =
            config_numeric_enabled(env::var("RUST_CONFIG_NUMERIC_ENABLED").ok().as_deref());
        let config_role = config_role_enabled(env::var("RUST_CONFIG_ROLE_ENABLED").ok().as_deref());
        let config_reset =
            config_reset_enabled(env::var("RUST_CONFIG_RESET_ENABLED").ok().as_deref());
        let config_show = config_show_enabled(env::var("RUST_CONFIG_SHOW_ENABLED").ok().as_deref());
        let public_commands =
            public_commands_enabled(env::var("RUST_PUBLIC_COMMANDS_ENABLED").ok().as_deref());
        let uptime =
            uptime_enabled(env::var("RUST_UPTIME_ENABLED").ok().as_deref()) || public_commands;
        let invite =
            invite_enabled(env::var("RUST_INVITE_ENABLED").ok().as_deref()) || public_commands;
        let invite_client_id = nonempty_env("CLIENT_ID");
        let help = help_enabled(env::var("RUST_HELP_ENABLED").ok().as_deref()) || public_commands;
        let help_support_url = nonempty_env("SUPPORT_URL")
            .unwrap_or_else(|| "https://discord.gg/4kYw2WUbNN".to_owned());
        let welcome = welcome_enabled(env::var("RUST_WELCOME_ENABLED").ok().as_deref());
        let vote = vote_enabled(env::var("RUST_VOTE_ENABLED").ok().as_deref()) || public_commands;
        let vote_client_id = nonempty_env("CLIENT_ID");
        let top_speakers =
            top_speakers_enabled(env::var("RUST_TOP_SPEAKERS_ENABLED").ok().as_deref())
                || public_commands;
        let birthday = birthday_enabled(env::var("RUST_BIRTHDAY_ENABLED").ok().as_deref());
        let bot_stats = bot_stats_enabled(env::var("RUST_BOT_STATS_ENABLED").ok().as_deref())
            || public_commands;
        let server_stats =
            server_stats_enabled(env::var("RUST_SERVER_STATS_ENABLED").ok().as_deref())
                || public_commands;
        let stats =
            stats_enabled(env::var("RUST_STATS_ENABLED").ok().as_deref()) || public_commands;
        let premium = premium_enabled(env::var("RUST_PREMIUM_ENABLED").ok().as_deref());
        let redeem = redeem_enabled(env::var("RUST_REDEEM_ENABLED").ok().as_deref());
        let privacy = privacy_enabled(env::var("RUST_PRIVACY_ENABLED").ok().as_deref());
        let game_list = game_list_enabled(env::var("RUST_GAME_LIST_ENABLED").ok().as_deref())
            || public_commands;
        let game_scores = game_scores_enabled(env::var("RUST_GAME_SCORES_ENABLED").ok().as_deref())
            || public_commands;
        let automatic_translation = automatic_translation_from_environment();
        let dashboard = dashboard_from_environment()?;
        let admin = admin_from_environment();
        if http_listener_required(
            health_bind,
            premium_http.is_some(),
            dashboard.is_some(),
            admin.is_some(),
            topgg_webhook.is_some(),
            public_status.is_some(),
        ) {
            return Err(RuntimeError::HttpListenerRequired);
        }
        Ok(Self {
            discord_token,
            database_path,
            health_bind,
            public_status,
            premium_http,
            topgg_webhook,
            topgg_metrics,
            vote_redemption_secret,
            owner_commands,
            core_voice,
            tts_file,
            transcription,
            transcription_control,
            #[cfg(feature = "voice-driver")]
            transcription_live,
            translation_text,
            translation_preferences,
            voice_preferences,
            config_default_voice,
            config_channel,
            config_queue_roles,
            config_greet_language,
            config_blockword,
            pronunciation,
            config_language,
            config_toggles,
            config_numeric,
            config_role,
            config_reset,
            config_show,
            uptime,
            invite,
            invite_client_id,
            help,
            help_support_url,
            welcome,
            vote,
            vote_client_id,
            top_speakers,
            birthday,
            bot_stats,
            server_stats,
            stats,
            premium,
            redeem,
            privacy,
            game_list,
            game_scores,
            automatic_translation,
            dashboard,
            admin,
        })
    }
}

fn core_voice_from_environment() -> Result<Option<CoreVoiceRuntimeOptions>, RuntimeError> {
    if !core_voice_enabled(env::var("RUST_CORE_VOICE_ENABLED").ok().as_deref()) {
        return Ok(None);
    }
    let default_engine = core_voice_default_engine(env::var("TTS_ENGINE").ok().as_deref())?;
    if default_engine == SynthesisEngine::Neural && nonempty_env("OPENAI_API_KEY").is_none() {
        return Err(RuntimeError::NeuralApiKeyRequired);
    }
    let default_voice =
        nonempty_env("DEFAULT_VOICE").unwrap_or_else(|| "en_US-amy-medium".to_owned());
    let default_speed = positive_number_from_environment("DEFAULT_SPEED", 1.0, false)?;
    let queue_cap = positive_number_from_environment("QUEUE_CAP", 20.0, true)? as usize;
    let piper_concurrency = positive_number_from_environment(
        "PIPER_MAX_CONCURRENCY",
        default_piper_concurrency() as f64,
        true,
    )? as usize;
    Ok(Some(CoreVoiceRuntimeOptions {
        piper_path: nonempty_env("PIPER_PATH")
            .unwrap_or_else(|| "piper".to_owned())
            .into(),
        models_dir: nonempty_env("MODELS_DIR")
            .unwrap_or_else(|| "./models".to_owned())
            .into(),
        cache_dir: nonempty_env("RUST_VOICE_CACHE_DIR")
            .unwrap_or_else(|| "./audio-cache/rust".to_owned())
            .into(),
        gtts_cache_dir: nonempty_env("RUST_GTTS_CACHE_DIR")
            .unwrap_or_else(|| "./audio-cache/rust-gtts".to_owned())
            .into(),
        ffmpeg: nonempty_env("FFMPEG_PATH")
            .unwrap_or_else(|| "ffmpeg".to_owned())
            .into(),
        openai_api_key: nonempty_env("OPENAI_API_KEY"),
        neural_cache_dir: nonempty_env("RUST_NEURAL_CACHE_DIR")
            .unwrap_or_else(|| "./audio-cache/rust-neural".to_owned())
            .into(),
        gcloud_api_key: nonempty_env("GOOGLE_TTS_API_KEY"),
        gcloud_cache_dir: nonempty_env("RUST_GCLOUD_CACHE_DIR")
            .unwrap_or_else(|| "./audio-cache/rust-gcloud".to_owned())
            .into(),
        gcloud_limits: vozen_tts::GcloudLimits {
            max_chars: positive_number_from_environment("GCLOUD_MAX_CHARS", 500.0, true)? as usize,
            plus_monthly: positive_number_from_environment(
                "GCLOUD_PLUS_MONTHLY_CHARS",
                100_000.0,
                true,
            )? as i64,
            pass3_monthly: positive_number_from_environment(
                "GCLOUD_PASS3_MONTHLY_CHARS",
                400_000.0,
                true,
            )? as i64,
            pass8_monthly: positive_number_from_environment(
                "GCLOUD_PASS8_MONTHLY_CHARS",
                1_000_000.0,
                true,
            )? as i64,
            daily_budget: non_negative_number_from_environment(
                "GCLOUD_DAILY_CHAR_BUDGET",
                300_000.0,
                true,
            )? as i64,
        },
        kokoro_command: resolve_kokoro_command(nonempty_env("KOKORO_CMD").as_deref()),
        kokoro_cache_dir: nonempty_env("RUST_KOKORO_CACHE_DIR")
            .unwrap_or_else(|| "./audio-cache/rust-kokoro".to_owned())
            .into(),
        kokoro_languages: kokoro_languages_from_environment(),
        piper_concurrency,
        queue_cap,
        queue_enabled: queue_enabled(env::var("RUST_QUEUE_ENABLED").ok().as_deref()),
        message_autoread: message_autoread_enabled(
            env::var("RUST_MESSAGE_AUTOREAD_ENABLED").ok().as_deref(),
        ),
        randomizer_enabled: randomizer_enabled(env::var("RUST_RANDOMIZER_ENABLED").ok().as_deref()),
        cast_enabled: cast_enabled(env::var("RUST_CAST_ENABLED").ok().as_deref()),
        setup_enabled: setup_enabled(env::var("RUST_SETUP_ENABLED").ok().as_deref()),
        speak_context_enabled: speak_context_enabled(
            env::var("RUST_SPEAK_CONTEXT_ENABLED").ok().as_deref(),
        ),
        game_play_enabled: game_play_enabled(env::var("RUST_GAME_PLAY_ENABLED").ok().as_deref()),
        settings: CoreVoiceSettings {
            available_models: Vec::new(),
            default_voice,
            default_speed,
            default_engine,
        },
    }))
}

fn kokoro_languages_from_environment() -> Option<Vec<String>> {
    let raw = env::var("KOKORO_LANGS").ok()?;
    let languages: Vec<String> = raw
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_ascii_lowercase)
        .collect();
    (!languages.is_empty()).then_some(languages)
}

fn resolve_kokoro_command(explicit: Option<&str>) -> Option<vozen_tts::KokoroCommand> {
    if let Some(value) = explicit {
        return vozen_tts::parse_kokoro_command(value);
    }
    let root = env::current_dir().ok()?;
    let python = [
        root.join("tools")
            .join("kokoro-venv")
            .join("Scripts")
            .join("python.exe"),
        root.join("tools")
            .join("kokoro-venv")
            .join("bin")
            .join("python"),
    ]
    .into_iter()
    .find(|path| path.is_file())?;
    let required = [
        root.join("tools").join("kokoro_server.py"),
        root.join("tools").join("kokoro-v1.0.onnx"),
        root.join("tools").join("voices-v1.0.bin"),
    ];
    if required.iter().all(|path| Path::is_file(path)) {
        Some(vozen_tts::KokoroCommand {
            executable: python,
            args: vec![required[0].to_string_lossy().into_owned()],
        })
    } else {
        None
    }
}

fn randomizer_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn cast_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn setup_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn speak_context_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn game_play_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn tts_file_from_environment() -> Result<Option<TtsFileRuntimeOptions>, RuntimeError> {
    if !tts_file_enabled(env::var("RUST_TTS_FILE_ENABLED").ok().as_deref()) {
        return Ok(None);
    }
    require_piper_runtime_default(env::var("TTS_ENGINE").ok().as_deref())?;
    let default_voice =
        nonempty_env("DEFAULT_VOICE").unwrap_or_else(|| "en_US-amy-medium".to_owned());
    let default_speed = positive_number_from_environment("DEFAULT_SPEED", 1.0, false)?;
    let piper_concurrency = positive_number_from_environment(
        "PIPER_MAX_CONCURRENCY",
        default_piper_concurrency() as f64,
        true,
    )? as usize;
    Ok(Some(TtsFileRuntimeOptions {
        piper_path: nonempty_env("PIPER_PATH")
            .unwrap_or_else(|| "piper".to_owned())
            .into(),
        models_dir: nonempty_env("MODELS_DIR")
            .unwrap_or_else(|| "./models".to_owned())
            .into(),
        cache_dir: nonempty_env("RUST_TTS_FILE_CACHE_DIR")
            .unwrap_or_else(|| "./audio-cache/rust-file".to_owned())
            .into(),
        piper_concurrency,
        settings: CoreVoiceSettings {
            available_models: Vec::new(),
            default_voice,
            default_speed,
            default_engine: SynthesisEngine::Piper,
        },
    }))
}

fn transcription_from_environment() -> Result<Option<TranscriptionRuntimeOptions>, RuntimeError> {
    let message_enabled =
        transcription_enabled(env::var("RUST_TRANSCRIBE_MESSAGE_ENABLED").ok().as_deref());
    #[cfg(feature = "voice-driver")]
    let live_enabled =
        live_transcription_enabled(env::var("RUST_TRANSCRIBE_LIVE_ENABLED").ok().as_deref());
    #[cfg(not(feature = "voice-driver"))]
    let live_enabled = false;
    if !message_enabled && !live_enabled {
        return Ok(None);
    }
    let max_concurrency =
        positive_number_from_environment("STT_MAX_CONCURRENCY", 1.0, true)? as usize;
    Ok(Some(TranscriptionRuntimeOptions {
        python: nonempty_env("WHISPER_PYTHON")
            .unwrap_or_else(|| "python3".to_owned())
            .into(),
        script: nonempty_env("WHISPER_SCRIPT")
            .unwrap_or_else(|| "tools/whisper_sidecar.py".to_owned())
            .into(),
        model: nonempty_env("WHISPER_MODEL"),
        ffmpeg: nonempty_env("FFMPEG_PATH")
            .unwrap_or_else(|| "ffmpeg".to_owned())
            .into(),
        max_concurrency,
    }))
}

fn voice_preferences_from_environment()
-> Result<Option<VoicePreferenceRuntimeOptions>, RuntimeError> {
    if !voice_preferences_enabled(env::var("RUST_VOICE_PREFERENCES_ENABLED").ok().as_deref()) {
        return Ok(None);
    }
    let models_dir = nonempty_env("MODELS_DIR").unwrap_or_else(|| "./models".to_owned());
    let default_speed = positive_number_from_environment("DEFAULT_SPEED", 1.0, false)?;
    Ok(Some(VoicePreferenceRuntimeOptions {
        available_models: discover_piper_models(std::path::Path::new(&models_dir))?,
        default_speed,
    }))
}

fn config_default_voice_from_environment()
-> Result<Option<ConfigDefaultVoiceRuntimeOptions>, RuntimeError> {
    if !config_default_voice_enabled(
        env::var("RUST_CONFIG_DEFAULT_VOICE_ENABLED")
            .ok()
            .as_deref(),
    ) {
        return Ok(None);
    }
    let models_dir = nonempty_env("MODELS_DIR").unwrap_or_else(|| "./models".to_owned());
    Ok(Some(ConfigDefaultVoiceRuntimeOptions {
        available_models: discover_piper_models(std::path::Path::new(&models_dir))?,
    }))
}

fn translation_text_from_environment() -> Option<TranslationTextRuntimeOptions> {
    let text_enabled =
        translation_text_enabled(env::var("RUST_TRANSLATE_TEXT_ENABLED").ok().as_deref());
    let admin_enabled =
        translation_admin_enabled(env::var("RUST_TRANSLATION_ADMIN_ENABLED").ok().as_deref());
    let context_enabled =
        translation_context_enabled(env::var("RUST_TRANSLATE_CONTEXT_ENABLED").ok().as_deref());
    (text_enabled || admin_enabled || context_enabled).then(|| TranslationTextRuntimeOptions {
        provider: translation_provider::RuntimeTranslationProvider::from_environment(),
        text_enabled,
        admin_enabled,
        context_enabled,
    })
}

fn automatic_translation_from_environment() -> Option<AutomaticTranslationRuntimeOptions> {
    automatic_translation_enabled(
        env::var("RUST_AUTOMATIC_TRANSLATION_ENABLED")
            .ok()
            .as_deref(),
    )
    .then(|| AutomaticTranslationRuntimeOptions {
        provider: translation_provider::RuntimeTranslationProvider::from_environment(),
    })
}

/// This deliberately matches Node's safe opt-in semantics: only literal `true` can make Rust
/// own a Discord interaction. `1`, `yes`, missing and spelling mistakes remain shadow-only.
fn core_voice_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

/// Bundles only read-only/control-plane handlers. Voice, live games, STT, payments and
/// destructive privacy actions deliberately remain on independent canaries.
fn public_commands_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

/// The Rust owner sink is inert unless the operator explicitly enables it and supplies both
/// identity guards. This mirrors the Node handler's fail-closed owner resolution.
fn owner_commands_from_environment() -> Option<OwnerCommandRuntimeOptions> {
    if !owner_commands_enabled(env::var("RUST_OWNER_COMMANDS_ENABLED").ok().as_deref()) {
        return None;
    }
    Some(OwnerCommandRuntimeOptions {
        owner_id: nonempty_env("OWNER_ID")?,
        owner_guild_id: nonempty_env("OWNER_GUILD_ID")?,
    })
}

fn owner_commands_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

async fn register_rust_commands_if_enabled(config: &RuntimeConfig) -> Result<(), RuntimeError> {
    if !register_commands_enabled(env::var("RUST_REGISTER_COMMANDS_ENABLED").ok().as_deref()) {
        return Ok(());
    }
    let application_id = nonempty_env("CLIENT_ID").ok_or(RuntimeError::MissingClientId)?;
    let owner_guild_id = nonempty_env("OWNER_GUILD_ID");
    let state_path = nonempty_env("RUST_COMMANDS_STATE_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            config
                .database_path
                .parent()
                .unwrap_or_else(|| std::path::Path::new("."))
                .join("commands-state-rust.json")
        });
    let client = DiscordHttpCommandRegistrationClient::new(config.discord_token.clone())
        .map_err(|_| RuntimeError::CommandRegistration)?;
    register_commands(
        &client,
        &CommandRegistrationConfig {
            application_id,
            state_path: Some(state_path),
            owner_guild_id,
        },
    )
    .await
    .map_err(|_| RuntimeError::CommandRegistration)?;
    Ok(())
}

fn register_commands_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn tts_file_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn transcription_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn transcription_control_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn live_transcription_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

/// The first Rust voice adapters only have a production Piper backend. The Node bot can use
/// other default engines, but allowing the Rust canary to start in that configuration would
/// silently change what users hear. Missing `TTS_ENGINE` keeps Node's Piper default.
fn piper_runtime_default_compatible(raw: Option<&str>) -> bool {
    raw.is_none_or(|value| value.trim().is_empty() || value.trim().eq_ignore_ascii_case("piper"))
}

fn require_piper_runtime_default(raw: Option<&str>) -> Result<(), RuntimeError> {
    piper_runtime_default_compatible(raw)
        .then_some(())
        .ok_or(RuntimeError::RustVoiceRequiresPiperDefault)
}

fn core_voice_default_engine(raw: Option<&str>) -> Result<SynthesisEngine, RuntimeError> {
    match raw.map(str::trim).filter(|value| !value.is_empty()) {
        None => Ok(SynthesisEngine::Piper),
        Some(value) if value.eq_ignore_ascii_case("piper") => Ok(SynthesisEngine::Piper),
        Some(value) if value.eq_ignore_ascii_case("gtts") => Ok(SynthesisEngine::Default),
        Some(value) if value.eq_ignore_ascii_case("router") => Ok(SynthesisEngine::Default),
        Some(value) if value.eq_ignore_ascii_case("neural") => Ok(SynthesisEngine::Neural),
        Some(_) => Err(RuntimeError::RustVoiceRequiresPiperDefault),
    }
}

fn translation_text_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn translation_admin_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn translation_context_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn translation_preferences_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn voice_preferences_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn config_default_voice_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn config_channel_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn config_queue_roles_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn config_greet_language_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn config_blockword_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn pronunciation_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn config_language_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn config_toggles_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn config_numeric_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn config_role_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn config_show_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn config_reset_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn uptime_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn invite_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn help_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn welcome_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn vote_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn top_speakers_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn birthday_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn bot_stats_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn server_stats_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn stats_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn premium_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn redeem_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn privacy_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn game_list_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn game_scores_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn automatic_translation_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn message_autoread_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn queue_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn dashboard_from_environment() -> Result<Option<DashboardRuntimeOptions>, RuntimeError> {
    if !dashboard_enabled(env::var("RUST_DASHBOARD_ENABLED").ok().as_deref()) {
        return Ok(None);
    }
    let models_dir: PathBuf = nonempty_env("MODELS_DIR")
        .unwrap_or_else(|| "./models".to_owned())
        .into();
    // Validate now. A dashboard with an empty model selection would silently reject every
    // existing default voice, so its operator must fix the local model directory first.
    let _ = discover_piper_models(&models_dir)?;
    Ok(Some(DashboardRuntimeOptions { models_dir }))
}

fn dashboard_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn admin_from_environment() -> Option<AdminRuntimeOptions> {
    if !admin_enabled(env::var("RUST_ADMIN_API_ENABLED").ok().as_deref()) {
        return None;
    }
    Some(AdminRuntimeOptions {
        panel_origin: nonempty_env("ADMIN_PANEL_ORIGIN")
            .unwrap_or_else(|| "https://rexy40407.github.io".to_owned()),
        session_secret: nonempty_env("ADMIN_SESSION_SECRET"),
        owner_id: nonempty_env("OWNER_ID"),
        client_id: nonempty_env("ADMIN_CLIENT_ID").or_else(|| nonempty_env("CLIENT_ID")),
    })
}

fn admin_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn default_piper_concurrency() -> usize {
    std::thread::available_parallelism()
        .map(|count| count.get().saturating_sub(1).max(1))
        .unwrap_or(1)
}

fn positive_number_from_environment(
    name: &'static str,
    fallback: f64,
    integer: bool,
) -> Result<f64, RuntimeError> {
    parse_positive_number(nonempty_env(name).as_deref(), fallback, integer)
        .ok_or(RuntimeError::InvalidCoreVoiceSetting(name))
}

fn non_negative_number_from_environment(
    name: &'static str,
    fallback: f64,
    integer: bool,
) -> Result<f64, RuntimeError> {
    let value = nonempty_env(name)
        .and_then(|raw| raw.parse::<f64>().ok())
        .unwrap_or(fallback);
    if value.is_finite() && value >= 0.0 && (!integer || value.fract() == 0.0) {
        Ok(value)
    } else {
        Err(RuntimeError::InvalidCoreVoiceSetting(name))
    }
}

fn parse_positive_number(raw: Option<&str>, fallback: f64, integer: bool) -> Option<f64> {
    let Some(raw) = raw else {
        return Some(fallback);
    };
    raw.parse::<f64>()
        .ok()
        .filter(|value| value.is_finite() && *value > 0.0 && (!integer || value.fract() == 0.0))
}

#[cfg(feature = "voice-driver")]
fn core_voice_event_sink(
    options: Option<CoreVoiceRuntimeOptions>,
    store: Arc<Mutex<SqliteStore>>,
    gateway_state: GatewayState,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    let Some(mut options) = options else {
        return Ok(None);
    };
    options.settings.available_models = discover_piper_models(&options.models_dir)?;
    if !options
        .settings
        .available_models
        .iter()
        .any(|model| model == &options.settings.default_voice)
    {
        return Err(RuntimeError::DefaultVoiceUnavailable);
    }
    Ok(Some(Arc::new(core_voice_sink::CoreVoiceGatewaySink::new(
        store,
        gateway_state,
        options,
    ))))
}

fn tts_file_event_sink(
    options: Option<TtsFileRuntimeOptions>,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    let Some(mut options) = options else {
        return Ok(None);
    };
    options.settings.available_models = discover_piper_models(&options.models_dir)?;
    if !options
        .settings
        .available_models
        .iter()
        .any(|model| model == &options.settings.default_voice)
    {
        return Err(RuntimeError::DefaultVoiceUnavailable);
    }
    Ok(Some(Arc::new(
        file_export_sink::TtsFileGatewaySink::new(store, options)
            .map_err(|_| RuntimeError::TtsFileGateway)?,
    )))
}

fn transcription_event_sink(
    options: Option<TranscriptionRuntimeOptions>,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    // Live `/transcribe` reuses the adapter configuration, but must not accidentally promote the
    // separate message-context command when only `RUST_TRANSCRIBE_LIVE_ENABLED` is set.
    if !transcription_enabled(env::var("RUST_TRANSCRIBE_MESSAGE_ENABLED").ok().as_deref()) {
        return Ok(None);
    }
    let Some(options) = options else {
        return Ok(None);
    };
    let transcriber = transcription_adapter::AttachmentTranscriber::new(options)
        .map_err(|_| RuntimeError::TranscriptionGateway)?;
    Ok(Some(Arc::new(
        transcription_sink::TranscriptionGatewaySink::new(store, transcriber),
    )))
}

fn transcription_control_event_sink(
    enabled: bool,
    store: Arc<Mutex<SqliteStore>>,
    consent_registry: SttConsentRegistry,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        transcription_control_sink::TranscriptionControlGatewaySink::new_with_registry(
            store,
            consent_registry,
        )
        .map_err(|_| RuntimeError::TranscriptionControlGateway)?,
    )))
}

#[cfg(feature = "voice-driver")]
fn transcription_live_event_sink(
    enabled: bool,
    options: Option<TranscriptionRuntimeOptions>,
    store: Arc<Mutex<SqliteStore>>,
    gateway_state: GatewayState,
    consent_registry: SttConsentRegistry,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    let options = options.ok_or(RuntimeError::TranscriptionGateway)?;
    let max_concurrency = options.max_concurrency.max(1);
    let transcriber = transcription_adapter::AttachmentTranscriber::new(options)
        .map_err(|_| RuntimeError::TranscriptionGateway)?;
    Ok(Some(Arc::new(
        live_transcription_sink::LiveTranscriptionGatewaySink::new(
            store,
            gateway_state,
            transcriber,
            max_concurrency,
            consent_registry,
        )
        .map_err(|_| RuntimeError::TranscriptionGateway)?,
    )))
}

fn owner_command_event_sink(
    options: Option<OwnerCommandRuntimeOptions>,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    let Some(options) = options else {
        return Ok(None);
    };
    Ok(Some(Arc::new(
        owner_command_sink::OwnerCommandGatewaySink::new(store, options)
            .map_err(|_| RuntimeError::OwnerCommandGateway)?,
    )))
}

fn translation_text_event_sink(
    options: Option<TranslationTextRuntimeOptions>,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    let Some(options) = options else {
        return Ok(None);
    };
    Ok(Some(Arc::new(
        translation_text_sink::TranslationTextGatewaySink::new(
            store,
            options.provider,
            options.text_enabled,
            options.admin_enabled,
            options.context_enabled,
        )
        .map_err(|_| RuntimeError::TranslationGateway)?,
    )))
}

fn translation_preference_event_sink(
    enabled: bool,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        translation_preference_sink::TranslationPreferenceGatewaySink::new(store)
            .map_err(|_| RuntimeError::TranslationPreferenceGateway)?,
    )))
}

fn voice_preference_event_sink(
    options: Option<VoicePreferenceRuntimeOptions>,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    let Some(options) = options else {
        return Ok(None);
    };
    Ok(Some(Arc::new(
        voice_preference_sink::VoicePreferenceGatewaySink::new(
            store,
            vozen_discord::VoicePreferenceSettings {
                available_models: options.available_models,
                default_speed: options.default_speed,
            },
        )
        .map_err(|_| RuntimeError::VoicePreferenceGateway)?,
    )))
}

fn pronunciation_event_sink(
    enabled: bool,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        pronunciation_sink::PronunciationGatewaySink::new(
            store,
            nonempty_env("KOFI_URL").unwrap_or_else(|| "https://ko-fi.com/".to_owned()),
        )
        .map_err(|_| RuntimeError::PronunciationGateway)?,
    )))
}

fn config_language_event_sink(
    enabled: bool,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        config_language_sink::ConfigLanguageGatewaySink::new(store)
            .map_err(|_| RuntimeError::ConfigLanguageGateway)?,
    )))
}

fn config_toggle_event_sink(
    enabled: bool,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        config_toggle_sink::ConfigToggleGatewaySink::new(store)
            .map_err(|_| RuntimeError::ConfigToggleGateway)?,
    )))
}

fn config_numeric_event_sink(
    enabled: bool,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        config_numeric_sink::ConfigNumericGatewaySink::new(store)
            .map_err(|_| RuntimeError::ConfigNumericGateway)?,
    )))
}

fn config_role_event_sink(
    enabled: bool,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        config_role_sink::ConfigRoleGatewaySink::new(store)
            .map_err(|_| RuntimeError::ConfigRoleGateway)?,
    )))
}

fn config_default_voice_event_sink(
    options: Option<ConfigDefaultVoiceRuntimeOptions>,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    let Some(options) = options else {
        return Ok(None);
    };
    Ok(Some(Arc::new(
        config_default_voice_sink::ConfigDefaultVoiceGatewaySink::new(
            store,
            vozen_discord::ConfigDefaultVoiceSettings {
                available_models: options.available_models,
            },
        )
        .map_err(|_| RuntimeError::ConfigDefaultVoiceGateway)?,
    )))
}

fn config_channel_event_sink(
    enabled: bool,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        config_channel_sink::ConfigChannelGatewaySink::new(store)
            .map_err(|_| RuntimeError::ConfigChannelGateway)?,
    )))
}

fn config_queue_role_event_sink(
    enabled: bool,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        config_queue_role_sink::ConfigQueueRoleGatewaySink::new(store)
            .map_err(|_| RuntimeError::ConfigQueueRoleGateway)?,
    )))
}

fn config_greet_language_event_sink(
    enabled: bool,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        config_greet_language_sink::ConfigGreetLanguageGatewaySink::new(store)
            .map_err(|_| RuntimeError::ConfigGreetLanguageGateway)?,
    )))
}

fn config_blockword_event_sink(
    enabled: bool,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        config_blockword_sink::ConfigBlockwordGatewaySink::new(store)
            .map_err(|_| RuntimeError::ConfigBlockwordGateway)?,
    )))
}

fn config_show_event_sink(
    enabled: bool,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        config_show_sink::ConfigShowGatewaySink::new(store)
            .map_err(|_| RuntimeError::ConfigShowGateway)?,
    )))
}

fn config_reset_event_sink(
    enabled: bool,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        config_reset_sink::ConfigResetGatewaySink::new(store)
            .map_err(|_| RuntimeError::ConfigResetGateway)?,
    )))
}

fn uptime_event_sink(enabled: bool) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        uptime_sink::UptimeGatewaySink::new().map_err(|_| RuntimeError::UptimeGateway)?,
    )))
}

fn invite_event_sink(
    enabled: bool,
    client_id: Option<String>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        invite_sink::InviteGatewaySink::new(client_id).map_err(|_| RuntimeError::InviteGateway)?,
    )))
}

fn help_event_sink(
    enabled: bool,
    support_url: String,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        help_sink::HelpGatewaySink::new(support_url).map_err(|_| RuntimeError::HelpGateway)?,
    )))
}

fn vote_event_sink(
    enabled: bool,
    client_id: Option<String>,
    redemption_secret: Option<String>,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        vote_sink::VoteGatewaySink::new(client_id, redemption_secret, store)
            .map_err(|_| RuntimeError::VoteGateway)?,
    )))
}

fn top_speakers_event_sink(
    enabled: bool,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        top_speakers_sink::TopSpeakersGatewaySink::new(store)
            .map_err(|_| RuntimeError::TopSpeakersGateway)?,
    )))
}

fn privacy_event_sink(
    enabled: bool,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        privacy_sink::PrivacyGatewaySink::new(store).map_err(|_| RuntimeError::PrivacyGateway)?,
    )))
}

fn birthday_event_sink(
    enabled: bool,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        birthday_sink::BirthdayGatewaySink::new(store)
            .map_err(|_| RuntimeError::BirthdayGateway)?,
    )))
}

fn bot_stats_event_sink(
    enabled: bool,
    gateway_state: GatewayState,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        bot_stats_sink::BotStatsGatewaySink::new(gateway_state)
            .map_err(|_| RuntimeError::BotStatsGateway)?,
    )))
}

fn stats_event_sink(
    enabled: bool,
    gateway_state: GatewayState,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        stats_sink::StatsGatewaySink::new(gateway_state).map_err(|_| RuntimeError::StatsGateway)?,
    )))
}

fn server_stats_event_sink(
    enabled: bool,
    client_id: Option<String>,
    redemption_secret: Option<String>,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        server_stats_sink::ServerStatsGatewaySink::new(store, client_id, redemption_secret)
            .map_err(|_| RuntimeError::ServerStatsGateway)?,
    )))
}

fn game_list_event_sink(enabled: bool) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        game_list_sink::GameListGatewaySink::new().map_err(|_| RuntimeError::GameListGateway)?,
    )))
}

fn game_scores_event_sink(
    enabled: bool,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        game_score_sink::GameScoreGatewaySink::new(store)
            .map_err(|_| RuntimeError::GameScoresGateway)?,
    )))
}

fn premium_event_sink(
    enabled: bool,
    store: Arc<Mutex<SqliteStore>>,
    client_id: Option<String>,
    redemption_secret: Option<String>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    let guild_sku_id = nonempty_env("PREMIUM_GUILD_SKU_ID").and_then(|value| value.parse().ok());
    let user_sku_id = nonempty_env("PREMIUM_USER_SKU_ID").and_then(|value| value.parse().ok());
    Ok(Some(Arc::new(
        premium_sink::PremiumGatewaySink::new(
            store,
            nonempty_env("KOFI_URL").unwrap_or_else(|| "https://ko-fi.com/".to_owned()),
            client_id,
            redemption_secret,
            guild_sku_id,
            user_sku_id,
        )
        .map_err(|_| RuntimeError::PremiumGateway)?,
    )))
}

fn redeem_event_sink(
    enabled: bool,
    store: Arc<Mutex<SqliteStore>>,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if !enabled {
        return Ok(None);
    }
    Ok(Some(Arc::new(
        redeem_sink::RedeemGatewaySink::new(store).map_err(|_| RuntimeError::RedeemGateway)?,
    )))
}

fn automatic_translation_event_sink(
    options: Option<AutomaticTranslationRuntimeOptions>,
    store: Arc<Mutex<SqliteStore>>,
    gateway_state: GatewayState,
) -> Option<Arc<dyn GatewayEventSink>> {
    options.map(|options| {
        Arc::new(
            automatic_translation_sink::AutomaticTranslationGatewaySink::new(
                store,
                gateway_state,
                options.provider,
            ),
        ) as Arc<dyn GatewayEventSink>
    })
}

#[cfg(not(feature = "voice-driver"))]
fn core_voice_event_sink(
    options: Option<CoreVoiceRuntimeOptions>,
    _store: Arc<Mutex<SqliteStore>>,
    _gateway_state: GatewayState,
) -> Result<Option<Arc<dyn GatewayEventSink>>, RuntimeError> {
    if options.is_some() {
        return Err(RuntimeError::VoiceDriverRequired);
    }
    Ok(None)
}

fn discover_piper_models(models_dir: &std::path::Path) -> Result<Vec<String>, RuntimeError> {
    let entries = fs::read_dir(models_dir).map_err(|_| RuntimeError::ModelsUnavailable)?;
    let mut models = entries
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let path = entry.path();
            (path.is_file()
                && path
                    .extension()
                    .is_some_and(|extension| extension == "onnx"))
            .then(|| {
                path.file_stem()
                    .and_then(|name| name.to_str())
                    .map(ToOwned::to_owned)
            })
            .flatten()
        })
        // Node intentionally excludes this legacy Piper model from selection/detection.
        .filter(|model| model != "pt_PT-tugao-medium")
        .collect::<Vec<_>>();
    models.sort_unstable();
    models.dedup();
    if models.is_empty() {
        return Err(RuntimeError::ModelsUnavailable);
    }
    Ok(models)
}

fn topgg_metrics_from_environment() -> Result<Option<TopggMetricsRuntimeConfig>, RuntimeError> {
    let Some(token) = nonempty_env("TOPGG_TOKEN") else {
        return Ok(None);
    };
    let client_id = nonempty_env("CLIENT_ID").ok_or(RuntimeError::MissingClientId)?;
    Ok(Some(TopggMetricsRuntimeConfig { client_id, token }))
}

/// A configured secret is an explicit request to serve this sensitive endpoint. It is never
/// inferred from a port or from the generic premium flag; missing companion values fail startup
/// once the HTTP listener is enabled instead of silently resetting reward eligibility.
fn topgg_webhook_from_environment() -> Result<Option<TopggWebhookRuntimeConfig>, RuntimeError> {
    let Some(webhook_secret) = nonempty_env("TOPGG_WEBHOOK_SECRET") else {
        return Ok(None);
    };
    let client_id = nonempty_env("CLIENT_ID").ok_or(RuntimeError::MissingClientId)?;
    let redemption_secret =
        nonempty_env("VOTE_REDEMPTION_SECRET").ok_or(RuntimeError::MissingVoteRedemptionSecret)?;
    Ok(Some(TopggWebhookRuntimeConfig {
        client_id,
        webhook_secret,
        redemption_secret,
    }))
}

/// Mirrors Node's deliberately strict public-status opt-in: only `true` enables a public route.
fn public_status_from_environment() -> Option<PublicStatusConfig> {
    public_status_enabled(env::var("PUBLIC_STATUS_ENABLED").ok().as_deref()).then_some(
        PublicStatusConfig {
            incident: nonempty_env("PUBLIC_STATUS_INCIDENT"),
        },
    )
}

fn public_status_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

/// Mirrors Node's dangerous-feature flag: only the literal value `true` enables the browser
/// premium API. A typo or a blank value must never expose an authenticated endpoint.
fn premium_http_from_environment() -> Result<Option<PremiumHttpConfig>, RuntimeError> {
    let browser_api_enabled = premium_http_enabled(env::var("PREMIUM_API_ENABLED").ok().as_deref());
    let kofi_webhook_token = nonempty_env("KOFI_WEBHOOK_TOKEN");
    if !browser_api_enabled && kofi_webhook_token.is_none() {
        return Ok(None);
    }
    let client_id = if browser_api_enabled {
        Some(nonempty_env("CLIENT_ID").ok_or(RuntimeError::MissingClientId)?)
    } else {
        nonempty_env("CLIENT_ID")
    };
    let origin = nonempty_env("PREMIUM_API_ORIGIN").unwrap_or_else(|| "https://vozen.org".into());
    Ok(Some(PremiumHttpConfig {
        browser_api_enabled,
        client_id,
        origin,
        kofi_webhook_token,
        kofi_shop_map: nonempty_env("KOFI_SHOP_MAP"),
        claim_help_webhook_url: nonempty_env("CLAIM_HELP_WEBHOOK_URL")
            .or_else(|| nonempty_env("ERROR_WEBHOOK_URL")),
    }))
}

fn premium_http_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn nonempty_env(name: &str) -> Option<String> {
    env::var(name)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn http_listener_required(
    health_bind: Option<SocketAddr>,
    premium_http: bool,
    dashboard: bool,
    admin: bool,
    topgg_webhook: bool,
    public_status: bool,
) -> bool {
    health_bind.is_none() && (premium_http || dashboard || admin || topgg_webhook || public_status)
}

#[derive(Debug, Error)]
enum RuntimeError {
    #[error("invalid or incomplete Rust runtime mode: {0}")]
    RuntimeMode(#[from] runtime_mode::RuntimeModeError),
    #[error("DISCORD_TOKEN is required to start the Rust gateway")]
    MissingToken,
    #[error("HEALTH_PORT must be an integer from 1 to 65535")]
    InvalidHealthPort,
    #[error("HEALTH_PORT is required when a Rust HTTP/API surface is enabled")]
    HttpListenerRequired,
    #[error(
        "CLIENT_ID is required when PREMIUM_API_ENABLED=true or TOPGG_WEBHOOK_SECRET is configured"
    )]
    MissingClientId,
    #[error("Rust Discord command registration failed")]
    CommandRegistration,
    #[error("VOTE_REDEMPTION_SECRET is required when TOPGG_WEBHOOK_SECRET is configured")]
    MissingVoteRedemptionSecret,
    #[error("{0} must be a positive number (and an integer where required)")]
    InvalidCoreVoiceSetting(&'static str),
    #[error("RUST_CORE_VOICE_ENABLED=true requires a runtime built with --features voice-driver")]
    #[cfg_attr(feature = "voice-driver", allow(dead_code))]
    VoiceDriverRequired,
    #[error(
        "RUST_TRANSCRIBE_LIVE_ENABLED=true requires a runtime built with --features voice-driver"
    )]
    #[cfg_attr(feature = "voice-driver", allow(dead_code))]
    LiveTranscriptionVoiceDriverRequired,
    #[error("Rust voice features require TTS_ENGINE to be unset, piper, gtts, router, or neural")]
    RustVoiceRequiresPiperDefault,
    #[error("TTS_ENGINE=neural requires OPENAI_API_KEY")]
    NeuralApiKeyRequired,
    #[error("a Rust Piper feature requires at least one supported Piper .onnx model")]
    ModelsUnavailable,
    #[error("DEFAULT_VOICE must name a supported Piper model when a Rust Piper feature is enabled")]
    DefaultVoiceUnavailable,
    #[error("private TTS file gateway initialisation failed")]
    TtsFileGateway,
    #[error("private translation gateway initialisation failed")]
    TranslationGateway,
    #[error("message transcription gateway initialisation failed")]
    TranscriptionGateway,
    #[error("transcription control gateway initialisation failed")]
    TranscriptionControlGateway,
    #[error("owner command gateway initialisation failed")]
    OwnerCommandGateway,
    #[error("translation preference gateway initialisation failed")]
    TranslationPreferenceGateway,
    #[error("voice preference gateway initialisation failed")]
    VoicePreferenceGateway,
    #[error("pronunciation gateway initialisation failed")]
    PronunciationGateway,
    #[error("config language gateway initialisation failed")]
    ConfigLanguageGateway,
    #[error("config toggle gateway initialisation failed")]
    ConfigToggleGateway,
    #[error("config numeric gateway initialisation failed")]
    ConfigNumericGateway,
    #[error("config role gateway initialisation failed")]
    ConfigRoleGateway,
    #[error("config show gateway initialisation failed")]
    ConfigShowGateway,
    #[error("config reset gateway initialisation failed")]
    ConfigResetGateway,
    #[error("uptime gateway initialisation failed")]
    UptimeGateway,
    #[error("invite gateway initialisation failed")]
    InviteGateway,
    #[error("help gateway initialisation failed")]
    HelpGateway,
    #[error("welcome gateway initialisation failed")]
    WelcomeGateway,
    #[error("vote gateway initialisation failed")]
    VoteGateway,
    #[error("top-speakers gateway initialisation failed")]
    TopSpeakersGateway,
    #[error("birthday gateway initialisation failed")]
    BirthdayGateway,
    #[error("bot-stats gateway initialisation failed")]
    BotStatsGateway,
    #[error("server-stats gateway initialisation failed")]
    ServerStatsGateway,
    #[error("stats gateway initialisation failed")]
    StatsGateway,
    #[error("premium gateway initialisation failed")]
    PremiumGateway,
    #[error("redeem gateway initialisation failed")]
    RedeemGateway,
    #[error("privacy gateway initialisation failed")]
    PrivacyGateway,
    #[error("game-list gateway initialisation failed")]
    GameListGateway,
    #[error("game-scores gateway initialisation failed")]
    GameScoresGateway,
    #[error("config default voice gateway initialisation failed")]
    ConfigDefaultVoiceGateway,
    #[error("config channel gateway initialisation failed")]
    ConfigChannelGateway,
    #[error("config queue role gateway initialisation failed")]
    ConfigQueueRoleGateway,
    #[error("config greet language gateway initialisation failed")]
    ConfigGreetLanguageGateway,
    #[error("config blockword gateway initialisation failed")]
    ConfigBlockwordGateway,
    #[error("Discord OAuth client initialisation failed")]
    OAuthClient,
    #[error("RUST_DASHBOARD_ENABLED=true requires PREMIUM_API_ENABLED=true")]
    DashboardRequiresPremiumHttp,
    #[error("RUST_ADMIN_API_ENABLED=true requires PREMIUM_API_ENABLED=true")]
    AdminRequiresPremiumHttp,
    #[error("RUST_DASHBOARD_ENABLED/RUST_ADMIN_API_ENABLED require PREMIUM_API_ENABLED=true")]
    DashboardOrAdminRequiresPremiumApi,
    #[error("SQLite startup failed: {0}")]
    Store(#[from] vozen_store::StoreError),
    #[error("SQLite store lock was poisoned")]
    StoreLock,
    #[error("Discord gateway failed: {0}")]
    Discord(#[from] DiscordRuntimeError),
    #[error("HTTP route construction failed: {0}")]
    Router(#[from] vozen_api::RuntimeRouterError),
    #[error("health listener failed: {0}")]
    HealthListener(#[from] std::io::Error),
}

#[tokio::main]
async fn main() {
    let error_reporter = error_reporter::ErrorReporter::from_environment();
    if let Err(error) = run().await {
        // Runtime errors intentionally never contain the Discord token or an OAuth bearer token.
        eprintln!("vozen runtime startup failed: {error}");
        error_reporter.report(&error.to_string(), "runtime").await;
        std::process::exit(1);
    }
}

async fn run() -> Result<(), RuntimeError> {
    let config = RuntimeConfig::from_environment()?;
    // Opening the store verifies/migrates the exact Node SQLite schema before the Rust gateway
    // does any work. Keep the handle alive for the whole process; future adapters share it.
    let store = Arc::new(Mutex::new(SqliteStore::open(&config.database_path)?));
    store
        .lock()
        .map_err(|_| RuntimeError::StoreLock)?
        .verify_integrity()?;
    run_startup_data_hygiene(&config.database_path);
    let ffmpeg_path = nonempty_env("FFMPEG_PATH").unwrap_or_else(|| "ffmpeg".to_owned());
    match transcription_adapter::check_ffmpeg(std::path::Path::new(&ffmpeg_path)).await {
        transcription_adapter::FfmpegHealth::Available { version } => {
            eprintln!("[health] ffmpeg OK ({version})");
        }
        transcription_adapter::FfmpegHealth::Unavailable { reason } => {
            eprintln!("[health] ffmpeg unavailable ({reason}); voice playback may fail");
        }
    }
    if let Some(redemption_secret) = config.vote_redemption_secret.as_deref() {
        store
            .lock()
            .map_err(|_| RuntimeError::StoreLock)?
            .initialize_vote_redemption_ledger(redemption_secret)?;
    }
    register_rust_commands_if_enabled(&config).await?;
    // Retention is best effort: a one-off SQLite lock must not take down Discord, and the next
    // daily pass retries. The permanent HMAC marker is deliberately not touched by this job.
    spawn_vote_retention(store.clone());
    // Google HD counters are cost-control metadata, not personal message content. Keep the same
    // bounded monthly retention as the Node runtime without letting an old row block startup.
    spawn_gcloud_retention(store.clone());
    spawn_guild_retention(store.clone());
    // Ko-fi pending purchases are temporary attribution records. Keep the Node retention
    // boundary (90 days) so abandoned or already-claimed rows do not accumulate indefinitely.
    spawn_kofi_pending_retention(store.clone());
    // This handle is intentionally process-scoped. The dashboard/rejoin adapters receive a
    // clone later; they never infer bot presence from a stale database row.
    let gateway_state = GatewayState::default();
    loop_lag::spawn(gateway_state.metrics().as_ref().clone());
    if let Some(topgg_metrics) = config.topgg_metrics {
        spawn_topgg_metrics(topgg_metrics, gateway_state.clone());
    }
    // Only a runtime that owns Rust voice sessions may write the shared restart marker. A
    // shadow process must never authorize the still-live Node process to reconnect calls.
    let write_rejoin_marker_on_shutdown = config.core_voice.is_some();
    let mut event_sinks: Vec<Arc<dyn GatewayEventSink>> = Vec::new();
    let consent_registry = SttConsentRegistry::default();
    // This sink only records departure markers and clears them on guild_create; it does not
    // consume messages or interactions, so it is safe while Node remains authoritative.
    event_sinks.push(Arc::new(
        guild_lifecycle_sink::GuildLifecycleGatewaySink::new(store.clone()),
    ));
    if config.welcome {
        event_sinks.push(Arc::new(
            guild_welcome_sink::GuildWelcomeGatewaySink::new()
                .map_err(|_| RuntimeError::WelcomeGateway)?,
        ));
    }
    if let Some(sink) = owner_command_event_sink(config.owner_commands, store.clone())? {
        event_sinks.push(sink);
    }
    if let Some(sink) =
        core_voice_event_sink(config.core_voice, store.clone(), gateway_state.clone())?
    {
        event_sinks.push(sink);
    }
    if let Some(sink) = tts_file_event_sink(config.tts_file, store.clone())? {
        event_sinks.push(sink);
    }
    #[cfg(feature = "voice-driver")]
    if let Some(sink) = transcription_live_event_sink(
        config.transcription_live,
        config.transcription.clone(),
        store.clone(),
        gateway_state.clone(),
        consent_registry.clone(),
    )? {
        event_sinks.push(sink);
    }
    if let Some(sink) = transcription_event_sink(config.transcription, store.clone())? {
        event_sinks.push(sink);
    }
    if let Some(sink) = transcription_control_event_sink(
        config.transcription_control,
        store.clone(),
        consent_registry.clone(),
    )? {
        event_sinks.push(sink);
    }
    if let Some(sink) = translation_text_event_sink(config.translation_text, store.clone())? {
        event_sinks.push(sink);
    }
    if let Some(sink) =
        translation_preference_event_sink(config.translation_preferences, store.clone())?
    {
        event_sinks.push(sink);
    }
    if let Some(sink) = voice_preference_event_sink(config.voice_preferences, store.clone())? {
        event_sinks.push(sink);
    }
    if let Some(sink) = pronunciation_event_sink(config.pronunciation, store.clone())? {
        event_sinks.push(sink);
    }
    if let Some(sink) = config_language_event_sink(config.config_language, store.clone())? {
        event_sinks.push(sink);
    }
    if let Some(sink) = config_toggle_event_sink(config.config_toggles, store.clone())? {
        event_sinks.push(sink);
    }
    if let Some(sink) = config_numeric_event_sink(config.config_numeric, store.clone())? {
        event_sinks.push(sink);
    }
    if let Some(sink) = config_role_event_sink(config.config_role, store.clone())? {
        event_sinks.push(sink);
    }
    if let Some(sink) = config_default_voice_event_sink(config.config_default_voice, store.clone())?
    {
        event_sinks.push(sink);
    }
    if let Some(sink) = config_channel_event_sink(config.config_channel, store.clone())? {
        event_sinks.push(sink);
    }
    if let Some(sink) = config_queue_role_event_sink(config.config_queue_roles, store.clone())? {
        event_sinks.push(sink);
    }
    if let Some(sink) =
        config_greet_language_event_sink(config.config_greet_language, store.clone())?
    {
        event_sinks.push(sink);
    }
    if let Some(sink) = config_blockword_event_sink(config.config_blockword, store.clone())? {
        event_sinks.push(sink);
    }
    if let Some(sink) = config_show_event_sink(config.config_show, store.clone())? {
        event_sinks.push(sink);
    }
    if let Some(sink) = config_reset_event_sink(config.config_reset, store.clone())? {
        event_sinks.push(sink);
    }
    if let Some(sink) = uptime_event_sink(config.uptime)? {
        event_sinks.push(sink);
    }
    if let Some(sink) = invite_event_sink(config.invite, config.invite_client_id.clone())? {
        event_sinks.push(sink);
    }
    if let Some(sink) = help_event_sink(config.help, config.help_support_url.clone())? {
        event_sinks.push(sink);
    }
    if let Some(sink) = vote_event_sink(
        config.vote,
        config.vote_client_id.clone(),
        config.vote_redemption_secret.clone(),
        store.clone(),
    )? {
        event_sinks.push(sink);
    }
    if let Some(sink) = top_speakers_event_sink(config.top_speakers, store.clone())? {
        event_sinks.push(sink);
    }
    if let Some(sink) = birthday_event_sink(config.birthday, store.clone())? {
        event_sinks.push(sink);
    }
    if let Some(sink) = bot_stats_event_sink(config.bot_stats, gateway_state.clone())? {
        event_sinks.push(sink);
    }
    if let Some(sink) = server_stats_event_sink(
        config.server_stats,
        config.vote_client_id.clone(),
        config.vote_redemption_secret.clone(),
        store.clone(),
    )? {
        event_sinks.push(sink);
    }
    if let Some(sink) = stats_event_sink(config.stats, gateway_state.clone())? {
        event_sinks.push(sink);
    }
    if let Some(sink) = premium_event_sink(
        config.premium,
        store.clone(),
        config.vote_client_id.clone(),
        config.vote_redemption_secret.clone(),
    )? {
        event_sinks.push(sink);
    }
    if let Some(sink) = redeem_event_sink(config.redeem, store.clone())? {
        event_sinks.push(sink);
    }
    if let Some(sink) = privacy_event_sink(config.privacy, store.clone())? {
        event_sinks.push(sink);
    }
    if let Some(sink) = game_list_event_sink(config.game_list)? {
        event_sinks.push(sink);
    }
    if let Some(sink) = game_scores_event_sink(config.game_scores, store.clone())? {
        event_sinks.push(sink);
    }
    if let Some(sink) = automatic_translation_event_sink(
        config.automatic_translation,
        store.clone(),
        gateway_state.clone(),
    ) {
        event_sinks.push(sink);
    }
    let event_sink = match event_sinks.len() {
        0 => None,
        1 => event_sinks.into_iter().next(),
        _ => {
            Some(Arc::new(CompositeGatewayEventSink::new(event_sinks)) as Arc<dyn GatewayEventSink>)
        }
    };
    let gateway = run_discord_gateway_with_state_and_sink(
        DiscordRuntimeConfig::from_token(config.discord_token)?,
        gateway_state.clone(),
        event_sink,
    );

    let Some(health_bind) = config.health_bind else {
        if write_rejoin_marker_on_shutdown {
            tokio::select! {
                result = gateway => return result.map_err(RuntimeError::from),
                _ = wait_for_clean_shutdown_signal() => {
                    write_current_rejoin_marker(&gateway_state);
                    return Ok(());
                }
            }
        }
        return gateway.await.map_err(RuntimeError::from);
    };
    let app = build_http_router(
        config.premium_http,
        config.dashboard,
        config.admin,
        config.topgg_webhook,
        config.public_status,
        store,
        gateway_state.clone(),
    )?;
    let listener = tokio::net::TcpListener::bind(health_bind).await?;
    if write_rejoin_marker_on_shutdown {
        tokio::select! {
            result = gateway => result.map_err(RuntimeError::from),
            result = axum::serve(listener, app) => result.map_err(RuntimeError::from),
            _ = wait_for_clean_shutdown_signal() => {
                write_current_rejoin_marker(&gateway_state);
                Ok(())
            }
        }
    } else {
        tokio::select! {
            result = gateway => result.map_err(RuntimeError::from),
            result = axum::serve(listener, app) => result.map_err(RuntimeError::from),
        }
    }
}

/// Waits for an administrator-initiated process stop. SIGTERM covers systemd/VPS deployments;
/// Ctrl+C keeps the local Windows development workflow equivalent. A forced crash never reaches
/// this function and therefore cannot authorize a normal voice-session recovery.
async fn wait_for_clean_shutdown_signal() {
    #[cfg(unix)]
    {
        if let Ok(mut terminate) =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        {
            tokio::select! {
                _ = tokio::signal::ctrl_c() => {},
                _ = terminate.recv() => {},
            }
            return;
        }
    }
    let _ = tokio::signal::ctrl_c().await;
}

fn write_current_rejoin_marker(gateway_state: &GatewayState) {
    let directory = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let _ = write_planned_rejoin_marker(
        gateway_state
            .bot_voice_sessions()
            .into_iter()
            .map(|(guild_id, _)| guild_id),
        &directory,
    );
}

fn build_http_router(
    premium_http: Option<PremiumHttpConfig>,
    dashboard: Option<DashboardRuntimeOptions>,
    admin: Option<AdminRuntimeOptions>,
    topgg_webhook: Option<TopggWebhookRuntimeConfig>,
    public_status: Option<PublicStatusConfig>,
    store: Arc<Mutex<SqliteStore>>,
    gateway_state: GatewayState,
) -> Result<axum::Router, RuntimeError> {
    let runtime_metrics = gateway_state.metrics();
    let public_status = public_status.map(|config| {
        public_status_provider(store.clone(), gateway_state.clone(), config.incident)
    });
    let Some(config) = premium_http else {
        if dashboard.is_some() {
            return Err(RuntimeError::DashboardRequiresPremiumHttp);
        }
        if admin.is_some() {
            return Err(RuntimeError::AdminRequiresPremiumHttp);
        }
        return runtime_router(RuntimeRouterConfig {
            public_status,
            account: None,
            premium: None,
            dashboard: None,
            admin: None,
            kofi_webhook: None,
            topgg_webhook: topgg_webhook.map(|config| TopggWebhookConfig {
                webhook_secret: config.webhook_secret,
                redemption_secret: config.redemption_secret,
                expected_bot_id: config.client_id,
                store,
                metrics: Some(runtime_metrics.clone()),
                now: Arc::new(system_now_ms),
            }),
        })
        .map_err(RuntimeError::from);
    };

    if (dashboard.is_some() || admin.is_some()) && !config.browser_api_enabled {
        return Err(RuntimeError::DashboardOrAdminRequiresPremiumApi);
    }
    let verifier = config
        .client_id
        .clone()
        .map(|client_id| {
            DiscordOAuthVerifier::production(client_id)
                .map(Arc::new)
                .map_err(|_| RuntimeError::OAuthClient)
        })
        .transpose()?;
    let now = Arc::new(system_now_ms);
    let kofi_webhook =
        config
            .kofi_webhook_token
            .clone()
            .map(|verification_token| KofiWebhookConfig {
                verification_token,
                store: store.clone(),
                shop_map: parse_kofi_shop_map(config.kofi_shop_map.as_deref()),
                now: now.clone(),
                on_unmapped_shop: None,
            });
    let dashboard = dashboard
        .map(|dashboard| {
            let models = discover_piper_models(&dashboard.models_dir)?;
            let authorization_state = gateway_state.clone();
            let authorizer = DiscordDashboardAuthorizer::production(
                config
                    .client_id
                    .clone()
                    .ok_or(RuntimeError::MissingClientId)?,
                move |guild_id| authorization_state.bot_has_guild(guild_id),
            )
            .map_err(|_| RuntimeError::OAuthClient)?;
            Ok::<DashboardApiConfig, RuntimeError>(DashboardApiConfig {
                origin: config.origin.clone(),
                store: store.clone(),
                authorizer: Arc::new(authorizer),
                options: Arc::new(RuntimeDashboardOptionsProvider::new(
                    gateway_state.clone(),
                    models,
                )),
            })
        })
        .transpose()?;
    let admin = admin
        .map(|admin| {
            let verifier = verifier
                .clone()
                .ok_or(RuntimeError::DashboardOrAdminRequiresPremiumApi)?;
            let gateway_state = gateway_state.clone();
            let api = vozen_api::admin_api::AdminApi::new(AdminApiConfig {
                store: store.clone(),
                resolver: verifier,
                now: now.clone(),
                admin_session_secret: admin.session_secret,
                owner_id: admin.owner_id,
                admin_client_id: admin.client_id,
                session_ttl_seconds: None,
                log: Arc::new(|message| eprintln!("{message}")),
                resolve_guilds: Some(Arc::new(move || {
                    gateway_state
                        .guild_snapshots()
                        .into_iter()
                        .map(|guild| vozen_api::admin_api::AdminGuildBrief {
                            id: guild.id,
                            name: guild.name,
                            icon: guild.icon,
                            member_count: i64::try_from(guild.member_count).unwrap_or(i64::MAX),
                            joined_timestamp: Some(guild.joined_timestamp.saturating_mul(1_000)),
                        })
                        .collect()
                })),
                local_day: Arc::new(system_local_day),
            });
            Ok::<AdminRouterConfig, RuntimeError>(AdminRouterConfig {
                origin: admin.panel_origin,
                api: Arc::new(api),
                now: now.clone(),
            })
        })
        .transpose()?;
    let (account, premium) = if config.browser_api_enabled {
        let verifier = verifier.clone().ok_or(RuntimeError::MissingClientId)?;
        (
            Some(AccountApiConfig {
                origin: config.origin.clone(),
                store: store.clone(),
                identity_verifier: verifier.clone(),
                now: now.clone(),
                // Guild names are sourced only from the current gateway process; a missing cache
                // entry stays `null` rather than causing an outbound lookup or leaking old data.
                resolve_guild_name: Some(Arc::new({
                    let gateway_state = gateway_state.clone();
                    move |guild_id| gateway_state.guild_name(guild_id)
                })),
            }),
            Some(PremiumApiConfig {
                origin: config.origin.clone(),
                kofi_webhook_token: config.kofi_webhook_token.clone(),
                store: store.clone(),
                identity_verifier: verifier,
                now: now.clone(),
                claim_help_notifier: config
                    .claim_help_webhook_url
                    .clone()
                    .map(DiscordClaimHelpNotifier::new)
                    .map(|notifier| Arc::new(notifier) as Arc<dyn ClaimHelpNotifier>),
            }),
        )
    } else {
        (None, None)
    };
    runtime_router(RuntimeRouterConfig {
        public_status,
        account,
        premium,
        // Only `RUST_DASHBOARD_ENABLED=true` produces this route. Its authorizer rechecks
        // OAuth audience/scope, Manage Guild and current bot presence before the options
        // provider asks Discord for the bot's current authorised channels and roles.
        dashboard,
        admin,
        kofi_webhook,
        topgg_webhook: topgg_webhook.map(|config| TopggWebhookConfig {
            webhook_secret: config.webhook_secret,
            redemption_secret: config.redemption_secret,
            expected_bot_id: config.client_id,
            store: store.clone(),
            metrics: Some(runtime_metrics),
            now: Arc::new(system_now_ms),
        }),
    })
    .map_err(RuntimeError::from)
}

/// Produces the same coarse public status shape as Node. Any SQLite problem becomes an
/// unavailable database/providers component; provider names and errors never leave the process.
fn public_status_provider(
    store: Arc<Mutex<SqliteStore>>,
    gateway_state: GatewayState,
    incident: Option<String>,
) -> PublicStatusProvider {
    Arc::new(move || {
        let (database_ready, provider_states) = match store.lock() {
            Ok(store) => match store.list_provider_health() {
                Ok(rows) => (
                    true,
                    rows.into_iter()
                        .map(|row| match row.health {
                            StoreProviderHealth::Healthy => PublicProviderHealth::Healthy,
                            StoreProviderHealth::Degraded => PublicProviderHealth::Degraded,
                        })
                        .collect(),
                ),
                Err(_) => (false, Vec::new()),
            },
            Err(_) => (false, Vec::new()),
        };
        map_public_status(PublicStatusInput {
            bot_ready: gateway_state.is_ready(),
            database_ready,
            provider_states,
            incident_message: incident.clone(),
        })
    })
}

fn system_now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().try_into().unwrap_or(i64::MAX))
        .unwrap_or_default()
}

/// Reconciles files that cannot be cleaned up transactionally after a hard process stop. The
/// operation is deliberately best-effort and narrow: only Rust/Vozen-owned STT prefixes and the
/// exact legacy `voice-clones` directory beside the configured database are touched.
fn run_startup_data_hygiene(database_path: &std::path::Path) {
    let removed = transcription_adapter::sweep_orphan_stt_temps(&env::temp_dir(), system_now_ms());
    if removed > 0 {
        eprintln!("[retention] removed {removed} orphaned STT workspace(s)");
    }

    let Some(parent) = database_path.parent() else {
        return;
    };
    let legacy_voice_clones = parent.join("voice-clones");
    if !legacy_voice_clones.is_dir() {
        return;
    }
    if let Err(error) = fs::remove_dir_all(&legacy_voice_clones) {
        eprintln!("[retention] legacy voice-clones cleanup failed: {error}");
    } else {
        eprintln!("[retention] removed legacy voice-clones directory");
    }
}

fn system_local_day() -> String {
    time::OffsetDateTime::now_utc().date().to_string()
}

fn purge_vote_retention(
    store: &SqliteStore,
    now: i64,
) -> Result<(usize, usize), vozen_store::StoreError> {
    let rewards = store.purge_expired_vote_rewards(now)?;
    let events = store.purge_expired_topgg_events(now)?;
    Ok((rewards, events))
}

fn spawn_vote_retention(store: Arc<Mutex<SqliteStore>>) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(24 * 60 * 60));
        loop {
            interval.tick().await;
            if let Ok(store) = store.lock() {
                let _ = purge_vote_retention(&store, system_now_ms());
            }
        }
    });
}

const GCLOUD_RETENTION_MS: i64 = 92 * 86_400_000;

fn purge_gcloud_retention(store: &SqliteStore, now: i64) -> Result<usize, vozen_store::StoreError> {
    let cutoff = month_key_utc(now.saturating_sub(GCLOUD_RETENTION_MS));
    store.purge_old_gcloud_usage(&cutoff)
}

fn spawn_gcloud_retention(store: Arc<Mutex<SqliteStore>>) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(24 * 60 * 60));
        loop {
            interval.tick().await;
            if let Ok(store) = store.lock() {
                let _ = purge_gcloud_retention(&store, system_now_ms());
            }
        }
    });
}

fn spawn_guild_retention(store: Arc<Mutex<SqliteStore>>) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(24 * 60 * 60));
        loop {
            interval.tick().await;
            if let Ok(store) = store.lock() {
                let _ = store.purge_departed_guilds(system_now_ms(), DEPARTURE_GRACE_MS);
            }
        }
    });
}

const KOFI_PENDING_RETENTION_MS: i64 = 90 * 86_400_000;

fn purge_kofi_pending_retention(
    store: &SqliteStore,
    now: i64,
) -> Result<usize, vozen_store::StoreError> {
    store.purge_old_kofi_pending(now.saturating_sub(KOFI_PENDING_RETENTION_MS))
}

fn spawn_kofi_pending_retention(store: Arc<Mutex<SqliteStore>>) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(24 * 60 * 60));
        loop {
            interval.tick().await;
            if let Ok(store) = store.lock() {
                let _ = purge_kofi_pending_retention(&store, system_now_ms());
            }
        }
    });
}

fn spawn_topgg_metrics(config: TopggMetricsRuntimeConfig, gateway_state: GatewayState) {
    tokio::spawn(async move {
        let Ok(http) = ReqwestTopggMetricsHttp::new() else {
            // The listing is optional. A local client construction failure must never block the
            // Discord gateway or trigger a retry loop with partial configuration.
            return;
        };
        // Node starts Top.gg work from ClientReady. Do not publish a transient zero while the
        // gateway is still establishing its authoritative guild cache.
        while !gateway_state.is_ready() {
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
        if let Some(commands) = public_topgg_commands() {
            let _ = sync_topgg_commands(&http, &config.token, commands).await;
        }
        loop {
            let _ = post_topgg_stats(
                &http,
                &config.client_id,
                &config.token,
                gateway_state.guild_count(),
            )
            .await;
            tokio::time::sleep(TOPGG_POST_INTERVAL).await;
        }
    });
}

fn public_topgg_commands() -> Option<Vec<serde_json::Value>> {
    DiscordCommandCatalog::from_json(DISCORD_COMMAND_CONTRACT)
        .ok()?
        .public_registration_payload()
        .ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request};
    use tower::ServiceExt;

    #[test]
    fn runtime_errors_without_a_token() {
        assert!(matches!(
            DiscordRuntimeConfig::from_token(String::new()),
            Err(DiscordRuntimeError::MissingToken)
        ));
    }

    #[test]
    fn health_port_is_loopback_only_when_constructed() {
        let address = SocketAddr::from(([127, 0, 0, 1], 8080));
        assert!(address.ip().is_loopback());
        assert_eq!(address.port(), 8080);
    }

    #[test]
    fn opted_in_http_surfaces_require_a_listener() {
        assert!(http_listener_required(
            None, true, false, false, false, false
        ));
        assert!(http_listener_required(
            None, false, true, false, false, false
        ));
        assert!(http_listener_required(
            None, false, false, false, true, false
        ));
        assert!(!http_listener_required(
            Some(SocketAddr::from(([127, 0, 0, 1], 8080))),
            true,
            true,
            true,
            true,
            true,
        ));
        assert!(!http_listener_required(
            None, false, false, false, false, false
        ));
    }

    #[test]
    fn premium_http_flag_is_exactly_opt_in() {
        assert!(premium_http_enabled(Some("true")));
        assert!(premium_http_enabled(Some("TRUE")));
        assert!(!premium_http_enabled(Some("1")));
        assert!(!premium_http_enabled(Some("yes")));
        assert!(!premium_http_enabled(None));
    }

    #[test]
    fn public_status_flag_is_exactly_opt_in() {
        assert!(public_status_enabled(Some("true")));
        assert!(public_status_enabled(Some("TRUE")));
        assert!(!public_status_enabled(Some("1")));
        assert!(!public_status_enabled(Some("yes")));
        assert!(!public_status_enabled(None));
    }

    #[test]
    fn rust_voice_promotion_is_exactly_opt_in() {
        assert!(core_voice_enabled(Some("true")));
        assert!(core_voice_enabled(Some(" TRUE ")));
        assert!(!core_voice_enabled(Some("1")));
        assert!(!core_voice_enabled(Some("yes")));
        assert!(!core_voice_enabled(None));
    }

    #[test]
    fn private_file_promotion_is_exactly_opt_in_and_independent_of_calls() {
        assert!(tts_file_enabled(Some("true")));
        assert!(tts_file_enabled(Some(" TRUE ")));
        assert!(!tts_file_enabled(Some("1")));
        assert!(!tts_file_enabled(Some("yes")));
        assert!(!tts_file_enabled(None));
    }

    #[test]
    fn message_transcription_promotion_is_exactly_opt_in() {
        assert!(transcription_enabled(Some("true")));
        assert!(transcription_enabled(Some(" TRUE ")));
        assert!(!transcription_enabled(Some("1")));
        assert!(!transcription_enabled(Some("yes")));
        assert!(!transcription_enabled(None));
    }

    #[test]
    fn transcription_control_promotion_is_exactly_opt_in() {
        assert!(transcription_control_enabled(Some("true")));
        assert!(transcription_control_enabled(Some(" TRUE ")));
        assert!(!transcription_control_enabled(Some("1")));
        assert!(!transcription_control_enabled(Some("yes")));
        assert!(!transcription_control_enabled(None));
    }

    #[test]
    fn live_transcription_promotion_is_exactly_opt_in() {
        assert!(live_transcription_enabled(Some("true")));
        assert!(live_transcription_enabled(Some(" TRUE ")));
        assert!(!live_transcription_enabled(Some("1")));
        assert!(!live_transcription_enabled(Some("yes")));
        assert!(!live_transcription_enabled(None));
    }

    #[test]
    fn piper_only_canaries_remain_explicitly_piper_gated() {
        assert!(piper_runtime_default_compatible(None));
        assert!(piper_runtime_default_compatible(Some("  ")));
        assert!(piper_runtime_default_compatible(Some("PIPER")));
        assert!(!piper_runtime_default_compatible(Some("gtts")));
        assert!(!piper_runtime_default_compatible(Some("neural")));
        assert!(!piper_runtime_default_compatible(Some("router")));
        assert!(require_piper_runtime_default(Some("piper")).is_ok());
        assert!(matches!(
            require_piper_runtime_default(Some("gtts")),
            Err(RuntimeError::RustVoiceRequiresPiperDefault)
        ));
    }

    #[test]
    fn core_voice_can_select_each_supported_operator_default() {
        assert_eq!(
            core_voice_default_engine(Some("gtts")).expect("gtts default"),
            SynthesisEngine::Default
        );
        assert_eq!(
            core_voice_default_engine(Some("PIPER")).expect("piper default"),
            SynthesisEngine::Piper
        );
        assert_eq!(
            core_voice_default_engine(Some("router")).expect("router default"),
            SynthesisEngine::Default
        );
        assert_eq!(
            core_voice_default_engine(Some("NEURAL")).expect("neural default"),
            SynthesisEngine::Neural
        );
    }

    #[test]
    fn private_translation_promotion_is_exactly_opt_in_and_independent_of_calls() {
        assert!(translation_text_enabled(Some("true")));
        assert!(translation_text_enabled(Some(" TRUE ")));
        assert!(!translation_text_enabled(Some("1")));
        assert!(!translation_text_enabled(Some("yes")));
        assert!(!translation_text_enabled(None));
    }

    #[test]
    fn welcome_promotion_is_exactly_opt_in() {
        assert!(welcome_enabled(Some("true")));
        assert!(welcome_enabled(Some(" TRUE ")));
        assert!(!welcome_enabled(Some("1")));
        assert!(!welcome_enabled(Some("yes")));
        assert!(!welcome_enabled(None));
    }

    #[test]
    fn translation_admin_promotion_is_exactly_opt_in_and_separate_from_text() {
        assert!(translation_admin_enabled(Some("true")));
        assert!(translation_admin_enabled(Some(" TRUE ")));
        assert!(!translation_admin_enabled(Some("1")));
        assert!(!translation_admin_enabled(Some("yes")));
        assert!(!translation_admin_enabled(None));
    }

    #[test]
    fn translation_preference_promotion_is_exactly_opt_in_and_independent_of_text() {
        assert!(translation_preferences_enabled(Some("true")));
        assert!(translation_preferences_enabled(Some(" TRUE ")));
        assert!(!translation_preferences_enabled(Some("1")));
        assert!(!translation_preferences_enabled(Some("yes")));
        assert!(!translation_preferences_enabled(None));
    }

    #[test]
    fn voice_preference_promotion_is_exactly_opt_in_and_independent_of_voice_driver() {
        assert!(voice_preferences_enabled(Some("true")));
        assert!(voice_preferences_enabled(Some(" TRUE ")));
        assert!(!voice_preferences_enabled(Some("1")));
        assert!(!voice_preferences_enabled(Some("yes")));
        assert!(!voice_preferences_enabled(None));
    }

    #[test]
    fn pronunciation_promotion_is_exactly_opt_in() {
        assert!(pronunciation_enabled(Some("true")));
        assert!(pronunciation_enabled(Some(" TRUE ")));
        assert!(!pronunciation_enabled(Some("1")));
        assert!(!pronunciation_enabled(Some("yes")));
        assert!(!pronunciation_enabled(None));
    }

    #[test]
    fn config_language_promotion_is_exactly_opt_in() {
        assert!(config_language_enabled(Some("true")));
        assert!(config_language_enabled(Some(" TRUE ")));
        assert!(!config_language_enabled(Some("1")));
        assert!(!config_language_enabled(Some("yes")));
        assert!(!config_language_enabled(None));
    }

    #[test]
    fn config_toggle_promotion_is_exactly_opt_in() {
        assert!(config_toggles_enabled(Some("true")));
        assert!(config_toggles_enabled(Some(" TRUE ")));
        assert!(!config_toggles_enabled(Some("1")));
        assert!(!config_toggles_enabled(Some("yes")));
        assert!(!config_toggles_enabled(None));
    }

    #[test]
    fn numeric_and_role_config_promotions_are_exactly_opt_in() {
        for enabled in [
            config_numeric_enabled as fn(Option<&str>) -> bool,
            config_role_enabled as fn(Option<&str>) -> bool,
        ] {
            assert!(enabled(Some("true")));
            assert!(enabled(Some(" TRUE ")));
            assert!(!enabled(Some("1")));
            assert!(!enabled(Some("yes")));
            assert!(!enabled(None));
        }
    }

    #[test]
    fn default_voice_config_promotion_is_exactly_opt_in() {
        assert!(config_default_voice_enabled(Some("true")));
        assert!(config_default_voice_enabled(Some(" TRUE ")));
        assert!(!config_default_voice_enabled(Some("1")));
        assert!(!config_default_voice_enabled(Some("yes")));
        assert!(!config_default_voice_enabled(None));
    }

    #[test]
    fn config_channel_promotion_is_exactly_opt_in() {
        assert!(config_channel_enabled(Some("true")));
        assert!(config_channel_enabled(Some(" TRUE ")));
        assert!(!config_channel_enabled(Some("1")));
        assert!(!config_channel_enabled(Some("yes")));
        assert!(!config_channel_enabled(None));
    }

    #[test]
    fn config_queue_roles_promotion_is_exactly_opt_in() {
        assert!(config_queue_roles_enabled(Some("true")));
        assert!(config_queue_roles_enabled(Some(" TRUE ")));
        assert!(!config_queue_roles_enabled(Some("1")));
        assert!(!config_queue_roles_enabled(Some("yes")));
        assert!(!config_queue_roles_enabled(None));
    }

    #[test]
    fn config_greet_language_promotion_is_exactly_opt_in() {
        assert!(config_greet_language_enabled(Some("true")));
        assert!(config_greet_language_enabled(Some(" TRUE ")));
        assert!(!config_greet_language_enabled(Some("1")));
        assert!(!config_greet_language_enabled(Some("yes")));
        assert!(!config_greet_language_enabled(None));
    }

    #[test]
    fn config_blockword_promotion_is_exactly_opt_in() {
        assert!(config_blockword_enabled(Some("true")));
        assert!(config_blockword_enabled(Some(" TRUE ")));
        assert!(!config_blockword_enabled(Some("1")));
        assert!(!config_blockword_enabled(Some("yes")));
        assert!(!config_blockword_enabled(None));
    }

    #[test]
    fn config_show_promotion_is_exactly_opt_in() {
        assert!(config_show_enabled(Some("true")));
        assert!(config_show_enabled(Some(" TRUE ")));
        assert!(!config_show_enabled(Some("1")));
        assert!(!config_show_enabled(Some("yes")));
        assert!(!config_show_enabled(None));
    }

    #[test]
    fn config_reset_promotion_is_exactly_opt_in() {
        assert!(config_reset_enabled(Some("true")));
        assert!(config_reset_enabled(Some(" TRUE ")));
        assert!(!config_reset_enabled(Some("1")));
        assert!(!config_reset_enabled(Some("yes")));
        assert!(!config_reset_enabled(None));
    }

    #[test]
    fn uptime_promotion_is_exactly_opt_in() {
        assert!(uptime_enabled(Some("true")));
        assert!(uptime_enabled(Some(" TRUE ")));
        assert!(!uptime_enabled(Some("1")));
        assert!(!uptime_enabled(Some("yes")));
        assert!(!uptime_enabled(None));
    }

    #[test]
    fn invite_promotion_is_exactly_opt_in() {
        assert!(invite_enabled(Some("true")));
        assert!(invite_enabled(Some(" TRUE ")));
        assert!(!invite_enabled(Some("1")));
        assert!(!invite_enabled(Some("yes")));
        assert!(!invite_enabled(None));
    }

    #[test]
    fn help_promotion_is_exactly_opt_in() {
        assert!(help_enabled(Some("true")));
        assert!(help_enabled(Some(" TRUE ")));
        assert!(!help_enabled(Some("1")));
        assert!(!help_enabled(Some("yes")));
        assert!(!help_enabled(None));
    }

    #[test]
    fn vote_promotion_is_exactly_opt_in() {
        assert!(vote_enabled(Some("true")));
        assert!(vote_enabled(Some(" TRUE ")));
        assert!(!vote_enabled(Some("1")));
        assert!(!vote_enabled(Some("yes")));
        assert!(!vote_enabled(None));
    }

    #[test]
    fn top_speakers_promotion_is_exactly_opt_in() {
        assert!(top_speakers_enabled(Some("true")));
        assert!(top_speakers_enabled(Some(" TRUE ")));
        assert!(!top_speakers_enabled(Some("1")));
        assert!(!top_speakers_enabled(Some("yes")));
        assert!(!top_speakers_enabled(None));
    }

    #[test]
    fn privacy_promotion_is_exactly_opt_in() {
        assert!(privacy_enabled(Some("true")));
        assert!(privacy_enabled(Some(" TRUE ")));
        assert!(!privacy_enabled(Some("1")));
        assert!(!privacy_enabled(Some("yes")));
        assert!(!privacy_enabled(None));
    }

    #[test]
    fn birthday_promotion_is_exactly_opt_in() {
        assert!(birthday_enabled(Some("true")));
        assert!(birthday_enabled(Some(" TRUE ")));
        assert!(!birthday_enabled(Some("1")));
        assert!(!birthday_enabled(Some("yes")));
        assert!(!birthday_enabled(None));
    }

    #[test]
    fn bot_stats_promotion_is_exactly_opt_in() {
        assert!(bot_stats_enabled(Some("true")));
        assert!(bot_stats_enabled(Some(" TRUE ")));
        assert!(!bot_stats_enabled(Some("1")));
        assert!(!bot_stats_enabled(Some("yes")));
        assert!(!bot_stats_enabled(None));
    }

    #[test]
    fn server_stats_promotion_is_exactly_opt_in() {
        assert!(server_stats_enabled(Some("true")));
        assert!(server_stats_enabled(Some(" TRUE ")));
        assert!(!server_stats_enabled(Some("1")));
        assert!(!server_stats_enabled(Some("yes")));
        assert!(!server_stats_enabled(None));
    }

    #[test]
    fn stats_promotion_is_exactly_opt_in() {
        assert!(stats_enabled(Some("true")));
        assert!(stats_enabled(Some(" TRUE ")));
        assert!(!stats_enabled(Some("1")));
        assert!(!stats_enabled(Some("yes")));
        assert!(!stats_enabled(None));
    }

    #[test]
    fn game_list_promotion_is_exactly_opt_in() {
        assert!(game_list_enabled(Some("true")));
        assert!(game_list_enabled(Some(" TRUE ")));
        assert!(!game_list_enabled(Some("1")));
        assert!(!game_list_enabled(Some("yes")));
        assert!(!game_list_enabled(None));
    }

    #[test]
    fn game_scores_promotion_is_exactly_opt_in() {
        assert!(game_scores_enabled(Some("true")));
        assert!(game_scores_enabled(Some(" TRUE ")));
        assert!(!game_scores_enabled(Some("1")));
        assert!(!game_scores_enabled(Some("yes")));
        assert!(!game_scores_enabled(None));
    }

    #[test]
    fn public_command_bundle_is_exactly_opt_in() {
        assert!(public_commands_enabled(Some("true")));
        assert!(public_commands_enabled(Some(" TRUE ")));
        assert!(!public_commands_enabled(Some("1")));
        assert!(!public_commands_enabled(Some("yes")));
        assert!(!public_commands_enabled(None));
    }

    #[test]
    fn rust_command_registration_is_exactly_opt_in() {
        assert!(register_commands_enabled(Some("true")));
        assert!(register_commands_enabled(Some(" TRUE ")));
        assert!(!register_commands_enabled(Some("1")));
        assert!(!register_commands_enabled(Some("yes")));
        assert!(!register_commands_enabled(None));
    }

    #[test]
    fn owner_commands_are_exactly_opt_in() {
        assert!(owner_commands_enabled(Some("true")));
        assert!(owner_commands_enabled(Some(" TRUE ")));
        assert!(!owner_commands_enabled(Some("1")));
        assert!(!owner_commands_enabled(Some("yes")));
        assert!(!owner_commands_enabled(None));
    }

    #[test]
    fn automatic_translation_promotion_is_exactly_opt_in_and_independent_of_other_paths() {
        assert!(automatic_translation_enabled(Some("true")));
        assert!(automatic_translation_enabled(Some(" TRUE ")));
        assert!(!automatic_translation_enabled(Some("1")));
        assert!(!automatic_translation_enabled(Some("yes")));
        assert!(!automatic_translation_enabled(None));
    }

    #[test]
    fn rust_dashboard_promotion_is_exactly_opt_in() {
        assert!(dashboard_enabled(Some("true")));
        assert!(dashboard_enabled(Some(" TRUE ")));
        assert!(!dashboard_enabled(Some("1")));
        assert!(!dashboard_enabled(Some("yes")));
        assert!(!dashboard_enabled(None));
    }

    #[test]
    fn rust_admin_promotion_is_exactly_opt_in() {
        assert!(admin_enabled(Some("true")));
        assert!(admin_enabled(Some(" TRUE ")));
        assert!(!admin_enabled(Some("1")));
        assert!(!admin_enabled(Some("yes")));
        assert!(!admin_enabled(None));
    }

    #[test]
    fn admin_promotion_fails_closed_without_the_premium_http_listener() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let result = build_http_router(
            None,
            None,
            Some(AdminRuntimeOptions {
                panel_origin: "https://admin.example".into(),
                session_secret: Some("01234567890123456789012345678901".into()),
                owner_id: Some("123456789012345678".into()),
                client_id: Some("123456789012345678".into()),
            }),
            None,
            None,
            store,
            GatewayState::default(),
        );
        assert!(matches!(
            result,
            Err(RuntimeError::AdminRequiresPremiumHttp)
        ));
    }

    #[tokio::test]
    async fn kofi_webhook_can_run_without_the_browser_premium_api() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let app = build_http_router(
            Some(PremiumHttpConfig {
                browser_api_enabled: false,
                client_id: None,
                origin: "https://vozen.org".into(),
                kofi_webhook_token: Some("token".into()),
                kofi_shop_map: None,
                claim_help_webhook_url: None,
            }),
            None,
            None,
            None,
            None,
            store,
            GatewayState::default(),
        )
        .expect("kofi-only router");
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/")
                    .body(Body::from("{}"))
                    .unwrap(),
            )
            .await
            .expect("response");
        // The route is present even without the browser Premium API; an unsigned
        // webhook request is rejected by the Ko-fi verifier before payload parsing.
        assert_eq!(response.status(), axum::http::StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn rust_message_autoread_is_exactly_opt_in() {
        assert!(message_autoread_enabled(Some("true")));
        assert!(message_autoread_enabled(Some(" TRUE ")));
        assert!(!message_autoread_enabled(Some("1")));
        assert!(!message_autoread_enabled(Some("yes")));
        assert!(!message_autoread_enabled(None));
    }

    #[test]
    fn rust_speak_context_is_exactly_opt_in() {
        assert!(speak_context_enabled(Some("true")));
        assert!(speak_context_enabled(Some(" TRUE ")));
        assert!(!speak_context_enabled(Some("1")));
        assert!(!speak_context_enabled(Some("yes")));
        assert!(!speak_context_enabled(None));
    }

    #[test]
    fn rust_translate_context_is_exactly_opt_in() {
        assert!(translation_context_enabled(Some("true")));
        assert!(translation_context_enabled(Some(" TRUE ")));
        assert!(!translation_context_enabled(Some("1")));
        assert!(!translation_context_enabled(Some("yes")));
        assert!(!translation_context_enabled(None));
    }

    #[test]
    fn rust_queue_promotion_is_exactly_opt_in() {
        assert!(queue_enabled(Some("true")));
        assert!(queue_enabled(Some(" TRUE ")));
        assert!(!queue_enabled(Some("1")));
        assert!(!queue_enabled(Some("yes")));
        assert!(!queue_enabled(None));
    }

    #[tokio::test]
    async fn dashboard_options_fail_closed_without_a_ready_gateway_connection() {
        let provider = RuntimeDashboardOptionsProvider::new(
            GatewayState::default(),
            vec!["en_US-amy-medium".into()],
        );
        assert!(matches!(
            provider.options_for_guild("123456789012345678").await,
            Err(DashboardOptionsError::Unavailable)
        ));
    }

    #[test]
    fn rust_voice_numeric_configuration_rejects_dead_or_fractional_queue_limits() {
        assert_eq!(parse_positive_number(None, 20.0, true), Some(20.0));
        assert_eq!(parse_positive_number(Some("2.5"), 20.0, false), Some(2.5));
        assert_eq!(parse_positive_number(Some("2.5"), 20.0, true), None);
        assert_eq!(parse_positive_number(Some("0"), 20.0, true), None);
        assert_eq!(parse_positive_number(Some("wat"), 20.0, true), None);
        assert!(default_piper_concurrency() >= 1);
    }

    #[test]
    fn public_status_fails_closed_until_gateway_ready_and_never_leaks_provider_detail() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let state = GatewayState::default();
        let response = public_status_provider(store, state, Some("  planned\nwork  ".into()))();
        assert_eq!(response.status, vozen_api::PublicStatusState::Unavailable);
        assert_eq!(response.incident.as_deref(), Some("planned work"));
        assert_eq!(
            response.components.bot,
            vozen_api::PublicStatusState::Unavailable
        );
        assert_eq!(
            response.components.database,
            vozen_api::PublicStatusState::Operational
        );
    }

    #[test]
    fn retention_removes_only_expired_raw_vote_records_and_delivery_ids() {
        let store = SqliteStore::open_in_memory().expect("store");
        let secret = "0123456789abcdef0123456789abcdef";
        let user = "12345678901234567";
        store
            .claim_topgg_vote_reward(Some("delivery"), user, 1_000, secret)
            .expect("reward");
        let (rewards, events) = purge_vote_retention(
            &store,
            1_000 + vozen_store::VOTE_REWARD_MS + vozen_store::TOPGG_EVENT_RETENTION_MS + 1,
        )
        .expect("purge");
        assert_eq!((rewards, events), (1, 1));
        assert!(
            store
                .vote_reward_status(user, secret)
                .expect("status")
                .already_redeemed
        );
    }

    #[test]
    fn gcloud_retention_removes_only_months_older_than_the_node_ttl() {
        let store = SqliteStore::open_in_memory().expect("store");
        let now = 1_753_372_800_000_i64; // 2025-07-01T00:00:00Z
        store
            .add_gcloud_monthly_chars(
                vozen_store::GcloudUsageScope::Guild,
                "guild-old",
                "2025-03",
                10,
            )
            .expect("old usage");
        store
            .add_gcloud_monthly_chars(
                vozen_store::GcloudUsageScope::Guild,
                "guild-recent",
                "2025-05",
                20,
            )
            .expect("recent usage");

        let removed = purge_gcloud_retention(&store, now).expect("purge");
        assert_eq!(removed, 1);
        assert_eq!(
            store
                .gcloud_monthly_chars(vozen_store::GcloudUsageScope::Guild, "guild-old", "2025-03",)
                .expect("old lookup"),
            0
        );
        assert_eq!(
            store
                .gcloud_monthly_chars(
                    vozen_store::GcloudUsageScope::Guild,
                    "guild-recent",
                    "2025-05",
                )
                .expect("recent lookup"),
            20
        );
    }

    #[test]
    fn topgg_sync_uses_only_the_public_command_contract() {
        let commands = public_topgg_commands().expect("public commands");
        let names = commands
            .iter()
            .filter_map(|command| command.get("name").and_then(serde_json::Value::as_str))
            .collect::<Vec<_>>();
        assert!(names.contains(&"join"));
        assert!(!names.contains(&"vozen-grant"));
        assert!(!names.contains(&"dev"));
    }
}
