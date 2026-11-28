-- Verify ordered completion, atomic response/progress persistence, visitor isolation and idempotency.
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
  v_response_count INTEGER;
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

  -- A second-level response must be rejected before the first level is completed.
  WITH eligible AS MATERIALIZED (
    SELECT e.id AS experience_id, l.id AS level_id, b.buyer_ref
    FROM experiences e
    JOIN experience_levels l ON l.experience_id = e.id AND l.is_active = TRUE
    JOIN buyer_sessions b ON b.buyer_ref = v_buyer_one AND b.expires_at > now()
    WHERE e.id = v_experience_id AND e.status = 'published' AND l.id = v_second_level
      AND NOT EXISTS (
        SELECT 1 FROM experience_levels previous
        WHERE previous.experience_id = l.experience_id
          AND previous.is_active = TRUE AND previous.position < l.position
          AND NOT EXISTS (
            SELECT 1 FROM journey_level_progress progress
            WHERE progress.level_id = previous.id AND progress.buyer_ref = b.buyer_ref
          )
      )
  )
  INSERT INTO journey_responses (experience_id, level_id, buyer_ref, reaction, message)
  SELECT experience_id, level_id, buyer_ref, 'heart', 'Should remain locked' FROM eligible;
  GET DIAGNOSTICS v_response_count = ROW_COUNT;
  IF v_response_count <> 0 THEN RAISE EXCEPTION 'LOCKED_LEVEL_ACCEPTED_RESPONSE'; END IF;

  -- Mirror the route's single-statement write: response and progress are persisted together.
  WITH eligible AS MATERIALIZED (
    SELECT e.id AS experience_id, l.id AS level_id, b.buyer_ref
    FROM experiences e
    JOIN experience_levels l ON l.experience_id = e.id AND l.is_active = TRUE
    JOIN buyer_sessions b ON b.buyer_ref = v_buyer_one AND b.expires_at > now()
    WHERE e.id = v_experience_id AND e.status = 'published' AND l.id = v_first_level
      AND NOT EXISTS (
        SELECT 1 FROM experience_levels previous
        WHERE previous.experience_id = l.experience_id
          AND previous.is_active = TRUE AND previous.position < l.position
          AND NOT EXISTS (
            SELECT 1 FROM journey_level_progress progress
            WHERE progress.level_id = previous.id AND progress.buyer_ref = b.buyer_ref
          )
      )
  ), saved_response AS (
    INSERT INTO journey_responses (experience_id, level_id, buyer_ref, reaction, message)
    SELECT experience_id, level_id, buyer_ref, 'heart', 'First level completed' FROM eligible
    ON CONFLICT (level_id, buyer_ref)
    DO UPDATE SET reaction = EXCLUDED.reaction, message = EXCLUDED.message, updated_at = now(), read_at = NULL
    RETURNING id
  ), saved_progress AS (
    INSERT INTO journey_level_progress (experience_id, level_id, buyer_ref)
    SELECT experience_id, level_id, buyer_ref FROM eligible
    WHERE EXISTS (SELECT 1 FROM saved_response)
    ON CONFLICT (level_id, buyer_ref) DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO v_completed_count FROM saved_response;

  IF v_completed_count <> 1 THEN RAISE EXCEPTION 'FIRST_LEVEL_RESPONSE_NOT_SAVED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM journey_level_progress WHERE level_id = v_first_level AND buyer_ref = v_buyer_one)
    THEN RAISE EXCEPTION 'RESPONSE_DID_NOT_COMPLETE_LEVEL'; END IF;

  -- The second level unlocks only after the first response and progress commit.
  IF EXISTS (
    SELECT 1 FROM experience_levels target
    WHERE target.id = v_second_level AND EXISTS (
      SELECT 1 FROM experience_levels previous
      WHERE previous.experience_id = target.experience_id
        AND previous.is_active AND previous.position < target.position
        AND NOT EXISTS (SELECT 1 FROM journey_level_progress p WHERE p.level_id = previous.id AND p.buyer_ref = v_buyer_one)
    )
  ) THEN RAISE EXCEPTION 'SECOND_LEVEL_DID_NOT_UNLOCK'; END IF;

  INSERT INTO journey_level_progress (experience_id, level_id, buyer_ref)
    VALUES (v_experience_id, v_first_level, v_buyer_one)
    ON CONFLICT (level_id, buyer_ref) DO NOTHING;
  SELECT COUNT(*) INTO v_completed_count FROM journey_level_progress
    WHERE experience_id = v_experience_id AND level_id = v_first_level AND buyer_ref = v_buyer_one;
  IF v_completed_count <> 1 THEN RAISE EXCEPTION 'PROGRESS_NOT_IDEMPOTENT'; END IF;

  IF EXISTS (SELECT 1 FROM journey_level_progress WHERE level_id = v_first_level AND buyer_ref = v_buyer_two)
    THEN RAISE EXCEPTION 'PROGRESS_LEAKED_TO_OTHER_VISITOR'; END IF;
  IF EXISTS (SELECT 1 FROM journey_responses WHERE level_id = v_first_level AND buyer_ref = v_buyer_two)
    THEN RAISE EXCEPTION 'RESPONSE_LEAKED_TO_OTHER_VISITOR'; END IF;
END $$;
ROLLBACK;
