#!/usr/bin/env python3
"""Reclassify a known lifecycle bootstrap window without exposing guild IDs.

The growth collector initially sees every already-installed guild as a new Guild Create. This
operator tool moves that one bootstrap cohort to the reserved ``baseline`` source while preserving
real joins, departures, re-joins and all aggregate history. It is intentionally fail-closed and
creates a verified online SQLite backup before changing anything.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


EVENT_COLUMNS = {
    "joined": "first_joined_at",
    "setup_completed": "setup_completed_at",
    "first_value": "first_value_at",
}


def utc_day(timestamp_ms: int) -> str:
    return datetime.fromtimestamp(timestamp_ms / 1000, timezone.utc).date().isoformat()


def backup_database(source: sqlite3.Connection, database_path: Path) -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_path = database_path.with_name(f"{database_path.name}.pre-growth-baseline-{stamp}")
    with sqlite3.connect(backup_path) as destination:
        source.backup(destination)
        integrity = destination.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise RuntimeError(f"backup integrity check failed: {integrity}")
    return backup_path


def cohort_counts(
    connection: sqlite3.Connection, start_ms: int, end_ms: int
) -> dict[tuple[str, str], int]:
    counts: dict[tuple[str, str], int] = defaultdict(int)
    for event, column in EVENT_COLUMNS.items():
        rows = connection.execute(
            f"""SELECT {column}
                FROM guild_growth_lifecycle
                WHERE first_joined_at >= ? AND first_joined_at < ?
                  AND {column} IS NOT NULL""",
            (start_ms, end_ms),
        )
        for (timestamp_ms,) in rows:
            counts[(utc_day(timestamp_ms), event)] += 1

    rows = connection.execute(
        """SELECT activity.day
           FROM guild_growth_activity_day activity
           INNER JOIN guild_growth_lifecycle lifecycle
             ON lifecycle.guild_id = activity.guild_id
           WHERE lifecycle.first_joined_at >= ? AND lifecycle.first_joined_at < ?""",
        (start_ms, end_ms),
    )
    for (day,) in rows:
        counts[(day, "active")] += 1
    return dict(counts)


def reconcile(database_path: Path, start_ms: int, end_ms: int, expected: int) -> dict[str, object]:
    connection = sqlite3.connect(database_path, timeout=30)
    try:
        connection.execute("PRAGMA busy_timeout = 30000")
        integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise RuntimeError(f"source integrity check failed: {integrity}")

        cohort_size, already_baseline = connection.execute(
            """SELECT COUNT(*),
                      COALESCE(SUM(CASE WHEN install_source = 'baseline' THEN 1 ELSE 0 END), 0)
               FROM guild_growth_lifecycle
               WHERE first_joined_at >= ? AND first_joined_at < ?""",
            (start_ms, end_ms),
        ).fetchone()
        if cohort_size != expected:
            raise RuntimeError(
                f"bootstrap cohort mismatch: expected {expected}, observed {cohort_size}"
            )
        if already_baseline not in (0, expected):
            raise RuntimeError(
                f"partial reconciliation detected: {already_baseline}/{expected} baseline rows"
            )

        counts = cohort_counts(connection, start_ms, end_ms)
        if already_baseline == expected:
            baseline_joins = connection.execute(
                """SELECT COALESCE(SUM(value), 0) FROM growth_daily_metric
                   WHERE product = 'tts' AND source = 'baseline' AND event = 'joined'"""
            ).fetchone()[0]
            if baseline_joins < expected:
                raise RuntimeError("lifecycle is baseline but aggregate reconciliation is incomplete")
            return {
                "status": "already_reconciled",
                "cohort": cohort_size,
                "baselineJoins": baseline_joins,
            }

        backup_path = backup_database(connection, database_path)
        connection.execute("BEGIN IMMEDIATE")
        try:
            for (day, event), value in sorted(counts.items()):
                available = connection.execute(
                    """SELECT COALESCE(value, 0) FROM growth_daily_metric
                       WHERE day = ? AND product = 'tts' AND source = 'unknown' AND event = ?""",
                    (day, event),
                ).fetchone()
                available_value = 0 if available is None else available[0]
                if available_value < value:
                    raise RuntimeError(
                        f"aggregate underflow for {day}/{event}: need {value}, found {available_value}"
                    )
                connection.execute(
                    """INSERT INTO growth_daily_metric (day, product, source, event, value)
                       VALUES (?, 'tts', 'baseline', ?, ?)
                       ON CONFLICT(day, product, source, event)
                       DO UPDATE SET value = value + excluded.value""",
                    (day, event, value),
                )
                connection.execute(
                    """UPDATE growth_daily_metric SET value = value - ?
                       WHERE day = ? AND product = 'tts' AND source = 'unknown' AND event = ?""",
                    (value, day, event),
                )
                connection.execute(
                    """DELETE FROM growth_daily_metric
                       WHERE day = ? AND product = 'tts' AND source = 'unknown'
                         AND event = ? AND value = 0""",
                    (day, event),
                )

            changed = connection.execute(
                """UPDATE guild_growth_lifecycle SET install_source = 'baseline'
                   WHERE first_joined_at >= ? AND first_joined_at < ?""",
                (start_ms, end_ms),
            ).rowcount
            if changed != expected:
                raise RuntimeError(f"expected to update {expected} lifecycle rows, updated {changed}")
            connection.commit()
        except Exception:
            connection.rollback()
            raise

        return {
            "status": "reconciled",
            "cohort": cohort_size,
            "movedEvents": sum(counts.values()),
            "backup": str(backup_path),
        }
    finally:
        connection.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("database", type=Path)
    parser.add_argument("--start-ms", type=int, required=True)
    parser.add_argument("--end-ms", type=int, required=True)
    parser.add_argument("--expected", type=int, required=True)
    args = parser.parse_args()
    print(
        json.dumps(
            reconcile(args.database, args.start_ms, args.end_ms, args.expected),
            separators=(",", ":"),
        )
    )


if __name__ == "__main__":
    main()
