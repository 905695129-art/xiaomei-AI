import { createHash, randomBytes, scryptSync } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDb } from "@/lib/db";
import { isSameOriginWrite, readJsonLimited } from "@/lib/security";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
const schema = z.object({
  token: z.string().min(20).max(200),
  newPassword: z.string().min(10).max(128)
});

export async function POST(request: Request) {
  if (!isSameOriginWrite(request)) return NextResponse.json({ error: "BAD_ORIGIN" }, { status: 403, headers });
  try {
    const body = await readJsonLimited(request);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers });
    const parsed = schema.safeParse(body.value);
    if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400, headers });
    const { token, newPassword } = parsed.data;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const salt = randomBytes(16).toString("hex");
    const passwordHash = `scrypt:${salt}:${scryptSync(newPassword, salt, 64).toString("hex")}`;
    const db = requireDb();
    const result = await db.begin(async tx => {
      const [reset] = await tx`
        SELECT id, user_id FROM password_reset_tokens
        WHERE token_hash = ${tokenHash} AND consumed_at IS NULL AND expires_at > now()
        FOR UPDATE
      `;
      if (!reset) return false;
      await tx`UPDATE users SET password_hash = ${passwordHash}, email_verified_at = COALESCE(email_verified_at, now()) WHERE id = ${reset.user_id}`;
      await tx`UPDATE password_reset_tokens SET consumed_at = now() WHERE id = ${reset.id}`;
      await tx`DELETE FROM password_reset_tokens WHERE user_id = ${reset.user_id} AND id <> ${reset.id}`;
      await tx`DELETE FROM creator_sessions WHERE user_id = ${reset.user_id}`;
      await tx`DELETE FROM password_change_rate_limits WHERE user_id = ${reset.user_id}`;
      return true;
    });
    if (!result) return NextResponse.json({ error: "INVALID_OR_EXPIRED_TOKEN" }, { status: 400, headers });
    return NextResponse.json({ ok: true, message: "密码已重置，请使用新密码重新登录。" }, { headers });
  } catch {
    return NextResponse.json({ error: "RESET_FAILED" }, { status: 500, headers });
  }
}
