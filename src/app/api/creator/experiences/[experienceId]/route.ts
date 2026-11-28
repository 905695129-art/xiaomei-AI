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
const updateSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(1000).optional(),
  theme: z.enum(["rose", "cream", "lavender"]).optional(),
  coverPosition: z.enum(["top", "center", "bottom"]).optional(),
  coverUrl: z.string().max(2048).refine(value => value === "" || /^preset:(rose|cream|lavender|night)$/.test(value) || /^https:\/\//i.test(value), "Invalid cover URL").optional(),
  paymentQrUrl: z.string().max(2048).refine(value => value === "" || /^https:\/\//i.test(value), "Invalid payment QR URL").optional(),
  // Publishing is deliberately handled only by the dedicated publish endpoint.
  status: z.enum(["draft", "archived"]).optional()
}).refine(value => Object.keys(value).length > 0);


export async function GET(_request: Request, context: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await context.params;
  try {
    const creator = await getCurrentCreator();
    if (!creator) return privateJson({ error: "UNAUTHORIZED" }, { status: 401 });
    const db = requireDb();
    const [experience] = await db`SELECT id, slug, title, description, status, theme, cover_url, cover_position, payment_qr_url FROM experiences WHERE id = ${experienceId}::uuid AND creator_id = ${creator.id} LIMIT 1`;
    if (!experience) return privateJson({ error: "NOT_FOUND" }, { status: 404 });
    return privateJson({ experience }, { headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "DATABASE_NOT_CONFIGURED" ? 503 : 500;
    return privateJson({ error: status === 503 ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await context.params;
  if (!isSameOriginWrite(request)) return privateJson({ error: "BAD_ORIGIN" }, { status: 403 });
  try {
    const creator = await getCurrentCreator();
    if (!creator) return privateJson({ error: "UNAUTHORIZED" }, { status: 401 });
    const body = await readJsonLimited(request, 8 * 1024);
    if (!body.ok) return privateJson({ error: body.error }, { status: body.error === "REQUEST_TOO_LARGE" ? 413 : 400 });
    const parsed = updateSchema.safeParse(body.value);
    if (!parsed.success) return privateJson({ error: "INVALID_INPUT" }, { status: 400 });
    const db = requireDb();
    const [updated] = await db`
      UPDATE experiences SET
        title = COALESCE(${parsed.data.title ?? null}, title),
        description = COALESCE(${parsed.data.description ?? null}, description),
        theme = COALESCE(${parsed.data.theme ?? null}, theme),
        cover_url = COALESCE(${parsed.data.coverUrl ?? null}, cover_url),
        cover_position = COALESCE(${parsed.data.coverPosition ?? null}, cover_position),
        payment_qr_url = COALESCE(${parsed.data.paymentQrUrl ?? null}, payment_qr_url),
        status = COALESCE(${parsed.data.status ?? null}, status),
        updated_at = now()
      WHERE id = ${experienceId}::uuid AND creator_id = ${creator.id}
      RETURNING id, slug, title, description, status, theme, cover_url, cover_position, payment_qr_url, updated_at
    `;
    if (!updated) return privateJson({ error: "NOT_FOUND" }, { status: 404 });
    return privateJson({ experience: updated });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "DATABASE_NOT_CONFIGURED" ? 503 : 500;
    return privateJson({ error: status === 503 ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status });
  }
}
