import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserById } from "@/lib/storage";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = getUserById(session.userId);
  return NextResponse.json({
    user: session,
    has2fa: user?.twofaEnabled || false,
    backupCodesRemaining: user?.twofaBackupCodes?.length || 0,
  });
}
