//! Owner-only runtime measurements for the administration console.
//!
//! The snapshot intentionally contains only coarse process/storage values. It never returns
//! database content, Discord identifiers, or paths from the production host.

use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};

use vozen_api::admin_api::{AdminDatabaseUsageSample, AdminSupabaseMetrics, AdminSystemMetrics};

const HISTORY_DAYS: usize = 7;

pub fn snapshot_with_supabase(
    database_path: &Path,
    active_voice_sessions: usize,
    supabase: Option<AdminSupabaseMetrics>,
) -> AdminSystemMetrics {
    let database_bytes = database_bytes(database_path);
    let volume = volume_usage(database_path.parent().unwrap_or_else(|| Path::new(".")));
    let database_history = record_database_history(database_path, database_bytes, volume);
    AdminSystemMetrics {
        database_bytes,
        volume_total_bytes: volume.map(|value| value.total_bytes),
        volume_used_bytes: volume.map(|value| value.used_bytes),
        volume_available_bytes: volume.map(|value| value.available_bytes),
        active_voice_sessions: u64::try_from(active_voice_sessions).unwrap_or(u64::MAX),
        database_history,
        supabase,
    }
}

/// Records today's aggregate database reading. Repeated calls replace the same day's value, so
/// the file remains small and never turns a dashboard refresh into a time-series write storm.
pub fn record_daily_history(database_path: &Path) {
    let database_bytes = database_bytes(database_path);
    let volume = volume_usage(database_path.parent().unwrap_or_else(|| Path::new(".")));
    let _ = record_database_history(database_path, database_bytes, volume);
}

fn record_database_history(
    database_path: &Path,
    database_bytes: u64,
    volume: Option<VolumeUsage>,
) -> Vec<AdminDatabaseUsageSample> {
    let history_path = history_path(database_path);
    let sample = AdminDatabaseUsageSample {
        day: time::OffsetDateTime::now_utc().date().to_string(),
        database_bytes,
        volume_total_bytes: volume.map(|value| value.total_bytes),
        volume_used_bytes: volume.map(|value| value.used_bytes),
    };
    let history = merge_history(read_history(&history_path), sample);
    write_history(&history_path, &history);
    history
}

fn history_path(database_path: &Path) -> PathBuf {
    PathBuf::from(format!("{}.metrics-history.json", database_path.display()))
}

fn read_history(path: &Path) -> Vec<AdminDatabaseUsageSample> {
    fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

fn write_history(path: &Path, history: &[AdminDatabaseUsageSample]) {
    let Ok(encoded) = serde_json::to_vec(history) else {
        return;
    };
    let temporary = path.with_extension("tmp");
    if fs::write(&temporary, encoded).is_ok() {
        let _ = fs::rename(temporary, path);
    }
}

fn merge_history(
    mut history: Vec<AdminDatabaseUsageSample>,
    sample: AdminDatabaseUsageSample,
) -> Vec<AdminDatabaseUsageSample> {
    history.retain(|entry| entry.day != sample.day);
    history.push(sample);
    history.sort_by(|left, right| left.day.cmp(&right.day));
    if history.len() > HISTORY_DAYS {
        history.drain(..history.len() - HISTORY_DAYS);
    }
    history
}

fn database_bytes(database_path: &Path) -> u64 {
    [
        database_path.to_path_buf(),
        Path::new(&format!("{}-wal", database_path.display())).to_path_buf(),
        Path::new(&format!("{}-shm", database_path.display())).to_path_buf(),
    ]
    .into_iter()
    .filter_map(|path| fs::metadata(path).ok().map(|metadata| metadata.len()))
    .sum()
}

#[derive(Clone, Copy)]
struct VolumeUsage {
    total_bytes: u64,
    used_bytes: u64,
    available_bytes: u64,
}

fn volume_usage(path: &Path) -> Option<VolumeUsage> {
    let output = Command::new("df").arg("-Pk").arg(path).output().ok()?;
    output.status.success().then_some(())?;
    parse_df_output(std::str::from_utf8(&output.stdout).ok()?)
}

fn parse_df_output(output: &str) -> Option<VolumeUsage> {
    let row = output.lines().rev().find(|line| !line.trim().is_empty())?;
    let mut fields = row.split_whitespace();
    let _filesystem = fields.next()?;
    let total_kib = fields.next()?.parse::<u64>().ok()?;
    let used_kib = fields.next()?.parse::<u64>().ok()?;
    let available_kib = fields.next()?.parse::<u64>().ok()?;
    Some(VolumeUsage {
        total_bytes: total_kib.checked_mul(1_024)?,
        used_bytes: used_kib.checked_mul(1_024)?,
        available_bytes: available_kib.checked_mul(1_024)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_posix_df_capacity_without_leaking_mount_data() {
        let usage = parse_df_output(
            "Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/vda1 4096000 1024000 3072000 25% /data\n",
        )
        .expect("usage");
        assert_eq!(usage.total_bytes, 4_194_304_000);
        assert_eq!(usage.used_bytes, 1_048_576_000);
        assert_eq!(usage.available_bytes, 3_145_728_000);
    }

    #[test]
    fn history_replaces_a_daily_reading_and_keeps_only_the_latest_week() {
        let history = (1..=7)
            .map(|day| AdminDatabaseUsageSample {
                day: format!("2026-07-{day:02}"),
                database_bytes: u64::try_from(day).expect("positive test day"),
                volume_total_bytes: Some(100),
                volume_used_bytes: Some(10),
            })
            .collect();
        let history = merge_history(
            history,
            AdminDatabaseUsageSample {
                day: "2026-07-08".into(),
                database_bytes: 8,
                volume_total_bytes: Some(100),
                volume_used_bytes: Some(20),
            },
        );
        assert_eq!(history.len(), HISTORY_DAYS);
        assert_eq!(
            history.first().map(|sample| sample.day.as_str()),
            Some("2026-07-02")
        );
        assert_eq!(history.last().map(|sample| sample.database_bytes), Some(8));

        let updated = merge_history(
            history,
            AdminDatabaseUsageSample {
                day: "2026-07-08".into(),
                database_bytes: 9,
                volume_total_bytes: Some(100),
                volume_used_bytes: Some(21),
            },
        );
        assert_eq!(updated.len(), HISTORY_DAYS);
        assert_eq!(updated.last().map(|sample| sample.database_bytes), Some(9));
    }
}
