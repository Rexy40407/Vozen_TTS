//! Single-use Premium/Plus gift-code persistence.
//!
//! Code claim and entitlement grant happen in the same SQLite transaction. A failed grant must
//! roll the claim back; otherwise a purchaser could lose a paid code during a transient fault.

use rusqlite::{Connection, OptionalExtension, params};

use crate::premium::{grant_guild_pass_on, grant_user_premium_on};
use crate::{SqliteStore, StoreError};

type PremiumCodeRow = (
    String,
    String,
    i64,
    i64,
    String,
    i64,
    Option<i64>,
    Option<String>,
    Option<i64>,
);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PremiumCodePlan {
    Premium,
    Plus,
}

impl PremiumCodePlan {
    fn as_str(self) -> &'static str {
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
pub struct PremiumCodeInput {
    pub code: String,
    pub plan: PremiumCodePlan,
    pub days: i64,
    pub seats: i64,
    pub created_by: String,
    pub created_at: i64,
    /// The code's own expiry, not the duration of the entitlement it grants.
    pub expires_at: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PremiumCode {
    pub input: PremiumCodeInput,
    pub redeemed_by: Option<String>,
    pub redeemed_at: Option<i64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RedeemCodeStatus {
    Redeemed,
    NotFound,
    Used,
    Expired,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RedeemCodeResult {
    pub status: RedeemCodeStatus,
    pub plan: Option<PremiumCodePlan>,
    pub days: Option<i64>,
    pub seats: Option<i64>,
    pub granted_expires_at: Option<i64>,
}

impl RedeemCodeResult {
    fn unavailable(status: RedeemCodeStatus) -> Self {
        Self {
            status,
            plan: None,
            days: None,
            seats: None,
            granted_expires_at: None,
        }
    }
}

impl SqliteStore {
    /// Inserts a code only if it does not collide with a previously generated code.
    pub fn insert_premium_code(&self, input: &PremiumCodeInput) -> Result<bool, StoreError> {
        Ok(self.connection().execute(
            "INSERT OR IGNORE INTO premium_code
             (code, plan, days, seats, created_by, created_at, expires_at, redeemed_by, redeemed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, NULL)",
            params![
                input.code,
                input.plan.as_str(),
                input.days,
                input.seats,
                input.created_by,
                input.created_at,
                input.expires_at,
            ],
        )? > 0)
    }

    pub fn premium_code(&self, code: &str) -> Result<Option<PremiumCode>, StoreError> {
        premium_code_from(self.connection(), code)
    }

    /// Claims a code and grants Plus or a Premium pass in a single transaction. `source=redeem`
    /// is deliberately fixed to match the current slash-command provenance.
    pub fn redeem_premium_code(
        &self,
        code: &str,
        user_id: &str,
        now: i64,
    ) -> Result<RedeemCodeResult, StoreError> {
        let transaction = self.connection().unchecked_transaction()?;
        let result = match premium_code_from(&transaction, code)? {
            None => RedeemCodeResult::unavailable(RedeemCodeStatus::NotFound),
            Some(code) if code.redeemed_by.is_some() => {
                RedeemCodeResult::unavailable(RedeemCodeStatus::Used)
            }
            Some(code) if code.input.expires_at.is_some_and(|expiry| expiry <= now) => {
                RedeemCodeResult::unavailable(RedeemCodeStatus::Expired)
            }
            Some(code) => {
                let claimed = transaction.execute(
                    "UPDATE premium_code SET redeemed_by = ?1, redeemed_at = ?2
                     WHERE code = ?3 AND redeemed_by IS NULL",
                    params![user_id, now, code.input.code],
                )?;
                if claimed == 0 {
                    RedeemCodeResult::unavailable(RedeemCodeStatus::Used)
                } else {
                    let granted_expires_at = match code.input.plan {
                        PremiumCodePlan::Plus => grant_user_premium_on(
                            &transaction,
                            user_id,
                            code.input.days,
                            "redeem",
                            now,
                        )?,
                        PremiumCodePlan::Premium => grant_guild_pass_on(
                            &transaction,
                            user_id,
                            code.input.seats,
                            code.input.days,
                            "redeem",
                            now,
                        )?,
                    };
                    RedeemCodeResult {
                        status: RedeemCodeStatus::Redeemed,
                        plan: Some(code.input.plan),
                        days: Some(code.input.days),
                        seats: Some(code.input.seats),
                        granted_expires_at: Some(granted_expires_at),
                    }
                }
            }
        };
        transaction.commit()?;
        Ok(result)
    }
}

fn premium_code_from(
    connection: &Connection,
    code: &str,
) -> Result<Option<PremiumCode>, StoreError> {
    let raw: Option<PremiumCodeRow> = connection
        .query_row(
            "SELECT code, plan, days, seats, created_by, created_at, expires_at, redeemed_by, redeemed_at
             FROM premium_code WHERE code = ?1",
            [code],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                    row.get(7)?,
                    row.get(8)?,
                ))
            },
        )
        .optional()?;
    raw.map(
        |(
            code,
            plan,
            days,
            seats,
            created_by,
            created_at,
            expires_at,
            redeemed_by,
            redeemed_at,
        )| {
            Ok(PremiumCode {
                input: PremiumCodeInput {
                    code,
                    plan: PremiumCodePlan::from_database(plan)?,
                    days,
                    seats,
                    created_by,
                    created_at,
                    expires_at,
                },
                redeemed_by,
                redeemed_at,
            })
        },
    )
    .transpose()
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 1_000_000;

