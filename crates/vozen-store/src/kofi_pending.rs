//! Pending Ko-fi purchases that could not yet be attributed to a Discord account.
//!
//! Only a transaction ID or a separately verified Discord-account email may be used by the
//! future claim API. This store intentionally treats the email value as an opaque HMAC key.

use rusqlite::{Connection, OptionalExtension, params};

use crate::{SqliteStore, StoreError};

pub const PENDING_RETENTION_MS: i64 = 90 * 24 * 60 * 60 * 1_000;
pub const ADMIN_PENDING_SCAN_CAP: i64 = 500;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KofiPendingPlan {
    Premium,
    Plus,
}

impl KofiPendingPlan {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Premium => "premium",
            Self::Plus => "plus",
        }
    }

    fn from_database(value: String) -> Result<Self, StoreError> {
        match value.as_str() {
            "premium" => Ok(Self::Premium),
            "plus" => Ok(Self::Plus),
            _ => Err(StoreError::InvalidPremiumCodePlan(value)),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KofiPendingGrantInput {
    pub transaction_id: String,
    /// HMAC(email), never a clear-text email.
    pub email_hash: Option<String>,
    pub plan: KofiPendingPlan,
    pub days: i64,
    pub seats: i64,
    /// Shop purchases are false. Only membership rows may rebind email to Discord on claim.
    pub is_subscription: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KofiPendingGrant {
    pub input: KofiPendingGrantInput,
    pub created_at: i64,
    pub claimed_at: Option<i64>,
}

type KofiPendingRow = (
    String,
    Option<String>,
    String,
    i64,
    i64,
    i64,
    Option<i64>,
    i64,
);

impl SqliteStore {
    /// Returns true only for the first delivery of a transaction ID.
    pub fn record_kofi_pending_grant(
        &self,
        input: &KofiPendingGrantInput,
        now: i64,
    ) -> Result<bool, StoreError> {
        record_kofi_pending_grant_on(self.connection(), input, now)
    }

    pub fn unclaimed_kofi_pending_by_transaction(
        &self,
        transaction_id: &str,
    ) -> Result<Option<KofiPendingGrant>, StoreError> {
        unclaimed_kofi_pending_by_transaction_on(self.connection(), transaction_id)
    }

    pub fn unclaimed_kofi_pending_by_email_hash(
        &self,
        email_hash: &str,
    ) -> Result<Vec<KofiPendingGrant>, StoreError> {
        unclaimed_kofi_pending_by_email_hash_on(self.connection(), email_hash)
    }

    /// Bounded owner-only overview, ordered newest first. It never returns a clear-text email.
    pub fn all_unclaimed_kofi_pending(
        &self,
        cap: i64,
    ) -> Result<Vec<KofiPendingGrant>, StoreError> {
        let cap = cap.clamp(1, ADMIN_PENDING_SCAN_CAP);
        let mut statement = self.connection().prepare(
            "SELECT transaction_id, email_hash, plan, days, seats, created_at, claimed_at, is_subscription
             FROM kofi_pending WHERE claimed_at IS NULL ORDER BY created_at DESC LIMIT ?1",
        )?;
        statement
            .query_map([cap], pending_from_row)?
            .collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .map(pending_from_raw)
            .collect()
    }

    /// Conditional update is the single-use boundary for a later claim transaction.
    pub fn mark_kofi_pending_claimed(
        &self,
        transaction_id: &str,
        now: i64,
    ) -> Result<bool, StoreError> {
        mark_kofi_pending_claimed_on(self.connection(), transaction_id, now)
    }

    /// Removes claimed and unclaimed pending records before the caller-provided cutoff.
    pub fn purge_old_kofi_pending(&self, cutoff: i64) -> Result<usize, StoreError> {
        Ok(self
            .connection()
            .execute("DELETE FROM kofi_pending WHERE created_at < ?1", [cutoff])?)
    }
}

pub(crate) fn record_kofi_pending_grant_on(
    connection: &Connection,
    input: &KofiPendingGrantInput,
    now: i64,
) -> Result<bool, StoreError> {
    Ok(connection.execute(
        "INSERT OR IGNORE INTO kofi_pending
         (transaction_id, email_hash, plan, days, seats, created_at, claimed_at, is_subscription)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7)",
        params![
            input.transaction_id,
            input.email_hash,
            input.plan.as_str(),
            input.days,
            input.seats,
            now,
            i64::from(input.is_subscription),
        ],
    )? > 0)
}

pub(crate) fn unclaimed_kofi_pending_by_transaction_on(
    connection: &Connection,
    transaction_id: &str,
) -> Result<Option<KofiPendingGrant>, StoreError> {
    pending_from(
        connection,
        "SELECT transaction_id, email_hash, plan, days, seats, created_at, claimed_at, is_subscription
         FROM kofi_pending WHERE transaction_id = ?1 AND claimed_at IS NULL",
        [transaction_id],
    )
}

pub(crate) fn unclaimed_kofi_pending_by_email_hash_on(
    connection: &Connection,
    email_hash: &str,
) -> Result<Vec<KofiPendingGrant>, StoreError> {
    pending_list(
        connection,
        "SELECT transaction_id, email_hash, plan, days, seats, created_at, claimed_at, is_subscription
         FROM kofi_pending WHERE email_hash = ?1 AND claimed_at IS NULL ORDER BY created_at",
        [email_hash],
    )
}

pub(crate) fn mark_kofi_pending_claimed_on(
    connection: &Connection,
    transaction_id: &str,
    now: i64,
) -> Result<bool, StoreError> {
    Ok(connection.execute(
        "UPDATE kofi_pending SET claimed_at = ?1
             WHERE transaction_id = ?2 AND claimed_at IS NULL",
        params![now, transaction_id],
    )? > 0)
}

fn pending_from(
    connection: &Connection,
    sql: &str,
    parameter: [&str; 1],
) -> Result<Option<KofiPendingGrant>, StoreError> {
    connection
        .query_row(sql, parameter, pending_from_row)
        .optional()?
        .map(pending_from_raw)
        .transpose()
}

fn pending_list(
    connection: &Connection,
    sql: &str,
    parameter: [&str; 1],
) -> Result<Vec<KofiPendingGrant>, StoreError> {
    let mut statement = connection.prepare(sql)?;
    statement
        .query_map(parameter, pending_from_row)?
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .map(pending_from_raw)
        .collect()
}

fn pending_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<KofiPendingRow> {
    Ok((
        row.get(0)?,
        row.get(1)?,
        row.get(2)?,
        row.get(3)?,
        row.get(4)?,
        row.get(5)?,
        row.get(6)?,
        row.get(7)?,
    ))
}

fn pending_from_raw(
    (transaction_id, email_hash, plan, days, seats, created_at, claimed_at, is_subscription): KofiPendingRow,
) -> Result<KofiPendingGrant, StoreError> {
    Ok(KofiPendingGrant {
        input: KofiPendingGrantInput {
            transaction_id,
            email_hash,
            plan: KofiPendingPlan::from_database(plan)?,
            days,
            seats,
            is_subscription: is_subscription == 1,
        },
        created_at,
        claimed_at,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 1_000_000;

    fn pending(transaction_id: &str) -> KofiPendingGrantInput {
        KofiPendingGrantInput {
            transaction_id: transaction_id.into(),
            email_hash: Some("opaque-hmac".into()),
            plan: KofiPendingPlan::Plus,
            days: 30,
            seats: 0,
            is_subscription: false,
        }
    }

    #[test]
    fn pending_deliveries_are_idempotent_and_claimed_once() {
        let store = SqliteStore::open_in_memory().expect("store");
        let input = pending("transaction");
        assert!(store.record_kofi_pending_grant(&input, NOW).expect("first"));
        assert!(
            !store
                .record_kofi_pending_grant(&input, NOW + 1)
                .expect("retry")
        );
        assert_eq!(
            store
                .unclaimed_kofi_pending_by_transaction("transaction")
                .expect("read")
                .expect("pending")
                .claimed_at,
            None
        );
        assert!(
            store
                .mark_kofi_pending_claimed("transaction", NOW + 2)
                .expect("claim")
        );
        assert!(
            !store
                .mark_kofi_pending_claimed("transaction", NOW + 3)
                .expect("repeat")
        );
        assert!(
            store
                .unclaimed_kofi_pending_by_transaction("transaction")
                .expect("read")
                .is_none()
        );
    }

    #[test]
    fn hashes_group_unclaimed_renewals_but_null_never_matches() {
        let store = SqliteStore::open_in_memory().expect("store");
        let first = pending("one");
        let mut second = pending("two");
        second.is_subscription = true;
        let mut no_email = pending("three");
        no_email.email_hash = None;
        store.record_kofi_pending_grant(&first, NOW).expect("one");
        store
            .record_kofi_pending_grant(&second, NOW + 1)
            .expect("two");
        store
            .record_kofi_pending_grant(&no_email, NOW + 2)
            .expect("three");
        assert_eq!(
            store
                .unclaimed_kofi_pending_by_email_hash("opaque-hmac")
                .expect("hash")
                .into_iter()
                .map(|grant| grant.input.transaction_id)
                .collect::<Vec<_>>(),
            vec!["one", "two"]
        );
        assert_eq!(store.purge_old_kofi_pending(NOW + 2).expect("purge"), 2);
        assert!(
            store
                .unclaimed_kofi_pending_by_transaction("three")
                .expect("remaining")
                .is_some()
        );
    }
}
