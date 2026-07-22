// src/moderation/antispam.ts — spam detection for voice reading (plan 017).
//
// Two PURE and conservative heuristics (opt-in per guild; OFF by default):
//  1) isRepetitionSpam — massive token repetition WITHIN a message
//     (e.g. "POKEBOLAS POKEBOLAS ×39"): many tokens + very low diversity.
//  2) DuplicateTracker — the SAME person repeating the SAME large message in a
//     short window (the 1st is read; the following ones, within the window, are not).
//
// Thresholds pinned as exported constants — the tuning surface. They are deliberately
// conservative to minimize false positives (song lyrics, counts). Nothing here does I/O.

/** Minimum number of tokens to even consider repetition (short messages are never spam). */
export const REPETITION_MIN_TOKENS = 10;
/** Diversity (unique/total) AT MOST this => spam. 0.35: "abc abc abc" (0.33) is caught; a normal sentence (~0.9) is not. */
export const REPETITION_UNIQUE_RATIO_MAX = 0.35;
/** Minimum length (normalized chars) for a message to count as duplicate-spam. */
export const DUPLICATE_MIN_CHARS = 40;
/** Duplicate window: repetitions of the SAME message within this are suppressed. */
export const DUPLICATE_WINDOW_MS = 60 * 1000;
/** Cap on tracker entries (anti-growth); evicts the oldest when exceeded. */
const MAX_ENTRIES = 10_000;

/** Tokenizes for the repetition heuristic: lowercase, split on non-(letter|number), no empties. PURE. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0);
}

/**
 * Is the message REPETITION-spam? True if it has ≥ REPETITION_MIN_TOKENS tokens AND the
 * diversity (unique/total) is ≤ REPETITION_UNIQUE_RATIO_MAX. Short messages (< min tokens)
 * are always false — we do not want to catch "yes yes yes". PURE.
 */
export function isRepetitionSpam(text: string): boolean {
  const tokens = tokenize(text);
  if (tokens.length < REPETITION_MIN_TOKENS) return false;
  const unique = new Set(tokens).size;
  return unique / tokens.length <= REPETITION_UNIQUE_RATIO_MAX;
}

/** Normalizes for comparing duplicates: lowercase, collapsed spaces, trim. PURE. */
export function normalizeForDuplicate(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

interface DupEntry {
  text: string;
  ts: number;
}

/**
 * Detects the SAME person repeating the SAME large message in a short window, per
 * (guild, author). In-memory state with cap + evict (rateLimiter pattern). It is a FIXED
 * window: a suppressed repetition does NOT renew the timestamp — once the window passes, the
 * message is read once again. Clock passed per call (like the rateLimiter).
 */
export class DuplicateTracker {
  // Map preserves insertion order → the 1st key is the oldest (simple evict).
  private readonly last = new Map<string, DupEntry>();

  private static keyOf(guildId: string, authorId: string): string {
    return `${guildId}:${authorId}`;
  }

  /**
   * Is `text` (the already-cleaned body) duplicate-spam NOW? False for short messages
   * (< DUPLICATE_MIN_CHARS normalized) — only the flood of LARGE messages counts. True if it
   * is identical to this person's last one within DUPLICATE_WINDOW_MS. The 1st occurrence
   * (or after the window, or new text) is RECORDED and returns false.
   */
  isDuplicateSpam(guildId: string, authorId: string, text: string, nowMs: number): boolean {
    const norm = normalizeForDuplicate(text);
    if (norm.length < DUPLICATE_MIN_CHARS) return false;
    const key = DuplicateTracker.keyOf(guildId, authorId);
    const prev = this.last.get(key);
    if (prev && prev.text === norm && nowMs - prev.ts < DUPLICATE_WINDOW_MS) {
      return true; // duplicate within the window — suppress, without renewing (fixed window)
    }
    this.last.delete(key); // re-inserts at the end (MRU) so the evict hits the oldest
    this.last.set(key, { text: norm, ts: nowMs });
    if (this.last.size > MAX_ENTRIES) {
      const oldest = this.last.keys().next().value as string | undefined;
      if (oldest !== undefined) this.last.delete(oldest);
    }
    return false;
  }
}
