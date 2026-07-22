import { randomUUID } from 'node:crypto';
import type { SynthRequest } from '../tts/engine';

/** The origin is intentionally coarse: public queue views must never disclose text or a model. */
export type QueueSource = 'message' | 'command' | 'game' | 'sound' | 'system';
export type QueueLane = 'standard' | 'accessibility';

export interface QueueItem {
  req: SynthRequest;
}

export interface QueueEnqueueOptions {
  authorId?: string | null;
  source?: QueueSource;
  lane?: QueueLane;
  now?: number;
}

interface QueueEnvelope extends QueueItem {
  readonly id: string;
  readonly authorId: string | null;
  readonly createdAt: number;
  readonly source: QueueSource;
  readonly lane: QueueLane;
}

/** Private worker metadata. Never expose this object through queueSnapshot(). */
export type QueueWorkItem = QueueEnvelope;

/** Safe to send to Discord. It deliberately has no request, text, model, path or author id. */
export interface PublicQueueItem {
  id: string;
  source: QueueSource;
  lane: QueueLane;
  ageMs: number;
}

/** At most this many accessibility jobs run before one waiting standard job. */
export const MAX_ACCESSIBILITY_BURST = 3;

/**
 * Two FIFO lanes with one shared cap. Accessibility jobs are chosen between completed items;
 * they never interrupt audio that is already synthesising or playing.
 */
export class PlayQueue {
  private readonly standard: QueueEnvelope[] = [];
  private readonly accessibility: QueueEnvelope[] = [];
  private accessibilityBurst = 0;

  constructor(private readonly cap: number) {}

  enqueue(item: QueueItem, options: QueueEnqueueOptions = {}): boolean {
    return this.enqueueMany([item], options);
  }

  /** Adds a logical multi-part utterance all-or-nothing so a full queue cannot cut it short. */
  enqueueMany(items: readonly QueueItem[], options: QueueEnqueueOptions = {}): boolean {
    if (items.length === 0 || this.size() + items.length > this.cap) return false;
    const createdAt = options.now ?? Date.now();
    const lane = options.lane ?? 'standard';
    const target = lane === 'accessibility' ? this.accessibility : this.standard;
    for (const item of items) {
      target.push({
        req: item.req,
        id: randomUUID(),
        authorId: options.authorId ?? null,
        createdAt,
        source: options.source ?? 'system',
        lane,
      });
    }
    return true;
  }

  /** Private worker-only dequeue. Do not expose this result to command rendering. */
  dequeue(): QueueWorkItem | undefined {
    // Accessibility remains responsive, but a sustained priority stream cannot starve
    // normal callers forever. FIFO is preserved inside each lane.
    if (
      this.accessibility.length > 0 &&
      (this.standard.length === 0 || this.accessibilityBurst < MAX_ACCESSIBILITY_BURST)
    ) {
      this.accessibilityBurst++;
      return this.accessibility.shift();
    }
    if (this.standard.length > 0) {
      this.accessibilityBurst = 0;
      return this.standard.shift();
    }
    return undefined;
  }

  size(): number {
    return this.standard.length + this.accessibility.length;
  }

  clear(): void {
    this.standard.length = 0;
    this.accessibility.length = 0;
    this.accessibilityBurst = 0;
  }

  /** Removes only queued (never current) jobs by the author who created them. */
  removeByAuthor(authorId: string): number {
    return this.removeWhere((item) => item.authorId === authorId);
  }

  /** Moderator action: remove one opaque queue id, without reading its private request. */
  removeById(id: string): boolean {
    return this.removeWhere((item) => item.id === id) === 1;
  }

  /** Author action: an opaque id is removable only when it belongs to that author. */
  removeByAuthorId(authorId: string, id: string): boolean {
    return this.removeWhere((item) => item.authorId === authorId && item.id === id) === 1;
  }

  snapshot(now: number = Date.now()): PublicQueueItem[] {
    return [...this.accessibility, ...this.standard].map((item) => ({
      id: item.id,
      source: item.source,
      lane: item.lane,
      ageMs: Math.max(0, now - item.createdAt),
    }));
  }

  private removeWhere(predicate: (item: QueueEnvelope) => boolean): number {
    let removed = 0;
    for (const lane of [this.standard, this.accessibility]) {
      for (let i = lane.length - 1; i >= 0; i--) {
        if (predicate(lane[i])) {
          lane.splice(i, 1);
          removed++;
        }
      }
    }
    return removed;
  }
}
