-- A visitor completes a level by sending one of the existing emotional reactions.
-- Progress is scoped to the opaque buyer session and is idempotent.
CREATE TABLE IF NOT EXISTS journey_level_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  level_id UUID NOT NULL REFERENCES experience_levels(id) ON DELETE CASCADE,
  buyer_ref TEXT NOT NULL REFERENCES buyer_sessions(buyer_ref) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (level_id, buyer_ref)
);
CREATE INDEX IF NOT EXISTS journey_level_progress_buyer_idx
  ON journey_level_progress(buyer_ref, experience_id, completed_at);
