// tests/claim.test.ts — claiming a pending Ko-fi purchase.
//
// The Ko-fi subscription checkout has no message box, and a GUEST buyer has no
// transaction history — but the EMAIL is not a secret (see plan 021: for anyone who knows it,
// it would be possible to steal someone else's Premium via any logged-in Discord account, during
// the 90-day retention of the pending grant). So the claim accepts ONLY the receipt's transaction
// CODE (a strong key only the buyer has); an input with '@' (email) is rejected with reason
// `use_receipt_code`, without even touching the DB. See src/premium/claim.ts.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import {
  recordPendingGrant,
  findUnclaimedPendingByTx,
  markPendingClaimed,
} from '../src/store/kofiPending';
import {
  ACTIVATION_TERMS_VERSION,
  activateByEmailHash,
  claimPendingGrant,
} from '../src/premium/claim';
import { hashKofiEmail } from '../src/premium/kofi';
import { isUserPremium, getPremiumPass, lookupKofiSupporter } from '../src/store/premium';

const DID = '123456789012345678';
const TOKEN = 'kofi-webhook-secret';
const EMAIL = 'buyer@example.com';
const EMAIL_HASH = hashKofiEmail(TOKEN, EMAIL);

describe('claimPendingGrant — claim a pending purchase (code only, plan 021)', () => {
  let db: Database.Database;
  const now = 1_000_000;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  const pend = (over: Partial<Parameters<typeof recordPendingGrant>[1]> = {}) => ({
    transactionId: 'tx-1',
    emailHash: EMAIL_HASH,
    plan: 'plus',
    days: 30,
    seats: 3,
    ...over,
  });

  // ── Gift contamination (plan 035, risk #1) ─────────────────────────────────────────────────
  // Once every new purchase pends, one email can hold several unclaimed rows at once — and a
  // claim both (a) applies every pending row sharing that email and (b) rebinds the email to
  // whoever claimed. A subscriber buying a gift on their own email would therefore hand their
  // OWN renewals to the recipient's account. So: only subscriptions travel together, and only
  // a subscription claim may move the binding.
  it('a claimed subscription does not drag a pending Shop gift on the same email', () => {
    recordPendingGrant(db, pend({ transactionId: 'sub-1', isSubscription: true }), now);
    recordPendingGrant(db, pend({ transactionId: 'gift-1', isSubscription: false }), now);
    const out = claimPendingGrant(db, DID, 'sub-1', now + 10);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.items).toHaveLength(1); // the subscription only
    expect(findUnclaimedPendingByTx(db, 'gift-1')).not.toBeNull(); // gift still waiting
  });

  it('accumulated orphan renewals on one email are still applied together', () => {
    recordPendingGrant(db, pend({ transactionId: 'sub-1', isSubscription: true }), now);
    recordPendingGrant(db, pend({ transactionId: 'sub-2', isSubscription: true }), now + 100);
    const out = claimPendingGrant(db, DID, 'sub-1', now + 200);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.items).toHaveLength(2);
  });

  // The mirror case, and the worse one: the recipient claims first and walks off with the
  // buyer's own pending subscription.
  it('a claimed Shop gift does not drag the buyer pending subscription', () => {
    recordPendingGrant(db, pend({ transactionId: 'sub-1', isSubscription: true }), now);
    recordPendingGrant(db, pend({ transactionId: 'gift-1', isSubscription: false }), now);
    const out = claimPendingGrant(db, DID, 'gift-1', now + 10);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.items).toHaveLength(1); // the gift only
    expect(findUnclaimedPendingByTx(db, 'sub-1')).not.toBeNull(); // buyer's sub untouched
  });

  it('claiming a Shop gift does NOT rebind the email (renewals stay with the buyer)', () => {
    recordPendingGrant(db, pend({ transactionId: 'gift-1', isSubscription: false }), now);
    const out = claimPendingGrant(db, DID, 'gift-1', now + 10);
    expect(out.ok).toBe(true); // the recipient gets the gift...
    expect(lookupKofiSupporter(db, EMAIL_HASH)).toBeNull(); // ...but the routing is untouched
  });

  it('claiming a subscription DOES bind the email (renewals resolve themselves after)', () => {
    recordPendingGrant(db, pend({ transactionId: 'sub-1', isSubscription: true }), now);
    claimPendingGrant(db, DID, 'sub-1', now + 10);
    expect(lookupKofiSupporter(db, EMAIL_HASH)).toBe(DID);
  });

  // ── What a buyer ACTUALLY pastes ───────────────────────────────────────────────────────────
  // The code has no field of its own on a Ko-fi receipt: it lives inside the receipt's URL, and
  // Ko-fi uses two shapes for it —
  //   Shop item (annual):   ko-fi.com/summary/<code>              (code is last)
  //   Membership (monthly): .../coffeeshop?txid=<code>&mode=g     (code is in the MIDDLE)
  // On the monthly one, "select from after txid= to the end" hands you the code with "&mode=g"
  // welded on. Demanding a surgically clean paste, from a page that never labels the thing,
  // fails the buyer for our convenience. Take whatever they paste and find the code in it.
  const UUID = '281c5c8e-dfa2-439f-bdbb-d3e8ef118ac2';

  it('accepts the whole monthly receipt URL, &mode=g and all', () => {
    recordPendingGrant(db, pend({ transactionId: UUID }), now);
    const out = claimPendingGrant(
      db,
      DID,
      `https://ko-fi.com/home/coffeeshop?txid=${UUID}&mode=g`,
      now + 10,
    );
    expect(out.ok).toBe(true);
    expect(isUserPremium(db, DID, now + 20)).toBe(true);
  });

  it('accepts the code with the trailing query param stuck to it', () => {
    recordPendingGrant(db, pend({ transactionId: UUID }), now);
    expect(claimPendingGrant(db, DID, `${UUID}&mode=g`, now + 10).ok).toBe(true);
  });

  it('accepts the whole annual receipt URL', () => {
    recordPendingGrant(db, pend({ transactionId: UUID }), now);
    expect(claimPendingGrant(db, DID, `https://ko-fi.com/summary/${UUID}`, now + 10).ok).toBe(true);
  });

  // A THIRD shape, found on a real guest receipt — the one a buyer reaches from the "Go to your
  // order" button in Ko-fi's email. Code in the middle of the PATH this time, with a query string
  // after it. We never designed for this shape; taking the whole link is what makes it work, and
  // that is exactly the point — enumerating Ko-fi's URL formats was always going to lose. Pinned
  // as a regression guard: this one arrives from the only recovery path a guest has.
  it('accepts the guest receipt URL reached from the Ko-fi email button', () => {
    recordPendingGrant(db, pend({ transactionId: UUID }), now);
    const out = claimPendingGrant(
      db,
      DID,
      `https://ko-fi.com/transactions/${UUID}/thank-you?img=ogbuymeacoffee`,
      now + 10,
    );
    expect(out.ok).toBe(true);
    expect(isUserPremium(db, DID, now + 20)).toBe(true);
  });

  it('still accepts a clean code, and still rejects a wrong one', () => {
    recordPendingGrant(db, pend({ transactionId: UUID }), now);
    expect(claimPendingGrant(db, DID, `  ${UUID}  `, now + 10).ok).toBe(true);
    // A different UUID must not open someone else's purchase just because it is UUID-shaped.
    recordPendingGrant(db, pend({ transactionId: 'tx-other' }), now);
    expect(claimPendingGrant(db, DID, '11111111-2222-3333-4444-555555555555', now + 30)).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('falls back to the raw input when there is no UUID in it (non-UUID tx ids keep working)', () => {
    recordPendingGrant(db, pend({ transactionId: 'tx-legacy-1' }), now);
    expect(claimPendingGrant(db, DID, 'tx-legacy-1', now + 10).ok).toBe(true);
  });

  // ── EMAIL (plan 021: no longer proof of ownership — rejected, without touching the DB) ─────────
  it('email-like input -> use_receipt_code (applies nothing, pending stays unclaimed)', () => {
    recordPendingGrant(db, pend(), now);
    const out = claimPendingGrant(db, DID, EMAIL, now + 10);
    expect(out).toEqual({ ok: false, reason: 'use_receipt_code' });
    expect(isUserPremium(db, DID, now + 20)).toBe(false);
    expect(findUnclaimedPendingByTx(db, 'tx-1')).not.toBeNull(); // still unclaimed
    expect(lookupKofiSupporter(db, EMAIL_HASH)).toBeNull(); // nothing memorized
  });

  it('normalized email (uppercase/spaces) -> use_receipt_code too', () => {
    recordPendingGrant(db, pend(), now);
    expect(claimPendingGrant(db, DID, '  BUYER@Example.COM ', now)).toEqual({
      ok: false,
      reason: 'use_receipt_code',
    });
  });

  it('unknown email -> use_receipt_code all the same (no oracle: never queries the DB)', () => {
    expect(claimPendingGrant(db, DID, 'stranger@x.com', now)).toEqual({
      ok: false,
      reason: 'use_receipt_code',
    });
  });

  // ── Secondary path: CODE (tx id) ──────────────────────────────────────────────────
  // Orphan renewals of one membership piling up on the same email — applying them in one go is
  // the point of matching by email. Marked as subscriptions since plan 035: that is what they
  // always were, and only subscriptions travel together now.
  it('code (tx id) -> activates and matches by internal email (applies all for that email)', () => {
    recordPendingGrant(db, pend({ transactionId: 'tx-1', isSubscription: true }), now);
    recordPendingGrant(db, pend({ transactionId: 'tx-2', isSubscription: true }), now + 100);
    const out = claimPendingGrant(db, DID, 'tx-1', now + 200);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.items).toHaveLength(2); // tx-1 + tx-2 (same email)
    expect(findUnclaimedPendingByTx(db, 'tx-2')).toBeNull();
  });

  it('code for a Premium -> pass with the right seats, source kofi', () => {
    recordPendingGrant(
      db,
      pend({ transactionId: 'tx-p', plan: 'premium', days: 365, seats: 8 }),
      now,
    );
    const out = claimPendingGrant(db, DID, 'tx-p', now);
    expect(out.ok).toBe(true);
    const pass = getPremiumPass(db, DID)!;
    expect(pass.seats).toBe(8);
    expect(pass.source).toBe('kofi');
  });

  it('unknown code -> not_found', () => {
    const out = claimPendingGrant(db, DID, 'nao-existe', now);
    expect(out).toEqual({ ok: false, reason: 'not_found' });
  });

  it('pending without email (emailHash null), claimed by code -> only its own purchase', () => {
    recordPendingGrant(db, pend({ transactionId: 'tx-solo', emailHash: null }), now);
    recordPendingGrant(db, pend({ transactionId: 'tx-other', emailHash: null }), now);
    const out = claimPendingGrant(db, DID, 'tx-solo', now);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.items).toHaveLength(1);
    expect(findUnclaimedPendingByTx(db, 'tx-other')).not.toBeNull();
  });

  it('code memorizes email->Discord ID (future renewals resolve themselves)', () => {
    recordPendingGrant(db, pend({ isSubscription: true }), now);
    claimPendingGrant(db, DID, 'tx-1', now);
    expect(lookupKofiSupporter(db, EMAIL_HASH)).toBe(DID);
  });

  it('2nd claim of the same code -> not_found (single use, never doubles the grant)', () => {
    recordPendingGrant(db, pend(), now);
    expect(claimPendingGrant(db, DID, 'tx-1', now).ok).toBe(true);
    expect(claimPendingGrant(db, DID, 'tx-1', now)).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('empty input -> not_found', () => {
    expect(claimPendingGrant(db, DID, '   ', now)).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  // ── Verified Discord-email activation (plan 040) ──────────────────────────────────────────
  it('creates the consent table in new databases', () => {
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get('kofi_activation_consent') as { name?: string } | undefined;
    expect(table?.name).toBe('kofi_activation_consent');
  });

  it('returns not_found and writes no consent when the email has no pending purchase', () => {
    expect(activateByEmailHash(db, DID, EMAIL_HASH, now)).toEqual({
      ok: false,
      reason: 'not_found',
    });
    const count = db.prepare('SELECT COUNT(*) AS n FROM kofi_activation_consent').get() as {
      n: number;
    };
    expect(count.n).toBe(0);
  });

  it('applies one Shop purchase without creating a renewal binding', () => {
    recordPendingGrant(db, pend({ transactionId: 'shop-1', isSubscription: false }), now);

    const out = activateByEmailHash(db, DID, EMAIL_HASH, now + 10);

    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.items).toHaveLength(1);
      expect(out.confirmation.termsVersion).toBe(ACTIVATION_TERMS_VERSION);
      expect(out.confirmation.method).toBe('discord_email');
    }
    expect(lookupKofiSupporter(db, EMAIL_HASH)).toBeNull();
  });

  it('applies one subscription and binds future renewals to the Discord user', () => {
    recordPendingGrant(db, pend({ transactionId: 'sub-1', isSubscription: true }), now);

    const out = activateByEmailHash(db, DID, EMAIL_HASH, now + 10);

    expect(out.ok).toBe(true);
    expect(lookupKofiSupporter(db, EMAIL_HASH)).toBe(DID);
  });

  it('applies every pending Shop and subscription purchase in one batch', () => {
    recordPendingGrant(db, pend({ transactionId: 'shop-1', isSubscription: false }), now);
    recordPendingGrant(
      db,
      pend({ transactionId: 'sub-1', plan: 'premium', seats: 8, isSubscription: true }),
      now + 1,
    );

    const out = activateByEmailHash(db, DID, EMAIL_HASH, now + 10);

    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.items.map((item) => item.plan)).toEqual(['plus', 'premium']);
    expect(findUnclaimedPendingByTx(db, 'shop-1')).toBeNull();
    expect(findUnclaimedPendingByTx(db, 'sub-1')).toBeNull();
    expect(lookupKofiSupporter(db, EMAIL_HASH)).toBe(DID);

    const rows = db
      .prepare(
        `SELECT transaction_id, confirmation_id, discord_id, accepted_at, terms_version, method
           FROM kofi_activation_consent ORDER BY transaction_id`,
      )
      .all() as Array<Record<string, string | number>>;
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.confirmation_id))).toEqual(new Set([out.confirmation.id]));
    for (const row of rows) {
      expect(row.discord_id).toBe(DID);
      expect(row.accepted_at).toBe(now + 10);
      expect(row.terms_version).toBe(ACTIVATION_TERMS_VERSION);
      expect(row.method).toBe('discord_email');
    }
  });

  it('does not bind when the only subscription lost the race and only Shop is applied', () => {
    recordPendingGrant(db, pend({ transactionId: 'sub-1', isSubscription: true }), now);
    recordPendingGrant(db, pend({ transactionId: 'shop-1', isSubscription: false }), now + 1);
    expect(markPendingClaimed(db, 'sub-1', now + 5)).toBe(true);

    const out = activateByEmailHash(db, DID, EMAIL_HASH, now + 10);

    expect(out.ok).toBe(true);
    if (out.ok) expect(out.items).toHaveLength(1);
    expect(lookupKofiSupporter(db, EMAIL_HASH)).toBeNull();
  });

  it('is single-use and never extends the entitlement twice', () => {
    recordPendingGrant(db, pend({ transactionId: 'shop-1' }), now);
    const first = activateByEmailHash(db, DID, EMAIL_HASH, now + 10);
    expect(first.ok).toBe(true);
    const expiresAt = first.ok ? first.items[0]?.expiresAt : null;

    expect(activateByEmailHash(db, DID, EMAIL_HASH, now + 20)).toEqual({
      ok: false,
      reason: 'not_found',
    });
    expect(isUserPremium(db, DID, Number(expiresAt) - 1)).toBe(true);
  });

  it('rolls back the grant and pending claim when consent persistence fails', () => {
    recordPendingGrant(db, pend({ transactionId: 'shop-1' }), now);
    db.exec(`CREATE TRIGGER fail_activation_consent
      BEFORE INSERT ON kofi_activation_consent
      BEGIN
        SELECT RAISE(ABORT, 'consent write failed');
      END`);

    expect(() => activateByEmailHash(db, DID, EMAIL_HASH, now + 10)).toThrow(
      /consent write failed/,
    );
    expect(findUnclaimedPendingByTx(db, 'shop-1')).not.toBeNull();
    expect(isUserPremium(db, DID, now + 20)).toBe(false);
    expect(lookupKofiSupporter(db, EMAIL_HASH)).toBeNull();
  });
});
