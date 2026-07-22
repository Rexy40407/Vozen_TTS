// src/premium/kofi.ts
//
// PURE logic of the Ko-fi webhook (option A: Discord ID in the purchase message). No IO —
// receives the POST body and returns the grant to apply. The thin HTTP server (kofiWebhook.ts)
// verifies the token, calls this and applies it to the store. INERT without KOFI_WEBHOOK_TOKEN.
//
// Ko-fi POSTs `application/x-www-form-urlencoded` with a single field `data` = JSON.
// Fields we use: verification_token, type, message (where the buyer puts the Discord ID),
// is_subscription_payment, tier_name (memberships) and shop_items (one-off purchases → annual).

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/** Number of licenses (servers) of a Premium pass. Product decision: pay for 1, use 3. */
export const PREMIUM_PASS_SEATS = 3;
/** Licenses of the "Premium Max" tier (Ko-fi product name contains "max"): pay for 1, use 8.
 * (Big deal reduced from 10 to 8 servers on 2026-07-11; new products use
 * "(8 servers)" in the name — this fallback only catches legacy names with "max".) */
export const PREMIUM_MAX_SEATS = 8;

export type KofiPlan = 'premium' | 'plus';

/** Subset of the Ko-fi payload we need (the rest is ignored). */
export interface KofiEvent {
  verificationToken: string;
  type: string; // Donation | Subscription | Shop Order | Commission
  message: string | null;
  isSubscriptionPayment: boolean;
  /**
   * true only on the FIRST payment of a membership. Plan 035 routes on this: a first payment
   * pends and is claimed (the buyer picks the Discord account and consents to immediate
   * delivery), while renewals keep applying themselves — a subscriber must not lose the
   * service they pay for by forgetting to claim each month. Absent/anything-but-true reads as
   * false, and the routing demands the email binding as well, so a Ko-fi payload that omits
   * this degrades to "pending" rather than to "activate without consent".
   */
  isFirstSubscriptionPayment: boolean;
  tierName: string | null;
  /** Concatenated shop item names/codes, to match keywords (annual, plus…). */
  shopItemsText: string;
  /**
   * `direct_link_code` of each shop item (the code in the product's link,
   * ko-fi.com/s/<code>). Ko-fi does NOT send the product NAME in a Shop Order —
   * `variation_name` only exists for PHYSICAL products, so a digital item sends it empty.
   * The code is therefore the only stable identifier of what was bought; KOFI_SHOP_MAP
   * turns it into a product (see parseShopMap).
   */
  shopItemCodes: string[];
  /** Buyer's email (from Ko-fi). Key to re-find the Discord ID on renewals. */
  email: string | null;
  amount: string | null;
  transactionId: string | null;
}

export interface KofiGrant {
  plan: KofiPlan;
  days: number;
  seats: number; // relevant only for 'premium'
  /** Discord ID extracted from the message; null => could not be associated (manual grant). */
  discordId: string | null;
  /** Product label (for logs). */
  label: string;
}

/**
 * Parses the Ko-fi POST body. Accepts both the official format
 * (`data=<json url-encoded>`) and plain JSON (useful in tests). Returns null if it fails.
 */
export function parseKofiPayload(raw: string): KofiEvent | null {
  try {
    let jsonText = raw.trim();
    if (jsonText.startsWith('data=') || jsonText.includes('data=')) {
      const data = new URLSearchParams(raw).get('data');
      if (data) jsonText = data;
    }
    const o = JSON.parse(jsonText) as Record<string, unknown>;
    const shopItems = Array.isArray(o.shop_items)
      ? (o.shop_items as Record<string, unknown>[])
      : [];
    const shopItemsText = shopItems
      .map((s) => `${String(s.variation_name ?? '')} ${String(s.direct_link_code ?? '')}`)
      .join(' ')
      .trim();
    const shopItemCodes = shopItems
      .map((s) => String(s.direct_link_code ?? '').trim())
      .filter((c) => c !== '');
    return {
      verificationToken: String(o.verification_token ?? ''),
      type: String(o.type ?? ''),
      message: o.message == null ? null : String(o.message),
      isSubscriptionPayment: o.is_subscription_payment === true,
      isFirstSubscriptionPayment: o.is_first_subscription_payment === true,
      tierName: o.tier_name == null ? null : String(o.tier_name),
      shopItemsText,
      shopItemCodes,
      // from_name (buyer's name) is NOT captured — PII minimization; Ko-fi
      // keeps it on their side and the tx id is enough to reconcile.
      email: o.email == null ? null : String(o.email),
      amount: o.amount == null ? null : String(o.amount),
      transactionId: o.kofi_transaction_id == null ? null : String(o.kofi_transaction_id),
    };
  } catch {
    return null;
  }
}

/**
 * true if the payload token matches the expected one (and the expected one is not empty).
 * CONSTANT-TIME comparison: `===` short-circuits at the 1st differing byte and leaks a
 * prefix oracle via timing. We hash both sides to SHA-256 (fixed length,
 * so it also doesn't leak the secret's size) and use timingSafeEqual — the same pattern as the
 * top.gg webhook (authMatches in src/vote.ts).
 */
