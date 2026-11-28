-- Exercise the response inbox persistence rules against the disposable CI database.
BEGIN;
DO $$
DECLARE
  v_creator_id UUID;
  v_experience_id UUID;
  v_level_id UUID;
  v_buyer_ref TEXT := encode(gen_random_bytes(18), 'hex');
  found_count INTEGER;
BEGIN
  INSERT INTO users (display_name, role)
  VALUES ('Response CI creator', 'creator')
  RETURNING id INTO v_creator_id;

  INSERT INTO experiences (creator_id, slug, title, status)
  VALUES (v_creator_id, 'response-ci-' || replace(gen_random_uuid()::text, '-', ''), 'Response CI', 'published')
  RETURNING id INTO v_experience_id;

  INSERT INTO experience_levels (experience_id, position, title, price_minor)
  VALUES (v_experience_id, 1, 'Response level', 100)
  RETURNING id INTO v_level_id;

  INSERT INTO buyer_sessions (buyer_ref, token_hash, expires_at)
  VALUES (v_buyer_ref, encode(digest(gen_random_uuid()::text, 'sha256'), 'hex'), now() + interval '1 day');

  INSERT INTO journey_responses (experience_id, level_id, buyer_ref, reaction)
  VALUES (v_experience_id, v_level_id, v_buyer_ref, 'heart');

  INSERT INTO journey_responses (experience_id, level_id, buyer_ref, reaction)
  VALUES (v_experience_id, v_level_id, v_buyer_ref, 'miss_you')
  ON CONFLICT (level_id, buyer_ref)
  DO UPDATE SET reaction = EXCLUDED.reaction, updated_at = now();

  SELECT COUNT(*) INTO found_count
  FROM journey_responses jr
  WHERE jr.experience_id = v_experience_id
    AND jr.level_id = v_level_id
    AND jr.buyer_ref = v_buyer_ref;

  IF found_count <> 1 OR NOT EXISTS (
    SELECT 1 FROM journey_responses jr
    WHERE jr.level_id = v_level_id
      AND jr.buyer_ref = v_buyer_ref
      AND jr.reaction = 'miss_you' AND jr.read_at IS NULL
  ) THEN
    RAISE EXCEPTION 'JOURNEY_RESPONSE_UPSERT_FAILED';
  END IF;

  UPDATE journey_responses SET read_at = now()
  WHERE level_id = v_level_id AND buyer_ref = v_buyer_ref;
  INSERT INTO journey_responses (experience_id, level_id, buyer_ref, reaction)
  VALUES (v_experience_id, v_level_id, v_buyer_ref, 'hug')
  ON CONFLICT (level_id, buyer_ref)
  DO UPDATE SET reaction = EXCLUDED.reaction, updated_at = now(), read_at = NULL;
  IF NOT EXISTS (
    SELECT 1 FROM journey_responses jr
    WHERE jr.level_id = v_level_id AND jr.buyer_ref = v_buyer_ref
      AND jr.reaction = 'hug' AND jr.read_at IS NULL
  ) THEN
    RAISE EXCEPTION 'UPDATED_RESPONSE_NOT_MARKED_UNREAD';
  END IF;

  BEGIN
    INSERT INTO journey_responses (experience_id, level_id, buyer_ref, reaction)
    VALUES (v_experience_id, v_level_id, v_buyer_ref, 'unknown');
    RAISE EXCEPTION 'INVALID_JOURNEY_REACTION_ACCEPTED';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END $$;
ROLLBACK;
