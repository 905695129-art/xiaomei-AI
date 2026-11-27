import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDb } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/security";

export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "no-store, private", Vary: "Cookie" };
function authJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(privateHeaders);
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  return NextResponse.json(body, { ...init, headers });
}
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
  if (!isSameOriginWrite(request)) return authJson({ error: "BAD_ORIGIN" }, { status: 403 });
  const maxBodyBytes = 16 * 1024;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    return authJson({ error: "REQUEST_TOO_LARGE" }, { status: 413, headers: { "Cache-Control": "no-store" } });
  }

  // Content-Length is optional and can be omitted by streaming clients. Enforce
  // the limit while reading so a chunked request cannot bypass the body cap.
  let rawBody = "";
  if (request.body) {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > maxBodyBytes) {
          await reader.cancel();
          return authJson({ error: "REQUEST_TOO_LARGE" }, { status: 413, headers: { "Cache-Control": "no-store" } });
        }
        chunks.push(value);
      }
    } catch {
      return authJson({ error: "INVALID_REQUEST_BODY" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    const body = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    rawBody = new TextDecoder().decode(body);
  }
  let bodyValue: unknown = null;
  try {
    bodyValue = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return authJson({ error: "INVALID_JSON" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const parsed = inputSchema.safeParse(bodyValue);
  if (!parsed.success) return authJson({ error: "INVALID_INPUT", message: "邮箱格式不正确，密码至少 10 位。" }, { status: 400 });
  try {
    const db = requireDb();
    // Expired sessions cannot authenticate; prune them during normal auth traffic.
    await db`DELETE FROM creator_sessions WHERE expires_at < now()`;
    // Opportunistically prune expired throttle keys so arbitrary email attempts
    // cannot grow the rate-limit table indefinitely.
    await db`DELETE FROM auth_rate_limits WHERE window_started_at < now() - interval '1 day'`;
    const { email, password, displayName } = parsed.data;

    // Atomic per-email throttling: 10 attempts per 15-minute window.
    // The database upsert makes concurrent requests share one counter.
    const [limit] = await db`
      INSERT INTO auth_rate_limits (email, window_started_at, attempts)
      VALUES (${email}, now(), 1)
      ON CONFLICT (email) DO UPDATE SET
        attempts = CASE
          WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN 1
          ELSE auth_rate_limits.attempts + 1
        END,
        window_started_at = CASE
          WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN now()
          ELSE auth_rate_limits.window_started_at
        END
      RETURNING attempts, window_started_at
    `;
    if (Number(limit.attempts) > 10) {
      const elapsedMs = Date.now() - new Date(limit.window_started_at).getTime();
      const retryAfter = Math.max(1, Math.ceil((15 * 60 * 1000 - elapsedMs) / 1000));
      return authJson(
        { error: "TOO_MANY_ATTEMPTS", message: "尝试次数过多，请稍后再试。" },
        { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } }
      );
    }

    const rows = await db`SELECT id, email, display_name, password_hash FROM users WHERE email = ${email} LIMIT 1`;
    let user = rows[0];
    if (request.headers.get("x-heart-mode") === "register") {
      if (user) return authJson({ error: "EMAIL_EXISTS" }, { status: 409 });
      const salt = randomBytes(16).toString("hex");
      const passwordHash = `scrypt:${salt}:${hashPassword(password, salt)}`;
      const created = await db`INSERT INTO users (email, display_name, password_hash, role) VALUES (${email}, ${displayName ?? email.split("@")[0]}, ${passwordHash}, 'creator') RETURNING id, email, display_name`;
      user = created[0];
    } else {
      if (!user?.password_hash?.startsWith("scrypt:")) {
        // Perform a dummy scrypt operation so unknown accounts do not return
        // dramatically faster than accounts with an incorrect password.
        safeEqual(hashPassword(password, "heart-studio-dummy-auth-salt"), "0".repeat(128));
        return authJson({ error: "INVALID_CREDENTIALS" }, { status: 401 });
      }
      const [, salt, stored] = user.password_hash.split(":");
      if (!salt || !/^[a-f0-9]{128}$/i.test(stored ?? "")) {
        safeEqual(hashPassword(password, "heart-studio-dummy-auth-salt"), "0".repeat(128));
        return authJson({ error: "INVALID_CREDENTIALS" }, { status: 401 });
      }
      const candidate = hashPassword(password, salt);
      if (!safeEqual(candidate, stored)) return authJson({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await db`INSERT INTO creator_sessions (user_id, token_hash, expires_at) VALUES (${user.id}, ${tokenHash}, now() + interval '14 days')`;
    await db`DELETE FROM auth_rate_limits WHERE email = ${email}`;
    const response = authJson({ user: { id: user.id, email: user.email, displayName: user.display_name } }, { headers: { "Cache-Control": "no-store, private", Vary: "Cookie" } });
    response.cookies.set("heart_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14 });
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    return authJson({ error: code === "DATABASE_NOT_CONFIGURED" ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status: code === "DATABASE_NOT_CONFIGURED" ? 503 : 500 });
  }
}
