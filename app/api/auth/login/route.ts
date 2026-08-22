import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getUserByUsername, getUsers, saveUsers } from "@/lib/storage";
import { createSession, COOKIE_NAME } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import speakeasy from "speakeasy";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { username, password, totpCode, remember } = body;

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  const user = getUserByUsername(String(username));
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await bcrypt.compare(String(password), user.password);
  if (!valid) {
    logActivity(user.id, "login_failed", request, { details: `Failed login attempt for ${username}` });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (user.twofaEnabled) {
    if (!totpCode) {
      return NextResponse.json(
        { error: "2FA code required", requires2fa: true },
        { status: 401 }
      );
    }

    const code = String(totpCode).trim();
    const isNumeric = /^\d{6}$/.test(code);

    if (isNumeric) {
      const verified = speakeasy.totp.verify({
        secret: user.twofaSecret!,
        encoding: "base32",
        token: code,
        window: 1,
      });
      if (!verified) {
        return NextResponse.json({ error: "Invalid 2FA code", requires2fa: true }, { status: 401 });
      }
    } else {
      const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const formatted = normalized.length === 8
        ? `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`
        : code.toUpperCase();
      const hashed = crypto.createHash("sha256").update(formatted).digest("hex");

      const backupCodes = user.twofaBackupCodes || [];
      const codeIdx = backupCodes.indexOf(hashed);
      if (codeIdx === -1) {
        return NextResponse.json({ error: "Invalid backup code", requires2fa: true }, { status: 401 });
      }

      const users = getUsers();
      const userIdx = users.findIndex((u) => u.id === user.id);
      if (userIdx !== -1) {
        users[userIdx].twofaBackupCodes = backupCodes.filter((_, i) => i !== codeIdx);
        saveUsers(users);
      }
    }
  }

  const expirationTime = remember ? "30d" : "1d";
  const token = await createSession({
    userId: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
  }, expirationTime);

  logActivity(user.id, "login", request, { details: `Logged in as ${user.username}` });

  const response = NextResponse.json({
    user: { id: user.id, username: user.username, isAdmin: user.isAdmin },
  });

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: remember ? 30 * 24 * 60 * 60 : 24 * 60 * 60,
    path: "/",
  });

  return response;
}
