import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  let hasBuyerCookie = false;
  const responseHeaders = () => hasBuyerCookie
    ? { "Cache-Control": "private, no-store", Vary: "Cookie" }
    : { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60", Vary: "Cookie" };
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("heart_buyer")?.value;
    hasBuyerCookie = Boolean(token);
    const db = requireDb();
    let buyerRef: string | null = null;
    if (token) {
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const [buyer] = await db`SELECT buyer_ref FROM buyer_sessions WHERE token_hash = ${tokenHash} AND expires_at > now() LIMIT 1`;
      buyerRef = buyer?.buyer_ref ?? null;
    }
    const rows = await db`
      SELECT e.slug, e.title, e.description, e.cover_url, e.cover_position, e.currency, e.theme,
        l.id AS level_id, l.position, l.title AS level_title,
        l.teaser, l.price_minor,
        EXISTS (
          SELECT 1 FROM journey_level_progress progress
          WHERE progress.level_id = l.id AND progress.buyer_ref = ${buyerRef}
        ) AS completed
      FROM experiences e
      LEFT JOIN experience_levels l
        ON l.experience_id = e.id
        AND ((e.status = 'published' AND l.is_active = true) OR EXISTS (
          SELECT 1 FROM entitlements ent JOIN orders o ON o.id = ent.order_id
          WHERE ent.level_id = l.id AND ent.buyer_ref = ${buyerRef}
            AND o.status = 'paid' AND o.buyer_ref = ent.buyer_ref AND o.level_id = l.id
        ))
      WHERE e.slug = ${slug}
        AND (e.status = 'published' OR EXISTS (
          SELECT 1 FROM entitlements ent JOIN orders o ON o.id = ent.order_id
          WHERE o.experience_id = e.id AND ent.buyer_ref = ${buyerRef}
            AND o.status = 'paid' AND o.buyer_ref = ent.buyer_ref
        ))
      ORDER BY l.position ASC
    `;
    if (!rows.length) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: responseHeaders() });
    const first = rows[0];
    return NextResponse.json({
      experience: {
        slug: first.slug, title: first.title, description: first.description,
        coverUrl: first.cover_url, coverPosition: ["top", "center", "bottom"].includes(first.cover_position) ? first.cover_position : "center", currency: first.currency, theme: ["rose", "cream", "lavender"].includes(first.theme) ? first.theme : "rose",
        levels: rows.filter((r: any) => r.level_id).map((r: any) => ({
          id: r.level_id, position: r.position, title: r.level_title,
          teaser: r.teaser, priceMinor: r.price_minor, completed: Boolean(r.completed)
        }))
      }
    }, { headers: responseHeaders() });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "DATABASE_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json({ error: status === 503 ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status, headers: responseHeaders() });
  }
}
