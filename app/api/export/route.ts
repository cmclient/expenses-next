import { NextResponse } from "next/server";
import { getExpenses } from "@/lib/storage";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const expenses = getExpenses(session.userId);

  if (expenses.length === 0) {
    return new NextResponse("No expenses to export", { status: 404 });
  }

  const hasTags = expenses.some((e) => e.tags && e.tags.length > 0);
  const headers = ["ID", "Name", "Category", "Amount", "Currency", "Date"];
  if (hasTags) headers.push("Tags");

  const csvRows = [headers.join(",")];
  for (const e of expenses) {
    const row = [
      e.id,
      `"${e.name.replace(/"/g, '""')}"`,
      `"${e.category.replace(/"/g, '""')}"`,
      String(e.amount),
      e.currency,
      e.date,
    ];
    if (hasTags) {
      row.push(`"${(e.tags || []).join(",")}"`);
    }
    csvRows.push(row.join(","));
  }

  const csv = csvRows.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="expenses_${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
