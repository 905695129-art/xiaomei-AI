import { scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { getCurrentCreator } from "@/lib/session";
import { isSameOriginWrite, readJsonLimited } from "@/lib/security";

export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "no-store, private", Vary: "Cookie" };

function verifyPassword(password: string, stored: string) {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt" || !/^[a-f0-9]{32}$/i.test(parts[1]) || !/^[a-f0-9]{128}$/i.test(parts[2])) return false;
  const candidate = scryptSync(password, parts[1], 64);
  const expected = Buffer.from(parts[2], "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function POST(request: Request) {
  if (!isSameOriginWrite(request)) {
    return NextResponse.json({ error: "BAD_ORIGIN" }, { status: 403, headers: privateHeaders });
  }
  const body = await readJsonLimited(request, 4096);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: privateHeaders });
  }
  const value = body.value as { password?: unknown; confirmation?: unknown };
  if (typeof value.password !== "string" || value.password.length < 10 || value.password.length > 128 || value.confirmation !== "DELETE") {
    return NextResponse.json({ error: "INVALID_CONFIRMATION" }, { status: 400, headers: privateHeaders });
  }

  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: privateHeaders });

  try {
    const db = requireDb();
    const deleted = await db.begin(async tx => {
      const [account] = await tx`
        SELECT id, password_hash, email FROM users
        WHERE id = ${creator.id} AND deleted_at IS NULL
        FOR UPDATE
      `;
      if (!account?.password_hash || !verifyPassword(value.password as string, account.password_hash)) return false;

      // Preserve financial audit rows and foreign-key integrity, but remove the
      // creator's identifying profile and unpublished/published creative content.
      await tx`
        UPDATE experiences
        SET status = 'archived', title = '已删除的作品', description = '',
            cover_url = NULL, updated_at = now()
        WHERE creator_id = ${creator.id}
      `;
      await tx`
        UPDATE experience_levels l
        SET title = '已删除的关卡', teaser = '', private_content = '',
            updated_at = now()
        FROM experiences e
        WHERE l.experience_id = e.id AND e.creator_id = ${creator.id}
      `;
      await tx`
        UPDATE orders SET level_title_snapshot = '已删除的关卡',
          private_content_snapshot = NULL
        WHERE creator_id = ${creator.id}
      `;
      await tx`
        UPDATE entitlements en SET level_title_snapshot = '已删除的关卡',
          private_content_snapshot = NULL
        FROM orders o
        WHERE en.order_id = o.id AND o.creator_id = ${creator.id}
      `;
      await tx`
        DELETE FROM creator_sessions WHERE user_id = ${creator.id}
      `;
      await tx`
        DELETE FROM email_verification_tokens WHERE user_id = ${creator.id}
      `;
      await tx`
        DELETE FROM password_reset_tokens WHERE user_id = ${creator.id}
      `;
      await tx`
        DELETE FROM password_change_rate_limits WHERE user_id = ${creator.id}
      `;
      await tx`
        DELETE FROM email_action_rate_limits
        WHERE email = ${account.email}
      `;
      await tx`
        UPDATE users SET email = NULL, password_hash = NULL,
          display_name = '已注销账户', email_verified_at = NULL,
          deleted_at = now()
        WHERE id = ${creator.id}
      `;
      return true;
    });

    if (!deleted) {
      return NextResponse.json({ error: "INVALID_PASSWORD" }, { status: 400, headers: privateHeaders });
    }
    const response = NextResponse.json({
      ok: true,
      message: "账户已注销。账户资料和私密创作内容已清除；依法或为财务审计必须保留的订单记录会继续保留并与账户身份分离。"
    }, { headers: privateHeaders });
    const cookieStore = await cookies();
    response.cookies.set("heart_session", "", {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", path: "/", maxAge: 0
    });
    return response;
  } catch {
    return NextResponse.json({ error: "ACCOUNT_DELETE_FAILED" }, { status: 500, headers: privateHeaders });
  }
}
