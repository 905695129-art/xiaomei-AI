import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  // Avoid crashing static builds; every DB-backed request checks availability.
}
export const sql = url
  ? postgres(url, { max: 5, idle_timeout: 20, connect_timeout: 10, prepare: false })
  : null;

export function requireDb() {
  if (!sql) throw new Error("DATABASE_NOT_CONFIGURED");
  return sql;
}
