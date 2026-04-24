import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getUsers, getReminders, saveReminders, getPushSubscriptions, savePushSubscriptions } from "@/lib/storage";
import { Reminder } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const DATA_DIR = process.env.STORAGE_URL || path.join(process.cwd(), "data");
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:no-reply@example.com";

type WebPushModule = {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  sendNotification: (subscription: unknown, payload?: string) => Promise<unknown>;
};

let webPushModulePromise: Promise<WebPushModule> | null = null;
let webPushConfigured = false;

function getUserIdsForCron(): string[] {
  const ids = new Set<string>(getUsers().map((u) => u.id));
  const usersDir = path.join(DATA_DIR, "users");

  try {
    if (fs.existsSync(usersDir)) {
      const entries = fs.readdirSync(usersDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          ids.add(entry.name);
        }
      }
    }
  } catch (err) {
    console.warn("[Reminders] Failed to scan user directories for cron:", err);
  }

  return Array.from(ids);
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!SMTP_HOST || !SMTP_USER) {
    console.warn("[Reminders] SMTP not configured, skipping email alert");
    return false;
  }

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
    });
    console.log(`[Reminders] Email sent to ${to}`);
    return true;
  } catch (err) {
    console.error("[Reminders] Failed to send email:", err);
    return false;
  }
}

async function sendDiscordWebhook(
  webhookUrl: string,
  reminder: Reminder,
  status: string,
  timeInfo: string,
  username?: string,
  avatarUrl?: string
): Promise<boolean> {
  try {
    const url = new URL(webhookUrl);
    if (!url.hostname.endsWith("discord.com") || !url.pathname.startsWith("/api/webhooks/")) {
      console.error("[Reminders] Invalid Discord webhook URL, skipping");
      return false;
    }
  } catch {
    console.error("[Reminders] Invalid Discord webhook URL format, skipping");
    return false;
  }

  const statusColor = status === "overdue" ? 0xff4444 : status === "unpaid" ? 0xffaa00 : 0x44ff44;
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  const embed = {
    title: `💰 Payment Reminder: ${reminder.name}`,
    color: statusColor,
    fields: [
      { name: "From", value: reminder.payer, inline: true },
      { name: "Amount", value: formatCurrency(reminder.amount, reminder.currency), inline: true },
      { name: "Category", value: reminder.category, inline: true },
      { name: "Status", value: statusLabel, inline: true },
      { name: "Due Date", value: new Date(reminder.nextDueDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), inline: true },
      { name: "Time Info", value: timeInfo, inline: true },
    ],
    footer: { text: "Expenses Reminder System" },
    timestamp: new Date().toISOString(),
  };

  const payload: Record<string, unknown> = { embeds: [embed] };
  if (username) payload.username = username;
  if (avatarUrl) payload.avatar_url = avatarUrl;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("[Reminders] Discord webhook failed:", res.status, await res.text());
      return false;
    } else {
      console.log(`[Reminders] Discord webhook sent for ${reminder.name}`);
      return true;
    }
  } catch (err) {
    console.error("[Reminders] Discord webhook error:", err);
    return false;
  }
}

async function getWebPushModule(): Promise<WebPushModule | null> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return null;

  if (!webPushModulePromise) {
    webPushModulePromise = import("web-push").then((mod) => {
      const resolved = ((mod as unknown as { default?: WebPushModule }).default || (mod as unknown as WebPushModule));
      return resolved;
    });
  }

  const webPush = await webPushModulePromise;
  if (!webPushConfigured) {
    webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    webPushConfigured = true;
  }

  return webPush;
}

async function sendWebPushAlert(
  userId: string,
  reminder: Reminder,
  status: string,
  timeInfo: string
): Promise<boolean> {
  const webPush = await getWebPushModule();
  if (!webPush) return false;

  const subscriptions = getPushSubscriptions(userId);
  if (!subscriptions.length) return false;

  const payload = JSON.stringify({
    title: status === "overdue" ? `Overdue: ${reminder.name}` : `Due Soon: ${reminder.name}`,
    body: `${reminder.payer} owes ${formatCurrency(reminder.amount, reminder.currency)} • ${timeInfo}`,
    url: "/reminders",
  });

  let sentCount = 0;
  const validSubscriptions = [] as typeof subscriptions;

  for (const subscription of subscriptions) {
    try {
      await webPush.sendNotification(subscription, payload);
      sentCount++;
      validSubscriptions.push(subscription);
    } catch (err: unknown) {
      const statusCode = typeof err === "object" && err && "statusCode" in err ? Number((err as { statusCode?: number }).statusCode) : 0;

      if (statusCode !== 404 && statusCode !== 410) {
        console.error("[Reminders] Web push send failed:", err);
        validSubscriptions.push(subscription);
      }
    }
  }

  if (validSubscriptions.length !== subscriptions.length) {
    savePushSubscriptions(userId, validSubscriptions);
  }

  return sentCount > 0;
}

