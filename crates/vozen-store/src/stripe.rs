//! Minimal Stripe persistence boundary.
//!
//! Stripe is the payment processor of record. Vozen stores only provider identifiers,
//! entitlement metadata and idempotency evidence; card data, email and addresses never enter
//! this database.

use rusqlite::params;

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

use rusqlite::OptionalExtension;
