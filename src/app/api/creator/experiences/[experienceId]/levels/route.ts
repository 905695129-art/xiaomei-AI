import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDb } from "@/lib/db";
import { getCurrentCreator } from "@/lib/session";

export const dynamic = "force-dynamic";
const levelSchema = z.object({
  title: z.string().trim().min(1).max(80),
  teaser: z.string().max(240).default(""),
  priceMinor: z.number().int().min(0).max(100000000),
  privateContent: z.string().max(20000)
});
const bodySchema = z.object({ levels: z.array(levelSchema).min(1).max(30) });

export async function GET(_request: Request, context: { params: { experienceId: string } }) {
  try {
    const creator = await getCurrentCreator();
    if (!creator) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const db = requireDb();
    const owns = await db`SELECT id FROM experiences WHERE id = ${context.params.experienceId}::uuid AND creator_id = ${creator.id} LIMIT 1`;
    if (!owns.length) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const rows = await db`SELECT id, position, title, teaser, price_minor, private_content, is_active FROM experience_levels WHERE experience_id = ${context.params.experienceId}::uuid AND is_active = true ORDER BY position`;
    return NextResponse.json({ levels: rows });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ error: code === "DATABASE_NOT_CONFIGURED" ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status: code === "DATABASE_NOT_CONFIGURED" ? 503 : 500 });
  }
}

export async function PUT(request: Request, context: { params: { experienceId: string } }) {
  try {
    const creator = await getCurrentCreator();
    if (!creator) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
    const db = requireDb();
    const result = await db.begin(async tx => {
      const owns = await tx`SELECT id FROM experiences WHERE id = ${context.params.experienceId}::uuid AND creator_id = ${creator.id} FOR UPDATE`;
      if (!owns.length) return null;
      await tx`UPDATE experience_levels SET is_active = false, updated_at = now() WHERE experience_id = ${context.params.experienceId}::uuid AND is_active = true`;
      const saved = [];
      for (let i = 0; i < parsed.data.levels.length; i++) {
        const level = parsed.data.levels[i];
        const rows = await tx`
          INSERT INTO experience_levels (experience_id, position, title, teaser, price_minor, private_content, is_active)
          VALUES (${context.params.experienceId}::uuid, ${i + 1}, ${level.title}, ${level.teaser}, ${level.priceMinor}, ${level.privateContent}, true)
          RETURNING id, position, title, teaser, price_minor
        `;
        saved.push(rows[0]);
      }
      await tx`UPDATE experiences SET updated_at = now() WHERE id = ${context.params.experienceId}::uuid`;
      return saved;
    });
    if (!result) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ levels: result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ error: code === "DATABASE_NOT_CONFIGURED" ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status: code === "DATABASE_NOT_CONFIGURED" ? 503 : 500 });
  }
}
