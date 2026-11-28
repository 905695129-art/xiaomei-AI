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

ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

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
CREATE INDEX IF NOT EXISTS buyer_sessions_expiry_idx ON buyer_sessions(expires_at);

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
  price_minor INTEGER NOT NULL CHECK (price_minor >= 1),
  private_content TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Existing installations may contain legacy zero-priced levels. Keep those rows
-- readable/editable, but reject every new or updated row until free unlock exists.
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'experience_levels'::regclass
      AND conname = 'experience_levels_price_positive'
  ) THEN
    ALTER TABLE experience_levels
      ADD CONSTRAINT experience_levels_price_positive CHECK (price_minor >= 1) NOT VALID;
  END IF;
END $;
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


-- Atomic per-email authentication throttling (10 attempts per 15-minute window).
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  email TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);

-- Rate-limit authenticated password-change attempts independently per creator account.
CREATE TABLE IF NOT EXISTS password_change_rate_limits (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);

-- Account deletion password verification is independently throttled per creator.
CREATE TABLE IF NOT EXISTS account_delete_rate_limits (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);

-- Email ownership and recovery tokens. Only token hashes are persisted.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_verification_tokens_user_idx
  ON email_verification_tokens(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx
  ON password_reset_tokens(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS email_action_rate_limits (
  email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('verify','password_reset')),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  PRIMARY KEY (email, action)
);


-- Provider webhook idempotency ledger. Store identifiers and hashes, not raw card/payment secrets.
CREATE TABLE IF NOT EXISTS payment_provider_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_sha256 CHAR(64) NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received','processing','processed','failed')),
  order_id UUID REFERENCES orders(id),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  last_error_code TEXT,
  UNIQUE (provider, provider_event_id)
);
CREATE INDEX IF NOT EXISTS payment_events_order_idx
  ON payment_provider_events(order_id, received_at DESC);

-- Refund records are separate from orders so partial/multiple refund attempts remain auditable.
CREATE TABLE IF NOT EXISTS payment_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  provider TEXT NOT NULL,
  provider_refund_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','succeeded','failed','cancelled')),
  reason_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (provider, provider_refund_id)
);
CREATE INDEX IF NOT EXISTS payment_refunds_order_idx
  ON payment_refunds(order_id, created_at DESC);

-- Audit timestamps for order state transitions; additive for existing installations.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;


-- Order lifecycle transition guard. Payment integrations must update status through
-- these allowed transitions; paid/refunded states cannot be reopened as pending.
CREATE OR REPLACE FUNCTION heart_orders_guard_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'pending' AND NEW.status NOT IN ('paid','failed','cancelled') THEN
      RAISE EXCEPTION 'INVALID_ORDER_STATUS_TRANSITION';
    ELSIF OLD.status = 'paid' AND NEW.status NOT IN ('refunded') THEN
      RAISE EXCEPTION 'INVALID_ORDER_STATUS_TRANSITION';
    ELSIF OLD.status IN ('failed','cancelled','refunded') THEN
      RAISE EXCEPTION 'TERMINAL_ORDER_STATUS';
    END IF;
  END IF;

  IF OLD.status = 'paid' AND NEW.status = 'refunded' AND NEW.refunded_at IS NULL THEN
    NEW.refunded_at := now();
  END IF;
  IF NEW.status = 'paid' AND NEW.paid_at IS NULL THEN
    NEW.paid_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_guard_transition ON orders;
CREATE TRIGGER orders_guard_transition
BEFORE UPDATE OF status ON orders
FOR EACH ROW EXECUTE FUNCTION heart_orders_guard_transition();

-- Keep order/entitlement identity aligned even if a future integration writes directly.
CREATE OR REPLACE FUNCTION heart_entitlement_matches_paid_order()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  matched_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO matched_count
  FROM orders o
  WHERE o.id = NEW.order_id
    AND o.status = 'paid'
    AND o.level_id = NEW.level_id
    AND o.buyer_ref = NEW.buyer_ref;
  IF matched_count <> 1 THEN
    RAISE EXCEPTION 'ENTITLEMENT_REQUIRES_MATCHING_PAID_ORDER';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entitlements_require_paid_order ON entitlements;
