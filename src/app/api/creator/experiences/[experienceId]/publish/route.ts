import { NextResponse } from "next/server";
import { isSameOriginWrite } from "@/lib/security";
import { requireDb } from "@/lib/db";
import { getCurrentCreator } from "@/lib/session";

export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "no-store, private", Vary: "Cookie" };
export async function POST(_request: Request, context: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await context.params;
  if (!isSameOriginWrite(_request)) return NextResponse.json({ error: "BAD_ORIGIN" }, { status: 403, headers: privateHeaders });
  try {
    const creator = await getCurrentCreator();
    if (!creator) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: privateHeaders });
    const db = requireDb();
    if (process.env.REQUIRE_VERIFIED_EMAIL === "true") {
      const [account] = await db`SELECT email_verified_at FROM users WHERE id = ${creator.id} LIMIT 1`;
      if (!account?.email_verified_at) return NextResponse.json({ error: "EMAIL_NOT_VERIFIED" }, { status: 403, headers: privateHeaders });
    }
    const result = await db`
      UPDATE experiences e SET status = 'published', updated_at = now()
      WHERE e.id = ${experienceId}::uuid AND e.creator_id = ${creator.id}
        AND EXISTS (SELECT 1 FROM experience_levels l WHERE l.experience_id = e.id AND l.is_active = true)
      RETURNING e.id, e.slug, e.title, e.status
    `;
    if (!result.length) return NextResponse.json({ error: "NOT_FOUND_OR_NO_LEVELS" }, { status: 404, headers: privateHeaders });
    return NextResponse.json({ experience: result[0], shareUrl: `/p/${result[0].slug}` }, { headers: privateHeaders });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ error: code === "DATABASE_NOT_CONFIGURED" ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status: code === "DATABASE_NOT_CONFIGURED" ? 503 : 500, headers: privateHeaders });
  }
}
