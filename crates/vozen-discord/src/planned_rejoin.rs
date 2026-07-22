//! One-shot recovery authorization for voice sessions after a planned restart.
//!
//! Persisted presence alone must never make a normal guild session rejoin after an unexpected
//! crash. A fresh marker, written only during a clean shutdown/deploy, authorizes recovery once.

use std::{
    collections::BTreeSet,
    fs,
    path::{Path, PathBuf},
    time::{Duration, SystemTime},
};

use serde::{Deserialize, Serialize};
use vozen_store::VoicePresence;

pub const PLANNED_REJOIN_MARKER: &str = ".vozen-rejoin-after-deploy";
pub const MAX_PLANNED_REJOIN_AGE: Duration = Duration::from_secs(10 * 60);

/// A fresh marker can authorize every persisted call (deployment workflow), or only the exact
/// calls that were active during a clean bot shutdown.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PlannedRejoinScope {
    All,
    Guilds(BTreeSet<String>),
}

#[derive(Debug, Serialize)]
struct RejoinMarker<'a> {
    guild_ids: &'a [String],
}

#[derive(Debug, Deserialize)]
struct ParsedRejoinMarker {
    guild_ids: Vec<String>,
}

fn marker_path(directory: &Path) -> PathBuf {
    directory.join(PLANNED_REJOIN_MARKER)
}

/// Records the exact live calls on a clean administrator-initiated shutdown. A failed write is
/// intentionally non-fatal: it should not turn an orderly shutdown into downtime.
pub fn write_planned_rejoin_marker(
    guild_ids: impl IntoIterator<Item = String>,
    directory: &Path,
) -> bool {
    let guild_ids = guild_ids
        .into_iter()
        .filter(|guild_id| !guild_id.trim().is_empty())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    if guild_ids.is_empty() {
        return false;
    }

    serde_json::to_vec(&RejoinMarker {
        guild_ids: &guild_ids,
    })
    .ok()
    .and_then(|payload| fs::write(marker_path(directory), payload).ok())
    .is_some()
}

/// Consumes a deploy/restart marker exactly once. An empty marker, written by the deployment
/// workflow, is the deliberate all-calls fallback. Malformed or stale markers are removed and
/// never authorize a recovery.
pub fn consume_planned_rejoin_marker(
    directory: &Path,
    now: SystemTime,
) -> Option<PlannedRejoinScope> {
    let path = marker_path(directory);
    let metadata = fs::metadata(&path).ok()?;
    let modified = metadata.modified().ok()?;
    let age = now.duration_since(modified).ok()?;
    let raw = fs::read_to_string(&path).ok()?;
    // Consume before parsing, so a malformed marker cannot authorize a later process.
    let _ = fs::remove_file(path);

    if age > MAX_PLANNED_REJOIN_AGE {
        return None;
    }
    if raw.trim().is_empty() {
        return Some(PlannedRejoinScope::All);
    }

    let parsed: ParsedRejoinMarker = serde_json::from_str(&raw).ok()?;
    if parsed
        .guild_ids
        .iter()
        .any(|guild_id| guild_id.trim().is_empty())
    {
        return None;
    }
    Some(PlannedRejoinScope::Guilds(
        parsed.guild_ids.into_iter().collect(),
    ))
}

/// State of a persisted Discord voice channel resolved at startup by the gateway adapter.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RejoinChannelState {
    Ready,
    NoPermissions,
    Gone,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct RejoinPlan {
    pub rejoin: Vec<VoicePresence>,
    pub forget: Vec<String>,
}

