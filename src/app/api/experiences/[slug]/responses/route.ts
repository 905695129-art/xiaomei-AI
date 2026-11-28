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
  const levelId = (parsed.value as { levelId?: unknown }).levelId;
  const messageValue = (parsed.value as { message?: unknown }).message;
  if (messageValue !== undefined && typeof messageValue !== "string") return NextResponse.json({ error: "INVALID_MESSAGE" }, { status: 400, headers });
  const message = typeof messageValue === "string" ? messageValue.trim() : "";
  if (Array.from(message).length > 500) return NextResponse.json({ error: "MESSAGE_TOO_LONG" }, { status: 400, headers });
  if (typeof levelId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(levelId)) {
    return NextResponse.json({ error: "INVALID_LEVEL" }, { status: 400, headers });
  }
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
      `WITH eligible AS MATERIALIZED (
         SELECT e.id AS experience_id, l.id AS level_id, b.buyer_ref
         FROM experiences e
         JOIN experience_levels l ON l.experience_id = e.id AND l.is_active = TRUE
         JOIN buyer_sessions b ON b.token_hash = $3 AND b.expires_at > now()
         WHERE e.slug = $1 AND e.status = 'published' AND l.id = $2::uuid
           AND NOT EXISTS (
             SELECT 1 FROM experience_levels previous
             WHERE previous.experience_id = l.experience_id
               AND previous.is_active = TRUE AND previous.position < l.position
               AND NOT EXISTS (
                 SELECT 1 FROM journey_level_progress progress
                 WHERE progress.level_id = previous.id AND progress.buyer_ref = b.buyer_ref
               )
           )
       ), saved_response AS (
         INSERT INTO journey_responses (experience_id, level_id, buyer_ref, reaction, message)
         SELECT experience_id, level_id, buyer_ref, $4, $5 FROM eligible
         ON CONFLICT (level_id, buyer_ref)
         DO UPDATE SET reaction = EXCLUDED.reaction, message = EXCLUDED.message, updated_at = now(), read_at = NULL
         RETURNING id
       ), saved_progress AS (
         INSERT INTO journey_level_progress (experience_id, level_id, buyer_ref)
         SELECT experience_id, level_id, buyer_ref FROM eligible
         WHERE EXISTS (SELECT 1 FROM saved_response)
         ON CONFLICT (level_id, buyer_ref) DO NOTHING
         RETURNING id
       )
       SELECT id FROM saved_response`,
      [slug, levelId, tokenHash, reaction, message]
    );
    if (!rows.length) {
      const [buyer] = await db.unsafe("SELECT buyer_ref FROM buyer_sessions WHERE token_hash = $1 AND expires_at > now() LIMIT 1", [tokenHash]);
      if (!buyer) return NextResponse.json({ error: "BUYER_SESSION_REQUIRED" }, { status: 401, headers });
      const [target] = await db.unsafe(
        `SELECT l.id FROM experiences e JOIN experience_levels l ON l.experience_id = e.id
         WHERE e.slug = $1 AND e.status = 'published' AND l.id = $2::uuid AND l.is_active = TRUE LIMIT 1`,
        [slug, levelId]
      );
      return NextResponse.json({ error: target ? "LEVEL_LOCKED" : "LEVEL_NOT_AVAILABLE" }, { status: target ? 409 : 404, headers });
    }
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "DATABASE_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json({ error: status === 503 ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status, headers });
  }
}
