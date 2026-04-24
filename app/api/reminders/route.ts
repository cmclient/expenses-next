import { NextRequest, NextResponse } from "next/server";
import { getReminders, saveReminders, getConfig } from "@/lib/storage";
import { Reminder, VALID_INTERVALS } from "@/lib/types";
import { sanitizeString } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";
import { getSession } from "@/lib/auth";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function computeNextDueDate(startDate: string, intervalAmount: number, intervalType: string): string {
  const now = new Date();
  let current = new Date(startDate);

  while (current <= now) {
    switch (intervalType) {
      case "daily":
        current = new Date(current.getTime() + intervalAmount * 86400000);
        break;
      case "weekly":
        current = new Date(current.getTime() + intervalAmount * 7 * 86400000);
        break;
      case "monthly":
        current = new Date(current.getFullYear(), current.getMonth() + intervalAmount, current.getDate());
        break;
      case "yearly":
        current = new Date(current.getFullYear() + intervalAmount, current.getMonth(), current.getDate());
        break;
    }
  }

  return current.toISOString();
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const reminders = getReminders(session.userId);
  return NextResponse.json({ reminders });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const config = getConfig(session.userId);

  const name = sanitizeString(String(body.name || ""));
  if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });

  const payer = sanitizeString(String(body.payer || ""));
  if (!payer) return NextResponse.json({ error: "Payer cannot be empty" }, { status: 400 });

  if (!body.category) return NextResponse.json({ error: "Category is required" }, { status: 400 });
  if (!body.amount || Number(body.amount) <= 0) return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
  if (!body.startDate) return NextResponse.json({ error: "Start date is required" }, { status: 400 });

  const intervalType = body.intervalType;
  if (!VALID_INTERVALS.includes(intervalType)) {
    return NextResponse.json({ error: "Invalid interval type" }, { status: 400 });
  }

  const intervalAmount = Number(body.intervalAmount) || 1;
  if (intervalAmount < 1) return NextResponse.json({ error: "Interval amount must be at least 1" }, { status: 400 });

  const alerts = {
    browser: !!body.alerts?.browser,
    email: !!body.alerts?.email,
    emailAddress: body.alerts?.email ? normalizeEmail(String(body.alerts.emailAddress || "")) : undefined,
    discord: !!body.alerts?.discord,
    discordWebhookUrl: body.alerts?.discord ? String(body.alerts.discordWebhookUrl || "") : undefined,
    discordUsername: body.alerts?.discord ? sanitizeString(String(body.alerts.discordUsername || "")) : undefined,
    discordAvatarUrl: body.alerts?.discord ? String(body.alerts.discordAvatarUrl || "") : undefined,
  };

  if (alerts.email && !alerts.emailAddress) {
    return NextResponse.json({ error: "Email address is required when email alerts are enabled" }, { status: 400 });
  }
  if (alerts.email && alerts.emailAddress && !isValidEmail(alerts.emailAddress)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  if (alerts.discord && !alerts.discordWebhookUrl) {
    return NextResponse.json({ error: "Discord webhook URL is required when Discord alerts are enabled" }, { status: 400 });
  }

  if (alerts.discord && alerts.discordWebhookUrl) {
    try {
      const url = new URL(alerts.discordWebhookUrl);
      if (!url.hostname.endsWith("discord.com") || !url.pathname.startsWith("/api/webhooks/")) {
        return NextResponse.json({ error: "Invalid Discord webhook URL" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid Discord webhook URL format" }, { status: 400 });
    }
  }

  const startDateISO = new Date(body.startDate).toISOString();
  const nextDueDate = computeNextDueDate(startDateISO, intervalAmount, intervalType);

  const reminder: Reminder = {
    id: uuidv4(),
    name,
    payer,
    category: String(body.category),
    amount: Math.abs(Number(body.amount)),
    currency: body.currency || config.currency,
    intervalAmount,
    intervalType,
    startDate: startDateISO,
    nextDueDate,
    alerts,
    paid: false,
    createdAt: new Date().toISOString(),
  };

  const reminders = getReminders(session.userId);
  reminders.push(reminder);
  saveReminders(session.userId, reminders);

  return NextResponse.json({ reminder }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const reminders = getReminders(session.userId);
  const idx = reminders.findIndex((r) => r.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  reminders.splice(idx, 1);
  saveReminders(session.userId, reminders);

  return NextResponse.json({ success: true });
}
