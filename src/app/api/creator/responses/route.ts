import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { getCurrentCreator } from "@/lib/session";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET() {
  try {
    const creator = await getCurrentCreator();
    if (!creator) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
    const db = requireDb();
    const responses = await db`
      SELECT r.id, r.reaction, r.created_at, r.updated_at,
        e.title AS experience_title, e.slug,
        l.title AS level_title, l.position
      FROM journey_responses r
      JOIN experiences e ON e.id = r.experience_id
      JOIN experience_levels l ON l.id = r.level_id
      WHERE e.creator_id = ${creator.id}
      ORDER BY r.updated_at DESC
      LIMIT 200
    `;
    return NextResponse.json({ responses }, { headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "DATABASE_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json({ error: status === 503 ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status, headers });
  }
}