export function verifyKofiToken(event: KofiEvent, expected: string | undefined): boolean {
  if (!expected) return false;
  const a = createHash('sha256').update(event.verificationToken).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Opaque key for the Ko-fi buyer email: HMAC-SHA256(token, normalized email).
 * We store THIS in the DB (kofi_supporter table) instead of the plaintext email — PII
 * minimization. Renewals resend the email → it is hashed and matches the stored hash, so the
 * email→Discord ID association keeps working without ever retaining the email. The webhook
 * token serves as the secret key (high entropy ⇒ no rainbow tables over emails).
 * NOTE: if you rotate KOFI_WEBHOOK_TOKEN, the old hashes stop matching (renewals
 * of those supporters need the Discord ID in the message again).
 */
export function hashKofiEmail(webhookToken: string, email: string): string {
  return createHmac('sha256', webhookToken).update(email.trim().toLowerCase()).digest('hex');
}

/** Extracts the 1st Discord ID (17–20 digits) from the message, or null. */
export function extractDiscordId(message: string | null): string | null {
  if (!message) return null;
  const m = message.match(/\b(\d{17,20})\b/);
  return m ? m[1] : null;
}

/**
 * Decides the grant from the event, by KEYWORDS in the tier/item name (robust to
 * exact names): "plus" => Plus (user); "premium" => Premium pass (guild), with the seat
 * count read from "(N servers)" and a legacy "max" fallback of PREMIUM_MAX_SEATS (8 since
 * 2026-07-11, see the constant), otherwise the default 3. "annual"/"anual"/"year"/"ano" => 365
 * days, otherwise 30 (monthly). Returns null if it is not a recognizable product (e.g. a one-off
 * donation) — those are ignored. CRITICAL ORDER: "plus" is tested BEFORE "premium", so
 * a Premium Max product can NEVER contain the word "plus" in its name.
 */
/** A product sold as a Ko-fi Shop item, resolved from its `direct_link_code`. */
export interface ShopProduct {
  plan: KofiPlan;
  days: number;
  seats: number;
}

/** Upper bounds for the env-configured map — cheap defense against a typo. */
const MAX_SHOP_DAYS = 3650;
const MAX_SHOP_SEATS = 100;

/**
 * Parses KOFI_SHOP_MAP: `code:plan:days[:seats]` entries separated by commas, e.g.
 * `abc123:plus:365, def456:premium:365:8`. Maps a Shop item's `direct_link_code` (the
 * code in ko-fi.com/s/<code>) to the product it sells.
 *
 * WHY this exists: a Ko-fi Shop Order does NOT carry the product name — `variation_name`
 * only applies to PHYSICAL products, so a digital item (our annual passes) sends it empty
 * and the keyword matching used for membership tiers can never recognize it. Without this
 * map an annual purchase is silently ignored (200 OK, no grant).
 *
 * Malformed entries are SKIPPED, never thrown: a typo in the env must not take the whole
 * webhook down (a dropped entry loses one product; an exception loses every sale). PURE.
 */
export function parseShopMap(raw: string | undefined): Map<string, ShopProduct> {
  const out = new Map<string, ShopProduct>();
  if (!raw) return out;
  for (const entry of raw.split(',')) {
    const parts = entry.trim().split(':');
    if (parts.length < 3 || parts.length > 4) continue;
    const [code, planRaw, daysRaw, seatsRaw] = parts.map((p) => p.trim());
    if (!code) continue;
    if (planRaw !== 'plus' && planRaw !== 'premium') continue;
    const days = Number.parseInt(daysRaw, 10);
    if (!Number.isFinite(days) || days < 1 || days > MAX_SHOP_DAYS) continue;
    let seats = PREMIUM_PASS_SEATS;
    if (seatsRaw !== undefined) {
      const n = Number.parseInt(seatsRaw, 10);
      if (!Number.isFinite(n) || n < 1 || n > MAX_SHOP_SEATS) continue;
      seats = n;
    }
    out.set(code, { plan: planRaw, days, seats });
  }
  return out;
}

export function mapKofiToGrant(
  event: KofiEvent,
  now: number,
  shopMap?: Map<string, ShopProduct>,
): KofiGrant | null {
  void now; // reserved (dates are computed in the store when applying)
  // Shop items FIRST: an exact configured code beats guessing from a name — and it is the
  // ONLY way to recognize one, since Ko-fi does not send the product name (see parseShopMap).
  if (shopMap?.size) {
    for (const code of event.shopItemCodes) {
      const product = shopMap.get(code);
      if (product) {
        return {
          plan: product.plan,
          days: product.days,
          seats: product.seats,
          discordId: extractDiscordId(event.message),
          label: `shop:${code}`,
        };
      }
    }
  }
  const label = `${event.tierName ?? ''} ${event.shopItemsText}`.trim();
  const lower = label.toLowerCase();
  let plan: KofiPlan | null = null;
  if (lower.includes('plus')) plan = 'plus';
  else if (lower.includes('premium')) plan = 'premium';
  if (!plan) return null;
  const annual = /(annual|anual|yearly|year|ano)/.test(lower);
  const days = annual ? 365 : 30;
  // Licenses (only for 'premium'; Plus is per-user). Plus is irrelevant -> 3.
  const seats = plan === 'premium' ? premiumSeats(lower) : PREMIUM_PASS_SEATS;
  return {
    plan,
    days,
    seats,
    discordId: extractDiscordId(event.message),
    label: label || plan,
  };
}

/**
 * Number of licenses of a Premium pass, READ from the product name: "(N servers)" -> N
 * (e.g. "Vozen Premium (8 servers)" -> 8; "(3 servers)" -> 3; old purchases "(10 servers)"
 * keep renewing with 10 — grandfathering). Historical fallback to the
 * word "max" (8). Default 3. N is capped to 1..100 so a name with a typo doesn't generate
 * an absurd pass (the name is the operator's, but this is cheap defense).
 */
function premiumSeats(lower: string): number {
  const m = lower.match(/(\d+)\s*servers?\b/);
  if (m) {
    const n = Number.parseInt(m[1], 10);
    if (Number.isFinite(n) && n >= 1 && n <= 100) return n;
  }
  return /\bmax\b/.test(lower) ? PREMIUM_MAX_SEATS : PREMIUM_PASS_SEATS;
}
