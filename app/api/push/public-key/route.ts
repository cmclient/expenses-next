import { NextResponse } from "next/server";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export async function GET() {
  if (!publicKey) {
    return NextResponse.json({ enabled: false, error: "VAPID public key is not configured" }, { status: 503 });
  }

  return NextResponse.json({ enabled: true, publicKey });
}
