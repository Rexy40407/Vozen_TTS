// src/errorReporter.ts — Vaga 3
//
// Sends UNEXPECTED errors (gateway, unhandledRejection, uncaughtException) to a
// Discord webhook, so the operator can see production problems without reading logs.
// OPT-IN: without ERROR_WEBHOOK_URL, it is a no-op. DEDUP by stack hash — the SAME
// error repeating does not spam the channel. NEVER throws (a problem reporting the
// error must not itself take down the bot).

import { createHash } from 'node:crypto';
import { log } from './logging/logger';

/** Clears the dedup window when it reaches this number of distinct errors (prevents unbounded growth). */
const DEDUP_CAP = 500;
/** Margin below Discord's 2000-char content limit. */
const MAX_CONTENT = 1900;

function hashError(error: unknown): string {
  const e = error as { stack?: string; message?: string };
  let key = e?.stack || e?.message;
  if (!key) {
    // NON-Error rejections (plain object, string, etc.) — common in unhandledRejection.
    // Without this, everything fell into String(error) === "[object Object]" and collided
    // on a single hash, deduplicating genuinely different failures. Serialize (guarded) to distinguish.
    try {
      key = JSON.stringify(error);
    } catch {
      key = String(error);
    }
  }
  return createHash('sha1').update(String(key).slice(0, 1000)).digest('hex');
}

/** Maximum forwarded body (before the header+code-block wrapper). */
const MAX_BODY = 1500;
// Shape of a Discord bot token (3 base64url blocks separated by '.').
const DISCORD_TOKEN_RE = /[\w-]{23,28}\.[\w-]{6,7}\.[\w-]{27,}/g;
// OpenAI key ("sk-..."): can appear loose in SDK errors, not only in
// Authorization (e.g. HTTP-client error messages that echo the config).
const OPENAI_KEY_RE = /sk-[A-Za-z0-9_-]{20,}/g;
// x-goog-api-key header (Google Cloud TTS/Translate): the key value.
const GOOGLE_HEADER_RE = /x-goog-api-key['":\s]*[:=]\s*['"]?[A-Za-z0-9_-]{10,}/gi;
// key=... query param — Google's REST API accepts the key in the URL itself
// (?key=<key>), so an HTTP error may echo the full URL.
const GOOGLE_QUERY_KEY_RE = /([?&]key=)[A-Za-z0-9_-]{10,}/gi;
// "Bearer xxx" credential (HTTP headers echoed in error messages).
const BEARER_RE = /Bearer\s+[\w.~+/=-]+/gi;
// Generic Authorization header (schemes != Bearer, e.g. Basic, or a raw key without
// a scheme). The lookahead excludes "Bearer" (already handled above, with the "Bearer […]"
// marker); the value must START with a non-space char so the preceding \s* cannot "give back"
// the space and thus bypass the lookahead by sitting right before "Bearer".
const AUTH_HEADER_RE = /authorization\s*[:=]\s*['"]?(?!Bearer\b)[^\s"'`,;\r\n][^"'`,;\r\n]*/gi;

/**
 * SEC-03 / SECRET-03: an error's text can echo credentials (bot token in a discord.js
 * error, OpenAI/Google key, Authorization header in an HTTP error). Redact them BEFORE
 * sending to the webhook (which is a chat channel) and cap the size — redact first, cut
 * after, so a cut never leaves half a token/key visible.
 */
function scrub(text: string): string {
  return text
    .replace(DISCORD_TOKEN_RE, '[token-redigido]')
    .replace(OPENAI_KEY_RE, '[chave-redigida]')
    .replace(GOOGLE_HEADER_RE, 'x-goog-api-key: [chave-redigida]')
    .replace(GOOGLE_QUERY_KEY_RE, '$1[chave-redigida]')
    .replace(BEARER_RE, 'Bearer [redigido]')
    .replace(AUTH_HEADER_RE, 'authorization: [redigido]')
    .slice(0, MAX_BODY);
}

/** Formats the error as webhook content (header + stack in a code block, truncated). */
export function formatErrorMessage(error: unknown, context: string): string {
  const e = error as { stack?: string; message?: string };
  const head = `⚠️ **Vozen** — erro em \`${context}\``;
  const body = scrub(String(e?.stack || e?.message || String(error)));
  const full = `${head}\n\`\`\`\n${body}\n\`\`\``;
  if (full.length <= MAX_CONTENT) return full;
  return `${full.slice(0, MAX_CONTENT - 4)}\n\`\`\``;
}

export interface ErrorReporter {
  /** Sends the error (fire-and-forget-friendly). Returns true if sent, false if
   * suppressed (dedup / no url) or it failed. NEVER throws. */
  report(error: unknown, context: string): Promise<boolean>;
}

/**
 * Creates a reporter with its OWN dedup window (isolable in tests). `url`
 * absent => report() is a no-op. `fetchImpl` injectable for tests.
 */
export function createErrorReporter(
  url: string | undefined,
  fetchImpl: typeof fetch = fetch,
): ErrorReporter {
  const seen = new Set<string>();
  return {
    async report(error, context) {
      if (!url) return false;
      const h = hashError(error);
      if (seen.has(h)) return false; // already reported — no spam
      if (seen.size >= DEDUP_CAP) seen.clear();
      // Mark BEFORE the await to deduplicate concurrent sends of the SAME error; but
      // remove it if the send FAILS, so the next occurrence can retry — otherwise a
      // transient failure (429/5xx/network) would lose that signal forever in this window.
      seen.add(h);
      try {
        const res = await fetchImpl(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: formatErrorMessage(error, context) }),
        });
        if (!res.ok) {
          seen.delete(h);
          return false;
        }
        return true;
      } catch (err) {
        seen.delete(h);
        log.warn(
          '[errorReporter] failed to send the error to the webhook (ignored):',
          (err as Error).message,
        );
        return false;
      }
    },
  };
}
