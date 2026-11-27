import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const db = requireDb();
    const cookieStore = cookies();
    const existingToken = cookieStore.get("heart_buyer")?.value;

    // Preserve the existing buyer identity so purchase history and entitlements
    // remain attached to this browser instead of creating a fresh identity per visit.
    if (existingToken) {
      const existingHash = createHash("sha256").update(existingToken).digest("hex");
      const existing = await db.unsafe(
        "SELECT buyer_ref FROM buyer_sessions WHERE token_hash = $1 AND expires_at > now() LIMIT 1",
        [existingHash]
      );
      if (existing.length) return NextResponse.json({ ok: true, existing: true });
    }

    const token = randomBytes(32).toString("base64url");
    const buyerRef = randomBytes(18).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await db.unsafe(
      "INSERT INTO buyer_sessions (buyer_ref, token_hash, expires_at) VALUES ($1, $2, now() + interval '180 days')",
      [buyerRef, tokenHash]
    );
    const response = NextResponse.json({ ok: true, existing: false });
    response.cookies.set("heart_buyer", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 180
    });
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json(
      { error: code === "DATABASE_NOT_CONFIGURED" ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" },
      { status: code === "DATABASE_NOT_CONFIGURED" ? 503 : 500 }
    );
  }
}
