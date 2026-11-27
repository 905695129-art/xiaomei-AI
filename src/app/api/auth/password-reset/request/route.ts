import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDb } from "@/lib/db";
import { escapeEmailHtml, isEmailDeliveryConfigured, sendTransactionalEmail } from "@/lib/email";
import { isSameOriginWrite, readJsonLimited } from "@/lib/security";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
const schema = z.object({ email: z.string().trim().email().max(254).transform(value => value.toLowerCase()) });

export async function POST(request: Request) {
  if (!isSameOriginWrite(request)) return NextResponse.json({ error: "BAD_ORIGIN" }, { status: 403, headers });
  if (!isEmailDeliveryConfigured()) return NextResponse.json({ error: "EMAIL_DELIVERY_NOT_CONFIGURED" }, { status: 503, headers });
  try {
    const body = await readJsonLimited(request);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers });
    const parsed = schema.safeParse(body.value);
    if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400, headers });
    const { email } = parsed.data;
    const db = requireDb();
    await db`DELETE FROM email_action_rate_limits WHERE window_started_at < now() - interval '1 day'`;
    const [limit] = await db`
      INSERT INTO email_action_rate_limits (email, action, window_started_at, attempts)
      VALUES (${email}, 'password_reset', now(), 1)
      ON CONFLICT (email, action) DO UPDATE SET
        attempts = CASE WHEN email_action_rate_limits.window_started_at < now() - interval '1 hour' THEN 1 ELSE email_action_rate_limits.attempts + 1 END,
        window_started_at = CASE WHEN email_action_rate_limits.window_started_at < now() - interval '1 hour' THEN now() ELSE email_action_rate_limits.window_started_at END
      RETURNING attempts
    `;
    if (Number(limit.attempts) > 3) return NextResponse.json({ ok: true, message: "如果该邮箱已注册，重置说明将发送至邮箱。" }, { headers });

    const [user] = await db`SELECT id, email FROM users WHERE email = ${email} LIMIT 1`;
    // Keep the response identical for known and unknown addresses to prevent account enumeration.
    if (!user) return NextResponse.json({ ok: true, message: "如果该邮箱已注册，重置说明将发送至邮箱。" }, { headers });

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await db.begin(async tx => {
      await tx`DELETE FROM password_reset_tokens WHERE user_id = ${user.id} AND consumed_at IS NULL`;
      await tx`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (${user.id}, ${tokenHash}, now() + interval '30 minutes')`;
    });
    const resetUrl = `${process.env.APP_URL!.replace(/\/$/, "")}/creator/reset-password?token=${encodeURIComponent(token)}`;
    const safeUrl = escapeEmailHtml(resetUrl);
    await sendTransactionalEmail({
      to: user.email,
      subject: "心意闯关：重置登录密码",
      text: `我们收到了重置心意闯关账户密码的请求。请在 30 分钟内打开以下链接设置新密码：${resetUrl}\n如果不是你本人操作，请忽略此邮件。`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.8;color:#654f58"><h2>重置登录密码</h2><p>请在 30 分钟内点击下方按钮设置新密码。</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 22px;background:#d98da4;color:white;border-radius:10px;text-decoration:none">设置新密码</a></p><p>如果不是你本人操作，请忽略此邮件。</p></div>`
    });
    return NextResponse.json({ ok: true, message: "如果该邮箱已注册，重置说明将发送至邮箱。" }, { headers });
  } catch {
    return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 500, headers });
  }
}
