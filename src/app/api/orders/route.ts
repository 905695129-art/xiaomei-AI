import { NextResponse } from "next/server";

export async function POST() {
  // Deliberately fail closed until a compliant marketplace/sub-merchant payment
  // provider, server credentials, callback signature verification and settlement
  // configuration have been approved and deployed.
  return NextResponse.json({
    error: "PAYMENTS_NOT_CONFIGURED",
    message: "当前版本尚未开通真实支付，请勿向任何人转账。"
  }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
