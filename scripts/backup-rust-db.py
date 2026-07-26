#!/usr/bin/env python3
"""Create and verify a consistent online backup of the production Rust SQLite DB."""

from __future__ import annotations

import argparse
import os
import sqlite3
import tempfile
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path


def verify(connection: sqlite3.Connection, label: str) -> None:
    integrity = connection.execute("PRAGMA integrity_check").fetchone()
    if integrity is None or integrity[0] != "ok":
        result = "missing result" if integrity is None else str(integrity[0])
        raise RuntimeError(f"{label} integrity_check failed: {result}")

    foreign_key_errors = connection.execute("PRAGMA foreign_key_check").fetchall()
    if foreign_key_errors:
        raise RuntimeError(
            f"{label} foreign_key_check found {len(foreign_key_errors)} violation(s)"
        )


def backup(source: Path, destination_dir: Path) -> Path:
    source = source.resolve(strict=True)
    destination_dir.mkdir(parents=True, exist_ok=True)
    destination_dir = destination_dir.resolve(strict=True)

    timestamp = datetime.now(UTC).strftime("%Y-%m-%dT%H-%M-%SZ")
    destination = destination_dir / f"tts-rust-predeploy-{timestamp}.db"

    file_descriptor, temporary_name = tempfile.mkstemp(
        prefix=".tts-rust-predeploy-",
        suffix=".db.tmp",
        dir=destination_dir,
    )
    os.close(file_descriptor)
    temporary = Path(temporary_name)

    try:
        source_uri = f"{source.as_uri()}?mode=ro"
        with closing(
            sqlite3.connect(source_uri, uri=True, timeout=30)
        ) as source_db:
            verify(source_db, "source database")
            with closing(sqlite3.connect(temporary)) as backup_db:
                source_db.backup(backup_db)
                verify(backup_db, "backup database")

        os.chmod(temporary, 0o600)
        os.replace(temporary, destination)
        return destination
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--destination-dir", type=Path, required=True)
    args = parser.parse_args()

    destination = backup(args.source, args.destination_dir)
    print(f"Verified SQLite backup: {destination} ({destination.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
