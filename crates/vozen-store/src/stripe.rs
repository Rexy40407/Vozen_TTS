//! Minimal Stripe persistence boundary.
//!
//! Stripe is the payment processor of record. Vozen stores only provider identifiers,
//! entitlement metadata and idempotency evidence; card data, email and addresses never enter
//! this database.

use rusqlite::{OptionalExtension, params};

use crate::{SqliteStore, StoreError};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StripeSubscription {
    pub subscription_id: String,
    pub customer_id: String,
    pub user_id: String,
    pub plan: String,
    pub seats: i64,
    pub current_period_end: i64,
    pub status: String,
    pub updated_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StripeSubscriptionInput {
    pub subscription_id: String,
    pub customer_id: String,
    pub user_id: String,
    pub plan: String,
    pub seats: i64,
    pub current_period_end: i64,
    pub status: String,
    pub updated_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StripeEventInput {
    Checkout {
        subscription_id: String,
        customer_id: String,
        user_id: String,
        plan: String,
        seats: i64,
    },
    InvoicePaid {
        subscription_id: String,
        period_end: Option<i64>,
    },
    SubscriptionUpdated {
        subscription_id: String,
        period_end: Option<i64>,
        status: String,
    },
    InvoiceFailed {
        subscription_id: String,
    },
    Ignored,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StripeEventApplyOutcome {
    Applied,
    AlreadyApplied,
}

impl SqliteStore {
    pub fn upsert_stripe_subscription(
        &self,
        input: &StripeSubscriptionInput,
    ) -> Result<(), StoreError> {
        self.connection().execute(
            "INSERT INTO stripe_subscription
             (subscription_id, customer_id, user_id, plan, seats, current_period_end, status, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(subscription_id) DO UPDATE SET
               customer_id=excluded.customer_id,
               user_id=excluded.user_id,
               plan=excluded.plan,
               seats=excluded.seats,
               current_period_end=excluded.current_period_end,
               status=excluded.status,
               updated_at=excluded.updated_at",
            params![
                input.subscription_id,
                input.customer_id,
                input.user_id,
                input.plan,
                input.seats,
                input.current_period_end,
                input.status,
                input.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn stripe_subscription(&self, id: &str) -> Result<Option<StripeSubscription>, StoreError> {
        self.connection()
            .query_row(
                "SELECT subscription_id, customer_id, user_id, plan, seats,
                        current_period_end, status, updated_at
                 FROM stripe_subscription WHERE subscription_id = ?1",
                [id],
                |row| {
                    Ok(StripeSubscription {
                        subscription_id: row.get(0)?,
                        customer_id: row.get(1)?,
                        user_id: row.get(2)?,
                        plan: row.get(3)?,
                        seats: row.get(4)?,
                        current_period_end: row.get(5)?,
                        status: row.get(6)?,
                        updated_at: row.get(7)?,
                    })
                },
            )
            .optional()
            .map_err(StoreError::from)
    }

    pub fn stripe_customer_for_user(&self, user_id: &str) -> Result<Option<String>, StoreError> {
        self.connection()
            .query_row(
                "SELECT customer_id FROM stripe_subscription
                 WHERE user_id = ?1 ORDER BY updated_at DESC LIMIT 1",
                [user_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(StoreError::from)
    }

    /// Returns false when the event was already processed.
    pub fn record_stripe_event_once(&self, event_id: &str, now: i64) -> Result<bool, StoreError> {
        Ok(self.connection().execute(
            "INSERT OR IGNORE INTO stripe_event (event_id, processed_at) VALUES (?1, ?2)",
            params![event_id, now],
        )? > 0)
    }

    /// Applies a Stripe event and records its idempotency evidence in one SQLite transaction.
    /// A failed grant rolls back the event reservation, allowing Stripe to retry safely.
    pub fn apply_stripe_event_once(
        &self,
        event_id: &str,
        input: &StripeEventInput,
        now: i64,
    ) -> Result<StripeEventApplyOutcome, StoreError> {
        let transaction = self.connection().unchecked_transaction()?;
        let inserted = transaction.execute(
            "INSERT OR IGNORE INTO stripe_event (event_id, processed_at) VALUES (?1, ?2)",
            params![event_id, now],
        )?;
        if inserted == 0 {
            return Ok(StripeEventApplyOutcome::AlreadyApplied);
        }

        match input {
            StripeEventInput::Checkout {
                subscription_id,
                customer_id,
                user_id,
                plan,
                seats,
            } => {
                transaction.execute(
                    "INSERT INTO stripe_subscription
                     (subscription_id, customer_id, user_id, plan, seats, current_period_end, status, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, 0, 'active', ?6)
                     ON CONFLICT(subscription_id) DO UPDATE SET
                       customer_id=excluded.customer_id, user_id=excluded.user_id,
                       plan=excluded.plan, seats=excluded.seats,
                       status=excluded.status, updated_at=excluded.updated_at",
                    params![subscription_id, customer_id, user_id, plan, seats, now],
                )?;
            }
            StripeEventInput::InvoicePaid {
                subscription_id,
                period_end,
            } => {
                let Some(mut subscription) = transaction
                    .query_row(
                        "SELECT subscription_id, customer_id, user_id, plan, seats,
                                current_period_end, status, updated_at
                         FROM stripe_subscription WHERE subscription_id = ?1",
                        [subscription_id],
                        |row| {
                            Ok(StripeSubscription {
                                subscription_id: row.get(0)?,
                                customer_id: row.get(1)?,
                                user_id: row.get(2)?,
                                plan: row.get(3)?,
                                seats: row.get(4)?,
                                current_period_end: row.get(5)?,
                                status: row.get(6)?,
                                updated_at: row.get(7)?,
                            })
                        },
                    )
                    .optional()?
                else {
                    return Err(StoreError::IntegrityCheck(
                        "Stripe invoice references an unknown subscription".into(),
                    ));
                };
                let period_end = period_end.unwrap_or(subscription.current_period_end);
                let end_ms = period_end.saturating_mul(1000);
                let days = ((end_ms.saturating_sub(now) + 86_399_999) / 86_400_000).max(1);
                subscription.current_period_end = end_ms;
                subscription.status = "active".into();
                subscription.updated_at = now;
                transaction.execute(
                    "UPDATE stripe_subscription SET current_period_end=?2, status=?3, updated_at=?4
                     WHERE subscription_id=?1",
                    params![
                        subscription.subscription_id,
                        end_ms,
                        subscription.status,
                        now
                    ],
                )?;
                if subscription.plan == "plus" {
                    crate::premium::grant_user_premium_on(
                        &transaction,
                        &subscription.user_id,
                        days,
                        "stripe",
                        now,
                    )?;
                } else {
                    crate::premium::grant_guild_pass_on(
                        &transaction,
                        &subscription.user_id,
                        subscription.seats,
                        days,
                        "stripe",
                        now,
                    )?;
                }
            }
            StripeEventInput::SubscriptionUpdated {
                subscription_id,
                period_end,
                status,
            } => {
                if let Some(subscription) = transaction
                    .query_row(
                        "SELECT customer_id, user_id, plan, seats, current_period_end
                         FROM stripe_subscription WHERE subscription_id=?1",
                        [subscription_id],
                        |row| {
                            Ok((
                                row.get::<_, String>(0)?,
                                row.get::<_, String>(1)?,
                                row.get::<_, String>(2)?,
                                row.get::<_, i64>(3)?,
                                row.get::<_, i64>(4)?,
                            ))
                        },
                    )
                    .optional()?
                {
                    let period_end = period_end.unwrap_or(subscription.4);
                    transaction.execute(
                        "UPDATE stripe_subscription SET current_period_end=?2, status=?3, updated_at=?4
                         WHERE subscription_id=?1",
                        params![subscription_id, period_end, status, now],
                    )?;
                }
            }
            StripeEventInput::InvoiceFailed { subscription_id } => {
                transaction.execute(
                    "UPDATE stripe_subscription SET status='past_due', updated_at=?2
                     WHERE subscription_id=?1",
                    params![subscription_id, now],
                )?;
            }
            StripeEventInput::Ignored => {}
        }
        transaction.commit()?;
        Ok(StripeEventApplyOutcome::Applied)
    }

    pub fn stripe_event_processed(&self, event_id: &str) -> Result<bool, StoreError> {
        self.connection()
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM stripe_event WHERE event_id = ?1)",
                [event_id],
                |row| row.get::<_, i64>(0),
            )
            .map(|value| value != 0)
            .map_err(StoreError::from)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 1_000_000;

    fn checkout() -> StripeEventInput {
        StripeEventInput::Checkout {
            subscription_id: "sub_test".into(),
            customer_id: "cus_test".into(),
            user_id: "user_test".into(),
            plan: "plus".into(),
            seats: 1,
        }
    }

    #[test]
    fn stripe_event_replay_is_idempotent() {
        let store = SqliteStore::open_in_memory().expect("store");
        assert_eq!(
            store
                .apply_stripe_event_once("evt_checkout", &checkout(), NOW)
                .expect("first"),
            StripeEventApplyOutcome::Applied
        );
        assert_eq!(
            store
                .apply_stripe_event_once("evt_checkout", &checkout(), NOW + 1)
                .expect("replay"),
            StripeEventApplyOutcome::AlreadyApplied
        );
        assert!(
            store
                .stripe_subscription("sub_test")
                .expect("subscription")
                .is_some()
        );
    }

    #[test]
    fn failed_invoice_does_not_leave_idempotency_marker() {
        let store = SqliteStore::open_in_memory().expect("store");
        let result = store.apply_stripe_event_once(
            "evt_unknown_invoice",
            &StripeEventInput::InvoicePaid {
                subscription_id: "missing".into(),
                period_end: Some(2_000),
            },
            NOW,
        );
        assert!(result.is_err());
        assert!(
            !store
                .stripe_event_processed("evt_unknown_invoice")
                .expect("marker")
        );
    }
}
