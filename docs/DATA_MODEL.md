# 数据模型草案

- users：id、email、identity、role、created_at
- creator_licenses：id、user_id、product_code、status、activated_at、expires_at
- activation_codes：id、code_hash、product_code、status、created_by、redeemed_by、redeemed_at
- experiences：id、creator_id、title、subtitle、share_slug、status、timestamps
- levels：id、experience_id、position、title、hint、price_minor、currency、content_type、private_object_key、is_active
- orders：id、creator_id、experience_id、level_id、buyer_session_id、amount_minor、currency、status、provider、provider_order_id、provider_transaction_id、paid_at、refunded_at
- entitlements：id、buyer/session、level_id、order_id、granted_at、revoked_at
- payment_events：id、provider、provider_event_id、signature_valid、payload_digest、processed_at、result

安全约束：支付交易 ID 唯一；回调事件唯一；同一买家同一关卡的授权唯一；每个创作者接口强制所有权校验；私有媒体仅在授权通过后发短时签名 URL。
