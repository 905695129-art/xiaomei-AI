import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const token = (await cookies()).get("heart_buyer")?.value;
    if (!token) return NextResponse.json({ error: "BUYER_SESSION_REQUIRED" }, { status: 401 });

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const db = requireDb();
    const [buyer] = await db`
      SELECT buyer_ref
      FROM buyer_sessions
      WHERE token_hash = ${tokenHash} AND expires_at > now()
      LIMIT 1
    `;
    if (!buyer) {
      const response = NextResponse.json({ error: "BUYER_SESSION_EXPIRED" }, { status: 401 });
      response.cookies.set("heart_buyer", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
      return response;
    }

    // Only server-recorded paid orders with matching entitlements are visible.
    // Never accept buyer_ref from query strings or request bodies.
    const purchases = await db`
      SELECT
        o.id AS order_id,
        o.amount_minor,
        o.currency,
        o.paid_at,
        e.slug AS experience_slug,
        e.title AS experience_title,
        l.id AS level_id,
        COALESCE(ent.level_position_snapshot, l.position) AS level_position,
        COALESCE(ent.level_title_snapshot, l.title) AS level_title
      FROM entitlements ent
      JOIN orders o ON o.id = ent.order_id
      JOIN experiences e ON e.id = o.experience_id
      JOIN experience_levels l ON l.id = ent.level_id AND l.experience_id = o.experience_id
      WHERE ent.buyer_ref = ${buyer.buyer_ref}
        AND o.buyer_ref = ${buyer.buyer_ref}
        AND o.level_id = ent.level_id
        AND o.status = 'paid'
      ORDER BY o.paid_at DESC NULLS LAST, o.created_at DESC
      LIMIT 100
    `;
    return NextResponse.json({ purchases }, { headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "DATABASE_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json({ error: status === 503 ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status });
  }
}
