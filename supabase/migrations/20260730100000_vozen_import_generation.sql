ALTER TABLE vozen.runtime_migration_state
  ADD COLUMN IF NOT EXISTS generation TEXT,
  ADD COLUMN IF NOT EXISTS fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS source_checkpoint TEXT;

REVOKE ALL ON vozen.runtime_migration_state FROM PUBLIC, anon, authenticated;
