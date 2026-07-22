//! Persisted routing for validated Ko-fi payments.
//!
//! The web adapter supplies an already-HMACed email. This layer deliberately never accepts an
//! email address, so the only durable association remains the opaque email hash.

use rusqlite::OptionalExtension;
use vozen_core::{KofiGrant, KofiPlan};

use crate::{
    KofiPendingGrantInput, KofiPendingPlan, SqliteStore, StoreError,
    kofi_pending::record_kofi_pending_grant_on,
    premium::{grant_guild_pass_on, grant_user_premium_on, record_kofi_transaction_on},
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KofiDelivery {
    pub transaction_id: Option<String>,
    /// HMAC(email), never a clear-text email address.
    pub email_hash: Option<String>,
    pub is_subscription_payment: bool,
    pub is_first_subscription_payment: bool,
    pub grant: KofiGrant,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum KofiDeliveryOutcome {
    Duplicate,
    RenewalApplied {
        discord_id: String,
        expires_at: i64,
    },
    PendingStored {
        transaction_id: String,
    },
    /// A new purchase with no transaction ID cannot be safely claimed by its buyer.
    ManualReconciliationRequired,
}

/// Routes a validated product according to the existing consent model.
///
/// Only a renewal of a previously-bound subscription gets automatic delivery. First payments and
/// all Shop purchases are held pending until the buyer chooses their Discord account and accepts
/// the immediate-delivery terms. The transaction ledger, pending row and eventual renewal grant
/// are atomic so a Ko-fi retry cannot duplicate value.
pub fn process_kofi_delivery(
    store: &SqliteStore,
    delivery: &KofiDelivery,
    now: i64,
) -> Result<KofiDeliveryOutcome, StoreError> {
    let transaction = store.connection().unchecked_transaction()?;
    if let Some(transaction_id) = delivery.transaction_id.as_deref()
        && !record_kofi_transaction_on(&transaction, transaction_id, now)?
    {
        transaction.commit()?;
        return Ok(KofiDeliveryOutcome::Duplicate);
    }

    let renewal = delivery.is_subscription_payment && !delivery.is_first_subscription_payment;
    let discord_id = if renewal {
        delivery
            .email_hash
            .as_deref()
            .map(|email_hash| {
                transaction
                    .query_row(
                        "SELECT discord_id FROM kofi_supporter WHERE email_hash = ?1",
                        [email_hash],
                        |row| row.get::<_, String>(0),
                    )
                    .optional()
            })
            .transpose()?
            .flatten()
    } else {
        None
    };
    if let Some(discord_id) = discord_id {
        let expires_at = apply_grant(&transaction, &discord_id, &delivery.grant, now)?;
        transaction.commit()?;
        return Ok(KofiDeliveryOutcome::RenewalApplied {
            discord_id,
            expires_at,
        });
    }

    let Some(transaction_id) = delivery.transaction_id.as_deref() else {
        transaction.commit()?;
        return Ok(KofiDeliveryOutcome::ManualReconciliationRequired);
    };
    let pending = KofiPendingGrantInput {
        transaction_id: transaction_id.to_owned(),
        email_hash: delivery.email_hash.clone(),
        plan: match delivery.grant.plan {
            KofiPlan::Premium => KofiPendingPlan::Premium,
            KofiPlan::Plus => KofiPendingPlan::Plus,
        },
        days: delivery.grant.days,
        seats: delivery.grant.seats,
        is_subscription: delivery.is_subscription_payment,
    };
    let stored = record_kofi_pending_grant_on(&transaction, &pending, now)?;
    transaction.commit()?;
    if stored {
        Ok(KofiDeliveryOutcome::PendingStored {
            transaction_id: transaction_id.to_owned(),
        })
    } else {
        // This should be unreachable while the transaction ledger is intact, but it stays
        // fail-closed if a legacy pending row collides with an otherwise new delivery.
        Ok(KofiDeliveryOutcome::ManualReconciliationRequired)
    }
}

fn apply_grant(
    connection: &rusqlite::Connection,
    discord_id: &str,
    grant: &KofiGrant,
    now: i64,
) -> Result<i64, StoreError> {
    match grant.plan {
        KofiPlan::Plus => grant_user_premium_on(connection, discord_id, grant.days, "kofi", now),
        KofiPlan::Premium => {
            grant_guild_pass_on(connection, discord_id, grant.seats, grant.days, "kofi", now)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 1_000_000;
    const DISCORD_ID: &str = "123456789012345678";
    const EMAIL_HASH: &str = "opaque-hmac";

    fn delivery(transaction_id: Option<&str>) -> KofiDelivery {
        KofiDelivery {
            transaction_id: transaction_id.map(str::to_owned),
            email_hash: Some(EMAIL_HASH.into()),
            is_subscription_payment: true,
            is_first_subscription_payment: true,
            grant: KofiGrant {
                plan: KofiPlan::Premium,
                days: 30,
                seats: 3,
                discord_id: Some(DISCORD_ID.into()),
                label: "Premium".into(),
            },
        }
    }

    #[test]
    fn first_payment_pends_even_when_payload_contains_a_discord_id() {
        let store = SqliteStore::open_in_memory().expect("store");
        assert_eq!(
            process_kofi_delivery(&store, &delivery(Some("first")), NOW).expect("delivery"),
            KofiDeliveryOutcome::PendingStored {
                transaction_id: "first".into()
            }
        );
        assert!(store.premium_pass(DISCORD_ID).expect("pass").is_none());
        assert!(
            store
                .unclaimed_kofi_pending_by_transaction("first")
                .expect("pending")
                .is_some()
        );
    }

    #[test]
    fn only_bound_renewals_auto_apply_and_retries_are_idempotent() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .remember_kofi_supporter(EMAIL_HASH, DISCORD_ID, NOW)
            .expect("bind");
        let mut renewal = delivery(Some("renewal"));
        renewal.is_first_subscription_payment = false;
        assert!(matches!(
            process_kofi_delivery(&store, &renewal, NOW).expect("first"),
            KofiDeliveryOutcome::RenewalApplied { .. }
        ));
        let expires_at = store
            .premium_pass(DISCORD_ID)
            .expect("pass")
            .expect("pass")
            .expires_at;
        assert_eq!(
            process_kofi_delivery(&store, &renewal, NOW + 1).expect("retry"),
            KofiDeliveryOutcome::Duplicate
        );
        assert_eq!(
            store
                .premium_pass(DISCORD_ID)
                .expect("pass")
                .expect("pass")
                .expires_at,
            expires_at
        );
    }

    #[test]
    fn unbound_renewal_and_missing_transaction_fail_closed_to_pending_or_manual() {
        let store = SqliteStore::open_in_memory().expect("store");
        let mut renewal = delivery(Some("unbound"));
        renewal.is_first_subscription_payment = false;
        assert!(matches!(
            process_kofi_delivery(&store, &renewal, NOW).expect("pending"),
            KofiDeliveryOutcome::PendingStored { .. }
        ));
        assert_eq!(
            process_kofi_delivery(&store, &delivery(None), NOW).expect("manual"),
            KofiDeliveryOutcome::ManualReconciliationRequired
        );
    }
}
