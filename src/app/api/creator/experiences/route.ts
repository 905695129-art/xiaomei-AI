import { NextResponse } from "next/server";
import { isSameOriginWrite } from "@/lib/security";
import { z } from "zod";
import { requireDb } from "@/lib/db";
import { getCurrentCreator } from "@/lib/session";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().max(1000).default(""),
  slug: z.string().trim().min(3).max(48).regex(/^[a-z0-9-]+$/)
});

export async function GET() {
  try {
    const user = await getCurrentCreator();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const db = requireDb();
    const rows = await db`
      SELECT id, slug, title, description, status, currency, created_at, updated_at
      FROM experiences WHERE creator_id = ${user.id}
      ORDER BY updated_at DESC
    `;
    return NextResponse.json({ experiences: rows });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ error: code === "DATABASE_NOT_CONFIGURED" ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status: code === "DATABASE_NOT_CONFIGURED" ? 503 : 500 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginWrite(request)) return NextResponse.json({ error: "BAD_ORIGIN" }, { status: 403 });
  try {
    const user = await getCurrentCreator();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
    const db = requireDb();
    const [created] = await db`
      INSERT INTO experiences (creator_id, slug, title, description)
      VALUES (${user.id}, ${parsed.data.slug}, ${parsed.data.title}, ${parsed.data.description})
      RETURNING id, slug, title, description, status, created_at
    `;
    return NextResponse.json({ experience: created }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code === "DATABASE_NOT_CONFIGURED") return NextResponse.json({ error: "SERVICE_NOT_CONFIGURED" }, { status: 503 });
    return NextResponse.json({ error: "CONFLICT_OR_INTERNAL_ERROR" }, { status: 409 });
  }
}
