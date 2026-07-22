import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const rpc =
    process.env.RITUAL_RPC_URL || "https://rpc.ritualfoundation.org";
  const response = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(await request.json()),
    cache: "no-store",
  });
  return NextResponse.json(await response.json(), {
    status: response.status,
  });
}
