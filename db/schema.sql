-- Heart Studio PostgreSQL schema. Apply with: psql "$DATABASE_URL" -f db/schema.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  password_hash TEXT,
  display_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'creator' CHECK (role IN ('creator','admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS creator_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS creator_sessions_user_idx ON creator_sessions(user_id);
CREATE INDEX IF NOT EXISTS creator_sessions_expiry_idx ON creator_sessions(expires_at);

CREATE TABLE IF NOT EXISTS buyer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_ref TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cover_url TEXT,
  cover_position TEXT NOT NULL DEFAULT 'center' CHECK (cover_position IN ('top','center','bottom')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  currency CHAR(3) NOT NULL DEFAULT 'CNY',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS cover_position TEXT NOT NULL DEFAULT 'center';
CREATE INDEX IF NOT EXISTS experiences_creator_idx ON experiences(creator_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS experiences_public_idx ON experiences(slug, status);

CREATE TABLE IF NOT EXISTS experience_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 30),
  title TEXT NOT NULL,
  teaser TEXT NOT NULL DEFAULT '',
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
  private_content TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS levels_active_position_unique ON experience_levels(experience_id, position) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS levels_experience_idx ON experience_levels(experience_id, is_active, position);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id UUID NOT NULL REFERENCES experiences(id),
  level_id UUID NOT NULL REFERENCES experience_levels(id),
  creator_id UUID NOT NULL REFERENCES users(id),
  buyer_ref TEXT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'CNY',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded','cancelled')),
  provider TEXT NOT NULL DEFAULT 'disabled',
  provider_order_id TEXT UNIQUE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_creator_idx ON orders(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_buyer_idx ON orders(buyer_ref, status);

CREATE TABLE IF NOT EXISTS entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id),
  level_id UUID NOT NULL REFERENCES experience_levels(id),
  buyer_ref TEXT NOT NULL,
  -- Immutable purchase-time snapshot: later creator edits must not rewrite a buyer's purchase.
  level_title_snapshot TEXT,
  level_position_snapshot INTEGER,
  private_content_snapshot TEXT,
  price_minor_snapshot INTEGER,
  currency_snapshot CHAR(3),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS level_title_snapshot TEXT;
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS level_position_snapshot INTEGER;
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS private_content_snapshot TEXT;
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS price_minor_snapshot INTEGER;
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS currency_snapshot CHAR(3);
CREATE INDEX IF NOT EXISTS entitlements_lookup_idx ON entitlements(buyer_ref, level_id);

-- Payment callbacks must be verified by the provider before changing orders to paid
-- and creating entitlements in one database transaction. Never trust client redirects.

-- Additive migration for share-page appearance; safe to run on existing databases.
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'rose';
