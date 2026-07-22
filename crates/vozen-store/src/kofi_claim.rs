//! Atomic claim paths for deferred Ko-fi purchases.
//!
//! Receipt codes are bearer secrets. Email activation is deliberately separate: its caller must
//! already have proved ownership of the Discord account email and must supply only its HMAC.

use rusqlite::{Connection, params};
use uuid::Uuid;

use crate::{
    KofiPendingGrant, KofiPendingPlan, SqliteStore, StoreError,
    kofi_pending::{
        mark_kofi_pending_claimed_on, unclaimed_kofi_pending_by_email_hash_on,
        unclaimed_kofi_pending_by_transaction_on,
    },
    premium::{grant_guild_pass_on, grant_user_premium_on, remember_kofi_supporter_on},
};

/// Versioned immediate-delivery terms accepted before activating with a verified Discord email.
pub const ACTIVATION_TERMS_VERSION: &str = "2026-07-19";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClaimedKofiItem {
    pub plan: KofiPendingPlan,
    pub days: i64,
    pub seats: i64,
    pub expires_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ClaimOutcome {
    Claimed { items: Vec<ClaimedKofiItem> },
    NotFound,
    UseReceiptCode,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActivationConfirmation {
    pub id: String,
    pub accepted_at: i64,
    pub terms_version: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ActivationOutcome {
    Activated {
        items: Vec<ClaimedKofiItem>,
        confirmation: ActivationConfirmation,
    },
    NotFound,
}

/// Extracts a UUID receipt code from any Ko-fi receipt URL, retaining legacy non-UUID IDs.
pub fn extract_kofi_receipt_code(input: &str) -> String {
    let trimmed = input.trim();
    trimmed
        .as_bytes()
        .windows(36)
        .find_map(|candidate| {
            std::str::from_utf8(candidate)
                .ok()
                .filter(|value| is_uuid_shaped(value))
                .map(str::to_owned)
        })
        .unwrap_or_else(|| trimmed.to_owned())
}

/// Claims a receipt-code purchase and, only for membership purchases, its orphan renewals.
///
/// An email-like input is never queried or accepted as a receipt code: an email is not proof of
/// ownership. Every state mutation shares one SQLite transaction.
pub fn claim_kofi_pending_grant(
    store: &SqliteStore,
    discord_id: &str,
    input: &str,
    now: i64,
) -> Result<ClaimOutcome, StoreError> {
    let raw = input.trim();
    if raw.is_empty() {
        return Ok(ClaimOutcome::NotFound);
    }
    if raw.contains('@') {
        return Ok(ClaimOutcome::UseReceiptCode);
    }

    let receipt_code = extract_kofi_receipt_code(raw);
    let transaction = store.connection().unchecked_transaction()?;
    let Some(matched) = unclaimed_kofi_pending_by_transaction_on(&transaction, &receipt_code)?
    else {
        return Ok(ClaimOutcome::NotFound);
    };

    let siblings = matched
        .input
        .email_hash
        .as_deref()
        .filter(|_| matched.input.is_subscription)
        .map(|email_hash| unclaimed_kofi_pending_by_email_hash_on(&transaction, email_hash))
        .transpose()?
        .unwrap_or_default()
        .into_iter()
        .filter(|pending| {
            pending.input.is_subscription
                && pending.input.transaction_id != matched.input.transaction_id
        });
    let targets = std::iter::once(matched.clone()).chain(siblings);
    let email_hash_for_remember = matched
        .input
        .is_subscription
        .then(|| matched.input.email_hash.clone())
        .flatten();

    let mut items = Vec::new();
    for pending in targets {
        if mark_kofi_pending_claimed_on(&transaction, &pending.input.transaction_id, now)? {
            items.push(apply_pending(&transaction, discord_id, &pending, now)?);
        }
    }
    if items.is_empty() {
        return Ok(ClaimOutcome::NotFound);
    }
    if let Some(email_hash) = email_hash_for_remember {
        remember_kofi_supporter_on(&transaction, &email_hash, discord_id, now)?;
    }
    transaction.commit()?;
    Ok(ClaimOutcome::Claimed { items })
}

/// Activates every purchase for an email HMAC that has already been verified by Discord OAuth.
/// Consent, grants, subscription routing, and claim markers are one all-or-nothing transaction.
pub fn activate_kofi_by_email_hash(
    store: &SqliteStore,
    discord_id: &str,
    email_hash: &str,
    now: i64,
) -> Result<ActivationOutcome, StoreError> {
    let transaction = store.connection().unchecked_transaction()?;
    let targets = unclaimed_kofi_pending_by_email_hash_on(&transaction, email_hash)?;
    if targets.is_empty() {
        return Ok(ActivationOutcome::NotFound);
    }

    let confirmation = ActivationConfirmation {
        id: Uuid::new_v4().to_string(),
        accepted_at: now,
        terms_version: ACTIVATION_TERMS_VERSION.into(),
    };
    let mut items = Vec::new();
    let mut applied_subscription = false;
    for pending in targets {
        if !mark_kofi_pending_claimed_on(&transaction, &pending.input.transaction_id, now)? {
            continue;
        }
        let item = apply_pending(&transaction, discord_id, &pending, now)?;
        record_activation_consent(
            &transaction,
            &pending.input.transaction_id,
            &confirmation,
            discord_id,
        )?;
        applied_subscription |= pending.input.is_subscription;
        items.push(item);
    }
    if items.is_empty() {
        return Ok(ActivationOutcome::NotFound);
    }
    if applied_subscription {
        remember_kofi_supporter_on(&transaction, email_hash, discord_id, now)?;
    }
    transaction.commit()?;
    Ok(ActivationOutcome::Activated {
        items,
        confirmation,
    })
}

fn apply_pending(
    connection: &Connection,
    discord_id: &str,
    pending: &KofiPendingGrant,
    now: i64,
) -> Result<ClaimedKofiItem, StoreError> {
    let expires_at = match pending.input.plan {
        KofiPendingPlan::Plus => {
            grant_user_premium_on(connection, discord_id, pending.input.days, "kofi", now)?
        }
        KofiPendingPlan::Premium => grant_guild_pass_on(
            connection,
            discord_id,
            pending.input.seats,
            pending.input.days,
            "kofi",
            now,
        )?,
    };
    Ok(ClaimedKofiItem {
        plan: pending.input.plan,
        days: pending.input.days,
        seats: pending.input.seats,
        expires_at,
    })
}

fn record_activation_consent(
    connection: &Connection,
    transaction_id: &str,
    confirmation: &ActivationConfirmation,
    discord_id: &str,
) -> Result<(), StoreError> {
    connection.execute(
        "INSERT INTO kofi_activation_consent
         (transaction_id, confirmation_id, discord_id, accepted_at, terms_version, method)
         VALUES (?1, ?2, ?3, ?4, ?5, 'discord_email')",
        params![
            transaction_id,
            confirmation.id,
            discord_id,
            confirmation.accepted_at,
            confirmation.terms_version,
        ],
    )?;
    Ok(())
}

fn is_uuid_shaped(value: &str) -> bool {
    value.len() == 36
        && value.bytes().enumerate().all(|(index, byte)| {
            matches!(index, 8 | 13 | 18 | 23) && byte == b'-'
                || !matches!(index, 8 | 13 | 18 | 23) && byte.is_ascii_hexdigit()
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::KofiPendingGrantInput;

    const NOW: i64 = 1_000_000;
    const DISCORD_ID: &str = "123456789012345678";
    const EMAIL_HASH: &str = "opaque-hmac";

    fn pending(transaction_id: &str) -> KofiPendingGrantInput {
        KofiPendingGrantInput {
            transaction_id: transaction_id.into(),
            email_hash: Some(EMAIL_HASH.into()),
            plan: KofiPendingPlan::Plus,
            days: 30,
            seats: 3,
            is_subscription: false,
        }
    }

    #[test]
    fn receipt_claim_aggregates_only_subscription_renewals_and_binds_them() {
        let store = SqliteStore::open_in_memory().expect("store");
        let mut subscription = pending("subscription");
        subscription.is_subscription = true;
        let mut renewal = pending("renewal");
        renewal.is_subscription = true;
        let gift = pending("gift");
        store
            .record_kofi_pending_grant(&subscription, NOW)
            .expect("sub");
        store
            .record_kofi_pending_grant(&renewal, NOW + 1)
            .expect("renewal");
        store
            .record_kofi_pending_grant(&gift, NOW + 2)
            .expect("gift");

        let result =
            claim_kofi_pending_grant(&store, DISCORD_ID, "subscription", NOW + 10).expect("claim");
        assert!(matches!(result, ClaimOutcome::Claimed { ref items } if items.len() == 2));
        assert_eq!(
            store.kofi_supporter(EMAIL_HASH).expect("supporter"),
            Some(DISCORD_ID.into())
        );
        assert!(
            store
                .unclaimed_kofi_pending_by_transaction("gift")
                .expect("gift")
                .is_some()
        );
    }

    #[test]
    fn receipt_url_is_accepted_but_email_like_input_never_hits_pending_state() {
        let store = SqliteStore::open_in_memory().expect("store");
        let receipt = "281c5c8e-dfa2-439f-bdbb-d3e8ef118ac2";
        store
            .record_kofi_pending_grant(&pending(receipt), NOW)
            .expect("pending");
        assert_eq!(
            claim_kofi_pending_grant(&store, DISCORD_ID, "buyer@example.com", NOW).expect("reject"),
            ClaimOutcome::UseReceiptCode
        );
        assert!(
            store
                .unclaimed_kofi_pending_by_transaction(receipt)
                .expect("still pending")
                .is_some()
        );
        assert!(matches!(
            claim_kofi_pending_grant(
                &store,
                DISCORD_ID,
                &format!("https://ko-fi.com/home/coffeeshop?txid={receipt}&mode=g"),
                NOW + 1,
            )
            .expect("url claim"),
            ClaimOutcome::Claimed { .. }
        ));
    }

    #[test]
    fn email_activation_writes_versioned_consent_and_rolls_back_on_failure() {
        let store = SqliteStore::open_in_memory().expect("store");
        let mut subscription = pending("subscription");
        subscription.is_subscription = true;
        store
            .record_kofi_pending_grant(&pending("shop"), NOW)
            .expect("shop");
        store
            .record_kofi_pending_grant(&subscription, NOW + 1)
            .expect("sub");

        let result = activate_kofi_by_email_hash(&store, DISCORD_ID, EMAIL_HASH, NOW + 10)
            .expect("activation");
        let ActivationOutcome::Activated {
            items,
            confirmation,
        } = result
        else {
            panic!("activated")
        };
        assert_eq!(items.len(), 2);
        assert_eq!(confirmation.terms_version, ACTIVATION_TERMS_VERSION);
        assert_eq!(
            store.kofi_supporter(EMAIL_HASH).expect("supporter"),
            Some(DISCORD_ID.into())
        );
        let consent_count: i64 = store
            .connection()
            .query_row(
                "SELECT COUNT(*) FROM kofi_activation_consent WHERE confirmation_id = ?1",
                [&confirmation.id],
                |row| row.get(0),
            )
            .expect("consent count");
        assert_eq!(consent_count, 2);
    }

    #[test]
    fn failed_consent_rolls_back_pending_claim_and_grant() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .record_kofi_pending_grant(&pending("shop"), NOW)
            .expect("pending");
        store
            .connection()
            .execute_batch(
                "CREATE TRIGGER fail_activation_consent BEFORE INSERT ON kofi_activation_consent
             BEGIN SELECT RAISE(ABORT, 'consent write failed'); END",
            )
            .expect("trigger");

        assert!(activate_kofi_by_email_hash(&store, DISCORD_ID, EMAIL_HASH, NOW + 10).is_err());
        assert!(
            store
                .unclaimed_kofi_pending_by_transaction("shop")
                .expect("pending")
                .is_some()
        );
        assert!(
            !store
                .is_user_premium(DISCORD_ID, NOW + 20)
                .expect("premium")
        );
        assert_eq!(store.kofi_supporter(EMAIL_HASH).expect("supporter"), None);
    }
}
