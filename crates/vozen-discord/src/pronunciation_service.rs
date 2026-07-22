//! SQLite-backed pronunciation mutation service.
//!
//! It returns semantic data only. A gateway adapter is responsible for the existing localized
//! text and modal UI, keeping this layer safe to test without Discord and without persisting any
//! display names or interaction tokens.

use std::sync::{Arc, Mutex};

use vozen_core::PronunciationEntry;
use vozen_store::{
    AddPronunciationResult, SERVER_PRON_LIMIT, SERVER_PRON_LIMIT_PREMIUM, SqliteStore,
    USER_PRON_LIMIT_FREE, USER_PRON_LIMIT_PREMIUM,
};

use crate::{PronunciationCommand, PronunciationScope};

pub struct PronunciationInvocation<'a> {
    pub user_id: &'a str,
    pub guild_id: Option<&'a str>,
    pub can_manage_guild: bool,
    pub now_ms: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PronunciationOutcome {
    List {
        scope: PronunciationScope,
        entries: Vec<PronunciationEntry>,
        limit: usize,
    },
    OpenAddForm {
        scope: PronunciationScope,
    },
    Added {
        scope: PronunciationScope,
        term: String,
        replacement: String,
        limit: usize,
    },
    Limit {
        scope: PronunciationScope,
        limit: usize,
    },
    Removed {
        scope: PronunciationScope,
        term: String,
    },
    NotFound {
        scope: PronunciationScope,
        term: String,
    },
    NeedsManageGuild,
    GuildRequired,
    StoreUnavailable,
}

pub struct PronunciationService {
    store: Arc<Mutex<SqliteStore>>,
}

impl PronunciationService {
    #[must_use]
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Self {
        Self { store }
    }

    pub fn execute(
        &self,
        invocation: PronunciationInvocation<'_>,
        command: PronunciationCommand,
    ) -> PronunciationOutcome {
        let scope = match command {
            PronunciationCommand::List { scope }
            | PronunciationCommand::OpenAddForm { scope }
            | PronunciationCommand::Add { scope, .. }
            | PronunciationCommand::Remove { scope, .. } => scope,
        };
        if scope == PronunciationScope::Server && !invocation.can_manage_guild {
            return PronunciationOutcome::NeedsManageGuild;
        }
        if scope == PronunciationScope::Server && invocation.guild_id.is_none() {
            return PronunciationOutcome::GuildRequired;
        }
        let store = match self.store.lock() {
            Ok(store) => store,
            Err(_) => return PronunciationOutcome::StoreUnavailable,
        };
        let limit = match limit_for(&store, scope, &invocation) {
            Ok(limit) => limit,
            Err(()) => return PronunciationOutcome::StoreUnavailable,
        };
        match command {
            PronunciationCommand::List { .. } => match scope {
                PronunciationScope::Personal => {
                    match store.get_user_pronunciations(invocation.user_id) {
                        Ok(entries) => PronunciationOutcome::List {
                            scope,
                            entries,
                            limit,
                        },
                        Err(_) => PronunciationOutcome::StoreUnavailable,
                    }
                }
                PronunciationScope::Server => match store.get_server_pronunciations(
                    invocation
                        .guild_id
                        .expect("server scope has a checked guild"),
                ) {
                    Ok(entries) => PronunciationOutcome::List {
                        scope,
                        entries,
                        limit,
                    },
                    Err(_) => PronunciationOutcome::StoreUnavailable,
                },
            },
            PronunciationCommand::OpenAddForm { .. } => PronunciationOutcome::OpenAddForm { scope },
            PronunciationCommand::Add {
                term, replacement, ..
            } => {
                let result = match scope {
                    PronunciationScope::Personal => {
                        store.add_user_pronunciation(invocation.user_id, &term, &replacement, limit)
                    }
                    PronunciationScope::Server => store.add_server_pronunciation(
                        invocation
                            .guild_id
                            .expect("server scope has a checked guild"),
                        &term,
                        &replacement,
                        limit,
                    ),
                };
                match result {
                    Ok(AddPronunciationResult::Ok) => PronunciationOutcome::Added {
                        scope,
                        term,
                        replacement,
                        limit,
                    },
                    Ok(AddPronunciationResult::Limit) => {
                        PronunciationOutcome::Limit { scope, limit }
                    }
                    Err(_) => PronunciationOutcome::StoreUnavailable,
                }
            }
            PronunciationCommand::Remove { term, .. } => {
                let result = match scope {
                    PronunciationScope::Personal => {
                        store.remove_user_pronunciation(invocation.user_id, &term)
                    }
                    PronunciationScope::Server => store.remove_server_pronunciation(
                        invocation
                            .guild_id
                            .expect("server scope has a checked guild"),
                        &term,
                    ),
                };
                match result {
                    Ok(true) => PronunciationOutcome::Removed { scope, term },
                    Ok(false) => PronunciationOutcome::NotFound { scope, term },
                    Err(_) => PronunciationOutcome::StoreUnavailable,
                }
            }
        }
    }
}

