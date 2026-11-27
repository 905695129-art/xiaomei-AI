import { NextResponse } from "next/server";
import { isSameOriginWrite } from "@/lib/security";
import { z } from "zod";
import { requireDb } from "@/lib/db";
import { getCurrentCreator } from "@/lib/session";

export const dynamic = "force-dynamic";
const updateSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(1000).optional(),
  theme: z.enum(["rose", "cream", "lavender"]).optional(),
  coverPosition: z.enum(["top", "center", "bottom"]).optional(),
  coverUrl: z.string().max(2048).refine(value => value === "" || /^preset:(rose|cream|lavender|night)$/.test(value) || /^https:\/\//i.test(value), "Invalid cover URL").optional(),
  // Publishing is deliberately handled only by the dedicated publish endpoint.
  status: z.enum(["draft", "archived"]).optional()
}).refine(value => Object.keys(value).length > 0);


export async function GET(_request: Request, context: { params: { experienceId: string } }) {
  try {
    const creator = await getCurrentCreator();
    if (!creator) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const db = requireDb();
    const [experience] = await db`SELECT id, slug, title, description, status, theme, cover_url, cover_position FROM experiences WHERE id = ${context.params.experienceId}::uuid AND creator_id = ${creator.id} LIMIT 1`;
    if (!experience) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ experience }, { headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "DATABASE_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json({ error: status === 503 ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status });
  }
}

export async function PATCH(request: Request, context: { params: { experienceId: string } }) {
  if (!isSameOriginWrite(request)) return NextResponse.json({ error: "BAD_ORIGIN" }, { status: 403 });
  try {
    const creator = await getCurrentCreator();
    if (!creator) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    const db = requireDb();
    const [updated] = await db`
      UPDATE experiences SET
        title = COALESCE(${parsed.data.title ?? null}, title),
        description = COALESCE(${parsed.data.description ?? null}, description),
        theme = COALESCE(${parsed.data.theme ?? null}, theme),
        cover_url = COALESCE(${parsed.data.coverUrl ?? null}, cover_url),
        cover_position = COALESCE(${parsed.data.coverPosition ?? null}, cover_position),
        status = COALESCE(${parsed.data.status ?? null}, status),
        updated_at = now()
      WHERE id = ${context.params.experienceId}::uuid AND creator_id = ${creator.id}
      RETURNING id, slug, title, description, status, theme, cover_url, cover_position, updated_at
    `;
    if (!updated) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ experience: updated });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "DATABASE_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json({ error: status === 503 ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status });
  }
}
