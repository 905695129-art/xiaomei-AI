import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginWrite(request)) {
    return NextResponse.json({ error: "BAD_ORIGIN" }, { status: 403 });
  }

  try {
    const db = requireDb();
    // Use the trusted reverse-proxy client IP header where available. The hash,
    // rather than the raw address, is persisted for basic abuse throttling.
    const address = request.headers.get("x-real-ip") || "unknown";
    const addressHash = createHash("sha256").update(address).digest("hex");
    await db`DELETE FROM guest_creator_rate_limits WHERE window_started_at < now() - interval '1 day'`;
    const [limit] = await db`
      INSERT INTO guest_creator_rate_limits (address_hash, window_started_at, attempts)
      VALUES (${addressHash}, now(), 1)
      ON CONFLICT (address_hash) DO UPDATE SET
        attempts = CASE
          WHEN guest_creator_rate_limits.window_started_at < now() - interval '1 hour' THEN 1
          ELSE guest_creator_rate_limits.attempts + 1
        END,
        window_started_at = CASE
          WHEN guest_creator_rate_limits.window_started_at < now() - interval '1 hour' THEN now()
          ELSE guest_creator_rate_limits.window_started_at
        END
      RETURNING attempts, window_started_at
    `;
    if (Number(limit.attempts) > 5) {
      const elapsed = Date.now() - new Date(limit.window_started_at).getTime();
      const retryAfter = Math.max(1, Math.ceil((60 * 60 * 1000 - elapsed) / 1000));
      return NextResponse.json(
        { error: "TOO_MANY_GUESTS", message: "创建次数较多，请稍后再试。" },
        { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } }
      );
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const created = await db.begin(async tx => {
      const [user] = await tx`
        INSERT INTO users (display_name, role, is_guest)
        VALUES ('访客创作者', 'creator', true)
        RETURNING id, display_name, is_guest
      `;
      await tx`
        INSERT INTO creator_sessions (user_id, token_hash, expires_at)
        VALUES (${user.id}, ${tokenHash}, now() + interval '30 days')
      `;
      return user;
    });

    const response = NextResponse.json(
      { user: { id: created.id, displayName: created.display_name, isGuest: true } },
      { headers: { "Cache-Control": "no-store, private", Vary: "Cookie" } }
    );
    response.cookies.set("heart_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "DATABASE_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json(
      { error: status === 503 ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" },
      { status, headers: { "Cache-Control": "no-store, private", Vary: "Cookie" } }
    );
  }
}
