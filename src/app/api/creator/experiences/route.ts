import { NextResponse } from "next/server";
import { isSameOriginWrite, readJsonLimited } from "@/lib/security";
import { z } from "zod";
import { requireDb } from "@/lib/db";
import { getCurrentCreator } from "@/lib/session";

export const dynamic = "force-dynamic";

const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };
function privateJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", privateHeaders["Cache-Control"]);
  headers.set("Vary", privateHeaders.Vary);
  return NextResponse.json(body, { ...init, headers });
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().max(1000).default(""),
  slug: z.string().trim().min(3).max(48).regex(/^[a-z0-9-]+$/)
});

export async function GET() {
  try {
    const user = await getCurrentCreator();
    if (!user) return privateJson({ error: "UNAUTHORIZED" }, { status: 401 });
    const db = requireDb();
    const rows = await db`
      SELECT id, slug, title, description, status, currency, created_at, updated_at
      FROM experiences WHERE creator_id = ${user.id}
      ORDER BY updated_at DESC
    `;
    return privateJson({ experiences: rows, creator: { displayName: user.display_name, email: user.email, isGuest: Boolean(user.is_guest) } }, { headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    return privateJson({ error: code === "DATABASE_NOT_CONFIGURED" ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status: code === "DATABASE_NOT_CONFIGURED" ? 503 : 500 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginWrite(request)) return privateJson({ error: "BAD_ORIGIN" }, { status: 403 });
  try {
    const user = await getCurrentCreator();
    if (!user) return privateJson({ error: "UNAUTHORIZED" }, { status: 401 });
    const body = await readJsonLimited(request, 8 * 1024);
    if (!body.ok) return privateJson({ error: body.error }, { status: body.error === "REQUEST_TOO_LARGE" ? 413 : 400 });
    const parsed = createSchema.safeParse(body.value);
    if (!parsed.success) return privateJson({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
    const db = requireDb();
    const [created] = await db`
      INSERT INTO experiences (creator_id, slug, title, description)
      VALUES (${user.id}, ${parsed.data.slug}, ${parsed.data.title}, ${parsed.data.description})
      RETURNING id, slug, title, description, status, created_at
    `;
    return privateJson({ experience: created }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code === "DATABASE_NOT_CONFIGURED") return privateJson({ error: "SERVICE_NOT_CONFIGURED" }, { status: 503 });
    return privateJson({ error: "CONFLICT_OR_INTERNAL_ERROR" }, { status: 409 });
  }
}
