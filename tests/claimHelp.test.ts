// tests/claimHelp.test.ts — the buyer asks us to activate a purchase by hand (plan 036 F3+).
//
// Why this exists, and why it carries the EMAIL: a stuck buyer's purchase must be found in the
// Ko-fi seller panel by hand, because Ko-fi never sends the order in the webhook after the fact.
// The receipt's `Ref: S-…` looked like the handle — but Ko-fi's transaction search only matches
// by NAME or EMAIL (verified 2026-07-17 against the live seller panel), so the Ref is useless to
// the owner. The email the buyer used is what the owner can actually paste and find. It is NOT
// proof of ownership (plan 021) — it is a lookup hint; the owner still confirms the paid order and
// grants by hand. This module turns (Discord ID, Ko-fi email) into that notification.
import { describe, it, expect, vi } from 'vitest';
import {
  buildClaimHelpMessage,
  sanitizeEmail,
  sendClaimHelp,
  shouldSendClaimHelp,
} from '../src/premium/claimHelp';

const DID = '123456789012345678';
const EMAIL = 'buyer@example.com';

describe('sanitizeEmail — what may reach a Discord webhook', () => {
  // The email goes into a Discord message we send ourselves. Anything the buyer types is hostile
  // input until proven otherwise: markdown, mentions, newlines that fake a second message. Only
  // the characters a real address can contain survive; allowed_mentions {parse:[]} is the backstop.
  it('keeps a real address intact', () => {
    expect(sanitizeEmail('buyer@example.com')).toBe('buyer@example.com');
    expect(sanitizeEmail('first.last+tag@sub.example.co.uk')).toBe(
      'first.last+tag@sub.example.co.uk',
    );
  });

  it('strips markdown, backticks, spaces and newlines', () => {
    expect(sanitizeEmail('buyer@example.com `**x**`')).toBe('buyer@example.comx');
    expect(sanitizeEmail('buyer@example.com\n\n@here')).toBe('buyer@example.com@here');
  });

  it('caps the length (a wall of text is not an address)', () => {
    expect(sanitizeEmail('a'.repeat(400) + '@x.com').length).toBeLessThanOrEqual(254);
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeEmail('  buyer@example.com  ')).toBe('buyer@example.com');
  });
});

describe('shouldSendClaimHelp — dedupe', () => {
  // One person pressing the button five times must not page the owner five times. Keyed by
  // user+email: the same person asking about a DIFFERENT purchase is a real second request.
  it('lets the first request through and swallows the repeat', () => {
    const seen = new Map<string, number>();
    const now = 1_000_000;
    expect(shouldSendClaimHelp(seen, DID, EMAIL, now)).toBe(true);
    expect(shouldSendClaimHelp(seen, DID, EMAIL, now + 1000)).toBe(false);
  });

  it('treats a different email from the same person as a new request', () => {
    const seen = new Map<string, number>();
    expect(shouldSendClaimHelp(seen, DID, 'a@x.com', 1000)).toBe(true);
    expect(shouldSendClaimHelp(seen, DID, 'b@x.com', 1000)).toBe(true);
  });

  it('lets the same request through again after the window', () => {
    const seen = new Map<string, number>();
    expect(shouldSendClaimHelp(seen, DID, EMAIL, 0)).toBe(true);
    // A day later the owner may simply have missed it; asking again is legitimate.
    expect(shouldSendClaimHelp(seen, DID, EMAIL, 25 * 60 * 60 * 1000)).toBe(true);
  });

  it('does not grow without bound', () => {
    const seen = new Map<string, number>();
    for (let i = 0; i < 1200; i++) shouldSendClaimHelp(seen, `u${i}`, EMAIL, i);
    expect(seen.size).toBeLessThanOrEqual(1000);
  });
});

describe('buildClaimHelpMessage', () => {
  it('carries the Discord ID and the email, and tells the owner how to act', () => {
    const msg = buildClaimHelpMessage(DID, EMAIL);
    expect(msg).toContain(DID);
    expect(msg).toContain(EMAIL);
    // The owner searches Ko-fi by this email, confirms the paid order, then grants — say so, so the
    // message is actionable months from now when the context is gone.
    expect(msg).toContain('/premium grant');
  });

  // The email is typed by whoever opened the modal — NOT proof they own the order (plan 021: the
  // email is not a secret). The message must not read as a rote "grant to this Discord ID", or a
  // staff member could grant a victim's real purchase to an attacker who merely knew their email.
  // The wording must flag it unverified and demand the owner confirm ownership first.
  it('warns that the email is unverified and must not be granted on blindly', () => {
    const msg = buildClaimHelpMessage(DID, EMAIL).toLowerCase();
    expect(msg).toMatch(/not (a )?proof|unverified|not verified/);
    // The grant must be gated on confirming the requester is the buyer, not on the order existing.
    expect(msg).toMatch(/confirm|make sure|verify/);
  });

  it('strips injected backticks so a crafted email cannot break out of the code span', () => {
    // The email is shown inside a `code span`. If the buyer could smuggle in a backtick they could
    // close our span and write live markdown/mentions after it. sanitizeEmail removes them, so the
    // only backticks in the message are the two we wrote.
    const crafted = sanitizeEmail('a`b@x.com');
    expect(crafted).not.toContain('`');
    const msg = buildClaimHelpMessage(DID, crafted);
    expect(msg).toContain('`ab@x.com`');
    expect((msg.match(/`/g) ?? []).length).toBe(6); // three code spans: id, email, /premium grant
  });
});

describe('sendClaimHelp — the notification itself', () => {
  const deps = (fetchImpl: typeof fetch) => ({
    webhookUrl: 'https://discord.com/api/webhooks/1/abc',
    fetchImpl,
    logError: vi.fn(),
  });

  it('POSTs the message to the webhook', async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const fake = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body) });
      // `null`, not '': the Response constructor throws on a body with a 204 (null-body status),
      // and a throwing test double would look exactly like the code failing.
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    const ok = await sendClaimHelp(deps(fake), DID, EMAIL);
    expect(ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://discord.com/api/webhooks/1/abc');
    expect(JSON.parse(calls[0].body).content).toContain(EMAIL);
    // Never let the bot ping a whole server because an email happened to contain text.
    expect(JSON.parse(calls[0].body).allowed_mentions).toEqual({ parse: [] });
  });

  it('reports failure instead of throwing when the webhook is down', async () => {
    const boom = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const d = deps(boom);
    await expect(sendClaimHelp(d, DID, EMAIL)).resolves.toBe(false);
    expect(d.logError).toHaveBeenCalled();
  });

  it('reports failure on a non-2xx response', async () => {
    const fail = vi.fn(
      async () => new Response('nope', { status: 500 }),
    ) as unknown as typeof fetch;
    expect(await sendClaimHelp(deps(fail), DID, EMAIL)).toBe(false);
  });

  it('is inert without a webhook URL (opt-in, like the error reporter)', async () => {
    const fake = vi.fn() as unknown as typeof fetch;
    expect(
      await sendClaimHelp({ webhookUrl: '', fetchImpl: fake, logError: vi.fn() }, DID, EMAIL),
    ).toBe(false);
    expect(fake).not.toHaveBeenCalled();
  });
});