    fn code(plan: PremiumCodePlan) -> PremiumCodeInput {
        PremiumCodeInput {
            code: "VOZEN-AAAA-BBBB".into(),
            plan,
            days: 30,
            seats: 3,
            created_by: "owner".into(),
            created_at: NOW,
            expires_at: None,
        }
    }

    #[test]
    fn plus_code_is_single_use_and_grants_to_the_redeemer() {
        let store = SqliteStore::open_in_memory().expect("store");
        let input = code(PremiumCodePlan::Plus);
        assert!(store.insert_premium_code(&input).expect("insert"));
        assert!(!store.insert_premium_code(&input).expect("collision"));
        let result = store
            .redeem_premium_code(&input.code, "recipient", NOW)
            .expect("redeem");
        assert_eq!(result.status, RedeemCodeStatus::Redeemed);
        assert!(store.is_user_premium("recipient", NOW + 1).expect("plus"));
        assert_eq!(
            store
                .redeem_premium_code(&input.code, "other", NOW + 1)
                .expect("reuse")
                .status,
            RedeemCodeStatus::Used
        );
    }

    #[test]
    fn premium_code_grants_a_pass_and_expired_codes_remain_unused() {
        let store = SqliteStore::open_in_memory().expect("store");
        let premium = code(PremiumCodePlan::Premium);
        store.insert_premium_code(&premium).expect("insert");
        let redeemed = store
            .redeem_premium_code(&premium.code, "recipient", NOW)
            .expect("redeem");
        assert_eq!(redeemed.plan, Some(PremiumCodePlan::Premium));
        assert_eq!(
            store
                .premium_pass("recipient")
                .expect("pass")
                .expect("exists")
                .seats,
            3
        );

        let mut expired = code(PremiumCodePlan::Plus);
        expired.code = "VOZEN-EXPIRED".into();
        expired.expires_at = Some(NOW);
        store.insert_premium_code(&expired).expect("expired code");
        assert_eq!(
            store
                .redeem_premium_code(&expired.code, "recipient", NOW)
                .expect("expiry")
                .status,
            RedeemCodeStatus::Expired
        );
        assert_eq!(
            store
                .premium_code(&expired.code)
                .expect("read")
                .expect("code")
                .redeemed_by,
            None
        );
    }

    #[test]
    fn malformed_database_plan_fails_closed_before_it_can_be_redeemed() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .connection()
            .execute(
                "INSERT INTO premium_code
             (code, plan, days, seats, created_by, created_at, redeemed_by, redeemed_at)
             VALUES ('VOZEN-BAD-PLAN', 'unknown', 30, 3, 'owner', ?1, NULL, NULL)",
                [NOW],
            )
            .expect("seed malformed row");
        assert!(matches!(
            store.redeem_premium_code("VOZEN-BAD-PLAN", "recipient", NOW),
            Err(StoreError::InvalidPremiumCodePlan(plan)) if plan == "unknown"
        ));
        assert_eq!(
            store
                .connection()
                .query_row(
                    "SELECT redeemed_by FROM premium_code WHERE code = 'VOZEN-BAD-PLAN'",
                    [],
                    |row| row.get::<_, Option<String>>(0),
                )
                .expect("unclaimed"),
            None
        );
    }
}
