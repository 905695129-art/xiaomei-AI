-- Optional creator-owned payment QR image. Heart Studio never collects or verifies payment.
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS payment_qr_url TEXT;
