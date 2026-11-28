import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { getCurrentCreator } from "@/lib/session";
import { escapeEmailHtml, getPublicAppBaseUrl, isEmailDeliveryConfigured, sendTransactionalEmail } from "@/lib/email";
import { isSameOriginWrite } from "@/lib/security";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", Vary: "Cookie" };

export async function GET() {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
  const db = requireDb();
  const [user] = await db`SELECT email, email_verified_at FROM users WHERE id = ${creator.id} LIMIT 1`;
  return NextResponse.json({ email: user.email, verified: Boolean(user.email_verified_at) }, { headers });
}

export async function POST(request: Request) {
  if (!isSameOriginWrite(request)) return NextResponse.json({ error: "BAD_ORIGIN" }, { status: 403, headers });
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
  if (!isEmailDeliveryConfigured()) return NextResponse.json({ error: "EMAIL_DELIVERY_NOT_CONFIGURED" }, { status: 503, headers });
  try {
    const db = requireDb();
    await db`DELETE FROM email_verification_tokens WHERE expires_at < now() - interval '1 day' OR consumed_at < now() - interval '1 day'`;
    const [user] = await db`SELECT email, email_verified_at FROM users WHERE id = ${creator.id} LIMIT 1`;
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
    if (user.email_verified_at) return NextResponse.json({ ok: true, verified: true, message: "邮箱已经验证。" }, { headers });
    await db`DELETE FROM email_action_rate_limits WHERE window_started_at < now() - interval '1 day'`;
    const [limit] = await db`
      INSERT INTO email_action_rate_limits (email, action, window_started_at, attempts)
      VALUES (${user.email}, 'verify', now(), 1)
      ON CONFLICT (email, action) DO UPDATE SET
        attempts = CASE WHEN email_action_rate_limits.window_started_at < now() - interval '1 hour' THEN 1 ELSE email_action_rate_limits.attempts + 1 END,
        window_started_at = CASE WHEN email_action_rate_limits.window_started_at < now() - interval '1 hour' THEN now() ELSE email_action_rate_limits.window_started_at END
      RETURNING attempts
    `;
    if (Number(limit.attempts) > 3) return NextResponse.json({ error: "TOO_MANY_ATTEMPTS" }, { status: 429, headers });
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await db.begin(async tx => {
      await tx`DELETE FROM email_verification_tokens WHERE user_id = ${creator.id} AND consumed_at IS NULL`;
      await tx`INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES (${creator.id}, ${tokenHash}, now() + interval '24 hours')`;
    });
    const appBaseUrl = getPublicAppBaseUrl();
    if (!appBaseUrl) return NextResponse.json({ error: "EMAIL_DELIVERY_NOT_CONFIGURED" }, { status: 503, headers });
    const verifyUrl = new URL("/creator/verify-email", appBaseUrl);
    verifyUrl.searchParams.set("token", token);
    const verifyLink = verifyUrl.toString();
    const safeUrl = escapeEmailHtml(verifyLink);
    await sendTransactionalEmail({
      to: user.email,
      subject: "心意闯关：验证你的邮箱",
      text: `请在 24 小时内打开以下链接验证邮箱：${verifyLink}\n如果不是你本人操作，请忽略此邮件。`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.8;color:#654f58"><h2>验证邮箱</h2><p>请在 24 小时内点击下方按钮完成验证。</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 22px;background:#d98da4;color:white;border-radius:10px;text-decoration:none">验证邮箱</a></p><p>如果不是你本人操作，请忽略此邮件。</p></div>`
    });
    return NextResponse.json({ ok: true, message: "验证邮件已发送，请检查收件箱。" }, { headers });
  } catch {
    return NextResponse.json({ error: "VERIFICATION_REQUEST_FAILED" }, { status: 500, headers });
  }
}
