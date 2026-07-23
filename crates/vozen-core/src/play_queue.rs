//! Privacy-safe two-lane FIFO queue for prepared speech.

use std::collections::VecDeque;

use uuid::Uuid;

use crate::{QueueLane, SynthRequest};

/// At most this many accessible requests run before one waiting standard request.
pub const MAX_ACCESSIBILITY_BURST: u8 = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QueueSource {
    Message,
    Command,
    Game,
    Sound,
    System,
}

#[derive(Debug, Clone, Copy)]
pub struct QueueEnqueueOptions<'a> {
    pub author_id: Option<&'a str>,
    pub source: QueueSource,
    pub lane: QueueLane,
    pub created_at_ms: u64,
}

impl Default for QueueEnqueueOptions<'_> {
    fn default() -> Self {
        Self {
            author_id: None,
            source: QueueSource::System,
            lane: QueueLane::Standard,
            created_at_ms: 0,
        }
    }
}

/// Worker-only request. Do not serialise or pass this to command rendering.
#[derive(Debug, Clone, PartialEq)]
pub struct QueueWorkItem {
    pub request: SynthRequest,
    pub id: String,
    pub author_id: Option<String>,
    pub created_at_ms: u64,
    pub source: QueueSource,
    pub lane: QueueLane,
}

/// Data safe to send to Discord; it intentionally has no speech text, model or author ID.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PublicQueueItem {
    pub id: String,
    pub source: QueueSource,
    pub lane: QueueLane,
    pub age_ms: u64,
}

/// Shared-capacity FIFO lanes. It never interrupts an item already being synthesized or played.
pub struct PlayQueue {
    cap: usize,
    standard: VecDeque<QueueWorkItem>,
    accessibility: VecDeque<QueueWorkItem>,
    accessibility_burst: u8,
}

impl PlayQueue {
    pub fn new(cap: usize) -> Self {
        Self {
            cap,
            standard: VecDeque::new(),
            accessibility: VecDeque::new(),
            accessibility_burst: 0,
        }
    }

    /// Adds all pieces atomically: a streamed utterance cannot be partially accepted.
    pub fn enqueue_many(
        &mut self,
        requests: impl IntoIterator<Item = SynthRequest>,
        options: QueueEnqueueOptions<'_>,
    ) -> bool {
        let requests: Vec<_> = requests.into_iter().collect();
        if requests.is_empty() || self.size().saturating_add(requests.len()) > self.cap {
            return false;
        }
        let target = match options.lane {
            QueueLane::Standard => &mut self.standard,
            QueueLane::Accessibility => &mut self.accessibility,
        };
        for request in requests {
            target.push_back(QueueWorkItem {
                request,
                id: Uuid::new_v4().to_string(),
                author_id: options.author_id.map(str::to_owned),
                created_at_ms: options.created_at_ms,
                source: options.source,
                lane: options.lane,
            });
        }
        true
    }

    pub fn dequeue(&mut self) -> Option<QueueWorkItem> {
        if !self.accessibility.is_empty()
            && (self.standard.is_empty() || self.accessibility_burst < MAX_ACCESSIBILITY_BURST)
        {
            self.accessibility_burst += 1;
            return self.accessibility.pop_front();
        }
        if let Some(item) = self.standard.pop_front() {
            self.accessibility_burst = 0;
            return Some(item);
        }
        None
    }

    pub fn size(&self) -> usize {
        self.standard.len() + self.accessibility.len()
    }

    pub fn is_empty(&self) -> bool {
        self.size() == 0
    }

    pub fn clear(&mut self) {
        self.standard.clear();
        self.accessibility.clear();
        self.accessibility_burst = 0;
    }

    /// Removes queued work only; a caller has no handle to the current item.
    pub fn remove_by_author(&mut self, author_id: &str) -> usize {
        self.remove_where(|item| item.author_id.as_deref() == Some(author_id))
    }

    pub fn remove_by_id(&mut self, id: &str) -> bool {
        self.remove_where(|item| item.id == id) == 1
    }

    pub fn remove_by_author_id(&mut self, author_id: &str, id: &str) -> bool {
        self.remove_where(|item| item.id == id && item.author_id.as_deref() == Some(author_id)) == 1
    }

    pub fn snapshot(&self, now_ms: u64) -> Vec<PublicQueueItem> {
        self.accessibility
            .iter()
            .chain(self.standard.iter())
            .map(|item| PublicQueueItem {
                id: item.id.clone(),
                source: item.source,
                lane: item.lane,
                age_ms: now_ms.saturating_sub(item.created_at_ms),
            })
            .collect()
    }

    fn remove_where(&mut self, mut predicate: impl FnMut(&QueueWorkItem) -> bool) -> usize {
        let before = self.size();
        self.standard.retain(|item| !predicate(item));
        self.accessibility.retain(|item| !predicate(item));
        before - self.size()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::SynthesisEngine;

    fn request(text: &str) -> SynthRequest {
        SynthRequest {
            text: text.to_owned(),
            model: "en_US-amy-medium".to_owned(),
            speed: 1.0,
            engine: SynthesisEngine::Default,
            segments: None,
            single_voice: None,
            emphasis_source: None,
            lead_silence_ms: 0,
        }
    }

    fn options(lane: QueueLane, author_id: Option<&str>) -> QueueEnqueueOptions<'_> {
        QueueEnqueueOptions {
            author_id,
            source: QueueSource::Message,
            lane,
            created_at_ms: 10,
        }
    }

    #[test]
    fn accessibility_is_responsive_but_cannot_starve_standard_fifo() {
        let mut queue = PlayQueue::new(8);
        assert!(queue.enqueue_many([request("normal")], options(QueueLane::Standard, None)));
        assert!(queue.enqueue_many(
            [request("a1"), request("a2"), request("a3"), request("a4")],
            options(QueueLane::Accessibility, None),
        ));
        let order: Vec<_> = (0..5)
            .map(|_| queue.dequeue().expect("item").request.text)
            .collect();
        assert_eq!(order, ["a1", "a2", "a3", "normal", "a4"]);
    }

    #[test]
    fn streamed_requests_are_atomic_and_public_view_cannot_leak_content() {
        let mut queue = PlayQueue::new(2);
        assert!(!queue.enqueue_many(
            [request("one"), request("two"), request("three")],
            QueueEnqueueOptions::default(),
        ));
        assert!(queue.is_empty());
        assert!(queue.enqueue_many(
            [request("private")],
            options(QueueLane::Standard, Some("author")),
        ));
        let public = queue.snapshot(4);
        assert_eq!(public.len(), 1);
        assert_eq!(public[0].age_ms, 0);
        assert!(!format!("{:?}", public).contains("private"));
        assert!(queue.remove_by_author("author") == 1);
    }

    #[test]
    fn opaque_item_removal_requires_the_matching_author() {
        let mut queue = PlayQueue::new(2);
        assert!(queue.enqueue_many([request("secret")], options(QueueLane::Standard, Some("a"))));
        let id = queue.snapshot(10)[0].id.clone();
        assert!(!queue.remove_by_author_id("b", &id));
        assert!(queue.remove_by_author_id("a", &id));
    }
}
