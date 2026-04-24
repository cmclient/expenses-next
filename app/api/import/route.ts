import { NextRequest, NextResponse } from "next/server";
import { getExpenses, saveExpenses, getConfig } from "@/lib/storage";
import { Expense } from "@/lib/types";
import { sanitizeString } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";
import { getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const text = await file.text();
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l);

  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV must have a header and at least one row" }, { status: 400 });
  }

  const config = getConfig(session.userId);
  const existingExpenses = getExpenses(session.userId);
  const existingIds = new Set(existingExpenses.map((e) => e.id));

  const imported: Expense[] = [];
  let skipped = 0;
  const newCategories: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    if (parts.length < 5) {
      skipped++;
      continue;
    }

    const [id, name, category, amount, currency, date, tags] = parts;
    const cleanName = sanitizeString(name.replace(/^"|"$/g, ""));
    const cleanCategory = category.replace(/^"|"$/g, "");

    if (!cleanName || !cleanCategory || !amount || !date) {
      skipped++;
      continue;
    }

    if (existingIds.has(id)) {
      skipped++;
      continue;
    }

    if (!config.categories.includes(cleanCategory)) {
      config.categories.push(cleanCategory);
      newCategories.push(cleanCategory);
    }

    const parsedTags = tags
      ? tags.replace(/^"|"$/g, "").split(",").map((t) => sanitizeString(t)).filter((t) => t)
      : [];

    imported.push({
      id: id || uuidv4(),
      recurringID: "",
      name: cleanName,
      tags: parsedTags,
      category: cleanCategory,
      amount: parseFloat(amount),
      currency: currency || config.currency,
      date: new Date(date).toISOString(),
    });
  }

  existingExpenses.push(...imported);
  saveExpenses(session.userId, existingExpenses);

  return NextResponse.json({
    processed: lines.length - 1,
    imported: imported.length,
    skipped,
    newCategories,
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}
