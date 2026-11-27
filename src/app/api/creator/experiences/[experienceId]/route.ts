import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDb } from "@/lib/db";
import { getCurrentCreator } from "@/lib/session";

export const dynamic = "force-dynamic";
const updateSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(["draft", "published", "archived"]).optional()
}).refine(value => Object.keys(value).length > 0);

export async function PATCH(request: Request, context: { params: { experienceId: string } }) {
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
        status = COALESCE(${parsed.data.status ?? null}, status),
        updated_at = now()
      WHERE id = ${context.params.experienceId}::uuid AND creator_id = ${creator.id}
      RETURNING id, slug, title, description, status, updated_at
    `;
    if (!updated) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ experience: updated });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "DATABASE_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json({ error: status === 503 ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status });
  }
}
