import { NextRequest, NextResponse } from "next/server";
import { getConfig, saveConfig } from "@/lib/storage";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const config = getConfig(session.userId);
  return NextResponse.json({ startDate: config.startDate });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const startDate = Number(body.startDate);

  if (!Number.isInteger(startDate) || startDate < 1 || startDate > 31) {
    return NextResponse.json({ error: "Start date must be between 1 and 31" }, { status: 400 });
  }

  const config = getConfig(session.userId);
  config.startDate = startDate;
  saveConfig(session.userId, config);

  return NextResponse.json({ startDate });
}