CREATE TRIGGER entitlements_require_paid_order
BEFORE INSERT OR UPDATE OF order_id, level_id, buyer_ref ON entitlements
FOR EACH ROW EXECUTE FUNCTION heart_entitlement_matches_paid_order();


-- Current MVP refund policy is full-order refunds only. A successful refund
-- revokes the associated paid order, which in turn blocks entitlement reads.
DROP INDEX IF EXISTS payment_refunds_one_success_per_order;
CREATE UNIQUE INDEX IF NOT EXISTS payment_refunds_one_active_per_order
  ON payment_refunds(order_id) WHERE status IN ('pending','succeeded');

CREATE OR REPLACE FUNCTION heart_validate_full_refund()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  order_row orders%ROWTYPE;
BEGIN
  SELECT * INTO order_row FROM orders WHERE id = NEW.order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REFUND_ORDER_NOT_FOUND';
  END IF;
  IF order_row.status <> 'paid' THEN
    RAISE EXCEPTION 'REFUND_REQUIRES_PAID_ORDER';
  END IF;
  IF NEW.amount_minor <> order_row.amount_minor OR NEW.currency <> order_row.currency THEN
    RAISE EXCEPTION 'REFUND_AMOUNT_MUST_MATCH_ORDER';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_refunds_validate ON payment_refunds;
CREATE TRIGGER payment_refunds_validate
BEFORE INSERT OR UPDATE OF order_id, amount_minor, currency ON payment_refunds
FOR EACH ROW EXECUTE FUNCTION heart_validate_full_refund();

CREATE OR REPLACE FUNCTION heart_apply_successful_refund()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'succeeded' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'succeeded') THEN
    UPDATE orders
    SET status = 'refunded', refunded_at = COALESCE(refunded_at, now()), updated_at = now()
    WHERE id = NEW.order_id AND status = 'paid';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'REFUND_ORDER_NOT_PAID';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_refunds_apply_success ON payment_refunds;
CREATE TRIGGER payment_refunds_apply_success
AFTER INSERT OR UPDATE OF status ON payment_refunds
FOR EACH ROW EXECUTE FUNCTION heart_apply_successful_refund();


CREATE OR REPLACE FUNCTION heart_guard_refund_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'succeeded' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'SUCCESSFUL_REFUND_IS_TERMINAL';
  END IF;
  IF OLD.status IN ('failed','cancelled') AND NEW.status NOT IN (OLD.status) THEN
    RAISE EXCEPTION 'TERMINAL_REFUND_STATUS';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_refunds_guard_transition ON payment_refunds;
CREATE TRIGGER payment_refunds_guard_transition
BEFORE UPDATE OF status ON payment_refunds
FOR EACH ROW EXECUTE FUNCTION heart_guard_refund_transition();



-- A provider event's identity and digest are immutable. Processed events are terminal;
-- failed events may be retried after operational review.
CREATE OR REPLACE FUNCTION heart_guard_provider_event()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.provider IS DISTINCT FROM OLD.provider
     OR NEW.provider_event_id IS DISTINCT FROM OLD.provider_event_id
     OR NEW.event_type IS DISTINCT FROM OLD.event_type
     OR NEW.payload_sha256 IS DISTINCT FROM OLD.payload_sha256
     OR (OLD.order_id IS NOT NULL AND NEW.order_id IS DISTINCT FROM OLD.order_id) THEN
    RAISE EXCEPTION 'PAYMENT_EVENT_IDENTITY_IMMUTABLE';
  END IF;
  IF OLD.processing_status = 'processed'
     AND NEW.processing_status IS DISTINCT FROM 'processed' THEN
    RAISE EXCEPTION 'PROCESSED_PAYMENT_EVENT_IS_TERMINAL';
  END IF;
  IF OLD.processing_status = 'received'
     AND NEW.processing_status NOT IN ('received','processing','failed') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_EVENT_TRANSITION';
  END IF;
  IF OLD.processing_status = 'processing'
     AND NEW.processing_status NOT IN ('processing','processed','failed') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_EVENT_TRANSITION';
  END IF;
  IF OLD.processing_status = 'failed'
     AND NEW.processing_status NOT IN ('failed','processing') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_EVENT_TRANSITION';
  END IF;
  IF NEW.processing_status = 'processed' AND NEW.processed_at IS NULL THEN
    NEW.processed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_events_guard ON payment_provider_events;
