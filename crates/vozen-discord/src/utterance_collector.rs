//! Pure PCM utterance segmentation for live STT.
//!
//! The collector mirrors the Node `UtteranceCollector`: pre-speech silence is ignored, 800 ms of
//! silence closes a turn, short noise below 300 ms of voiced audio is discarded, and a 20 s cap
//! prevents an uninterrupted speaker from growing an unbounded buffer.

const SAMPLES_PER_MS: f64 = 96.0; // 48 kHz, stereo, 16-bit PCM represented as i16 samples.

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Utterance {
    pub pcm: Vec<i16>,
    pub duration_ms: u64,
    pub voiced_ms: u64,
}

#[derive(Debug, Clone)]
pub struct UtteranceCollector {
    rms_threshold: f64,
    silence_gap_ms: f64,
    min_utterance_ms: f64,
    max_utterance_ms: f64,
    chunks: Vec<Vec<i16>>,
    total_ms: f64,
    voiced_ms: f64,
    silence_run_ms: f64,
    in_utterance: bool,
}

impl Default for UtteranceCollector {
    fn default() -> Self {
        Self::new()
    }
}

impl UtteranceCollector {
    #[must_use]
    pub fn new() -> Self {
        Self {
            rms_threshold: 350.0,
            silence_gap_ms: 800.0,
            min_utterance_ms: 300.0,
            max_utterance_ms: 20_000.0,
            chunks: Vec::new(),
            total_ms: 0.0,
            voiced_ms: 0.0,
            silence_run_ms: 0.0,
            in_utterance: false,
        }
    }

    /// Feeds one decoded 48 kHz stereo PCM frame.
    pub fn push(&mut self, frame: Vec<i16>) -> Option<Utterance> {
        let frame_ms = frame.len() as f64 / SAMPLES_PER_MS;
        let voiced = rms(&frame) >= self.rms_threshold;
        if voiced {
            self.in_utterance = true;
            self.chunks.push(frame);
            self.total_ms += frame_ms;
            self.voiced_ms += frame_ms;
            self.silence_run_ms = 0.0;
            return (self.total_ms >= self.max_utterance_ms).then(|| self.close());
        }
        if !self.in_utterance {
            return None;
        }
        self.chunks.push(frame);
        self.total_ms += frame_ms;
        self.silence_run_ms += frame_ms;
        if self.silence_run_ms < self.silence_gap_ms {
            return None;
        }
        if self.voiced_ms >= self.min_utterance_ms {
            Some(self.close())
        } else {
            self.reset();
            None
        }
    }

    /// Closes a pending turn during stop/disconnect. Short noise is discarded.
    pub fn flush(&mut self) -> Option<Utterance> {
        if self.in_utterance && self.voiced_ms >= self.min_utterance_ms {
            Some(self.close())
        } else {
            self.reset();
            None
        }
    }

    fn close(&mut self) -> Utterance {
        let mut pcm = Vec::with_capacity(self.chunks.iter().map(Vec::len).sum());
        for chunk in &self.chunks {
            pcm.extend_from_slice(chunk);
        }
        let utterance = Utterance {
            pcm,
            duration_ms: self.total_ms.round() as u64,
            voiced_ms: self.voiced_ms.round() as u64,
        };
        self.reset();
        utterance
    }

    fn reset(&mut self) {
        self.chunks.clear();
        self.total_ms = 0.0;
        self.voiced_ms = 0.0;
        self.silence_run_ms = 0.0;
        self.in_utterance = false;
    }
}

fn rms(frame: &[i16]) -> f64 {
    if frame.is_empty() {
        return 0.0;
    }
    let sum = frame
        .iter()
        .map(|sample| f64::from(*sample) * f64::from(*sample))
        .sum::<f64>();
    (sum / frame.len() as f64).sqrt()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frame(value: i16) -> Vec<i16> {
        vec![value; 1_920] // 20 ms at 48 kHz stereo.
    }

    #[test]
    fn ignores_pre_speech_silence_and_discards_short_blips() {
        let mut collector = UtteranceCollector::new();
        assert!(collector.push(frame(0)).is_none());
        assert!(collector.push(frame(500)).is_none());
        for _ in 0..40 {
            assert!(collector.push(frame(0)).is_none());
        }
        assert!(collector.flush().is_none());
    }

    #[test]
    fn closes_after_eight_hundred_ms_of_silence_and_preserves_internal_audio() {
        let mut collector = UtteranceCollector::new();
        // The Node collector only emits turns with at least 300 ms of voiced audio.
        for _ in 0..15 {
            assert!(collector.push(frame(500)).is_none());
        }
        assert!(collector.push(frame(0)).is_none());
        assert!(collector.push(frame(500)).is_none());
        for _ in 0..39 {
            assert!(collector.push(frame(0)).is_none());
        }
        let utterance = collector.push(frame(0));
        let utterance = utterance.expect("silence closes the turn");
        assert_eq!(utterance.duration_ms, 1_140);
        assert_eq!(utterance.voiced_ms, 320);
        assert_eq!(utterance.pcm.len(), 109_440);
    }

    #[test]
    fn twenty_second_cap_closes_a_long_monologue() {
        let mut collector = UtteranceCollector::new();
        let mut utterance = None;
        for _ in 0..1_000 {
            utterance = collector.push(frame(500));
            if utterance.is_some() {
                break;
            }
        }
        let utterance = utterance.expect("cap closes without silence");
        assert_eq!(utterance.duration_ms, 20_000);
        assert_eq!(utterance.voiced_ms, 20_000);
        assert!(collector.flush().is_none());
    }
}