fn limit_for(
    store: &SqliteStore,
    scope: PronunciationScope,
    invocation: &PronunciationInvocation<'_>,
) -> Result<usize, ()> {
    match scope {
        PronunciationScope::Server => store
            .is_guild_premium(
                invocation
                    .guild_id
                    .expect("server scope has a checked guild"),
                invocation.now_ms,
            )
            .map(|premium| {
                if premium {
                    SERVER_PRON_LIMIT_PREMIUM
                } else {
                    SERVER_PRON_LIMIT
                }
            })
            .map_err(|_| ()),
        PronunciationScope::Personal => {
            let user_premium = store
                .is_user_premium(invocation.user_id, invocation.now_ms)
                .map_err(|_| ())?;
            let guild_premium = invocation
                .guild_id
                .map(|guild_id| store.is_guild_premium(guild_id, invocation.now_ms))
                .transpose()
                .map_err(|_| ())?
                .unwrap_or(false);
            Ok(if user_premium || guild_premium {
                USER_PRON_LIMIT_PREMIUM
            } else {
                USER_PRON_LIMIT_FREE
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 1_700_000_000_000;

    fn service() -> (Arc<Mutex<SqliteStore>>, PronunciationService) {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        (store.clone(), PronunciationService::new(store))
    }

    fn personal(
        command: PronunciationCommand,
    ) -> (PronunciationInvocation<'static>, PronunciationCommand) {
        (
            PronunciationInvocation {
                user_id: "user",
                guild_id: Some("guild"),
                can_manage_guild: false,
                now_ms: NOW,
            },
            command,
        )
    }

    #[test]
    fn personal_entries_are_scoped_and_respect_effective_premium_limit() {
        let (store, service) = service();
        for term in ["a", "b", "c"] {
            let (invocation, command) = personal(PronunciationCommand::Add {
                scope: PronunciationScope::Personal,
                term: term.into(),
                replacement: "say".into(),
            });
            assert!(matches!(
                service.execute(invocation, command),
                PronunciationOutcome::Added { limit: 3, .. }
            ));
        }
        let (invocation, command) = personal(PronunciationCommand::Add {
            scope: PronunciationScope::Personal,
            term: "d".into(),
            replacement: "say".into(),
        });
        assert_eq!(
            service.execute(invocation, command),
            PronunciationOutcome::Limit {
                scope: PronunciationScope::Personal,
                limit: 3
            }
        );
        store
            .lock()
            .expect("store")
            .grant_guild_premium("guild", 1, "test", NOW)
            .expect("premium");
        let (invocation, command) = personal(PronunciationCommand::Add {
            scope: PronunciationScope::Personal,
            term: "d".into(),
            replacement: "say".into(),
        });
        assert!(matches!(
            service.execute(invocation, command),
            PronunciationOutcome::Added { limit: 50, .. }
        ));
    }

    #[test]
    fn server_mutations_fail_closed_without_manage_guild_and_never_touch_personal_entries() {
        let (_store, service) = service();
        let command = PronunciationCommand::Add {
            scope: PronunciationScope::Server,
            term: "vozen".into(),
            replacement: "voz en".into(),
        };
        let (invocation, _) = personal(command.clone());
        assert_eq!(
            service.execute(invocation, command.clone()),
            PronunciationOutcome::NeedsManageGuild
        );

        let manager = PronunciationInvocation {
            user_id: "user",
            guild_id: Some("guild"),
            can_manage_guild: true,
            now_ms: NOW,
        };
        assert!(matches!(
            service.execute(manager, command),
            PronunciationOutcome::Added {
                scope: PronunciationScope::Server,
                ..
            }
        ));
        let (invocation, list) = personal(PronunciationCommand::List {
            scope: PronunciationScope::Personal,
        });
        assert!(matches!(
            service.execute(invocation, list),
            PronunciationOutcome::List { entries, .. } if entries.is_empty()
        ));
    }

    #[test]
    fn lists_removes_and_modal_fallback_remain_semantic_and_content_free() {
        let (_store, service) = service();
        let (invocation, form) = personal(PronunciationCommand::OpenAddForm {
            scope: PronunciationScope::Personal,
        });
        assert_eq!(
            service.execute(invocation, form),
            PronunciationOutcome::OpenAddForm {
                scope: PronunciationScope::Personal
            }
        );
        let (invocation, add) = personal(PronunciationCommand::Add {
            scope: PronunciationScope::Personal,
            term: "gg".into(),
            replacement: "good game".into(),
        });
        assert!(matches!(
            service.execute(invocation, add),
            PronunciationOutcome::Added { .. }
        ));
        let (invocation, remove) = personal(PronunciationCommand::Remove {
            scope: PronunciationScope::Personal,
            term: "gg".into(),
        });
        assert!(matches!(
            service.execute(invocation, remove),
            PronunciationOutcome::Removed { .. }
        ));
        let (invocation, second) = personal(PronunciationCommand::Remove {
            scope: PronunciationScope::Personal,
            term: "gg".into(),
        });
        assert!(matches!(
            service.execute(invocation, second),
            PronunciationOutcome::NotFound { .. }
        ));
    }
}