CREATE TRIGGER payment_events_guard
BEFORE UPDATE ON payment_provider_events
FOR EACH ROW EXECUTE FUNCTION heart_guard_provider_event();



-- Bind each order to the exact creator-owned experience and level. Composite
-- foreign keys prevent mismatched IDs even if a future API has a validation bug.
CREATE UNIQUE INDEX IF NOT EXISTS experiences_id_creator_unique
  ON experiences(id, creator_id);
CREATE UNIQUE INDEX IF NOT EXISTS experiences_id_currency_unique
  ON experiences(id, currency);
CREATE UNIQUE INDEX IF NOT EXISTS levels_id_experience_unique
  ON experience_levels(id, experience_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_experience_creator_fk') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_experience_creator_fk
      FOREIGN KEY (experience_id, creator_id) REFERENCES experiences(id, creator_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_level_experience_fk') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_level_experience_fk
      FOREIGN KEY (level_id, experience_id) REFERENCES experience_levels(id, experience_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_experience_currency_fk') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_experience_currency_fk
      FOREIGN KEY (experience_id, currency) REFERENCES experiences(id, currency);
  END IF;
END $$;

-- Validate server-created pending orders against the locked, current published
-- level. amount_minor is the immutable amount snapshot stored on the order.
CREATE OR REPLACE FUNCTION heart_validate_new_order()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  experience_row experiences%ROWTYPE;
  level_row experience_levels%ROWTYPE;
BEGIN
  IF NEW.status <> 'pending' THEN
    RAISE EXCEPTION 'NEW_ORDER_MUST_START_PENDING';
  END IF;
  IF NEW.buyer_ref IS NULL OR length(trim(NEW.buyer_ref)) < 16 THEN
    RAISE EXCEPTION 'ORDER_BUYER_SESSION_REQUIRED';
  END IF;
  IF NEW.amount_minor <= 0 THEN
    RAISE EXCEPTION 'PAID_ORDER_AMOUNT_MUST_BE_POSITIVE';
  END IF;

  SELECT * INTO experience_row
  FROM experiences
  WHERE id = NEW.experience_id
  FOR SHARE;
  IF NOT FOUND OR experience_row.status <> 'published' THEN
    RAISE EXCEPTION 'EXPERIENCE_NOT_PUBLISHED';
  END IF;
  IF experience_row.creator_id <> NEW.creator_id OR experience_row.currency <> NEW.currency THEN
    RAISE EXCEPTION 'ORDER_CREATOR_OR_CURRENCY_MISMATCH';
  END IF;

  SELECT * INTO level_row
  FROM experience_levels
  WHERE id = NEW.level_id AND experience_id = NEW.experience_id
  FOR SHARE;
  IF NOT FOUND OR NOT level_row.is_active THEN
    RAISE EXCEPTION 'LEVEL_NOT_AVAILABLE';
  END IF;
  IF level_row.price_minor <> NEW.amount_minor THEN
    RAISE EXCEPTION 'ORDER_AMOUNT_MISMATCH';
  END IF;
  IF NEW.provider IS NULL OR NEW.provider = 'disabled' THEN
    RAISE EXCEPTION 'PAYMENT_PROVIDER_NOT_CONFIGURED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_validate_new ON orders;
CREATE TRIGGER orders_validate_new
BEFORE INSERT ON orders
FOR EACH ROW EXECUTE FUNCTION heart_validate_new_order();



-- Order commercial identity is immutable after creation. A provider order ID may
-- be attached once, but never replaced; callbacks must compare provider amounts
-- with this server-created amount_minor snapshot.
CREATE OR REPLACE FUNCTION heart_guard_order_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.experience_id IS DISTINCT FROM OLD.experience_id
     OR NEW.level_id IS DISTINCT FROM OLD.level_id
     OR NEW.creator_id IS DISTINCT FROM OLD.creator_id
     OR NEW.buyer_ref IS DISTINCT FROM OLD.buyer_ref
     OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.provider IS DISTINCT FROM OLD.provider
     OR (OLD.provider_order_id IS NOT NULL AND NEW.provider_order_id IS DISTINCT FROM OLD.provider_order_id) THEN
    RAISE EXCEPTION 'ORDER_COMMERCIAL_IDENTITY_IMMUTABLE';
  END IF;

  -- Permit a narrowly-scoped privacy erasure after the owning creator account
  -- has been soft-deleted; ordinary edits cannot rewrite purchase snapshots.
  IF (NEW.level_title_snapshot IS DISTINCT FROM OLD.level_title_snapshot
      OR NEW.level_position_snapshot IS DISTINCT FROM OLD.level_position_snapshot
      OR NEW.private_content_snapshot IS DISTINCT FROM OLD.private_content_snapshot)
     AND NOT (
       EXISTS (SELECT 1 FROM users u WHERE u.id = OLD.creator_id AND u.deleted_at IS NOT NULL)
       AND NEW.level_title_snapshot = '已删除的关卡'
       AND NEW.level_position_snapshot IS NOT DISTINCT FROM OLD.level_position_snapshot
       AND NEW.private_content_snapshot IS NULL
     ) THEN
    RAISE EXCEPTION 'ORDER_COMMERCIAL_IDENTITY_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_guard_identity ON orders;
CREATE TRIGGER orders_guard_identity
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION heart_guard_order_identity();



-- Snapshot the exact content at order creation, not at a later payment callback.
-- This prevents edits to a level while payment is pending from changing what was bought.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS level_title_snapshot TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS level_position_snapshot INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS private_content_snapshot TEXT;

CREATE OR REPLACE FUNCTION heart_validate_new_order()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  experience_row experiences%ROWTYPE;
  level_row experience_levels%ROWTYPE;
BEGIN
  IF NEW.status <> 'pending' THEN
    RAISE EXCEPTION 'NEW_ORDER_MUST_START_PENDING';
  END IF;
  IF NEW.buyer_ref IS NULL OR length(trim(NEW.buyer_ref)) < 16 THEN
    RAISE EXCEPTION 'ORDER_BUYER_SESSION_REQUIRED';
  END IF;
  IF NEW.amount_minor <= 0 THEN
    RAISE EXCEPTION 'PAID_ORDER_AMOUNT_MUST_BE_POSITIVE';
  END IF;

  SELECT * INTO experience_row FROM experiences WHERE id = NEW.experience_id FOR SHARE;
  IF NOT FOUND OR experience_row.status <> 'published' THEN
    RAISE EXCEPTION 'EXPERIENCE_NOT_PUBLISHED';
  END IF;
  IF experience_row.creator_id <> NEW.creator_id OR experience_row.currency <> NEW.currency THEN
    RAISE EXCEPTION 'ORDER_CREATOR_OR_CURRENCY_MISMATCH';
  END IF;

  SELECT * INTO level_row
  FROM experience_levels
  WHERE id = NEW.level_id AND experience_id = NEW.experience_id
  FOR SHARE;
  IF NOT FOUND OR NOT level_row.is_active THEN
    RAISE EXCEPTION 'LEVEL_NOT_AVAILABLE';
  END IF;
  IF level_row.price_minor <> NEW.amount_minor THEN
    RAISE EXCEPTION 'ORDER_AMOUNT_MISMATCH';
  END IF;
  IF NEW.provider IS NULL OR NEW.provider = 'disabled' THEN
    RAISE EXCEPTION 'PAYMENT_PROVIDER_NOT_CONFIGURED';
  END IF;

  NEW.level_title_snapshot := level_row.title;
  NEW.level_position_snapshot := level_row.position;
  NEW.private_content_snapshot := level_row.private_content;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION heart_entitlement_matches_paid_order()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  order_row orders%ROWTYPE;
BEGIN
  SELECT * INTO order_row
  FROM orders o
  WHERE o.id = NEW.order_id
    AND o.status = 'paid'
    AND o.level_id = NEW.level_id
    AND o.buyer_ref = NEW.buyer_ref
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ENTITLEMENT_REQUIRES_MATCHING_PAID_ORDER';
  END IF;

  NEW.level_title_snapshot := COALESCE(order_row.level_title_snapshot, NEW.level_title_snapshot);
  NEW.level_position_snapshot := COALESCE(order_row.level_position_snapshot, NEW.level_position_snapshot);
  NEW.private_content_snapshot := COALESCE(order_row.private_content_snapshot, NEW.private_content_snapshot);
  NEW.price_minor_snapshot := COALESCE(order_row.amount_minor, NEW.price_minor_snapshot);
  NEW.currency_snapshot := COALESCE(order_row.currency, NEW.currency_snapshot);
  RETURN NEW;
END;
$$;



-- One live checkout per buyer and level. Failed/cancelled/refunded orders do not
-- block a later legitimate retry or repurchase.
CREATE UNIQUE INDEX IF NOT EXISTS orders_one_live_buyer_level
  ON orders(buyer_ref, level_id)
  WHERE status IN ('pending','paid');

-- Require a real, unexpired server-issued buyer session for any new order.
CREATE OR REPLACE FUNCTION heart_validate_new_order()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  experience_row experiences%ROWTYPE;
  level_row experience_levels%ROWTYPE;
  buyer_exists BOOLEAN;
BEGIN
  IF NEW.status <> 'pending' THEN
    RAISE EXCEPTION 'NEW_ORDER_MUST_START_PENDING';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM buyer_sessions
    WHERE buyer_ref = NEW.buyer_ref AND expires_at > now()
  ) INTO buyer_exists;
  IF NOT buyer_exists THEN
    RAISE EXCEPTION 'ORDER_BUYER_SESSION_REQUIRED';
  END IF;
  IF NEW.amount_minor <= 0 THEN
    RAISE EXCEPTION 'PAID_ORDER_AMOUNT_MUST_BE_POSITIVE';
  END IF;

  SELECT * INTO experience_row FROM experiences WHERE id = NEW.experience_id FOR SHARE;
  IF NOT FOUND OR experience_row.status <> 'published' THEN
    RAISE EXCEPTION 'EXPERIENCE_NOT_PUBLISHED';
  END IF;
  IF experience_row.creator_id <> NEW.creator_id OR experience_row.currency <> NEW.currency THEN
    RAISE EXCEPTION 'ORDER_CREATOR_OR_CURRENCY_MISMATCH';
  END IF;

  SELECT * INTO level_row
  FROM experience_levels
  WHERE id = NEW.level_id AND experience_id = NEW.experience_id
  FOR SHARE;
  IF NOT FOUND OR NOT level_row.is_active THEN
    RAISE EXCEPTION 'LEVEL_NOT_AVAILABLE';
  END IF;
  IF level_row.price_minor <> NEW.amount_minor THEN
    RAISE EXCEPTION 'ORDER_AMOUNT_MISMATCH';
  END IF;
  IF NEW.provider IS NULL OR NEW.provider = 'disabled' THEN
    RAISE EXCEPTION 'PAYMENT_PROVIDER_NOT_CONFIGURED';
  END IF;

  NEW.level_title_snapshot := level_row.title;
  NEW.level_position_snapshot := level_row.position;
  NEW.private_content_snapshot := level_row.private_content;
  RETURN NEW;
END;
$$;



-- Atomic finalization primitive for a callback that the application has already
-- authenticated with the provider's signature/certificate. This function does NOT
-- verify signatures; only the trusted server callback handler may call it.
CREATE OR REPLACE FUNCTION heart_finalize_verified_payment(
  p_event_id UUID,
  p_order_id UUID,
  p_provider_order_id TEXT,
  p_amount_minor INTEGER,
  p_currency CHAR(3),
  p_payload_sha256 CHAR(64)
)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  event_row payment_provider_events%ROWTYPE;
  order_row orders%ROWTYPE;
BEGIN
  SELECT * INTO event_row
  FROM payment_provider_events
  WHERE id = p_event_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_EVENT_NOT_FOUND';
  END IF;

  IF event_row.payload_sha256 <> p_payload_sha256 THEN
    RAISE EXCEPTION 'PAYMENT_EVENT_DIGEST_MISMATCH';
  END IF;

  SELECT * INTO order_row
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_ORDER_NOT_FOUND';
  END IF;

  IF event_row.provider <> order_row.provider THEN
    RAISE EXCEPTION 'PAYMENT_PROVIDER_MISMATCH';
  END IF;
  IF event_row.event_type <> 'payment.succeeded' THEN
    RAISE EXCEPTION 'PAYMENT_EVENT_TYPE_NOT_SUCCESS';
  END IF;
  IF event_row.order_id IS NOT NULL AND event_row.order_id <> p_order_id THEN
    RAISE EXCEPTION 'PAYMENT_EVENT_ORDER_MISMATCH';
  END IF;
  IF p_provider_order_id IS NULL OR length(trim(p_provider_order_id)) = 0 THEN
    RAISE EXCEPTION 'PROVIDER_ORDER_ID_REQUIRED';
  END IF;
  IF order_row.provider_order_id IS NOT NULL
     AND order_row.provider_order_id <> p_provider_order_id THEN
    RAISE EXCEPTION 'PROVIDER_ORDER_ID_MISMATCH';
  END IF;
  IF order_row.amount_minor <> p_amount_minor OR order_row.currency <> p_currency THEN
    RAISE EXCEPTION 'PROVIDER_AMOUNT_OR_CURRENCY_MISMATCH';
  END IF;

  IF event_row.processing_status = 'processed' THEN
    IF event_row.order_id = p_order_id
       AND order_row.status = 'paid'
       AND order_row.provider_order_id = p_provider_order_id THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'PAYMENT_EVENT_ALREADY_PROCESSED_WITH_DIFFERENT_ORDER_STATE';
  END IF;

  IF event_row.processing_status <> 'processing' THEN
    RAISE EXCEPTION 'PAYMENT_EVENT_NOT_CLAIMED';
  END IF;

  IF order_row.status = 'paid' THEN
    IF order_row.provider_order_id IS DISTINCT FROM p_provider_order_id THEN
      RAISE EXCEPTION 'PAID_ORDER_PROVIDER_ID_MISMATCH';
    END IF;
  ELSIF order_row.status = 'pending' THEN
    UPDATE orders
    SET status = 'paid',
        provider_order_id = COALESCE(provider_order_id, p_provider_order_id),
        paid_at = COALESCE(paid_at, now()),
        updated_at = now()
    WHERE id = p_order_id;
  ELSE
    RAISE EXCEPTION 'ORDER_NOT_PAYABLE';
  END IF;

  INSERT INTO entitlements (order_id, level_id, buyer_ref)
  VALUES (order_row.id, order_row.level_id, order_row.buyer_ref)
  ON CONFLICT (order_id) DO NOTHING;

  UPDATE payment_provider_events
  SET order_id = p_order_id,
      processing_status = 'processed',
      processed_at = COALESCE(processed_at, now()),
      last_error_code = NULL
  WHERE id = p_event_id;
END;
$$;
REVOKE ALL ON FUNCTION heart_finalize_verified_payment(UUID, UUID, TEXT, INTEGER, CHAR(3), CHAR(64)) FROM PUBLIC;

