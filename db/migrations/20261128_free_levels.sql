-- Permit creators to mark a level as free (price_minor = 0).
-- Keep the constraint idempotent for existing deployments.
ALTER TABLE experience_levels DROP CONSTRAINT IF EXISTS experience_levels_price_positive;
ALTER TABLE experience_levels
  ADD CONSTRAINT experience_levels_price_positive CHECK (price_minor >= 0) NOT VALID;
