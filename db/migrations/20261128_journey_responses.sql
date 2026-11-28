-- Persist one latest emotional response per anonymous visitor and level.
-- Safe to apply repeatedly during deploys.
CREATE TABLE IF NOT EXISTS journey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  level_id UUID NOT NULL REFERENCES experience_levels(id) ON DELETE CASCADE,
  buyer_ref TEXT NOT NULL REFERENCES buyer_sessions(buyer_ref) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('heart','miss_you','hug')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (level_id, buyer_ref)
);
CREATE INDEX IF NOT EXISTS journey_responses_experience_idx
  ON journey_responses(experience_id, updated_at DESC);
