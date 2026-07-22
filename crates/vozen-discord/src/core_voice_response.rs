//! Semantic, locale-free outcomes for promoted voice interactions.
//!
//! The core service never chooses public wording. A later i18n adapter maps these stable values
//! to the existing Discord locale catalog, preventing an early Rust rollout from silently
//! downgrading command responses to English.

use crate::{
    CorePlaybackControlOutcome, CoreTtsOutcome, CoreVoiceOutcome, JoinVoiceOutcome,
    LeaveVoiceOutcome,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CoreVoiceResponse {
    JoinNeedsVoiceChannel,
    Joined,
    JoinPermissionDenied,
    VoiceUnavailable,
    JoinFailed,
    Left,
    LeaveFailed,
    NotInVoice,
    NothingPlaying,
    Skipped,
    Silenced,
    NotInSameVoice,
    Blocked,
    NothingToRead,
    RateLimited,
    Busy,
    SynthesisFailed,
    PlaybackFailed,
    Queued,
    StoreUnavailable,
    NotPromoted,
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
        CoreVoiceOutcome::Skipped(CorePlaybackControlOutcome::NotInVoice)
        | CoreVoiceOutcome::Silenced(CorePlaybackControlOutcome::NotInVoice) => {
            CoreVoiceResponse::NotInVoice
        }
        CoreVoiceOutcome::Skipped(CorePlaybackControlOutcome::NothingPlaying)
        | CoreVoiceOutcome::Silenced(CorePlaybackControlOutcome::NothingPlaying) => {
            CoreVoiceResponse::NothingPlaying
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
            CoreVoiceResponse::NothingPlaying
        );
    }
}
