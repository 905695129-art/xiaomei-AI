-- Exercise the response inbox persistence rules against the disposable CI database.
BEGIN;
DO $$
DECLARE
  creator_id UUID;
  experience_id UUID;
  level_id UUID;
  buyer_ref_value TEXT := encode(gen_random_bytes(18), 'hex');
  found_count INTEGER;
BEGIN
  INSERT INTO users (display_name, role) VALUES ('Response CI creator', 'creator')
  RETURNING id INTO creator_id;
  INSERT INTO experiences (creator_id, slug, title, status)
  VALUES (creator_id, 'response-ci-' || replace(gen_random_uuid()::text, '-', ''), 'Response CI', 'published')
  RETURNING id INTO experience_id;
  INSERT INTO experience_levels (experience_id, position, title, price_minor)
  VALUES (experience_id, 1, 'Response level', 100)
  RETURNING id INTO level_id;
  INSERT INTO buyer_sessions (buyer_ref, token_hash, expires_at)
  VALUES (buyer_ref_value, encode(digest(gen_random_uuid()::text, 'sha256'), 'hex'), now() + interval '1 day');

  INSERT INTO journey_responses (experience_id, level_id, buyer_ref, reaction)
  VALUES (experience_id, level_id, buyer_ref_value, 'heart');

  INSERT INTO journey_responses (experience_id, level_id, buyer_ref, reaction)
  VALUES (experience_id, level_id, buyer_ref_value, 'miss_you')
  ON CONFLICT (level_id, buyer_ref)
  DO UPDATE SET reaction = EXCLUDED.reaction, updated_at = now();

  SELECT COUNT(*) INTO found_count FROM journey_responses
  WHERE experience_id = experience_id AND level_id = level_id AND buyer_ref = buyer_ref_value;
  IF found_count <> 1 OR NOT EXISTS (
    SELECT 1 FROM journey_responses
    WHERE journey_responses.level_id = level_id
      AND journey_responses.buyer_ref = buyer_ref_value
      AND journey_responses.reaction = 'miss_you'
  ) THEN
    RAISE EXCEPTION 'JOURNEY_RESPONSE_UPSERT_FAILED';
  END IF;

  BEGIN
    INSERT INTO journey_responses (experience_id, level_id, buyer_ref, reaction)
    VALUES (experience_id, level_id, buyer_ref_value, 'unknown');
    RAISE EXCEPTION 'INVALID_JOURNEY_REACTION_ACCEPTED';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END $$;
ROLLBACK;
