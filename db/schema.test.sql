-- Integration checks for critical purchase invariants.
-- Run only against the disposable PostgreSQL service used by GitHub Actions.
BEGIN;

DO $$
DECLARE
  function_acl ACLITEM[];
BEGIN
  SELECT proacl INTO function_acl
  FROM pg_proc
  WHERE oid = 'heart_finalize_verified_payment(uuid,uuid,text,integer,character,char)'::regprocedure;

  IF EXISTS (
    SELECT 1
    FROM aclexplode(COALESCE(function_acl, acldefault('f', (SELECT proowner FROM pg_proc WHERE oid = 'heart_finalize_verified_payment(uuid,uuid,text,integer,character,char)'::regprocedure))))
    WHERE grantee = 0 AND privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'PAYMENT_FINALIZER_PUBLIC_EXECUTE_NOT_REVOKED';
  END IF;
END $$;

DO $$
DECLARE
  creator_id UUID;
  experience_id UUID;
  level_id UUID;
  buyer_ref_value TEXT := encode(gen_random_bytes(18), 'hex');
  order_id_value UUID;
  entitlement_id UUID;
  refund_id UUID;
  event_id_value UUID;
  provider_order_id_value TEXT := 'ci-provider-' || gen_random_uuid()::text;
  event_digest CHAR(64) := encode(digest(gen_random_uuid()::text, 'sha256'), 'hex');
  wrong_event_digest CHAR(64) := encode(digest(gen_random_uuid()::text, 'sha256'), 'hex');
  event_provider_id TEXT := 'ci-event-' || gen_random_uuid()::text;
  found_count INTEGER;
BEGIN
  INSERT INTO users (display_name, role)
  VALUES ('CI test creator', 'creator')
  RETURNING id INTO creator_id;

  INSERT INTO experiences (creator_id, slug, title, status, currency)
  VALUES (creator_id, 'ci-' || replace(gen_random_uuid()::text, '-', ''), 'CI test', 'published', 'CNY')
  RETURNING id INTO experience_id;

  INSERT INTO buyer_sessions (buyer_ref, token_hash, expires_at)
  VALUES (buyer_ref_value, encode(digest(gen_random_uuid()::text, 'sha256'), 'hex'), now() + interval '1 day');

  INSERT INTO experience_levels (experience_id, position, title, teaser, price_minor, private_content)
  VALUES (experience_id, 1, 'Original title', 'Teaser', 990, 'Original private content')
  RETURNING id INTO level_id;

  INSERT INTO orders (experience_id, level_id, creator_id, buyer_ref, amount_minor, currency, status, provider)
  VALUES (experience_id, level_id, creator_id, buyer_ref_value, 990, 'CNY', 'pending', 'ci-test')
  RETURNING id INTO order_id_value;

  IF NOT EXISTS (
    SELECT 1 FROM orders
    WHERE id = order_id_value
      AND level_title_snapshot = 'Original title'
      AND private_content_snapshot = 'Original private content'
      AND level_position_snapshot = 1
  ) THEN
    RAISE EXCEPTION 'ORDER_SNAPSHOT_NOT_CREATED';
  END IF;

  UPDATE experience_levels
  SET title = 'Edited title', private_content = 'Edited private content', price_minor = 1990
  WHERE id = level_id;

  IF NOT EXISTS (
    SELECT 1 FROM orders
    WHERE id = order_id_value
      AND level_title_snapshot = 'Original title'
      AND private_content_snapshot = 'Original private content'
      AND amount_minor = 990
  ) THEN
    RAISE EXCEPTION 'ORDER_SNAPSHOT_CHANGED_AFTER_EDIT';
  END IF;

  BEGIN
    INSERT INTO orders (experience_id, level_id, creator_id, buyer_ref, amount_minor, currency, status, provider)
    VALUES (experience_id, level_id, creator_id, buyer_ref_value, 990, 'CNY', 'pending', 'ci-test');
    RAISE EXCEPTION 'STALE_CLIENT_PRICE_WAS_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'ORDER_AMOUNT_MISMATCH' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    INSERT INTO orders (experience_id, level_id, creator_id, buyer_ref, amount_minor, currency, status, provider)
    VALUES (experience_id, level_id, creator_id, buyer_ref_value, 1990, 'CNY', 'pending', 'ci-test');
    RAISE EXCEPTION 'DUPLICATE_ACTIVE_ORDER_WAS_ACCEPTED';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  INSERT INTO payment_provider_events (provider, provider_event_id, event_type, payload_sha256, processing_status)
  VALUES ('ci-test', event_provider_id, 'payment.succeeded', event_digest, 'processing')
  RETURNING id INTO event_id_value;

  BEGIN
    PERFORM heart_finalize_verified_payment(
      event_id_value, order_id_value, provider_order_id_value, 990, 'CNY', wrong_event_digest
    );
    RAISE EXCEPTION 'CALLBACK_DIGEST_MISMATCH_WAS_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'PAYMENT_EVENT_DIGEST_MISMATCH' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    INSERT INTO payment_provider_events (provider, provider_event_id, event_type, payload_sha256, processing_status)
    VALUES ('ci-test', event_provider_id, 'payment.succeeded', event_digest, 'received');
    RAISE EXCEPTION 'DUPLICATE_PROVIDER_EVENT_WAS_ACCEPTED';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  BEGIN
    PERFORM heart_finalize_verified_payment(
      event_id_value, order_id_value, provider_order_id_value, 980, 'CNY', event_digest
    );
    RAISE EXCEPTION 'WRONG_PROVIDER_AMOUNT_WAS_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'PROVIDER_AMOUNT_OR_CURRENCY_MISMATCH' THEN
      RAISE;
    END IF;
  END;

  PERFORM heart_finalize_verified_payment(
    event_id_value, order_id_value, provider_order_id_value, 990, 'CNY', event_digest
  );
  -- Replaying the same already-processed event is a harmless no-op.
  PERFORM heart_finalize_verified_payment(
    event_id_value, order_id_value, provider_order_id_value, 990, 'CNY', event_digest
  );

  SELECT id INTO entitlement_id FROM entitlements WHERE order_id = order_id_value;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VERIFIED_CALLBACK_DID_NOT_CREATE_ENTITLEMENT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM entitlements
    WHERE id = entitlement_id
      AND level_title_snapshot = 'Original title'
      AND private_content_snapshot = 'Original private content'
      AND price_minor_snapshot = 990
      AND currency_snapshot = 'CNY'
  ) THEN
    RAISE EXCEPTION 'ENTITLEMENT_SNAPSHOT_NOT_COPIED';
  END IF;

  BEGIN
    UPDATE orders SET amount_minor = 1 WHERE id = order_id_value;
    RAISE EXCEPTION 'ORDER_AMOUNT_MUTATION_WAS_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'ORDER_AMOUNT_MUTATION_WAS_ACCEPTED' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    INSERT INTO payment_refunds (order_id, provider, idempotency_key, amount_minor, currency, status)
    VALUES (order_id_value, 'ci-test', 'ci-refund-wrong-' || gen_random_uuid()::text, 989, 'CNY', 'pending');
    RAISE EXCEPTION 'PARTIAL_REFUND_WAS_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'REFUND_AMOUNT_MUST_MATCH_ORDER' THEN
      RAISE;
    END IF;
  END;

  INSERT INTO payment_refunds (order_id, provider, idempotency_key, amount_minor, currency, status)
  VALUES (order_id_value, 'ci-test', 'ci-refund-' || gen_random_uuid()::text, 990, 'CNY', 'pending')
  RETURNING id INTO refund_id;

  BEGIN
    INSERT INTO payment_refunds (order_id, provider, idempotency_key, amount_minor, currency, status)
    VALUES (order_id_value, 'ci-test', 'ci-refund-duplicate-' || gen_random_uuid()::text, 990, 'CNY', 'pending');
    RAISE EXCEPTION 'CONCURRENT_ACTIVE_REFUND_WAS_ACCEPTED';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  UPDATE payment_refunds SET status = 'succeeded', completed_at = now() WHERE id = refund_id;

  IF NOT EXISTS (SELECT 1 FROM orders WHERE id = order_id_value AND status = 'refunded') THEN
    RAISE EXCEPTION 'SUCCESSFUL_REFUND_DID_NOT_REVOKE_ORDER';
  END IF;

  SELECT COUNT(*) INTO found_count
  FROM entitlements en JOIN orders o ON o.id = en.order_id
  WHERE en.id = entitlement_id AND o.status = 'paid';
  IF found_count <> 0 THEN
    RAISE EXCEPTION 'REFUNDED_ENTITLEMENT_STILL_COUNTS_AS_PAID';
  END IF;
END $$;

ROLLBACK;
