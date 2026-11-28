-- Optional short note attached to the visitor's latest response on a level.
-- Safe to apply repeatedly during deploys.
ALTER TABLE journey_responses
  ADD COLUMN IF NOT EXISTS message TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'journey_responses'::regclass
      AND conname = 'journey_responses_message_length_check'
  ) THEN
    ALTER TABLE journey_responses
      ADD CONSTRAINT journey_responses_message_length_check
      CHECK (char_length(message) <= 500);
  END IF;
END $$;
