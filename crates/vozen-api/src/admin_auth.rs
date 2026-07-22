//! Stateless HMAC sessions for the owner-only admin console.
//!
//! The Discord OAuth token is used only at login. Subsequent admin requests carry the signed
//! `<user_id>.<expiry>.<base64url_signature>` token, matching the Node adminAuth contract. This
//! module performs no owner decision itself: callers must compare the verified id to OWNER_ID.

use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use subtle::ConstantTimeEq;

type HmacSha256 = Hmac<Sha256>;

pub const DEFAULT_ADMIN_SESSION_TTL_SECONDS: i64 = 2 * 60 * 60;

#[must_use]
pub fn sign_admin_session(user_id: &str, secret: &str, now_ms: i64, ttl_seconds: i64) -> String {
    let expiry = now_ms.div_euclid(1_000) + ttl_seconds;
    let payload = format!("{user_id}.{expiry}");
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC accepts any key");
    mac.update(payload.as_bytes());
    let signature = URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());
    format!("{payload}.{signature}")
}

/// Returns the signed user id only when the token is well-formed, authentic and unexpired.
/// Expiry uses the same inclusive boundary as Node (`exp * 1000 < now` means expired).
#[must_use]
pub fn verify_admin_session(token: Option<&str>, secret: &str, now_ms: i64) -> Option<String> {
    let token = token?;
    let mut parts = token.split('.');
    let user_id = parts.next()?;
    let expiry_raw = parts.next()?;
    let signature = parts.next()?;
    if parts.next().is_some() || user_id.is_empty() {
        return None;
    }
    let expiry = expiry_raw.parse::<i64>().ok()?;
    if expiry.saturating_mul(1_000) < now_ms {
        return None;
    }
    let payload = format!("{user_id}.{expiry_raw}");
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).ok()?;
    mac.update(payload.as_bytes());
    let expected = URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());
    bool::from(signature.as_bytes().ct_eq(expected.as_bytes())).then(|| user_id.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    const SECRET: &str = "01234567890123456789012345678901";
    const NOW: i64 = 1_700_000_000_000;

    #[test]
    fn signs_the_node_compatible_shape_and_verifies_owner_identity() {
        let token = sign_admin_session("123456789", SECRET, NOW, 7_200);
        assert_eq!(token.split('.').count(), 3);
        assert_eq!(
            verify_admin_session(Some(&token), SECRET, NOW),
            Some("123456789".into())
        );
        assert_eq!(
            verify_admin_session(Some(&token), "wrong-secret", NOW),
            None
        );
    }

    #[test]
    fn rejects_malformed_tampered_and_expired_sessions() {
        let token = sign_admin_session("123456789", SECRET, NOW, 1);
        assert_eq!(
            verify_admin_session(Some(&token), SECRET, NOW + 1_001),
            None
        );
        assert_eq!(
            verify_admin_session(Some("not.a.session.extra"), SECRET, NOW),
            None
        );
        let tampered = token.replacen("123456789", "987654321", 1);
        assert_eq!(verify_admin_session(Some(&tampered), SECRET, NOW), None);
    }

    #[test]
    fn expiry_is_inclusive_at_the_exact_node_boundary() {
        let token = sign_admin_session("123456789", SECRET, NOW, 1);
        assert_eq!(
            verify_admin_session(Some(&token), SECRET, NOW + 1_000),
            Some("123456789".into())
        );
        assert_eq!(
            verify_admin_session(Some(&token), SECRET, NOW + 1_001),
            None
        );
    }
}
