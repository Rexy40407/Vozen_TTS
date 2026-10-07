//! Age-based retention for regenerable speech, independent of cache traffic or size.

use std::{
    io,
    path::Path,
    time::{Duration, SystemTime},
};

pub const AUDIO_CACHE_MAX_AGE: Duration = Duration::from_secs(7 * 24 * 60 * 60);
pub const AUDIO_CACHE_SWEEP_INTERVAL: Duration = Duration::from_secs(60 * 60);

fn expired(modified: SystemTime, now: SystemTime) -> bool {
    // An invalid future timestamp must not grant an unbounded cache lifetime.
    now.duration_since(modified)
        .map_or(true, |age| age >= AUDIO_CACHE_MAX_AGE)
}

async fn remove_if_present(path: &Path) -> io::Result<()> {
    match tokio::fs::remove_file(path).await {
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        result => result,
    }
}

/// Cache hits do not touch mtime: frequently repeated messages still expire.
pub(crate) async fn non_empty_file(path: &Path) -> io::Result<bool> {
    let metadata = match tokio::fs::symlink_metadata(path).await {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(error),
    };
    if !metadata.is_file() {
        return Ok(false);
    }
    if expired(metadata.modified()?, SystemTime::now()) {
        remove_if_present(path).await?;
        return Ok(false);
    }
    Ok(metadata.len() > 0)
}

/// Sweeps only direct cache artifacts, never follows symlinks or traverses arbitrary folders.
/// Missing directories are normal for unused providers. Other errors reach the operator.
pub async fn purge_expired_audio_cache(directory: &Path, now: SystemTime) -> io::Result<usize> {
    let root = match tokio::fs::symlink_metadata(directory).await {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(0),
        Err(error) => return Err(error),
    };
    if !root.is_dir() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "audio cache must be a real directory",
        ));
    }
    let mut entries = tokio::fs::read_dir(directory).await?;
    let mut removed = 0;
    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();
        let metadata = match tokio::fs::symlink_metadata(&path).await {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == io::ErrorKind::NotFound => continue,
            Err(error) => return Err(error),
        };
        if !expired(metadata.modified()?, now) {
            continue;
        }
        if metadata.is_file()
            && matches!(
                path.extension().and_then(|ext| ext.to_str()),
                Some("wav" | "mp3" | "tmp")
            )
        {
            remove_if_present(&path).await?;
            removed += 1;
        } else if metadata.is_dir()
            && path
                .file_name()
                .and_then(|name| name.to_str())
                .and_then(|name| name.strip_prefix(".gtts-"))
                .is_some_and(|id| uuid::Uuid::parse_str(id).is_ok())
        {
            // gTTS can leave input/output behind after a process crash. Do not recursively
            // remove a directory: only its two known payload paths, then the empty workspace.
            for name in ["input.mp3", "output.wav"] {
                let payload = path.join(name);
                match tokio::fs::symlink_metadata(&payload).await {
                    Ok(metadata) if metadata.is_file() => {
                        remove_if_present(&payload).await?;
                        removed += 1;
                    }
                    Ok(_) => {
                        return Err(io::Error::new(
                            io::ErrorKind::InvalidInput,
                            "unexpected gTTS workspace entry",
                        ));
                    }
                    Err(error) if error.kind() == io::ErrorKind::NotFound => {}
                    Err(error) => return Err(error),
                }
            }
            match tokio::fs::remove_dir(&path).await {
                Err(error) if error.kind() == io::ErrorKind::NotFound => {}
                result => result?,
            }
        }
    }
    Ok(removed)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_at(path: &Path, modified: SystemTime) {
        std::fs::write(path, b"audio").unwrap();
        std::fs::File::options()
            .write(true)
            .open(path)
            .unwrap()
            .set_times(std::fs::FileTimes::new().set_modified(modified))
            .unwrap();
    }

    #[test]
    fn cutoff_is_inclusive_and_future_dates_are_not_a_bypass() {
        let now = SystemTime::UNIX_EPOCH + AUDIO_CACHE_MAX_AGE * 2;
        assert!(expired(now - AUDIO_CACHE_MAX_AGE, now));
        assert!(!expired(
            now - AUDIO_CACHE_MAX_AGE + Duration::from_secs(1),
            now
        ));
        assert!(expired(now + Duration::from_secs(1), now));
    }

    #[tokio::test]
    async fn hits_do_not_renew_age_and_stale_hits_delete_payloads() {
        let dir = std::env::temp_dir().join(format!("vozen-retention-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&dir).unwrap();
        let fresh = dir.join("fresh.wav");
        let old = dir.join("old.wav");
        let now = SystemTime::now();
        write_at(&fresh, now - Duration::from_secs(60));
        write_at(&old, now - AUDIO_CACHE_MAX_AGE - Duration::from_secs(60));
        let mtime = std::fs::metadata(&fresh).unwrap().modified().unwrap();
        assert!(non_empty_file(&fresh).await.unwrap());
        assert!(non_empty_file(&fresh).await.unwrap());
        assert_eq!(
            std::fs::metadata(&fresh).unwrap().modified().unwrap(),
            mtime
        );
        assert!(!non_empty_file(&old).await.unwrap());
        assert!(!old.exists());
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[tokio::test]
    async fn idle_sweep_removes_old_audio_temps_but_preserves_fresh_and_unrelated_files() {
        let dir = std::env::temp_dir().join(format!("vozen-retention-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&dir).unwrap();
        // Advance the sweep clock so directory timestamps need no platform-specific API.
        let now = SystemTime::now() + AUDIO_CACHE_MAX_AGE + Duration::from_secs(60);
        let old = now - AUDIO_CACHE_MAX_AGE - Duration::from_secs(60);
        for name in [
            "old.wav",
            ".orphan.wav",
            ".kokoro.tmp",
            "old.mp3",
            "keep.txt",
        ] {
            write_at(&dir.join(name), old);
        }
        write_at(&dir.join("fresh.wav"), now);
        let work = dir.join(format!(".gtts-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&work).unwrap();
        write_at(&work.join("input.mp3"), old);
        write_at(&work.join("output.wav"), old);
        assert_eq!(purge_expired_audio_cache(&dir, now).await.unwrap(), 6);
        assert!(dir.join("fresh.wav").exists());
        assert!(dir.join("keep.txt").exists());
        assert!(!work.exists());
        assert_eq!(purge_expired_audio_cache(&dir, now).await.unwrap(), 0);
        std::fs::remove_dir_all(dir).unwrap();
        assert_eq!(purge_expired_audio_cache(&dir, now).await.unwrap(), 0);
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn symlinks_cannot_read_or_delete_external_audio() {
        let dir = std::env::temp_dir().join(format!("vozen-retention-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&dir).unwrap();
        let outside = dir.with_extension("wav");
        write_at(&outside, SystemTime::now() - AUDIO_CACHE_MAX_AGE * 2);
        std::os::unix::fs::symlink(&outside, dir.join("link.wav")).unwrap();
        assert!(!non_empty_file(&dir.join("link.wav")).await.unwrap());
        assert_eq!(
            purge_expired_audio_cache(&dir, SystemTime::now())
                .await
                .unwrap(),
            0
        );
        assert!(outside.exists());
        let alias = dir.with_extension("alias");
        std::os::unix::fs::symlink(&dir, &alias).unwrap();
        assert!(
            purge_expired_audio_cache(&alias, SystemTime::now())
                .await
                .is_err()
        );
        std::fs::remove_file(alias).unwrap();
        std::fs::remove_file(outside).unwrap();
        std::fs::remove_dir_all(dir).unwrap();
    }
}
