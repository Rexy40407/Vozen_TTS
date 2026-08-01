-- Keep the initial import attestation separate from the live mirror checkpoint.
-- `fingerprint` and `source_checkpoint` describe the source snapshot used for import;
-- `generation` advances atomically with each applied outbox batch.
ALTER TABLE vozen.runtime_migration_state
  ADD COLUMN IF NOT EXISTS generation TEXT,
  ADD COLUMN IF NOT EXISTS fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS source_checkpoint TEXT;

REVOKE ALL ON vozen.runtime_migration_state FROM PUBLIC, anon, authenticated;
