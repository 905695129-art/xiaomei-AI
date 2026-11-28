BEGIN;
DO $$
DECLARE
  creator_id UUID := gen_random_uuid();
  experience_id UUID := gen_random_uuid();
  level_id UUID := gen_random_uuid();
  inserted_id UUID;
BEGIN
  INSERT INTO users (id, display_name, role) VALUES (creator_id, 'QR unlock migration test', 'creator');
  INSERT INTO experiences (id, creator_id, slug, title, status, payment_qr_url)
  VALUES (experience_id, creator_id, 'qr-unlock-' || replace(creator_id::text, '-', ''), 'QR unlock test', 'published', 'https://assets.example.test/qr.png');
  INSERT INTO experience_levels (id, experience_id, position, title, price_minor, private_content)
  VALUES (level_id, experience_id, 1, 'Test level', 123, 'Private test');
  INSERT INTO journey_level_unlocks
    (experience_id, level_id, buyer_ref, confirmation_method, amount_minor_snapshot, currency_snapshot)
  VALUES (experience_id, level_id, 'buyer-test', 'self_attested_transfer', 123, 'CNY')
  RETURNING id INTO inserted_id;
  IF inserted_id IS NULL THEN RAISE EXCEPTION 'QR_UNLOCK_NOT_CREATED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM journey_level_unlocks
    WHERE level_id = level_id AND buyer_ref = 'buyer-test'
      AND confirmation_method = 'self_attested_transfer' AND amount_minor_snapshot = 123
  ) THEN RAISE EXCEPTION 'QR_UNLOCK_SNAPSHOT_MISSING'; END IF;
  BEGIN
    INSERT INTO journey_level_unlocks
      (experience_id, level_id, buyer_ref, confirmation_method, amount_minor_snapshot, currency_snapshot)
    VALUES (experience_id, level_id, 'buyer-test', 'provider_verified', 123, 'CNY');
    RAISE EXCEPTION 'INVALID_CONFIRMATION_METHOD_WAS_ACCEPTED';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  BEGIN
    INSERT INTO journey_level_unlocks
      (experience_id, level_id, buyer_ref, confirmation_method, amount_minor_snapshot, currency_snapshot)
    VALUES (experience_id, level_id, 'buyer-test', 'self_attested_transfer', 123, 'CNY');
    RAISE EXCEPTION 'DUPLICATE_BUYER_UNLOCK_WAS_ACCEPTED';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  DELETE FROM users WHERE id = creator_id;
END $$;
ROLLBACK;
