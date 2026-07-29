//! Owner-only runtime measurements for the administration console.
//!
//! The snapshot intentionally contains only coarse process/storage values. It never returns
//! database content, Discord identifiers, or paths from the production host.

use std::{fs, path::Path, process::Command};

use vozen_api::admin_api::AdminSystemMetrics;

pub fn snapshot(database_path: &Path, active_voice_sessions: usize) -> AdminSystemMetrics {
    let database_bytes = database_bytes(database_path);
    let volume = volume_usage(database_path.parent().unwrap_or_else(|| Path::new(".")));
    AdminSystemMetrics {
        database_bytes,
        volume_total_bytes: volume.map(|value| value.total_bytes),
        volume_used_bytes: volume.map(|value| value.used_bytes),
        volume_available_bytes: volume.map(|value| value.available_bytes),
        active_voice_sessions: u64::try_from(active_voice_sessions).unwrap_or(u64::MAX),
    }
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
}
