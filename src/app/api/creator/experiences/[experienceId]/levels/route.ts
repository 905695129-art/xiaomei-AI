import { NextResponse } from "next/server";
import { isSameOriginWrite } from "@/lib/security";
import { z } from "zod";
import { requireDb } from "@/lib/db";
import { getCurrentCreator } from "@/lib/session";

export const dynamic = "force-dynamic";
const levelSchema = z.object({
  id: z.string().uuid().optional(),
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

export async function PUT(request: Request, context: {
  if (!isSameOriginWrite(request)) return NextResponse.json({ error: "BAD_ORIGIN" }, { status: 403 }); params: { experienceId: string } }) {
  try {
    const creator = await getCurrentCreator();
    if (!creator) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
    const db = requireDb();
    const result = await db.begin(async tx => {
      const owns = await tx`SELECT id FROM experiences WHERE id = ${context.params.experienceId}::uuid AND creator_id = ${creator.id} FOR UPDATE`;
      if (!owns.length) return null;

      const submittedIds = parsed.data.levels.flatMap(level => level.id ? [level.id] : []);
      if (new Set(submittedIds).size !== submittedIds.length) return "INVALID_LEVEL_IDS";
      if (submittedIds.length) {
        const ownedLevels = await tx`SELECT id FROM experience_levels WHERE experience_id = ${context.params.experienceId}::uuid AND id = ANY(${submittedIds}::uuid[])`;
        if (ownedLevels.length !== submittedIds.length) return "INVALID_LEVEL_IDS";
      }

      // Freeze the exact level content and amount for every historical paid entitlement
      // before mutating or deactivating the creator's current version.
      await tx`
        UPDATE entitlements ent
        SET level_title_snapshot = COALESCE(ent.level_title_snapshot, l.title),
            level_position_snapshot = COALESCE(ent.level_position_snapshot, l.position),
            private_content_snapshot = COALESCE(ent.private_content_snapshot, l.private_content),
            price_minor_snapshot = COALESCE(ent.price_minor_snapshot, o.amount_minor),
            currency_snapshot = COALESCE(ent.currency_snapshot, o.currency)
        FROM experience_levels l
        JOIN orders o ON o.level_id = l.id AND o.status = 'paid'
        WHERE ent.level_id = l.id
          AND ent.order_id = o.id
          AND ent.buyer_ref = o.buyer_ref
          AND o.experience_id = l.experience_id
          AND l.experience_id = ${context.params.experienceId}::uuid
      `;

      // Temporarily deactivate active rows to avoid position-index conflicts while reordering.
      // Keep existing row IDs stable so previously granted purchase entitlements remain valid.
      await tx`UPDATE experience_levels SET is_active = false, updated_at = now() WHERE experience_id = ${context.params.experienceId}::uuid AND is_active = true`;
      const saved = [];
      for (let i = 0; i < parsed.data.levels.length; i++) {
        const level = parsed.data.levels[i];
        const rows = level.id
          ? await tx`
              UPDATE experience_levels
              SET position = ${i + 1}, title = ${level.title}, teaser = ${level.teaser},
                  price_minor = ${level.priceMinor}, private_content = ${level.privateContent},
                  is_active = true, updated_at = now()
              WHERE id = ${level.id}::uuid AND experience_id = ${context.params.experienceId}::uuid
              RETURNING id, position, title, teaser, price_minor
            `
          : await tx`
              INSERT INTO experience_levels (experience_id, position, title, teaser, price_minor, private_content, is_active)
              VALUES (${context.params.experienceId}::uuid, ${i + 1}, ${level.title}, ${level.teaser}, ${level.priceMinor}, ${level.privateContent}, true)
              RETURNING id, position, title, teaser, price_minor
            `;
        if (!rows[0]) throw new Error("LEVEL_UPDATE_FAILED");
        saved.push(rows[0]);
      }
      await tx`UPDATE experiences SET updated_at = now() WHERE id = ${context.params.experienceId}::uuid`;
      return saved;
    });
    if (!result) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (result === "INVALID_LEVEL_IDS") return NextResponse.json({ error: "INVALID_LEVEL_IDS" }, { status: 400 });
    return NextResponse.json({ levels: result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ error: code === "DATABASE_NOT_CONFIGURED" ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status: code === "DATABASE_NOT_CONFIGURED" ? 503 : 500 });
  }
}
