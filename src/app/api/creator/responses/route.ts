import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { getCurrentCreator } from "@/lib/session";
import { isSameOriginWrite } from "@/lib/security";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET() {
  try {
    const creator = await getCurrentCreator();
    if (!creator) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
    const db = requireDb();
    const [responses, unread] = await Promise.all([
      db`
        SELECT r.id, r.reaction, r.message, r.created_at, r.updated_at, r.read_at,
          e.title AS experience_title, e.slug,
          l.title AS level_title, l.position
        FROM journey_responses r
        JOIN experiences e ON e.id = r.experience_id
        JOIN experience_levels l ON l.id = r.level_id
        WHERE e.creator_id = ${creator.id}
        ORDER BY r.updated_at DESC
        LIMIT 200
      `,
      db`
        SELECT COUNT(*)::int AS count
        FROM journey_responses r
        JOIN experiences e ON e.id = r.experience_id
        WHERE e.creator_id = ${creator.id} AND r.read_at IS NULL
      `
    ]);
    return NextResponse.json({ responses, unreadCount: unread[0]?.count ?? 0 }, { headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "DATABASE_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json({ error: status === 503 ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status, headers });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginWrite(request)) {
    return NextResponse.json({ error: "BAD_ORIGIN" }, { status: 403, headers });
  }
  try {
    const creator = await getCurrentCreator();
    if (!creator) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
    const db = requireDb();
    const marked = await db`
      UPDATE journey_responses r
      SET read_at = now()
      FROM experiences e
      WHERE e.id = r.experience_id
        AND e.creator_id = ${creator.id}
        AND r.read_at IS NULL
      RETURNING r.id
    `;
    return NextResponse.json({ ok: true, markedCount: marked.length }, { headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "DATABASE_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json({ error: status === 503 ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status, headers });
  }
}
