-- Track whether the creator has opened each anonymous journey response.
-- Safe to apply repeatedly during deploys.
ALTER TABLE journey_responses
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS journey_responses_unread_idx
  ON journey_responses(experience_id, updated_at DESC)
  WHERE read_at IS NULL;
