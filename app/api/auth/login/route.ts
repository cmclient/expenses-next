import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserByUsername } from "@/lib/storage";
import { createSession, COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { username, password } = body;

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  const user = getUserByUsername(String(username));
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await bcrypt.compare(String(password), user.password);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createSession({
    userId: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
  });

  const response = NextResponse.json({
    user: { id: user.id, username: user.username, isAdmin: user.isAdmin },
  });

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });

  return response;
}
