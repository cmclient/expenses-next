import { NextRequest, NextResponse } from "next/server";
import { getConfig, saveConfig, getExpenses, saveExpenses } from "@/lib/storage";
import { RecurringExpense, Expense, VALID_INTERVALS } from "@/lib/types";
import { sanitizeString } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";
import { getSession } from "@/lib/auth";

function generateOccurrences(rule: RecurringExpense): Expense[] {
  const expenses: Expense[] = [];
  const count = rule.occurrences === 0 ? 3000 : rule.occurrences;
  let current = new Date(rule.startDate);

  for (let i = 0; i < count; i++) {
    expenses.push({
      id: uuidv4(),
      recurringID: rule.id,
      name: rule.name,
      tags: [...rule.tags],
      category: rule.category,
      amount: rule.amount,
      currency: rule.currency,
      date: current.toISOString(),
    });

    switch (rule.interval) {
      case "daily":
        current = new Date(current.getTime() + 86400000);
        break;
      case "weekly":
        current = new Date(current.getTime() + 7 * 86400000);
        break;
      case "monthly":
        current = new Date(current.getFullYear(), current.getMonth() + 1, current.getDate());
        break;
      case "yearly":
        current = new Date(current.getFullYear() + 1, current.getMonth(), current.getDate());
        break;
    }
  }
  return expenses;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const config = getConfig(session.userId);
  return NextResponse.json({ recurringExpenses: config.recurringExpenses });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const config = getConfig(session.userId);

  const name = sanitizeString(String(body.name || ""));
  if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
  if (!body.category) return NextResponse.json({ error: "Category is required" }, { status: 400 });
  if (!body.startDate) return NextResponse.json({ error: "Start date is required" }, { status: 400 });
  if (!VALID_INTERVALS.includes(body.interval)) {
    return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
  }
  const occurrences = Number(body.occurrences) || 0;
  if (occurrences !== 0 && occurrences < 2) {
    return NextResponse.json({ error: "At least 2 occurrences required" }, { status: 400 });
  }

  const tags = Array.isArray(body.tags)
    ? body.tags.map((t: string) => sanitizeString(t)).filter((t: string) => t)
    : [];

  const rule: RecurringExpense = {
    id: uuidv4(),
    name,
    amount: Number(body.amount),
    currency: body.currency || config.currency,
    tags,
    category: String(body.category),
    startDate: new Date(body.startDate).toISOString(),
    interval: body.interval,
    occurrences,
  };

  config.recurringExpenses.push(rule);
  saveConfig(session.userId, config);

  const generated = generateOccurrences(rule);
  const expenses = getExpenses(session.userId);
  expenses.push(...generated);
  saveExpenses(session.userId, expenses);

  return NextResponse.json({ rule, generated: generated.length }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const removeAll = searchParams.get("removeAll") === "true";

  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const config = getConfig(session.userId);
  const ruleIdx = config.recurringExpenses.findIndex((r) => r.id === id);
  if (ruleIdx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  config.recurringExpenses.splice(ruleIdx, 1);
  saveConfig(session.userId, config);

  if (removeAll) {
    const expenses = getExpenses(session.userId);
    const filtered = expenses.filter((e) => e.recurringID !== id);
    saveExpenses(session.userId, filtered);
  } else {
    const now = new Date();
    const expenses = getExpenses(session.userId);
    const filtered = expenses.filter(
      (e) => e.recurringID !== id || new Date(e.date) <= now
    );
    saveExpenses(session.userId, filtered);
  }

  return NextResponse.json({ success: true });
}
