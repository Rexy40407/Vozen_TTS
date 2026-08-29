import sqlite3
import tempfile
import unittest
from pathlib import Path

from reconcile_growth_baseline import reconcile


class ReconcileGrowthBaselineTest(unittest.TestCase):
    def test_moves_only_bootstrap_events_and_is_idempotent(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "tts.db"
            with sqlite3.connect(database) as connection:
                connection.executescript(
                    """
                    CREATE TABLE guild_growth_lifecycle (
                      guild_id TEXT PRIMARY KEY, product TEXT NOT NULL,
                      first_joined_at INTEGER NOT NULL, last_joined_at INTEGER NOT NULL,
                      install_source TEXT NOT NULL, setup_completed_at INTEGER,
                      first_value_at INTEGER, last_active_at INTEGER, departed_at INTEGER
                    );
                    CREATE TABLE guild_growth_activity_day (
                      guild_id TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (guild_id, day)
                    );
                    CREATE TABLE growth_daily_metric (
                      day TEXT NOT NULL, product TEXT NOT NULL, source TEXT NOT NULL,
                      event TEXT NOT NULL, value INTEGER NOT NULL,
                      PRIMARY KEY (day, product, source, event)
                    );
                    INSERT INTO guild_growth_lifecycle VALUES
                      ('a','tts',1000,1000,'unknown',2000,3000,3000,NULL),
                      ('b','tts',1100,1100,'unknown',NULL,NULL,4000,NULL),
                      ('c','tts',1200,1200,'unknown',NULL,NULL,NULL,NULL),
                      ('new','tts',5000,5000,'unknown',NULL,NULL,NULL,NULL);
                    INSERT INTO guild_growth_activity_day VALUES
                      ('a','1970-01-01'), ('b','1970-01-01');
                    INSERT INTO growth_daily_metric VALUES
                      ('1970-01-01','tts','unknown','joined',4),
                      ('1970-01-01','tts','unknown','setup_completed',1),
                      ('1970-01-01','tts','unknown','first_value',1),
                      ('1970-01-01','tts','unknown','active',2);
                    """
                )

            first = reconcile(database, 1000, 1300, 3)
            self.assertEqual(first["status"], "reconciled")
            self.assertEqual(first["cohort"], 3)

            with sqlite3.connect(database) as connection:
                baseline = dict(
                    connection.execute(
                        "SELECT event, value FROM growth_daily_metric WHERE source = 'baseline'"
                    )
                )
                self.assertEqual(
                    baseline,
                    {"joined": 3, "setup_completed": 1, "first_value": 1, "active": 2},
                )
                self.assertEqual(
                    connection.execute(
                        "SELECT value FROM growth_daily_metric WHERE source='unknown' AND event='joined'"
                    ).fetchone()[0],
                    1,
                )
                self.assertEqual(
                    connection.execute(
                        "SELECT COUNT(*) FROM guild_growth_lifecycle WHERE install_source='baseline'"
                    ).fetchone()[0],
                    3,
                )

            second = reconcile(database, 1000, 1300, 3)
            self.assertEqual(second["status"], "already_reconciled")


if __name__ == "__main__":
    unittest.main()
