import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUsers, saveUsers, getUserByUsername, getUserById } from "@/lib/storage";
import { getSession } from "@/lib/auth";
import { User } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { error: "Unauthorized", status: 401 };
  if (!session.isAdmin) return { error: "Forbidden", status: 403 };
  return null;
}

export async function GET() {
  const err = await requireAdmin();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const users = getUsers().map((u) => ({
    id: u.id,
    username: u.username,
    isAdmin: u.isAdmin,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }));

  return NextResponse.json({ users });
}

export async function PUT(request: NextRequest) {
  const err = await requireAdmin();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const body = await request.json();
  const { username, password, isAdmin } = body;

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }
  if (String(username).length < 3 || String(username).length > 32) {
    return NextResponse.json({ error: "Username must be 3-32 characters" }, { status: 400 });
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  if (getUserByUsername(String(username))) {
    return NextResponse.json({ error: "Username already exists" }, { status: 409 });
  }

  const hash = await bcrypt.hash(String(password), 12);
  const now = new Date().toISOString();
  const user: User = {
    id: uuidv4(),
    username: String(username),
    password: hash,
    isAdmin: Boolean(isAdmin),
    createdAt: now,
    updatedAt: now,
  };

  const users = getUsers();
  users.push(user);
  saveUsers(users);

  return NextResponse.json({
    user: { id: user.id, username: user.username, isAdmin: user.isAdmin, createdAt: user.createdAt },
  }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const err = await requireAdmin();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const body = await request.json();
  const { id, password, isAdmin } = body;

  if (!id) return NextResponse.json({ error: "User ID required" }, { status: 400 });

  const users = getUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (password !== undefined) {
    if (String(password).length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    users[idx].password = await bcrypt.hash(String(password), 12);
  }
  if (isAdmin !== undefined) {
    users[idx].isAdmin = Boolean(isAdmin);
  }
  users[idx].updatedAt = new Date().toISOString();
  saveUsers(users);

  return NextResponse.json({
    user: { id: users[idx].id, username: users[idx].username, isAdmin: users[idx].isAdmin },
  });
}

export async function DELETE(request: NextRequest) {
  const err = await requireAdmin();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const body = await request.json();
  const { id } = body;

  if (!id) return NextResponse.json({ error: "User ID required" }, { status: 400 });

  const session = await getSession();
  if (session!.userId === id) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  const users = getUsers();
  const filtered = users.filter((u) => u.id !== id);
  if (filtered.length === users.length) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  saveUsers(filtered);
  return NextResponse.json({ success: true });
}
