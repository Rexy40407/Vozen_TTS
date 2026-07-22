// src/premium/adminAuth.ts
//
// Signed session for the Vozen admin console (plan 037). The console is gated by the operator's
// Discord identity (only OWNER_ID may log in); after that check passes, adminApi mints one of these
// tokens and the browser carries it on every later request. The page and this code live in PUBLIC
// repos, so a forgeable session would be the whole game — hence HMAC-SHA256 with a server-only
// secret. Kept pure so the sign/verify pair is unit-tested in isolation.

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Default session lifetime. Kept short (2h) so a session token leaked out-of-band has a small
 *  usable window — the console re-authenticates with one Discord OAuth click. (The stateless HMAC
 *  can't be individually revoked, so the TTL IS the bound; see SEC audit S6.) */
const DEFAULT_TTL_SEC = 2 * 3600;

/**
 * Signs an admin session token `<userId>.<expEpochSec>.<sigBase64url>` (HMAC-SHA256 over
 * `<userId>.<exp>`). Same shape as the Vozen-helper panel session. Minted ONLY after the Discord
 * identity has been confirmed to be the owner.
 */
export function signAdminSession(
  userId: string,
  secret: string,
  now: number,
  ttlSec: number = DEFAULT_TTL_SEC,
): string {
  const exp = Math.floor(now / 1000) + ttlSec;
  const payload = `${userId}.${exp}`;
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/**
 * Returns the `userId` iff the token is well-formed, unexpired, and correctly signed; else null.
 * The caller still re-checks `userId === ownerId` (defense in depth) before acting.
 */
export function verifyAdminSession(token: string, secret: string, now: number): string | null {
  const parts = (token ?? '').split('.');
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const payload = `${userId}.${expStr}`;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const exp = Number.parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp * 1000 < now) return null;
  return userId;
}
