import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/security";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function POST(request: Request, context: { params: Promise<{ slug: string; levelId: string }> }) {
  if (!isSameOriginWrite(request)) return NextResponse.json({ error: "BAD_ORIGIN" }, { status: 403, headers });
  const { slug, levelId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(levelId)) {
    return NextResponse.json({ error: "INVALID_LEVEL" }, { status: 400, headers });
  }
  try {
    const token = (await cookies()).get("heart_buyer")?.value;
    if (!token) return NextResponse.json({ error: "BUYER_SESSION_REQUIRED" }, { status: 401, headers });
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const db = requireDb();
    const [buyer] = await db`SELECT buyer_ref FROM buyer_sessions WHERE token_hash = ${tokenHash} AND expires_at > now() LIMIT 1`;
    if (!buyer) return NextResponse.json({ error: "BUYER_SESSION_REQUIRED" }, { status: 401, headers });

    const result = await db.begin(async tx => {
      const [target] = await tx`
        SELECT e.id AS experience_id, e.payment_qr_url, e.currency, l.id AS level_id, l.position, l.price_minor
        FROM experiences e JOIN experience_levels l ON l.experience_id = e.id
        WHERE e.slug = ${slug} AND e.status = 'published' AND l.id = ${levelId}::uuid AND l.is_active = true
        FOR UPDATE OF e, l
      `;
      if (!target) return { error: "LEVEL_NOT_AVAILABLE", status: 404 };
      if (target.price_minor === 0) return { error: "FREE_LEVEL_DOES_NOT_REQUIRE_PAYMENT", status: 409 };
      if (!target.payment_qr_url) return { error: "PAYMENT_QR_NOT_CONFIGURED", status: 409 };
      const [prior] = await tx`
        SELECT 1 FROM experience_levels previous
        WHERE previous.experience_id = ${target.experience_id} AND previous.is_active = true
          AND previous.position < ${target.position}
          AND NOT EXISTS (
            SELECT 1 FROM journey_level_progress progress
            WHERE progress.level_id = previous.id AND progress.buyer_ref = ${buyer.buyer_ref}
          )
        LIMIT 1
      `;
      if (prior) return { error: "LEVEL_LOCKED", status: 409 };
      const [saved] = await tx`
        INSERT INTO journey_level_unlocks
          (experience_id, level_id, buyer_ref, confirmation_method, amount_minor_snapshot, currency_snapshot)
        VALUES (${target.experience_id}, ${target.level_id}, ${buyer.buyer_ref}, 'self_attested_transfer', ${target.price_minor}, ${target.currency})
        ON CONFLICT (level_id, buyer_ref) DO UPDATE
          SET confirmed_at = journey_level_unlocks.confirmed_at
        RETURNING id, confirmed_at
      `;
      return { ok: true, unlockId: saved.id, confirmedAt: saved.confirmed_at, confirmationMethod: "self_attested_transfer" };
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status, headers });
    return NextResponse.json({
      ...result,
      notice: "你已自行确认完成转账。平台未核验收款到账，也未将此记录标记为平台支付成功。"
    }, { headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "DATABASE_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json({ error: status === 503 ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status, headers });
  }
}
