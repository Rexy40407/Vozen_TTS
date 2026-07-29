-- SQLite stores all integer values as signed 64-bit values.  Millisecond timestamps
-- therefore exceed PostgreSQL's 32-bit INTEGER range; keep the replica schema lossless.
DO $$
DECLARE
    column_record RECORD;
BEGIN
    FOR column_record IN
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'vozen'
          AND data_type = 'integer'
    LOOP
        EXECUTE format(
            'ALTER TABLE vozen.%I ALTER COLUMN %I TYPE BIGINT',
            column_record.table_name,
            column_record.column_name
        );
    END LOOP;
END $$;
