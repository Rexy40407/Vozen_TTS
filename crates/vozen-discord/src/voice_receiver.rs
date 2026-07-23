//! Consent-gated Songbird receive adapter for live transcription.
//!
//! The router is deliberately independent from Songbird's event loop. It owns only the
//! short-lived PCM buffers needed to segment one speaker at a time; a caller decides what to do
//! with the resulting utterance (for example, convert it to WAV and send it to Whisper). Audio
//! is never retained for a user who has not consented, and revoking consent drops any pending
//! buffer on the next received frame.

use std::{collections::BTreeMap, sync::Arc};

use crate::{Utterance, UtteranceCollector};

/// An utterance emitted by a consented speaker.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReceivedUtterance {
    pub user_id: u64,
    pub utterance: Utterance,
}

/// Small, deterministic receive state machine. It maps Songbird SSRCs to Discord users and
/// segments decoded 48 kHz stereo PCM into bounded turns.
pub struct VoiceReceiver {
    frame_samples: usize,
    consented: Arc<dyn Fn(u64) -> bool + Send + Sync>,
    ssrc_users: BTreeMap<u32, u64>,
    collectors: BTreeMap<u64, UtteranceCollector>,
}

impl VoiceReceiver {
    /// `frame_samples` is normally 1,920 (20 ms at 48 kHz stereo).
    pub fn new(frame_samples: usize, consented: Arc<dyn Fn(u64) -> bool + Send + Sync>) -> Self {
        Self {
            frame_samples: frame_samples.max(1),
            consented,
            ssrc_users: BTreeMap::new(),
            collectors: BTreeMap::new(),
        }
    }

    /// Associates an RTP SSRC with a Discord user. Discord may send this update more than once
    /// when a client changes speaking capabilities, so replacing the mapping is intentional.
    pub fn map_ssrc(&mut self, ssrc: u32, user_id: u64) {
        self.ssrc_users.insert(ssrc, user_id);
    }

    /// Handles one decoded frame. The frame is dropped immediately when the speaker is unknown
    /// or no longer consented.
    pub fn push_pcm(&mut self, ssrc: u32, pcm: Vec<i16>) -> Option<ReceivedUtterance> {
        let user_id = self.ssrc_users.get(&ssrc).copied()?;
        if !(self.consented)(user_id) {
            self.collectors.remove(&user_id);
            return None;
        }
        let collector = self.collectors.entry(user_id).or_default();
        collector
            .push(pcm)
            .map(|utterance| ReceivedUtterance { user_id, utterance })
    }

    /// Handles a missing/silent 20 ms tick so an utterance can close after the configured gap.
    pub fn push_silence(&mut self, ssrc: u32) -> Option<ReceivedUtterance> {
        self.push_pcm(ssrc, vec![0; self.frame_samples])
    }

    /// Flushes one speaker, for example when Songbird reports a disconnect or when a session is
    /// stopped. Pending short noise is discarded by `UtteranceCollector`.
    pub fn disconnect_user(&mut self, user_id: u64) -> Option<ReceivedUtterance> {
        self.ssrc_users.retain(|_, mapped| *mapped != user_id);
        self.collectors
            .remove(&user_id)
            .and_then(|mut collector| collector.flush())
            .map(|utterance| ReceivedUtterance { user_id, utterance })
    }

    /// Flushes all pending speakers and clears SSRC mappings. Used on an explicit stop or call
    /// teardown; it makes the no-audio-after-stop boundary deterministic.
    pub fn stop(&mut self) -> Vec<ReceivedUtterance> {
        let mut output = Vec::new();
        for (user_id, mut collector) in std::mem::take(&mut self.collectors) {
            if let Some(utterance) = collector.flush() {
                output.push(ReceivedUtterance { user_id, utterance });
            }
        }
        self.ssrc_users.clear();
        output
    }

    #[must_use]
    pub fn mapped_user(&self, ssrc: u32) -> Option<u64> {
        self.ssrc_users.get(&ssrc).copied()
    }

    #[must_use]
    pub fn pending_speakers(&self) -> usize {
        self.collectors.len()
    }
}

#[cfg(feature = "voice-driver")]
mod songbird_adapter {
    use std::sync::{Arc, Mutex};

    use async_trait::async_trait;
    use songbird::events::{CoreEvent, Event, EventContext, EventHandler};
    use tokio::sync::mpsc::UnboundedSender;

    use super::{ReceivedUtterance, VoiceReceiver};

    /// Event handler installed on a Songbird call when the live STT canary is enabled.
    #[derive(Clone)]
    pub struct SongbirdVoiceReceiver {
        state: Arc<Mutex<VoiceReceiver>>,
        output: UnboundedSender<ReceivedUtterance>,
        frame_samples: usize,
    }

    impl SongbirdVoiceReceiver {
        pub fn new(
            receiver: VoiceReceiver,
            output: UnboundedSender<ReceivedUtterance>,
            frame_samples: usize,
        ) -> Self {
            Self {
                state: Arc::new(Mutex::new(receiver)),
                output,
                frame_samples: frame_samples.max(1),
            }
        }

