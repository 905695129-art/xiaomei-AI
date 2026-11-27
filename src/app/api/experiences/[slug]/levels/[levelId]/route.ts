import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: { slug: string; levelId: string } }) {
  try {
    const buyerRef = new URL(request.url).searchParams.get("buyer");
    if (!buyerRef || buyerRef.length > 120) {
      return NextResponse.json({ error: "PURCHASE_REQUIRED" }, { status: 403 });
    }
    const db = requireDb();
    const rows = await db`
      SELECT l.title, l.private_content
      FROM experiences e
      JOIN experience_levels l ON l.experience_id = e.id
      JOIN entitlements en ON en.level_id = l.id AND en.buyer_ref = ${buyerRef}
      JOIN orders o ON o.id = en.order_id AND o.status = 'paid'
      WHERE e.slug = ${context.params.slug}
        AND e.status = 'published'
        AND l.id = ${context.params.levelId}::uuid
        AND l.is_active = true
      LIMIT 1
    `;
    if (!rows.length) return NextResponse.json({ error: "PURCHASE_REQUIRED" }, { status: 403 });
    return NextResponse.json({ title: rows[0].title, content: rows[0].private_content });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "DATABASE_NOT_CONFIGURED" ? 503 : 400;
    return NextResponse.json({ error: status === 503 ? "SERVICE_NOT_CONFIGURED" : "INVALID_REQUEST" }, { status });
  }
}
