import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { getCurrentCreator } from "@/lib/session";
import { isSameOriginWrite } from "@/lib/security";

export const dynamic = "force-dynamic";

const privateHeaders = { "Cache-Control": "no-store, private", Vary: "Cookie" };

export async function GET() {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: privateHeaders });
  const cookieStore = await cookies();
  const token = cookieStore.get("heart_session")?.value;
  if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: privateHeaders });
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const db = requireDb();
  const sessions = await db`
    SELECT id, created_at, expires_at, (token_hash = ${tokenHash}) AS is_current
    FROM creator_sessions
    WHERE user_id = ${creator.id} AND expires_at > now()
    ORDER BY created_at DESC
  `;
  return NextResponse.json({ sessions }, { headers: privateHeaders });
}

export async function POST(request: Request) {
  if (!isSameOriginWrite(request)) {
    return NextResponse.json({ error: "BAD_ORIGIN" }, { status: 403, headers: privateHeaders });
  }
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: privateHeaders });
  const cookieStore = await cookies();
  const token = cookieStore.get("heart_session")?.value;
  if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: privateHeaders });
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const db = requireDb();
  const result = await db`
    DELETE FROM creator_sessions
    WHERE user_id = ${creator.id}
      AND token_hash <> ${tokenHash}
    RETURNING id
  `;
  return NextResponse.json({ ok: true, revokedCount: result.length }, { headers: privateHeaders });
}