        /// Registers only the receive events needed by the router. The handler itself performs no
        /// network, filesystem, Whisper, or SQLite work on Songbird's audio thread.
        pub fn install_on_call(&self, call: &mut songbird::Call) {
            let handler = self.clone();
            call.add_global_event(Event::Core(CoreEvent::SpeakingStateUpdate), handler.clone());
            call.add_global_event(Event::Core(CoreEvent::VoiceTick), handler.clone());
            call.add_global_event(Event::Core(CoreEvent::ClientDisconnect), handler);
        }

        /// Flushes the router before removing the Songbird call.
        pub fn stop(&self) {
            let output = self
                .state
                .lock()
                .map(|mut state| state.stop())
                .unwrap_or_default();
            self.emit(output);
        }

        fn emit(&self, utterances: impl IntoIterator<Item = ReceivedUtterance>) {
            for utterance in utterances {
                // The receiver is best-effort at teardown. A closed consumer means the session
                // has already stopped, so retaining the audio would be both useless and unsafe.
                let _ = self.output.send(utterance);
            }
        }
    }

    #[async_trait]
    impl EventHandler for SongbirdVoiceReceiver {
        async fn act(&self, context: &EventContext<'_>) -> Option<Event> {
            let output = {
                let Ok(mut state) = self.state.lock() else {
                    return None;
                };
                match context {
                    EventContext::SpeakingStateUpdate(update) => update
                        .user_id
                        .map(|user| {
                            state.map_ssrc(update.ssrc, user.0);
                            Vec::new()
                        })
                        .unwrap_or_default(),
                    EventContext::VoiceTick(tick) => {
                        let mut output = Vec::new();
                        for (ssrc, data) in &tick.speaking {
                            let pcm = data
                                .decoded_voice
                                .clone()
                                .unwrap_or_else(|| vec![0; self.frame_samples]);
                            if let Some(utterance) = state.push_pcm(*ssrc, pcm) {
                                output.push(utterance);
                            }
                        }
                        for ssrc in &tick.silent {
                            if let Some(utterance) = state.push_silence(*ssrc) {
                                output.push(utterance);
                            }
                        }
                        output
                    }
                    EventContext::ClientDisconnect(disconnect) => state
                        .disconnect_user(disconnect.user_id.0)
                        .into_iter()
                        .collect(),
                    _ => Vec::new(),
                }
            };
            self.emit(output);
            None
        }
    }

    pub use SongbirdVoiceReceiver as PublicSongbirdVoiceReceiver;
}

#[cfg(feature = "voice-driver")]
pub use songbird_adapter::PublicSongbirdVoiceReceiver as SongbirdVoiceReceiver;

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, Ordering};

    fn frame(value: i16) -> Vec<i16> {
        vec![value; 1_920]
    }

    #[test]
    fn unknown_and_non_consented_audio_is_never_buffered() {
        let consent = Arc::new(AtomicBool::new(false));
        let gate = {
            let consent = consent.clone();
            Arc::new(move |user_id| user_id == 7 && consent.load(Ordering::Relaxed))
        };
        let mut receiver = VoiceReceiver::new(1_920, gate);
        assert!(receiver.push_pcm(10, frame(600)).is_none());
        receiver.map_ssrc(10, 7);
        assert!(receiver.push_pcm(10, frame(600)).is_none());
        assert_eq!(receiver.pending_speakers(), 0);
        consent.store(true, Ordering::Relaxed);
        assert!(receiver.push_pcm(10, frame(600)).is_none());
        assert_eq!(receiver.pending_speakers(), 1);
    }

    #[test]
    fn consent_revoke_drops_pending_audio_and_ssrc_survives_reconsent() {
        let consent = Arc::new(AtomicBool::new(true));
        let gate = {
            let consent = consent.clone();
            Arc::new(move |_| consent.load(Ordering::Relaxed))
        };
        let mut receiver = VoiceReceiver::new(1_920, gate);
        receiver.map_ssrc(4, 99);
        for _ in 0..15 {
            receiver.push_pcm(4, frame(700));
        }
        assert_eq!(receiver.pending_speakers(), 1);
        consent.store(false, Ordering::Relaxed);
        assert!(receiver.push_pcm(4, frame(700)).is_none());
        assert_eq!(receiver.pending_speakers(), 0);
        consent.store(true, Ordering::Relaxed);
        assert!(receiver.push_pcm(4, frame(700)).is_none());
        assert_eq!(receiver.pending_speakers(), 1);
    }

    #[test]
    fn disconnect_flushes_only_a_complete_turn() {
        let mut receiver = VoiceReceiver::new(1_920, Arc::new(|_| true));
        receiver.map_ssrc(2, 42);
        for _ in 0..15 {
            assert!(receiver.push_pcm(2, frame(500)).is_none());
        }
        let output = receiver.disconnect_user(42).expect("flushes complete turn");
        assert_eq!(output.user_id, 42);
        assert_eq!(output.utterance.voiced_ms, 300);
        assert_eq!(receiver.mapped_user(2), None);
    }
}
