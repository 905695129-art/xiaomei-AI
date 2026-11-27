import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: { slug: string } }) {
  try {
    const db = requireDb();
    const rows = await db`
      SELECT e.slug, e.title, e.description, e.cover_url, e.cover_position, e.currency, e.theme,
        l.id AS level_id, l.position, l.title AS level_title,
        l.teaser, l.price_minor
      FROM experiences e
      LEFT JOIN experience_levels l
        ON l.experience_id = e.id AND l.is_active = true
      WHERE e.slug = ${context.params.slug} AND e.status = 'published'
      ORDER BY l.position ASC
    `;
    if (!rows.length) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const first = rows[0];
    return NextResponse.json({
      experience: {
        slug: first.slug, title: first.title, description: first.description,
        coverUrl: first.cover_url, coverPosition: ["top", "center", "bottom"].includes(first.cover_position) ? first.cover_position : "center", currency: first.currency, theme: ["rose", "cream", "lavender"].includes(first.theme) ? first.theme : "rose",
        levels: rows.filter((r: any) => r.level_id).map((r: any) => ({
          id: r.level_id, position: r.position, title: r.level_title,
          teaser: r.teaser, priceMinor: r.price_minor
        }))
      }
    }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "DATABASE_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json({ error: status === 503 ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status });
  }
}
