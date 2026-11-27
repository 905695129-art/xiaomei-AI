import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDb } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/security";

export const dynamic = "force-dynamic";
const inputSchema = z.object({
  email: z.string().trim().email().max(254).transform(v => v.toLowerCase()),
  password: z.string().min(10).max(128),
  displayName: z.string().trim().min(1).max(40).optional()
});
function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}
function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a, "hex"), bb = Buffer.from(b, "hex");
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export async function POST(request: Request) {
  if (!isSameOriginWrite(request)) return NextResponse.json({ error: "BAD_ORIGIN" }, { status: 403 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", message: "邮箱格式不正确，密码至少 10 位。" }, { status: 400 });
  try {
    const db = requireDb();
    const { email, password, displayName } = parsed.data;
    const rows = await db`SELECT id, email, display_name, password_hash FROM users WHERE email = ${email} LIMIT 1`;
    let user = rows[0];
    if (request.headers.get("x-heart-mode") === "register") {
      if (user) return NextResponse.json({ error: "EMAIL_EXISTS" }, { status: 409 });
      const salt = randomBytes(16).toString("hex");
      const passwordHash = `scrypt:${salt}:${hashPassword(password, salt)}`;
      const created = await db`INSERT INTO users (email, display_name, password_hash, role) VALUES (${email}, ${displayName ?? email.split("@")[0]}, ${passwordHash}, 'creator') RETURNING id, email, display_name`;
      user = created[0];
    } else {
      if (!user?.password_hash?.startsWith("scrypt:")) return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
      const [, salt, stored] = user.password_hash.split(":");
      const candidate = hashPassword(password, salt);
      if (!safeEqual(candidate, stored)) return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await db`INSERT INTO creator_sessions (user_id, token_hash, expires_at) VALUES (${user.id}, ${tokenHash}, now() + interval '14 days')`;
    const response = NextResponse.json({ user: { id: user.id, email: user.email, displayName: user.display_name } });
    response.cookies.set("heart_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14 });
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ error: code === "DATABASE_NOT_CONFIGURED" ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status: code === "DATABASE_NOT_CONFIGURED" ? 503 : 500 });
  }
}
