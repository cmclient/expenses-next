import { NextResponse } from "next/server";
import { getConfig } from "@/lib/storage";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const config = getConfig(session.userId);
  return NextResponse.json(config);
}
