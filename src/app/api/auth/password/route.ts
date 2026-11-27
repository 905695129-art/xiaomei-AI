import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDb } from "@/lib/db";
import { getCurrentCreator } from "@/lib/session";
import { isSameOriginWrite } from "@/lib/security";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", Vary: "Cookie" };
const schema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(10).max(128) });

function passwordHash(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}
function matches(candidate: string, stored: string) {
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(stored, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!isSameOriginWrite(request)) return NextResponse.json({ error: "BAD_ORIGIN" }, { status: 403, headers });
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers });

  const maxBytes = 16 * 1024;
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > maxBytes) return NextResponse.json({ error: "REQUEST_TOO_LARGE" }, { status: 413, headers });
  let raw = "";
  if (request.body) {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          return NextResponse.json({ error: "REQUEST_TOO_LARGE" }, { status: 413, headers });
        }
        chunks.push(value);
      }
    } catch {
      return NextResponse.json({ error: "INVALID_REQUEST_BODY" }, { status: 400, headers });
    }
    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    raw = new TextDecoder().decode(body);
  }
  let value: unknown;
  try { value = raw ? JSON.parse(raw) : null; }
  catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400, headers }); }
  const parsed = schema.safeParse(value);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", message: "当前密码不能为空，新密码至少 10 位。" }, { status: 400, headers });
  if (parsed.data.currentPassword === parsed.data.newPassword) return NextResponse.json({ error: "PASSWORD_UNCHANGED" }, { status: 400, headers });

  try {
    const db = requireDb();
    const [user] = await db`SELECT password_hash FROM users WHERE id = ${creator.id} LIMIT 1`;
    if (!user?.password_hash?.startsWith("scrypt:")) return NextResponse.json({ error: "PASSWORD_NOT_AVAILABLE" }, { status: 409, headers });
    const [, salt, stored] = user.password_hash.split(":");
    if (!matches(passwordHash(parsed.data.currentPassword, salt), stored)) {
      return NextResponse.json({ error: "INVALID_CURRENT_PASSWORD" }, { status: 401, headers });
    }
    const newSalt = randomBytes(16).toString("hex");
    const nextHash = `scrypt:${newSalt}:${passwordHash(parsed.data.newPassword, newSalt)}`;
    const cookieStore = await cookies();
    const token = cookieStore.get("heart_session")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await db.begin(async tx => {
      await tx`UPDATE users SET password_hash = ${nextHash} WHERE id = ${creator.id}`;
      await tx`DELETE FROM creator_sessions WHERE user_id = ${creator.id} AND token_hash <> ${tokenHash}`;
    });
    return NextResponse.json({ ok: true, otherSessionsRevoked: true }, { headers });
  } catch {
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500, headers });
  }
}
