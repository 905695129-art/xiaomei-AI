import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: { slug: string; levelId: string } }) {
  try {
    // Opaque HttpOnly cookie; never accept buyer identity from a query string.
    const token = cookies().get("heart_buyer")?.value;
    if (!token) return NextResponse.json({ error: "PURCHASE_REQUIRED" }, { status: 403 });
    const db = requireDb();
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const sessions = await db.unsafe("SELECT buyer_ref FROM buyer_sessions WHERE token_hash = $1 AND expires_at > now() LIMIT 1", [tokenHash]);
    if (!sessions.length) return NextResponse.json({ error: "PURCHASE_REQUIRED" }, { status: 403 });
    const buyerRef = sessions[0].buyer_ref;
    const rows = await db.unsafe("SELECT l.title, l.private_content FROM experiences e JOIN experience_levels l ON l.experience_id = e.id JOIN entitlements en ON en.level_id = l.id AND en.buyer_ref = $1 JOIN orders o ON o.id = en.order_id AND o.status = 'paid' WHERE e.slug = $2 AND e.status = 'published' AND l.id = $3::uuid AND l.is_active = true LIMIT 1", [buyerRef, context.params.slug, context.params.levelId]);
    if (!rows.length) return NextResponse.json({ error: "PURCHASE_REQUIRED" }, { status: 403 });
    return NextResponse.json({ title: rows[0].title, content: rows[0].private_content }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "DATABASE_NOT_CONFIGURED" ? 503 : 400;
    return NextResponse.json({ error: status === 503 ? "SERVICE_NOT_CONFIGURED" : "INVALID_REQUEST" }, { status });
  }
}
