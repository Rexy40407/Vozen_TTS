import type Database from 'better-sqlite3';

/** Retain v1 delivery ids just long enough to absorb provider retries and replays. */
export const TOPGG_EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Atomic first-delivery gate. Returns false for an already processed v1 event. */
export function claimTopggEvent(db: Database.Database, eventId: string, now = Date.now()): boolean {
  if (!eventId || eventId.length > 200 || !Number.isFinite(now)) return false;
  return (
    db
      .prepare('INSERT OR IGNORE INTO topgg_webhook_event (event_id, processed_at) VALUES (?, ?)')
      .run(eventId, now).changes === 1
  );
}

/** Releases a failed reward so Top.gg's retry can perform the delivery. */
export function releaseTopggEvent(db: Database.Database, eventId: string): void {
  db.prepare('DELETE FROM topgg_webhook_event WHERE event_id = ?').run(eventId);
}

export function purgeExpiredTopggEvents(db: Database.Database, now = Date.now()): number {
  return db
    .prepare('DELETE FROM topgg_webhook_event WHERE processed_at < ?')
    .run(now - TOPGG_EVENT_RETENTION_MS).changes;
}