/// Creates a pure, fail-closed startup plan. Premium `stay_in_call` may recover without a marker;
/// all other guilds need the current one-shot marker. Deleted channels are forgotten; permission
/// failures remain recorded for a later legitimate restart, but are never joined blindly.
pub fn plan_rejoin(
    presences: Vec<VoicePresence>,
    scope: Option<&PlannedRejoinScope>,
    stay_in_call: impl Fn(&str) -> bool,
    channel_state: impl Fn(&str, &str) -> RejoinChannelState,
) -> RejoinPlan {
    let mut plan = RejoinPlan::default();
    for presence in presences {
        let marker_authorizes = match scope {
            Some(PlannedRejoinScope::All) => true,
            Some(PlannedRejoinScope::Guilds(guild_ids)) => guild_ids.contains(&presence.guild_id),
            None => false,
        };
        if !stay_in_call(&presence.guild_id) && !marker_authorizes {
            plan.forget.push(presence.guild_id);
            continue;
        }

        match channel_state(&presence.guild_id, &presence.channel_id) {
            RejoinChannelState::Ready => plan.rejoin.push(presence),
            RejoinChannelState::Gone => plan.forget.push(presence.guild_id),
            RejoinChannelState::NoPermissions => {}
        }
    }
    plan
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_directory(name: &str) -> PathBuf {
        let directory = std::env::temp_dir().join(format!(
            "vozen-rust-{name}-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .expect("clock after epoch")
                .as_nanos()
        ));
        fs::create_dir_all(&directory).expect("create test directory");
        directory
    }

    fn presence(guild_id: &str, channel_id: &str) -> VoicePresence {
        VoicePresence {
            guild_id: guild_id.into(),
            channel_id: channel_id.into(),
            updated_at: 1,
        }
    }

    #[test]
    fn marker_is_one_shot_and_scoped_to_clean_shutdown_calls() {
        let directory = test_directory("marker");
        assert!(write_planned_rejoin_marker(
            ["guild-a".into(), "guild-a".into(), "guild-b".into()],
            &directory
        ));
        assert_eq!(
            consume_planned_rejoin_marker(&directory, SystemTime::now()),
            Some(PlannedRejoinScope::Guilds(
                ["guild-a".into(), "guild-b".into()].into_iter().collect()
            ))
        );
        assert_eq!(
            consume_planned_rejoin_marker(&directory, SystemTime::now()),
            None
        );
        fs::remove_dir_all(directory).expect("remove test directory");
    }

    #[test]
    fn empty_deploy_marker_authorizes_all_but_stale_marker_does_not() {
        let directory = test_directory("all");
        let path = marker_path(&directory);
        fs::write(&path, "").expect("write deployment marker");
        assert_eq!(
            consume_planned_rejoin_marker(&directory, SystemTime::now()),
            Some(PlannedRejoinScope::All)
        );

        fs::write(&path, r#"{\"guild_ids\":[\"guild-a\"]}"#).expect("write stale marker");
        let stale_now = SystemTime::now() + MAX_PLANNED_REJOIN_AGE + Duration::from_secs(1);
        assert_eq!(consume_planned_rejoin_marker(&directory, stale_now), None);
        assert!(!path.exists());
        fs::remove_dir_all(directory).expect("remove test directory");
    }

    #[test]
    fn normal_calls_need_marker_while_premium_calls_can_recover() {
        let plan = plan_rejoin(
            vec![
                presence("premium", "voice-a"),
                presence("planned", "voice-b"),
                presence("crashed", "voice-c"),
                presence("gone", "voice-d"),
                presence("permissions", "voice-e"),
            ],
            Some(&PlannedRejoinScope::Guilds(
                ["planned".into()].into_iter().collect(),
            )),
            |guild_id| guild_id == "premium",
            |guild_id, _| match guild_id {
                "gone" => RejoinChannelState::Gone,
                "permissions" => RejoinChannelState::NoPermissions,
                _ => RejoinChannelState::Ready,
            },
        );

        assert_eq!(
            plan.rejoin,
            vec![
                presence("premium", "voice-a"),
                presence("planned", "voice-b")
            ]
        );
        assert_eq!(plan.forget, vec!["crashed", "gone"]);
    }
}
