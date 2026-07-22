import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signAdminSession, verifyAdminSession } from '../src/premium/adminAuth';

// The admin console (plan 037) is gated by the operator's Discord identity, then rides on a signed
// session. The page and code are public (two public repos), so a forgeable session would be the
// whole security boundary. These tests pin the sign/verify pair; the Discord-identity check and the
// HTTP wiring are tested in adminApi/adminRouter.

const SECRET = 'admin-session-secret-abc';
const NOW = 1_700_000_000_000; // fixed ms

describe('adminAuth — session', () => {
  it('signs and verifies a session, returning the userId', () => {
    const tok = signAdminSession('1523489275155583056', SECRET, NOW);
    expect(verifyAdminSession(tok, SECRET, NOW)).toBe('1523489275155583056');
  });

  it('rejects an expired session', () => {
    const tok = signAdminSession('1523489275155583056', SECRET, NOW, 3600);
    expect(verifyAdminSession(tok, SECRET, NOW + 3601_000)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const tok = signAdminSession('1523489275155583056', 'other-secret', NOW);
    expect(verifyAdminSession(tok, SECRET, NOW)).toBeNull();
  });

  it('rejects a tampered userId (signature no longer matches)', () => {
    const tok = signAdminSession('1523489275155583056', SECRET, NOW);
    const forged = tok.replace('1523489275155583056', '999999999999999999');
    expect(verifyAdminSession(forged, SECRET, NOW)).toBeNull();
  });

  it('rejects a tampered expiry', () => {
    const tok = signAdminSession('1523489275155583056', SECRET, NOW, 3600);
    const [uid, exp, sig] = tok.split('.');
    const bumped = `${uid}.${Number(exp) + 999999}.${sig}`;
    expect(verifyAdminSession(bumped, SECRET, NOW)).toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(verifyAdminSession('', SECRET, NOW)).toBeNull();
    expect(verifyAdminSession('a.b', SECRET, NOW)).toBeNull();
    expect(verifyAdminSession('a.b.c.d', SECRET, NOW)).toBeNull();
  });

  it('uses HMAC-SHA256 over "<userId>.<exp>" (interop with the Vozen-helper format)', () => {
    const tok = signAdminSession('42', SECRET, NOW, 3600);
    const [uid, exp, sig] = tok.split('.');
    const expected = createHmac('sha256', SECRET).update(`${uid}.${exp}`).digest('base64url');
    expect(sig).toBe(expected);
  });
});
