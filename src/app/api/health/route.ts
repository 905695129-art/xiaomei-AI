import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Liveness only: the process is serving requests. Database readiness is
// checked separately so orchestration can distinguish a live app from a
// temporarily unavailable database.
export async function GET() {
  return NextResponse.json({ status: "ok" }, {
    headers: { "Cache-Control": "no-store" }
  });
}
