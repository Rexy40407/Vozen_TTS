-- A staging read cache may only start after a complete SQLite-to-Postgres import has reconciled.
-- Keeping this marker in the same private schema makes the gate durable across restarts.
CREATE TABLE IF NOT EXISTS vozen.runtime_migration_state (
  marker TEXT PRIMARY KEY,
  completed_at BIGINT NOT NULL
);

REVOKE ALL ON vozen.runtime_migration_state FROM PUBLIC, anon, authenticated;
