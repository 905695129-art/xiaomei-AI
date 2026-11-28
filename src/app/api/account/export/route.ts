import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { getCurrentCreator } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const creator = await getCurrentCreator();
    if (!creator) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401, headers: { "Cache-Control": "no-store, private", Vary: "Cookie" } }
      );
    }

    const db = requireDb();
    const [account] = await db`
      SELECT email, display_name, email_verified_at, created_at
      FROM users WHERE id = ${creator.id} LIMIT 1
    `;
    if (!account) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401, headers: { "Cache-Control": "no-store, private", Vary: "Cookie" } }
      );
    }

    const experiences = await db`
      SELECT id, slug, title, description, cover_url, cover_position, theme,
        status, currency, created_at, updated_at
      FROM experiences
      WHERE creator_id = ${creator.id}
      ORDER BY created_at ASC
    `;
    const levels = await db`
      SELECT l.id, l.experience_id, l.position, l.title, l.teaser,
        l.price_minor, l.private_content, l.is_active, l.created_at, l.updated_at
      FROM experience_levels l
      JOIN experiences e ON e.id = l.experience_id
      WHERE e.creator_id = ${creator.id}
      ORDER BY l.experience_id, l.position, l.created_at
    `;
    const journeyResponses = await db`
      SELECT r.id, r.experience_id, e.title AS experience_title,
        r.level_id, l.title AS level_title, l.position,
        r.reaction, r.created_at, r.updated_at, r.read_at
      FROM journey_responses r
      JOIN experiences e ON e.id = r.experience_id
      JOIN experience_levels l ON l.id = r.level_id
      WHERE e.creator_id = ${creator.id}
      ORDER BY r.created_at ASC
    `;
    const orders = await db`
      SELECT o.id, o.experience_id, e.title AS experience_title,
        o.level_id, COALESCE(o.level_title_snapshot, ent.level_title_snapshot, l.title) AS level_title,
        o.amount_minor, o.currency, o.status, o.provider, o.created_at, o.paid_at, o.refunded_at
      FROM orders o
      LEFT JOIN experiences e ON e.id = o.experience_id
      LEFT JOIN experience_levels l ON l.id = o.level_id
      LEFT JOIN entitlements ent ON ent.order_id = o.id
      WHERE o.creator_id = ${creator.id}
      ORDER BY o.created_at ASC
    `;

    const payload = {
      exportType: "heart-studio-account-data",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      account: {
        email: account.email,
        displayName: account.display_name,
        emailVerifiedAt: account.email_verified_at,
        createdAt: account.created_at
      },
      experiences,
      levels,
      creatorOrders: orders,
      journeyResponses,
      excludedForSecurity: [
        "密码哈希和盐值",
        "登录会话令牌及其哈希",
        "密码重置和邮箱验证令牌",
        "买家会话标识及支付服务商原始凭据"
      ]
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="heart-studio-account-export.json"',
        "Cache-Control": "no-store, private",
        Vary: "Cookie",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json(
      { error: "EXPORT_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store, private", Vary: "Cookie" } }
    );
  }
}
