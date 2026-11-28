import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { isSameOriginWrite, readJsonLimited } from "@/lib/security";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const allowed = new Set(["heart", "miss_you", "hug"]);

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!isSameOriginWrite(request)) {
    return NextResponse.json({ error: "BAD_ORIGIN" }, { status: 403, headers });
  }
  const parsed = await readJsonLimited(request, 2048);
  if (!parsed.ok || !parsed.value || typeof parsed.value !== "object") {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400, headers });
  }
  const reaction = (parsed.value as { reaction?: unknown }).reaction;
  if (typeof reaction !== "string" || !allowed.has(reaction)) {
    return NextResponse.json({ error: "INVALID_REACTION" }, { status: 400, headers });
  }
  try {
    const { slug } = await context.params;
    const token = (await cookies()).get("heart_buyer")?.value;
    if (!token) return NextResponse.json({ error: "BUYER_SESSION_REQUIRED" }, { status: 401, headers });
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const db = requireDb();
    const rows = await db.unsafe(
      `INSERT INTO journey_responses (experience_id, level_id, buyer_ref, reaction)
       SELECT e.id, l.id, b.buyer_ref, $4
       FROM experiences e
       JOIN experience_levels l ON l.experience_id = e.id AND l.is_active = TRUE
       JOIN buyer_sessions b ON b.token_hash = $3 AND b.expires_at > now()
       WHERE e.slug = $1 AND e.status = 'published' AND l.id = $2::uuid
       ON CONFLICT (level_id, buyer_ref)
       DO UPDATE SET reaction = EXCLUDED.reaction, updated_at = now()
       RETURNING id`,
      [slug, (parsed.value as { levelId?: string }).levelId ?? "", tokenHash, reaction]
    );
    if (!rows.length) return NextResponse.json({ error: "LEVEL_NOT_AVAILABLE" }, { status: 404, headers });
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "DATABASE_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json({ error: status === 503 ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status, headers });
  }
}
