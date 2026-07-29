-- Apply one local SQLite durable-table change inside the private Vozen schema.
-- This is called only by the server-side staging pooler worker. No Data API role has schema
-- usage or EXECUTE access, and the function intentionally validates both the table and action.
CREATE OR REPLACE FUNCTION vozen.apply_replica_event(p_event JSONB)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = pg_catalog, vozen
AS $$
DECLARE
  v_table TEXT := p_event->>'table';
  v_operation TEXT := p_event->>'operation';
  v_row JSONB := p_event->'row';
  v_relation REGCLASS;
  v_columns TEXT;
  v_primary_key_columns TEXT;
  v_update_columns TEXT;
  v_predicate TEXT;
BEGIN
  IF v_table IS NULL
     OR v_table !~ '^[a-z_][a-z0-9_]*$'
     OR v_table NOT IN (
       'blocklist', 'channel_profile', 'discord_premium_entitlement', 'guild_config',
       'premium_guild', 'premium_pass', 'premium_pass_activation', 'premium_user',
       'pronunciation', 'pronunciation_user', 'tts_lang_detect_on', 'tts_optout',
       'user_effect', 'user_voice'
     )
     OR v_operation NOT IN ('upsert', 'delete')
     OR jsonb_typeof(v_row) <> 'object' THEN
    RAISE EXCEPTION 'invalid Vozen replica event';
  END IF;

  v_relation := to_regclass(format('vozen.%I', v_table));
  IF v_relation IS NULL THEN
    RAISE EXCEPTION 'unknown Vozen replica table';
  END IF;

  SELECT string_agg(quote_ident(attribute.attname), ', ' ORDER BY attribute.attnum)
    INTO v_columns
    FROM pg_attribute AS attribute
   WHERE attribute.attrelid = v_relation
     AND attribute.attnum > 0
     AND NOT attribute.attisdropped;

  SELECT string_agg(quote_ident(attribute.attname), ', ' ORDER BY key_column.ordinality)
    INTO v_primary_key_columns
    FROM pg_index AS index_definition
    CROSS JOIN LATERAL unnest(index_definition.indkey)
      WITH ORDINALITY AS key_column(attribute_number, ordinality)
    JOIN pg_attribute AS attribute
      ON attribute.attrelid = index_definition.indrelid
     AND attribute.attnum = key_column.attribute_number
   WHERE index_definition.indrelid = v_relation
     AND index_definition.indisprimary;

  IF v_primary_key_columns IS NULL THEN
    RAISE EXCEPTION 'Vozen replica table has no primary key';
  END IF;

  IF v_operation = 'delete' THEN
    SELECT string_agg(
             format('target.%1$I IS NOT DISTINCT FROM source.%1$I', attribute.attname),
             ' AND ' ORDER BY key_column.ordinality
           )
      INTO v_predicate
      FROM pg_index AS index_definition
      CROSS JOIN LATERAL unnest(index_definition.indkey)
        WITH ORDINALITY AS key_column(attribute_number, ordinality)
      JOIN pg_attribute AS attribute
        ON attribute.attrelid = index_definition.indrelid
       AND attribute.attnum = key_column.attribute_number
     WHERE index_definition.indrelid = v_relation
       AND index_definition.indisprimary;
    EXECUTE format(
      'DELETE FROM vozen.%1$I AS target
       USING jsonb_populate_record(NULL::vozen.%1$I, $1) AS source
       WHERE %2$s',
      v_table,
      v_predicate
    ) USING v_row;
    RETURN;
  END IF;

  SELECT string_agg(
           format('%1$I = EXCLUDED.%1$I', attribute.attname),
           ', ' ORDER BY attribute.attnum
         )
    INTO v_update_columns
    FROM pg_attribute AS attribute
   WHERE attribute.attrelid = v_relation
     AND attribute.attnum > 0
     AND NOT attribute.attisdropped
     AND NOT EXISTS (
       SELECT 1
         FROM pg_index AS index_definition
         CROSS JOIN LATERAL unnest(index_definition.indkey)
           AS key_column(attribute_number)
        WHERE index_definition.indrelid = v_relation
          AND index_definition.indisprimary
          AND key_column.attribute_number = attribute.attnum
     );

  EXECUTE format(
    'INSERT INTO vozen.%1$I (%2$s)
     SELECT %2$s FROM jsonb_populate_record(NULL::vozen.%1$I, $1) AS source
     ON CONFLICT (%3$s) DO %4$s',
    v_table,
    v_columns,
    v_primary_key_columns,
    CASE WHEN v_update_columns IS NULL THEN 'NOTHING'
         ELSE 'UPDATE SET ' || v_update_columns END
  ) USING v_row;
END;
$$;

REVOKE ALL ON FUNCTION vozen.apply_replica_event(JSONB) FROM PUBLIC, anon, authenticated;
