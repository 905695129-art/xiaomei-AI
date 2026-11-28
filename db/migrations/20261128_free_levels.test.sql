BEGIN;
DO $$
DECLARE
  creator_id UUID := gen_random_uuid();
  experience_id UUID := gen_random_uuid();
  level_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO users (id, display_name, role)
  VALUES (creator_id, 'Free level migration test', 'creator');
  INSERT INTO experiences (id, creator_id, slug, title, status)
  VALUES (experience_id, creator_id, 'free-level-' || replace(creator_id::text, '-', ''), 'Free level test', 'draft');
  INSERT INTO experience_levels (id, experience_id, position, title, price_minor)
  VALUES (level_id, experience_id, 1, '免费关卡', 0);
  IF NOT EXISTS (SELECT 1 FROM experience_levels WHERE id = level_id AND price_minor = 0) THEN
    RAISE EXCEPTION 'FREE_LEVEL_INSERT_FAILED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'experience_levels'::regclass
      AND conname = 'experience_levels_price_positive'
      AND pg_get_constraintdef(oid) NOT LIKE '%price_minor >= 0%'
  ) THEN
    RAISE EXCEPTION 'FREE_LEVEL_CONSTRAINT_NOT_UPDATED';
  END IF;
END $$;
ROLLBACK;
