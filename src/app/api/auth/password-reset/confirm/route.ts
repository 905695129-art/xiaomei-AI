import { createHash, randomBytes, scryptSync } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDb } from "@/lib/db";
import { isSameOriginWrite, readJsonLimited } from "@/lib/security";
import { sendTransactionalEmail } from "@/lib/email";

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
    const db = requireDb();
    const result = await db.begin(async tx => {
      const [reset] = await tx`
        SELECT password_reset_tokens.id, password_reset_tokens.user_id, users.email FROM password_reset_tokens JOIN users ON users.id = password_reset_tokens.user_id
        WHERE token_hash = ${tokenHash} AND consumed_at IS NULL AND expires_at > now()
        FOR UPDATE OF password_reset_tokens
      `;
      if (!reset) return false;
      // Do expensive password hashing only after proving possession of a valid token.
      const salt = randomBytes(16).toString("hex");
      const passwordHash = `scrypt:${salt}:${scryptSync(newPassword, salt, 64).toString("hex")}`;
      await tx`UPDATE users SET password_hash = ${passwordHash}, email_verified_at = COALESCE(email_verified_at, now()) WHERE id = ${reset.user_id}`;
      await tx`UPDATE password_reset_tokens SET consumed_at = now() WHERE id = ${reset.id}`;
      await tx`DELETE FROM password_reset_tokens WHERE user_id = ${reset.user_id} AND id <> ${reset.id}`;
      await tx`DELETE FROM creator_sessions WHERE user_id = ${reset.user_id}`;
      await tx`DELETE FROM password_change_rate_limits WHERE user_id = ${reset.user_id}`;
      return { email: reset.email as string };
    });
    if (!result) return NextResponse.json({ error: "INVALID_OR_EXPIRED_TOKEN" }, { status: 400, headers });
    // The password change is already committed. A notification failure must not
    // undo the reset or expose whether the mail provider is temporarily unavailable.
    try {
      await sendTransactionalEmail({
        to: result.email,
        subject: "心意闯关：账户密码已更新",
        text: "你的心意闯关账户密码刚刚完成重置。如果这不是你本人操作，请立即联系网站支持并采取账户保护措施。",
        html: "<div style=\"font-family:Arial,sans-serif;line-height:1.8;color:#654f58\"><h2>账户密码已更新</h2><p>你的心意闯关账户密码刚刚完成重置。</p><p>如果这不是你本人操作，请立即联系网站支持并采取账户保护措施。</p></div>"
      });
    } catch { /* Password reset remains successful even if the notification email fails. */ }
    return NextResponse.json({ ok: true, message: "密码已重置，请使用新密码重新登录。" }, { headers });
  } catch {
    return NextResponse.json({ error: "RESET_FAILED" }, { status: 500, headers });
  }
}
