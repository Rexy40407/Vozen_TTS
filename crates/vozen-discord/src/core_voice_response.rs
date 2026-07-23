//! Semantic, locale-free outcomes for promoted voice interactions.
//!
//! The core service never chooses public wording. A later i18n adapter maps these stable values
//! to the existing Discord locale catalog, preventing an early Rust rollout from silently
//! downgrading command responses to English.

use crate::{
    CoreJokeOutcome, CorePlaybackControlOutcome, CorePreviewOutcome, CoreTtsOutcome,
    CoreVoiceOutcome, JoinVoiceOutcome, LeaveVoiceOutcome,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CoreVoiceResponse {
    JoinNeedsVoiceChannel,
    Joined,
    JoinedAutoread,
    JoinPermissionDenied,
    VoiceUnavailable,
    JoinFailed,
    Left,
    LeaveFailed,
    LaughNotInVoice,
    LaughRateLimited,
    LaughBusy,
    LaughQueued,
    LaughFailed,
    JokeNotInVoice,
    JokeUnknownLanguage,
    JokeRateLimited,
    JokeBusy,
    JokePlaying,
    JokeFailed,
    MicroFunEightBall,
    MicroFunFortune,
    MicroFunFact,
    MicroFunWouldYouRather,
    SkipNotInVoice,
    SkipNothingPlaying,
    Skipped,
    ShutUpNotInVoice,
    ShutUpNothingPlaying,
    Silenced,
    NotInSameVoice,
    Blocked,
    NothingToRead,
    RateLimited,
    Busy,
    SynthesisFailed,
    PlaybackFailed,
    Queued,
    PreviewNotInPlayer,
    PreviewNotInSameVoice,
    PreviewRateLimited,
    PreviewBusy,
    PreviewUnknownModel,
    PreviewQueued,
    PreviewSynthesisFailed,
    PreviewPlaybackFailed,
    StoreUnavailable,
    NotPromoted,
}

impl CoreVoiceResponse {
    /// Existing Node i18n key when a public response is appropriate. The eventual Discord
    /// adapter supplies required placeholders such as `{channel}`; failures deliberately use the
    /// established generic error rather than a new, untranslated string.
    #[must_use]
    pub const fn catalog_key(self) -> Option<&'static str> {
        Some(match self {
            Self::JoinNeedsVoiceChannel => "join.needVoiceChannel",
            Self::Joined => "join.joined",
            Self::JoinedAutoread => "join.joinedAutoread",
            Self::JoinPermissionDenied => "join.missingPerms",
            Self::VoiceUnavailable
            | Self::JoinFailed
            | Self::LeaveFailed
            | Self::LaughFailed
            | Self::JokeFailed
            | Self::SynthesisFailed
            | Self::PlaybackFailed
            | Self::StoreUnavailable => "error.generic",
            Self::Left => "leave.left",
            Self::SkipNotInVoice => "skip.notInVoice",
            Self::SkipNothingPlaying => "skip.nothing",
            Self::Skipped => "skip.skipped",
            Self::ShutUpNotInVoice => "shutup.notInVoice",
            Self::ShutUpNothingPlaying => "shutup.nothing",
            Self::Silenced => "shutup.done",
            Self::NotInSameVoice => "tts.notInVoice",
            Self::Blocked => "tts.blocked",
            Self::NothingToRead => "tts.nothingAfterClean",
            Self::RateLimited => "tts.tooFast",
            Self::Busy => "tts.busy",
            Self::LaughNotInVoice => "tts.notInVoice",
            Self::LaughRateLimited => "tts.tooFast",
            Self::LaughBusy => "tts.busy",
            Self::LaughQueued => "laugh.playing",
            Self::JokeNotInVoice => "tts.notInVoice",
            Self::JokeUnknownLanguage => "joke.unknownLang",
            Self::JokeRateLimited => "tts.tooFast",
            Self::JokeBusy => "tts.busy",
            Self::JokePlaying => "joke.playing",
            Self::MicroFunEightBall => "fun.eightball",
            Self::MicroFunFortune => "fun.fortune",
            Self::MicroFunFact => "fun.fact",
            Self::MicroFunWouldYouRather => "fun.wyr",
            Self::Queued => "tts.queued",
            Self::PreviewNotInPlayer => "voice.notInVoice",
            Self::PreviewNotInSameVoice => "tts.notInVoice",
            Self::PreviewRateLimited => "tts.tooFast",
            Self::PreviewBusy => "tts.busy",
            Self::PreviewUnknownModel => "voice.unknownModel",
            Self::PreviewQueued => "voice.previewPlaying",
            Self::PreviewSynthesisFailed | Self::PreviewPlaybackFailed => "error.generic",
            Self::NotPromoted => return None,
        })
    }
}

