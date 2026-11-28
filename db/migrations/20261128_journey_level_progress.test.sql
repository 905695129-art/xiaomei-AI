-- Verify ordered completion, visitor isolation and idempotent progress.
BEGIN;
DO $$
DECLARE
  v_creator_id UUID;
  v_experience_id UUID;
  first_level UUID;
  second_level UUID;
  buyer_one TEXT := encode(gen_random_bytes(18), 'hex');
  buyer_two TEXT := encode(gen_random_bytes(18), 'hex');
  completed_count INTEGER;
BEGIN
  INSERT INTO users (display_name, role) VALUES ('Progress CI creator', 'creator') RETURNING id INTO v_creator_id;
  INSERT INTO experiences (v_creator_id, slug, title, status)
    VALUES (v_creator_id, 'progress-ci-' || replace(gen_random_uuid()::text, '-', ''), 'Progress CI', 'published')
    RETURNING id INTO v_experience_id;
  INSERT INTO experience_levels (v_experience_id, position, title, price_minor)
    VALUES (v_experience_id, 1, 'First', 100) RETURNING id INTO first_level;
  INSERT INTO experience_levels (v_experience_id, position, title, price_minor)
    VALUES (v_experience_id, 2, 'Second', 100) RETURNING id INTO second_level;
  INSERT INTO buyer_sessions (buyer_ref, token_hash, expires_at) VALUES
    (buyer_one, encode(digest(gen_random_uuid()::text, 'sha256'), 'hex'), now() + interval '1 day'),
    (buyer_two, encode(digest(gen_random_uuid()::text, 'sha256'), 'hex'), now() + interval '1 day');

  IF EXISTS (
    SELECT 1 FROM experience_levels target
    WHERE target.id = second_level AND EXISTS (
      SELECT 1 FROM experience_levels previous
      WHERE previous.v_experience_id = target.v_experience_id
        AND previous.is_active AND previous.position < target.position
        AND NOT EXISTS (SELECT 1 FROM journey_level_progress p WHERE p.level_id = previous.id AND p.buyer_ref = buyer_one)
    )
  ) IS NOT TRUE THEN RAISE EXCEPTION 'SECOND_LEVEL_SHOULD_START_LOCKED'; END IF;

  INSERT INTO journey_level_progress (v_experience_id, level_id, buyer_ref)
    VALUES (v_experience_id, first_level, buyer_one)
    ON CONFLICT (level_id, buyer_ref) DO NOTHING;
  INSERT INTO journey_level_progress (v_experience_id, level_id, buyer_ref)
    VALUES (v_experience_id, first_level, buyer_one)
    ON CONFLICT (level_id, buyer_ref) DO NOTHING;

  SELECT COUNT(*) INTO completed_count FROM journey_level_progress
    WHERE v_experience_id = v_experience_id AND level_id = first_level AND buyer_ref = buyer_one;
  IF completed_count <> 1 THEN RAISE EXCEPTION 'PROGRESS_NOT_IDEMPOTENT'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM experience_levels target
    WHERE target.id = second_level AND NOT EXISTS (
      SELECT 1 FROM experience_levels previous
      WHERE previous.v_experience_id = target.v_experience_id
        AND previous.is_active AND previous.position < target.position
        AND NOT EXISTS (SELECT 1 FROM journey_level_progress p WHERE p.level_id = previous.id AND p.buyer_ref = buyer_one)
    )
  ) THEN RAISE EXCEPTION 'SECOND_LEVEL_DID_NOT_UNLOCK'; END IF;

  IF EXISTS (SELECT 1 FROM journey_level_progress WHERE level_id = first_level AND buyer_ref = buyer_two)
    THEN RAISE EXCEPTION 'PROGRESS_LEAKED_TO_OTHER_VISITOR'; END IF;
END $$;
ROLLBACK;
