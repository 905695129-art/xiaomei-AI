-- Anonymous creator workspaces: users are retained as owners, but no email or
-- password is collected. The normal opaque creator session cookie authorizes edits.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS guest_creator_rate_limits (
  address_hash CHAR(64) PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);