#[must_use]
pub fn core_voice_response(outcome: CoreVoiceOutcome) -> CoreVoiceResponse {
    match outcome {
        CoreVoiceOutcome::Joined(JoinVoiceOutcome::NoUserVoiceChannel) => {
            CoreVoiceResponse::JoinNeedsVoiceChannel
        }
        CoreVoiceOutcome::Joined(JoinVoiceOutcome::Joined) => CoreVoiceResponse::Joined,
        CoreVoiceOutcome::Joined(JoinVoiceOutcome::PermissionDenied) => {
            CoreVoiceResponse::JoinPermissionDenied
        }
        CoreVoiceOutcome::Joined(JoinVoiceOutcome::Unavailable) => {
            CoreVoiceResponse::VoiceUnavailable
        }
        CoreVoiceOutcome::Joined(JoinVoiceOutcome::Failed) => CoreVoiceResponse::JoinFailed,
        CoreVoiceOutcome::Joined(JoinVoiceOutcome::StoreUnavailable) => {
            CoreVoiceResponse::StoreUnavailable
        }
        CoreVoiceOutcome::Left(LeaveVoiceOutcome::Left) => CoreVoiceResponse::Left,
        CoreVoiceOutcome::Left(LeaveVoiceOutcome::TransportFailed) => {
            CoreVoiceResponse::LeaveFailed
        }
        CoreVoiceOutcome::Left(LeaveVoiceOutcome::StoreUnavailable) => {
            CoreVoiceResponse::StoreUnavailable
        }
        CoreVoiceOutcome::Laugh(CorePreviewOutcome::NotInPlayer)
        | CoreVoiceOutcome::Laugh(CorePreviewOutcome::NotInSameVoice) => {
            CoreVoiceResponse::LaughNotInVoice
        }
        CoreVoiceOutcome::Laugh(CorePreviewOutcome::RateLimited) => {
            CoreVoiceResponse::LaughRateLimited
        }
        CoreVoiceOutcome::Laugh(CorePreviewOutcome::Busy) => CoreVoiceResponse::LaughBusy,
        CoreVoiceOutcome::Laugh(CorePreviewOutcome::Queued) => CoreVoiceResponse::LaughQueued,
        CoreVoiceOutcome::Laugh(
            CorePreviewOutcome::UnknownModel
            | CorePreviewOutcome::SynthesisFailed
            | CorePreviewOutcome::PlaybackFailed,
        ) => CoreVoiceResponse::LaughFailed,
        CoreVoiceOutcome::Laugh(CorePreviewOutcome::StoreUnavailable) => {
            CoreVoiceResponse::StoreUnavailable
        }
        CoreVoiceOutcome::Joke(result) => match result.outcome {
            CoreJokeOutcome::NotInPlayer | CoreJokeOutcome::NotInSameVoice => {
                CoreVoiceResponse::JokeNotInVoice
            }
            CoreJokeOutcome::UnknownLanguage => CoreVoiceResponse::JokeUnknownLanguage,
            CoreJokeOutcome::RateLimited => CoreVoiceResponse::JokeRateLimited,
            CoreJokeOutcome::Busy => CoreVoiceResponse::JokeBusy,
            CoreJokeOutcome::Queued => CoreVoiceResponse::JokePlaying,
            CoreJokeOutcome::SynthesisFailed | CoreJokeOutcome::PlaybackFailed => {
                CoreVoiceResponse::JokeFailed
            }
            CoreJokeOutcome::StoreUnavailable => CoreVoiceResponse::StoreUnavailable,
        },
        CoreVoiceOutcome::MicroFun(result) => match result.kind {
            crate::MicroFunKind::EightBall => CoreVoiceResponse::MicroFunEightBall,
            crate::MicroFunKind::Fortune => CoreVoiceResponse::MicroFunFortune,
            crate::MicroFunKind::Fact => CoreVoiceResponse::MicroFunFact,
            crate::MicroFunKind::WouldYouRather => CoreVoiceResponse::MicroFunWouldYouRather,
        },
        CoreVoiceOutcome::Skipped(CorePlaybackControlOutcome::NotInVoice) => {
            CoreVoiceResponse::SkipNotInVoice
        }
        CoreVoiceOutcome::Silenced(CorePlaybackControlOutcome::NotInVoice) => {
            CoreVoiceResponse::ShutUpNotInVoice
        }
        CoreVoiceOutcome::Skipped(CorePlaybackControlOutcome::NothingPlaying) => {
            CoreVoiceResponse::SkipNothingPlaying
        }
        CoreVoiceOutcome::Silenced(CorePlaybackControlOutcome::NothingPlaying) => {
            CoreVoiceResponse::ShutUpNothingPlaying
        }
        CoreVoiceOutcome::Skipped(CorePlaybackControlOutcome::Completed) => {
            CoreVoiceResponse::Skipped
        }
        CoreVoiceOutcome::Silenced(CorePlaybackControlOutcome::Completed) => {
            CoreVoiceResponse::Silenced
        }
        CoreVoiceOutcome::Skipped(CorePlaybackControlOutcome::PlaybackFailed)
        | CoreVoiceOutcome::Silenced(CorePlaybackControlOutcome::PlaybackFailed) => {
            CoreVoiceResponse::PlaybackFailed
        }
        CoreVoiceOutcome::Tts(CoreTtsOutcome::NotInSameVoice) => CoreVoiceResponse::NotInSameVoice,
        CoreVoiceOutcome::Tts(CoreTtsOutcome::Blocked)
        | CoreVoiceOutcome::Tts(CoreTtsOutcome::FullyBlocked) => CoreVoiceResponse::Blocked,
        CoreVoiceOutcome::Tts(CoreTtsOutcome::Empty) => CoreVoiceResponse::NothingToRead,
        CoreVoiceOutcome::Tts(CoreTtsOutcome::RateLimited) => CoreVoiceResponse::RateLimited,
        CoreVoiceOutcome::Tts(CoreTtsOutcome::Queued) => CoreVoiceResponse::Queued,
        CoreVoiceOutcome::Tts(CoreTtsOutcome::Busy) => CoreVoiceResponse::Busy,
        CoreVoiceOutcome::Tts(CoreTtsOutcome::SynthesisFailed) => {
            CoreVoiceResponse::SynthesisFailed
        }
        CoreVoiceOutcome::Tts(CoreTtsOutcome::PlaybackFailed) => CoreVoiceResponse::PlaybackFailed,
        CoreVoiceOutcome::Tts(CoreTtsOutcome::StoreUnavailable) => {
            CoreVoiceResponse::StoreUnavailable
        }
        CoreVoiceOutcome::Preview(CorePreviewOutcome::NotInPlayer) => {
            CoreVoiceResponse::PreviewNotInPlayer
        }
        CoreVoiceOutcome::Preview(CorePreviewOutcome::NotInSameVoice) => {
            CoreVoiceResponse::PreviewNotInSameVoice
        }
        CoreVoiceOutcome::Preview(CorePreviewOutcome::RateLimited) => {
            CoreVoiceResponse::PreviewRateLimited
        }
        CoreVoiceOutcome::Preview(CorePreviewOutcome::Busy) => CoreVoiceResponse::PreviewBusy,
        CoreVoiceOutcome::Preview(CorePreviewOutcome::UnknownModel) => {
            CoreVoiceResponse::PreviewUnknownModel
        }
        CoreVoiceOutcome::Preview(CorePreviewOutcome::Queued) => CoreVoiceResponse::PreviewQueued,
        CoreVoiceOutcome::Preview(CorePreviewOutcome::SynthesisFailed) => {
            CoreVoiceResponse::PreviewSynthesisFailed
        }
        CoreVoiceOutcome::Preview(CorePreviewOutcome::PlaybackFailed) => {
            CoreVoiceResponse::PreviewPlaybackFailed
        }
        CoreVoiceOutcome::Preview(CorePreviewOutcome::StoreUnavailable) => {
            CoreVoiceResponse::StoreUnavailable
        }
        CoreVoiceOutcome::NotPromoted => CoreVoiceResponse::NotPromoted,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn response_mapping_never_needs_to_choose_a_human_language() {
        assert_eq!(
            core_voice_response(CoreVoiceOutcome::Tts(CoreTtsOutcome::NotInSameVoice)),
            CoreVoiceResponse::NotInSameVoice
        );
        assert_eq!(
            core_voice_response(CoreVoiceOutcome::Joined(JoinVoiceOutcome::PermissionDenied)),
            CoreVoiceResponse::JoinPermissionDenied
        );
        assert_eq!(
            core_voice_response(CoreVoiceOutcome::Silenced(
                CorePlaybackControlOutcome::NothingPlaying
            )),
            CoreVoiceResponse::ShutUpNothingPlaying
        );
        assert_eq!(
            core_voice_response(CoreVoiceOutcome::Preview(CorePreviewOutcome::Queued)),
            CoreVoiceResponse::PreviewQueued
        );
        assert_eq!(
            core_voice_response(CoreVoiceOutcome::Laugh(CorePreviewOutcome::Queued)),
            CoreVoiceResponse::LaughQueued
        );
        assert_eq!(
            core_voice_response(CoreVoiceOutcome::Joke(crate::CoreJokeResult {
                outcome: CoreJokeOutcome::Queued,
                joke: Some("joke".into()),
            })),
            CoreVoiceResponse::JokePlaying
        );
        assert_eq!(
            core_voice_response(CoreVoiceOutcome::MicroFun(crate::CoreMicroFunResult {
                kind: crate::MicroFunKind::Fact,
                question: None,
                text: "Octopuses have three hearts.".into(),
                queued: false,
            })),
            CoreVoiceResponse::MicroFunFact
        );
        assert_eq!(
            CoreVoiceResponse::MicroFunFact.catalog_key(),
            Some("fun.fact")
        );
    }

    #[test]
    fn similar_controls_keep_their_own_existing_translation_keys() {
        assert_eq!(
            CoreVoiceResponse::SkipNotInVoice.catalog_key(),
            Some("skip.notInVoice")
        );
        assert_eq!(
            CoreVoiceResponse::ShutUpNotInVoice.catalog_key(),
            Some("shutup.notInVoice")
        );
        assert_eq!(CoreVoiceResponse::NotPromoted.catalog_key(), None);
    }
}