function isSameUtcDay(dateA: string, dateB: Date): boolean {
  return dateA.slice(0, 10) === dateB.toISOString().slice(0, 10);
}

function getTimeInfo(nextDueDate: string): { status: string; timeInfo: string } {
  const now = new Date();
  const due = new Date(nextDueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffMs <= 0) {
    const overdueDays = Math.floor(Math.abs(diffDays));
    const overdueHours = Math.floor(Math.abs(diffHours) % 24);
    return {
      status: "overdue",
      timeInfo: overdueDays > 0 ? `Overdue by ${overdueDays}d ${overdueHours}h` : `Overdue by ${overdueHours}h`,
    };
  } else if (diffHours <= 24) {
    const hours = Math.floor(diffHours);
    const mins = Math.floor((diffMs / (1000 * 60)) % 60);
    return {
      status: "unpaid",
      timeInfo: `${hours}h ${mins}m left`,
    };
  } else {
    const days = Math.floor(diffDays);
    return {
      status: "upcoming",
      timeInfo: `${days} day${days !== 1 ? "s" : ""} left`,
    };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  const cronSecret = process.env.CRON_SECRET || "";

  if (cronSecret && key !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userIds = getUserIdsForCron();
  let totalAlerts = 0;

  for (const userId of userIds) {
    const reminders = getReminders(userId);
    let updated = false;

    for (const reminder of reminders) {
      const now = new Date();
      const due = new Date(reminder.nextDueDate);
      const unpaidWindowStart = new Date(due.getTime() - 24 * 60 * 60 * 1000);

      if (reminder.paid) {
        if (now >= unpaidWindowStart) {
          reminder.paid = false;
          reminder.paidAt = undefined;
          reminder.lastAlertSentAt = undefined;
          updated = true;
        } else {
          continue;
        }
      }

      if (now < unpaidWindowStart) {
        continue;
      }

      if (reminder.lastAlertSentAt && isSameUtcDay(reminder.lastAlertSentAt, now)) {
        continue;
      }

      const { status, timeInfo } = getTimeInfo(reminder.nextDueDate);
      let sentAny = false;

      if (reminder.alerts.email && reminder.alerts.emailAddress) {
        const subject = `Payment Reminder: ${reminder.name} — ${status === "overdue" ? "OVERDUE" : "Due Soon"}`;
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: ${status === "overdue" ? "#ff4444" : "#ffaa00"};">💰 Payment Reminder</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; font-weight: bold;">Name:</td><td style="padding: 8px;">${reminder.name}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">From:</td><td style="padding: 8px;">${reminder.payer}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Amount:</td><td style="padding: 8px;">${formatCurrency(reminder.amount, reminder.currency)}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Category:</td><td style="padding: 8px;">${reminder.category}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Status:</td><td style="padding: 8px; color: ${status === "overdue" ? "#ff4444" : "#ffaa00"};">${status.toUpperCase()}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Time:</td><td style="padding: 8px;">${timeInfo}</td></tr>
            </table>
            <p style="color: #888; margin-top: 16px;">— Expenses Reminder System</p>
          </div>
        `;
        const sent = await sendEmail(reminder.alerts.emailAddress, subject, html);
        sentAny = sentAny || sent;
      }

      if (reminder.alerts.discord && reminder.alerts.discordWebhookUrl) {
        const sent = await sendDiscordWebhook(
          reminder.alerts.discordWebhookUrl,
          reminder,
          status,
          timeInfo,
          reminder.alerts.discordUsername,
          reminder.alerts.discordAvatarUrl
        );
        sentAny = sentAny || sent;
      }

      if (reminder.alerts.browser) {
        const sent = await sendWebPushAlert(userId, reminder, status, timeInfo);
        sentAny = sentAny || sent;
      }

      if (sentAny) {
        reminder.lastAlertSentAt = now.toISOString();
        updated = true;
        totalAlerts++;
      }
    }

    if (updated) {
      saveReminders(userId, reminders);
    }
  }

  return NextResponse.json({ success: true, alertsSent: totalAlerts });
}
