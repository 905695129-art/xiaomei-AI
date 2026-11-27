import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/security";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

export async function POST(request: Request) {
  if (!isSameOriginWrite(request)) return NextResponse.json({ error: "BAD_ORIGIN" }, { status: 403, headers });
  try {
    const length = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(length) && length > 16 * 1024) return NextResponse.json({ error: "REQUEST_TOO_LARGE" }, { status: 413, headers });
    const body = await request.json() as { token?: unknown };
    if (typeof body.token !== "string" || body.token.length < 20 || body.token.length > 200) {
      return NextResponse.json({ error: "INVALID_OR_EXPIRED_TOKEN" }, { status: 400, headers });
    }
    const tokenHash = createHash("sha256").update(body.token).digest("hex");
    const db = requireDb();
    const verified = await db.begin(async tx => {
      const [row] = await tx`
        SELECT id, user_id FROM email_verification_tokens
        WHERE token_hash = ${tokenHash} AND consumed_at IS NULL AND expires_at > now()
        FOR UPDATE
      `;
      if (!row) return false;
      await tx`UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = ${row.user_id}`;
      await tx`UPDATE email_verification_tokens SET consumed_at = now() WHERE id = ${row.id}`;
      await tx`DELETE FROM email_verification_tokens WHERE user_id = ${row.user_id} AND id <> ${row.id}`;
      return true;
    });
    if (!verified) return NextResponse.json({ error: "INVALID_OR_EXPIRED_TOKEN" }, { status: 400, headers });
    return NextResponse.json({ ok: true, message: "邮箱验证成功。" }, { headers });
  } catch {
    return NextResponse.json({ error: "VERIFICATION_FAILED" }, { status: 500, headers });
  }
}
