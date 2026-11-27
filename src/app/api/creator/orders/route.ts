import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { getCurrentCreator } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const creator = await getCurrentCreator();
    if (!creator) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const db = requireDb();
    const [summary] = await db`
      SELECT
        COUNT(*)::int AS total_orders,
        COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_orders,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_orders,
        COUNT(*) FILTER (WHERE status = 'refunded')::int AS refunded_orders,
        COALESCE(SUM(amount_minor) FILTER (WHERE status = 'paid'), 0)::bigint AS paid_amount_minor
      FROM orders WHERE creator_id = ${creator.id}
    `;
    const orders = await db`
      SELECT o.id, o.amount_minor, o.currency, o.status, o.created_at, o.paid_at,
        e.title AS experience_title, l.title AS level_title
      FROM orders o
      JOIN experiences e ON e.id = o.experience_id
      JOIN experience_levels l ON l.id = o.level_id
      WHERE o.creator_id = ${creator.id}
      ORDER BY o.created_at DESC
      LIMIT 100
    `;
    return NextResponse.json({ summary, orders, paymentsEnabled: false });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "DATABASE_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json({ error: status === 503 ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR" }, { status });
  }
}
