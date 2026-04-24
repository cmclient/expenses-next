import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUsers, saveUsers, getUserById } from "@/lib/storage";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = getUserById(session.userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    avatar: user.avatar || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { avatar, currentPassword, newPassword } = body;

  const users = getUsers();
  const idx = users.findIndex((u) => u.id === session.userId);
  if (idx === -1) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (avatar !== undefined) {
    if (typeof avatar !== "string" || avatar.length > 100) {
      return NextResponse.json({ error: "Invalid avatar" }, { status: 400 });
    }
    users[idx].avatar = avatar || undefined;
    users[idx].updatedAt = new Date().toISOString();
    saveUsers(users);
    return NextResponse.json({ success: true, avatar: users[idx].avatar || null });
  }

  if (newPassword !== undefined) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required" }, { status: 400 });
    }
    const valid = await bcrypt.compare(String(currentPassword), users[idx].password);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
    }
    if (String(newPassword).length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
    }
    users[idx].password = await bcrypt.hash(String(newPassword), 12);
    users[idx].updatedAt = new Date().toISOString();
    saveUsers(users);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "No action specified" }, { status: 400 });
}
