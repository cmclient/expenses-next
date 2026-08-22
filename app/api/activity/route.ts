import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getActivityLogs } from "@/lib/storage";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const logs = getActivityLogs(session.userId);
  return NextResponse.json({ logs });
}
