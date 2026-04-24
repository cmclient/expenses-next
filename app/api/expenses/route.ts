import { NextRequest, NextResponse } from "next/server";
import { getExpenses, saveExpenses } from "@/lib/storage";
import { getConfig } from "@/lib/storage";
import { Expense } from "@/lib/types";
import { sanitizeString } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const expenses = getExpenses(session.userId);
  return NextResponse.json({ expenses });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const config = getConfig(session.userId);

  const name = sanitizeString(String(body.name || ""));
  if (!name) {
    return NextResponse.json({ error: "Expense name cannot be empty" }, { status: 400 });
  }
  if (!body.category) {
    return NextResponse.json({ error: "Category is required" }, { status: 400 });
  }
  if (!body.amount || Number(body.amount) === 0) {
    return NextResponse.json({ error: "Amount cannot be zero" }, { status: 400 });
  }
  if (!body.date) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }

  const tags = Array.isArray(body.tags)
    ? body.tags.map((t: string) => sanitizeString(t)).filter((t: string) => t)
    : [];

  const expense: Expense = {
    id: uuidv4(),
    recurringID: body.recurringID || "",
    name,
    tags,
    category: String(body.category),
    amount: Number(body.amount),
    currency: body.currency || config.currency,
    date: new Date(body.date).toISOString(),
  };

  const expenses = getExpenses(session.userId);
  expenses.push(expense);
  saveExpenses(session.userId, expenses);

  return NextResponse.json(expense, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const ids: string[] = Array.isArray(body.ids) ? body.ids : [body.id];

  if (ids.length === 0) {
    return NextResponse.json({ error: "No IDs provided" }, { status: 400 });
  }

  const expenses = getExpenses(session.userId);
  const idSet = new Set(ids);
  const filtered = expenses.filter((e) => !idSet.has(e.id));
  const removed = expenses.length - filtered.length;
  saveExpenses(session.userId, filtered);

  return NextResponse.json({ removed });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Expense ID is required" }, { status: 400 });
  }

  const expenses = getExpenses(session.userId);
  const idx = expenses.findIndex((e) => e.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  if (updates.name !== undefined) {
    const name = sanitizeString(String(updates.name));
    if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    expenses[idx].name = name;
  }
  if (updates.category !== undefined) expenses[idx].category = String(updates.category);
  if (updates.amount !== undefined) {
    if (Number(updates.amount) === 0) return NextResponse.json({ error: "Amount cannot be zero" }, { status: 400 });
    expenses[idx].amount = Number(updates.amount);
  }
  if (updates.date !== undefined) expenses[idx].date = new Date(updates.date).toISOString();
  if (updates.currency !== undefined) expenses[idx].currency = updates.currency;
  if (updates.tags !== undefined) {
    expenses[idx].tags = Array.isArray(updates.tags)
      ? updates.tags.map((t: string) => sanitizeString(t)).filter((t: string) => t)
      : [];
  }

  saveExpenses(session.userId, expenses);
  return NextResponse.json(expenses[idx]);
}
