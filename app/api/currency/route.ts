import { NextRequest, NextResponse } from "next/server";
import { getConfig, saveConfig } from "@/lib/storage";
import { SUPPORTED_CURRENCIES } from "@/lib/types";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const config = getConfig(session.userId);
  return NextResponse.json({ currency: config.currency });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const currency = String(body.currency).toLowerCase();

  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    return NextResponse.json({ error: "Unsupported currency" }, { status: 400 });
  }

  const config = getConfig(session.userId);
  config.currency = currency;
  saveConfig(session.userId, config);

  return NextResponse.json({ currency });
}
