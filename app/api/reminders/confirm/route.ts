import { NextRequest, NextResponse } from "next/server";
import { getReminders, saveReminders, getExpenses, saveExpenses, getConfig } from "@/lib/storage";
import { Expense } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";
import { getSession } from "@/lib/auth";

function advanceDueDate(currentDue: string, intervalAmount: number, intervalType: string): string {
  const current = new Date(currentDue);
  switch (intervalType) {
    case "daily":
      return new Date(current.getTime() + intervalAmount * 86400000).toISOString();
    case "weekly":
      return new Date(current.getTime() + intervalAmount * 7 * 86400000).toISOString();
    case "monthly":
      return new Date(current.getFullYear(), current.getMonth() + intervalAmount, current.getDate()).toISOString();
    case "yearly":
      return new Date(current.getFullYear() + intervalAmount, current.getMonth(), current.getDate()).toISOString();
    default:
      return current.toISOString();
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const id = body.id;
  if (!id) return NextResponse.json({ error: "Reminder ID required" }, { status: 400 });

  const reminders = getReminders(session.userId);
  const idx = reminders.findIndex((r) => r.id === id);
  if (idx === -1) return NextResponse.json({ error: "Reminder not found" }, { status: 404 });

  const reminder = reminders[idx];
  const config = getConfig(session.userId);

  const expense: Expense = {
    id: uuidv4(),
    recurringID: "",
    name: `${reminder.name} (from ${reminder.payer})`,
    tags: ["reminder", "payment"],
    category: reminder.category,
    amount: Math.abs(reminder.amount), // positive = income
    currency: reminder.currency || config.currency,
    date: new Date().toISOString(),
  };

  const expenses = getExpenses(session.userId);
  expenses.push(expense);
  saveExpenses(session.userId, expenses);

  reminders[idx].paid = true;
  reminders[idx].paidAt = new Date().toISOString();
  reminders[idx].nextDueDate = advanceDueDate(
    reminder.nextDueDate,
    reminder.intervalAmount,
    reminder.intervalType
  );
  reminders[idx].lastAlertSentAt = undefined;

  saveReminders(session.userId, reminders);

  return NextResponse.json({ success: true, expense });
}
