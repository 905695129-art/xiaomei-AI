-- Verify ordered completion, visitor isolation and idempotent progress.
BEGIN;
DO $$
DECLARE
  v_creator_id UUID;
  v_experience_id UUID;
  v_first_level UUID;
  v_second_level UUID;
  v_buyer_one TEXT := encode(gen_random_bytes(18), 'hex');
  v_buyer_two TEXT := encode(gen_random_bytes(18), 'hex');
  v_completed_count INTEGER;
BEGIN
  INSERT INTO users (display_name, role) VALUES ('Progress CI creator', 'creator') RETURNING id INTO v_creator_id;
  INSERT INTO experiences (creator_id, slug, title, status)
    VALUES (v_creator_id, 'progress-ci-' || replace(gen_random_uuid()::text, '-', ''), 'Progress CI', 'published')
    RETURNING id INTO v_experience_id;
  INSERT INTO experience_levels (experience_id, position, title, price_minor)
    VALUES (v_experience_id, 1, 'First', 100) RETURNING id INTO v_first_level;
  INSERT INTO experience_levels (experience_id, position, title, price_minor)
    VALUES (v_experience_id, 2, 'Second', 100) RETURNING id INTO v_second_level;
  INSERT INTO buyer_sessions (buyer_ref, token_hash, expires_at) VALUES
    (v_buyer_one, encode(digest(gen_random_uuid()::text, 'sha256'), 'hex'), now() + interval '1 day'),
    (v_buyer_two, encode(digest(gen_random_uuid()::text, 'sha256'), 'hex'), now() + interval '1 day');

  IF NOT EXISTS (
    SELECT 1 FROM experience_levels target
    WHERE target.id = v_second_level AND EXISTS (
      SELECT 1 FROM experience_levels previous
      WHERE previous.experience_id = target.experience_id
        AND previous.is_active AND previous.position < target.position
        AND NOT EXISTS (SELECT 1 FROM journey_level_progress p WHERE p.level_id = previous.id AND p.buyer_ref = v_buyer_one)
    )
  ) THEN RAISE EXCEPTION 'SECOND_LEVEL_SHOULD_START_LOCKED'; END IF;

  INSERT INTO journey_level_progress (experience_id, level_id, buyer_ref)
    VALUES (v_experience_id, v_first_level, v_buyer_one)
    ON CONFLICT (level_id, buyer_ref) DO NOTHING;
  INSERT INTO journey_level_progress (experience_id, level_id, buyer_ref)
    VALUES (v_experience_id, v_first_level, v_buyer_one)
    ON CONFLICT (level_id, buyer_ref) DO NOTHING;

  SELECT COUNT(*) INTO v_completed_count FROM journey_level_progress
    WHERE experience_id = v_experience_id AND level_id = v_first_level AND buyer_ref = v_buyer_one;
  IF v_completed_count <> 1 THEN RAISE EXCEPTION 'PROGRESS_NOT_IDEMPOTENT'; END IF;

  IF EXISTS (
    SELECT 1 FROM experience_levels target
    WHERE target.id = v_second_level AND EXISTS (
      SELECT 1 FROM experience_levels previous
      WHERE previous.experience_id = target.experience_id
        AND previous.is_active AND previous.position < target.position
        AND NOT EXISTS (SELECT 1 FROM journey_level_progress p WHERE p.level_id = previous.id AND p.buyer_ref = v_buyer_one)
    )
  ) THEN RAISE EXCEPTION 'SECOND_LEVEL_DID_NOT_UNLOCK'; END IF;

  IF EXISTS (SELECT 1 FROM journey_level_progress WHERE level_id = v_first_level AND buyer_ref = v_buyer_two)
    THEN RAISE EXCEPTION 'PROGRESS_LEAKED_TO_OTHER_VISITOR'; END IF;
END $$;
ROLLBACK;
