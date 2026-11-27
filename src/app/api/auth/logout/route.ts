import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isSameOriginWrite } from "@/lib/security";
import { requireDb } from "@/lib/db";

export async function POST(request: Request) {
  if (!isSameOriginWrite(request)) return NextResponse.json({ error: "BAD_ORIGIN" }, { status: 403 });
  const cookieStore = await cookies();
  const token = cookieStore.get("heart_session")?.value;
  if (token) {
    try {
      const hash = createHash("sha256").update(token).digest("hex");
      await requireDb()`DELETE FROM creator_sessions WHERE token_hash = ${hash}`;
    } catch { /* Cookie is still cleared if the database is temporarily unavailable. */ }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set("heart_session", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
