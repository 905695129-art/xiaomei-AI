-- Trust-based, visitor-scoped level unlocks for creator-configured QR transfers.
-- These rows are NOT payment orders and must never be represented as provider-verified payments.
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS payment_qr_url TEXT;

CREATE TABLE IF NOT EXISTS journey_level_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  level_id UUID NOT NULL REFERENCES experience_levels(id) ON DELETE CASCADE,
  buyer_ref TEXT NOT NULL,
  confirmation_method TEXT NOT NULL CHECK (confirmation_method = 'self_attested_transfer'),
  amount_minor_snapshot INTEGER NOT NULL CHECK (amount_minor_snapshot >= 0),
  currency_snapshot CHAR(3) NOT NULL DEFAULT 'CNY',
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (level_id, buyer_ref)
);
CREATE INDEX IF NOT EXISTS journey_level_unlocks_buyer_idx
  ON journey_level_unlocks(buyer_ref, experience_id, confirmed_at DESC);
