import { NextResponse } from "next/server";
import { isSameOriginWrite } from "@/lib/security";
import { requireDb } from "@/lib/db";
import { getCurrentCreator } from "@/lib/session";

export const dynamic = "force-dynamic";
export async function POST(_request: Request, context: {
  if (!isSameOriginWrite(request)) return NextResponse.json({ error: "BAD_ORIGIN" }, { status: 403 }); params: { experienceId: string } }) {
  try {
    const creator = await getCurrentCreator();
    if (!creator) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const db = requireDb();
    const result = await db`
      UPDATE experiences e SET status = 'published', updated_at = now()
      WHERE e.id = ${context.params.experienceId}::uuid AND e.creator_id = ${creator.id}
        AND EXISTS (SELECT 1 FROM experience_levels l WHERE l.experience_id = e.id AND l.is_active = true)
      RETURNING e.id, e.slug, e.title, e.status
    `;
    if (!result.length) return NextResponse.json({ error: "NOT_FOUND_OR_NO_LEVELS" }, { status: 404 });
    return NextResponse.json({ experience: result[0], shareUrl: `/p/${result[0].slug}` });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ error: code === "DATABASE_NOT_CONFIGURED" ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status: code === "DATABASE_NOT_CONFIGURED" ? 503 : 500 });
  }
}
