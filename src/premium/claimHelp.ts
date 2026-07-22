// src/premium/claimHelp.ts
//
// The buyer asks us to activate a purchase by hand (plan 036).
//
// WHY IT CARRIES THE EMAIL, and why this is not an automatic activation: when a buyer cannot
// activate, the owner has to find the order in the Ko-fi seller panel and grant by hand — Ko-fi
// offers no API to look an order up (webhook-only), so this is inherently manual. The receipt's
// `Ref: S-…` looked like the handle, but Ko-fi's transaction search matches only by NAME or EMAIL
// (verified 2026-07-17 against the live seller panel), so the Ref is useless to the owner. The
// email the buyer used is what the owner can paste into that search and find the order with.
//
// The email is NOT proof of ownership (that path was rejected in plan 021 — the email is not a
// secret). It is a LOOKUP HINT for a human: the owner still opens Ko-fi, confirms the paid order,
// and grants manually. Nothing here activates anything. Only (Discord ID, email) leaves — no pass,
// no product, nothing else we hold. The Discord identity arrives already validated by OAuth.

/** Personal data leaving this module: the Discord ID (the buyer just authenticated with it) and
 *  the Ko-fi email they typed. Deliberately nothing else. */
export interface ClaimHelpDeps {
  /** Discord webhook to notify. EMPTY => inert (opt-in, same shape as the error reporter). */
  webhookUrl: string;
  fetchImpl: typeof fetch;
  logError: (m: string, err: unknown) => void;
}

/** RFC-max local+domain length; this is a guard against a wall of text, not a target. */
const MAX_EMAIL = 254;
/** One person asking about the SAME purchase again inside this window is the same request. */
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Distinct (user, email) pairs remembered before the map is cleared (unbounded growth guard). */
const DEDUPE_CAP = 1000;
/** A slow webhook must not hold an HTTP handler open. */
const WEBHOOK_TIMEOUT_MS = 5_000;

/**
 * Strips a buyer-typed email down to what is safe to put in a message we send. Keeps only the
 * characters a real address can contain (`[A-Za-z0-9._%+@-]`); backticks and asterisks (markdown),
 * spaces and newlines (a fake second message) all go. A real address is unaffected, so this only
 * ever costs an attacker. `allowed_mentions: { parse: [] }` on the POST is the backstop for the `@`
 * that a real address legitimately contains.
 */
export function sanitizeEmail(raw: string): string {
  return raw
    .trim()
    .replace(/[^A-Za-z0-9._%+@-]/g, '')
    .slice(0, MAX_EMAIL);
}

/**
 * True when this help request should actually be sent. Keyed by user+email: pressing the button
 * five times must not page the owner five times, but the same person asking about a DIFFERENT
 * purchase is a genuine second request. After the window it passes again — the owner may simply
 * have missed the first one, and a buyer who paid should not be silenced by our bookkeeping.
 */
export function shouldSendClaimHelp(
  seen: Map<string, number>,
  discordId: string,
  email: string,
  now: number,
): boolean {
  const key = `${discordId}:${email}`;
  const last = seen.get(key);
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return false;
  if (seen.size >= DEDUPE_CAP) seen.clear();
  seen.set(key, now);
  return true;
}

/**
 * The message the owner reads. Written to still be actionable months later, when the context of
 * why this is manual is long gone.
 *
 * CRITICAL — the email is NOT proof of ownership (plan 021: the email is not a secret). Whoever
 * opened the modal typed it; they need not be the buyer. If this message read as a rote
 * "grant to this Discord ID", a staff member could hand a victim's real purchase to an attacker
 * who merely knew the victim's Ko-fi email — the exact vector plan 021 closed on the automatic
 * path, reopened by a human. So the wording flags the email as unverified and makes the grant
 * conditional on the owner confirming the requester actually is the buyer.
 */
export function buildClaimHelpMessage(discordId: string, email: string): string {
  return [
    '🆘 **Activation help requested**',
    `Discord ID: \`${discordId}\``,
    `Ko-fi email (typed by the requester — NOT verified): \`${email}\``,
    '',
    '⚠️ The email is not proof of purchase — anyone can type an address they know bought Vozen.',
    'Find the paid order by this email in your Ko-fi transactions, then confirm THIS requester is',
    'the buyer (e.g. have them reply from the Ko-fi receipt email, or state the exact amount + date)',
    'before you `/premium grant` for the Discord ID above.',
  ].join('\n');
}

/**
 * Sends the notification. Returns whether it went out — the caller decides what to tell the buyer.
 * NEVER throws: a failure to report must not take the endpoint down, and the site already has a
 * copy-this-to-support fallback for exactly this case.
 */
export async function sendClaimHelp(
  deps: ClaimHelpDeps,
  discordId: string,
  email: string,
): Promise<boolean> {
  if (!deps.webhookUrl) return false;
  try {
    const res = await deps.fetchImpl(deps.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: buildClaimHelpMessage(discordId, email),
        // Belt and braces with sanitizeEmail: even if a mention survived, Discord must not ping.
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    if (!res.ok) {
      deps.logError(`[claim-help] webhook returned ${res.status}`, null);
      return false;
    }
    return true;
  } catch (err) {
    deps.logError('[claim-help] failed to notify', err);
    return false;
  }
}
