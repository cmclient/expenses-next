import { NextRequest, NextResponse } from "next/server";
import { getConfig, saveConfig } from "@/lib/storage";
import { sanitizeString } from "@/lib/utils";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const config = getConfig(session.userId);
  return NextResponse.json(config.categories);
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const categories: string[] = body.categories;

  if (!Array.isArray(categories) || categories.length === 0) {
    return NextResponse.json({ error: "Categories must be a non-empty array" }, { status: 400 });
  }

  const sanitized = categories
    .map((c: string) => sanitizeString(c))
    .filter((c: string) => c.length > 0 && c.length <= 255);

  if (sanitized.length === 0) {
    return NextResponse.json({ error: "No valid categories after sanitization" }, { status: 400 });
  }

  const config = getConfig(session.userId);
  config.categories = sanitized;
  saveConfig(session.userId, config);

  return NextResponse.json({ categories: sanitized });
}
