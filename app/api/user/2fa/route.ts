import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUsers, saveUsers } from "@/lib/storage";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import crypto from "crypto";

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const hex = crypto.randomBytes(4).toString("hex").toUpperCase();
    codes.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}`);
  }
  return codes;
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = getUsers();
  const idx = users.findIndex((u) => u.id === session.userId);
  if (idx === -1) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const secret = speakeasy.generateSecret({
    name: `Expenses (${users[idx].username})`,
    issuer: "Expenses",
  });

  users[idx].twofaSecret = secret.base32;
  users[idx].twofaEnabled = false;
  users[idx].updatedAt = new Date().toISOString();
  saveUsers(users);

  const otpauthUrl = secret.otpauth_url!;
  const qr = await QRCode.toDataURL(otpauthUrl);

  return NextResponse.json({
    qr,
    secret: secret.base32,
    issuer: "Expenses",
    accountName: users[idx].username,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { code } = body;

  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  const users = getUsers();
  const idx = users.findIndex((u) => u.id === session.userId);
  if (idx === -1) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!users[idx].twofaSecret) {
    return NextResponse.json({ error: "2FA setup not started" }, { status: 400 });
  }

  const verified = speakeasy.totp.verify({
    secret: users[idx].twofaSecret!,
    encoding: "base32",
    token: code,
    window: 1,
  });

  if (!verified) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const backupCodes = generateBackupCodes();
  users[idx].twofaEnabled = true;
  users[idx].twofaBackupCodes = backupCodes.map(hashCode);
  users[idx].updatedAt = new Date().toISOString();
  saveUsers(users);

  return NextResponse.json({ ok: true, backupCodes });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = getUsers();
  const idx = users.findIndex((u) => u.id === session.userId);
  if (idx === -1) return NextResponse.json({ error: "User not found" }, { status: 404 });

  delete users[idx].twofaSecret;
  users[idx].twofaEnabled = false;
  delete users[idx].twofaBackupCodes;
  users[idx].updatedAt = new Date().toISOString();
  saveUsers(users);

  return NextResponse.json({ ok: true });
}
