import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";

export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(_request: Request, context: { params: Promise<{ slug: string; levelId: string }> }) {
  const { slug, levelId } = await context.params;
  try {
    // Opaque HttpOnly cookie; never accept buyer identity from a query string.
    const cookieStore = await cookies();
    const token = cookieStore.get("heart_buyer")?.value;
    if (!token) return NextResponse.json({ error: "PURCHASE_REQUIRED" }, { status: 403, headers: privateHeaders });
    const db = requireDb();
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const sessions = await db.unsafe("SELECT buyer_ref FROM buyer_sessions WHERE token_hash = $1 AND expires_at > now() LIMIT 1", [tokenHash]);
    if (!sessions.length) return NextResponse.json({ error: "PURCHASE_REQUIRED" }, { status: 403, headers: privateHeaders });
    const buyerRef = sessions[0].buyer_ref;
    // Published journeys are share-link experiences: anyone with the link and
    // a valid HttpOnly visitor session can open active levels without paying.
    // Paid entitlements remain valid for archived/removed levels and use snapshots.
    const rows = await db.unsafe(
      `SELECT
         CASE WHEN o.id IS NOT NULL THEN COALESCE(en.level_title_snapshot, l.title) ELSE l.title END AS title,
         CASE WHEN o.id IS NOT NULL THEN COALESCE(en.private_content_snapshot, l.private_content) ELSE l.private_content END AS private_content
       FROM experiences e
       JOIN experience_levels l ON l.experience_id = e.id
       LEFT JOIN entitlements en ON en.level_id = l.id AND en.buyer_ref = $1
       LEFT JOIN orders o ON o.id = en.order_id AND o.status = 'paid' AND o.buyer_ref = en.buyer_ref AND o.level_id = l.id
       WHERE e.slug = $2 AND l.id = $3::uuid
         AND (
           (e.status = 'published' AND l.is_active = TRUE AND (
             NOT EXISTS (
               SELECT 1 FROM experience_levels previous
               WHERE previous.experience_id = l.experience_id
                 AND previous.is_active = TRUE AND previous.position < l.position
                 AND NOT EXISTS (
                   SELECT 1 FROM journey_level_progress progress
                   WHERE progress.level_id = previous.id AND progress.buyer_ref = $1
                 )
             )
           )) OR o.id IS NOT NULL
         )
       LIMIT 1`,
      [buyerRef, slug, levelId]
    );
    if (!rows.length) return NextResponse.json({ error: "LEVEL_NOT_AVAILABLE" }, { status: 404, headers: privateHeaders });
    return NextResponse.json({ title: rows[0].title, content: rows[0].private_content }, { headers: privateHeaders });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "DATABASE_NOT_CONFIGURED" ? 503 : 400;
    return NextResponse.json({ error: status === 503 ? "SERVICE_NOT_CONFIGURED" : "INVALID_REQUEST" }, { status, headers: privateHeaders });
  }
}
