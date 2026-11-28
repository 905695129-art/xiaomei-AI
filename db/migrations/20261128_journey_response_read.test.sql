-- Validate that the inbox read-state column is available after migration.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'journey_responses'
      AND column_name = 'read_at'
  ) THEN
    RAISE EXCEPTION 'JOURNEY_RESPONSE_READ_AT_COLUMN_MISSING';
  END IF;
END $$;
ROLLBACK;
