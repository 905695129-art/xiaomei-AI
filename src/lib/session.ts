import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { requireDb } from "@/lib/db";

export async function getCurrentCreator() {
  const cookieStore = await cookies();
  const token = cookieStore.get("heart_session")?.value;
  if (!token) return null;
  const db = requireDb();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const rows = await db`
    SELECT u.id, u.email, u.display_name, u.role
    FROM creator_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash} AND s.expires_at > now() AND u.deleted_at IS NULL
    LIMIT 1
  `;
  return rows[0] ?? null;
}
