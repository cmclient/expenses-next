"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardBody, CardHeader, Chip } from "@heroui/react";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from "chart.js";
import { Expense, AppConfig, COLOR_PALETTE } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip, ChartLegend);

export default function StatsContent() {
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [configRes, expensesRes] = await Promise.all([
        fetch("/api/config"),
        fetch("/api/expenses"),
      ]);
      setConfig(await configRes.json());
      const data = await expensesRes.json();
      setExpenses(data.expenses || []);
    } catch {
      addToast({ title: t("stats.failed_load"), color: "danger" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currency = config?.currency || "usd";

  // Monthly spending over last 12 months
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: { label: string; income: number; expenses: number }[] = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

      let income = 0;
      let exp = 0;
      for (const e of expenses) {
        const ed = new Date(e.date);
        if (ed >= d && ed < nextMonth) {
          if (e.amount > 0) income += e.amount;
          else exp += Math.abs(e.amount);
        }
      }
      months.push({ label, income, expenses: exp });
    }
    return months;
  }, [expenses]);

  const barData = useMemo(
    () => ({
      labels: monthlyData.map((m) => m.label),
      datasets: [
        {
          label: t("stats.income"),
          data: monthlyData.map((m) => m.income),
          backgroundColor: "#17c964",
          borderRadius: 4,
        },
        {
          label: t("stats.expenses"),
          data: monthlyData.map((m) => m.expenses),
          backgroundColor: "#f31260",
          borderRadius: 4,
        },
      ],
    }),
    [monthlyData, t]
  );

  // Category totals (all-time)
  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenses) {
      if (e.amount < 0) {
        map[e.category] = (map[e.category] || 0) + Math.abs(e.amount);
      }
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  // Top expenses
  const topExpenses = useMemo(
    () =>
      [...expenses]
        .filter((e) => e.amount < 0)
        .sort((a, b) => a.amount - b.amount)
        .slice(0, 10),
    [expenses]
  );

  // Average spending per month
  const avgMonthlySpend = useMemo(() => {
    const monthsWithData = monthlyData.filter((m) => m.expenses > 0);
    if (monthsWithData.length === 0) return 0;
    return monthsWithData.reduce((s, m) => s + m.expenses, 0) / monthsWithData.length;
  }, [monthlyData]);

  // All-time totals
  const allTimeIncome = expenses.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const allTimeExpenses = expenses.filter((e) => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0);
  const allTimeSavings = allTimeIncome - allTimeExpenses;

  // Savings rate
  const savingsRate = allTimeIncome > 0 ? ((allTimeSavings / allTimeIncome) * 100) : 0;

  // Tag stats
  const tagTotals = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    for (const e of expenses) {
      if (e.tags) {
        for (const t of e.tags) {
          if (!map[t]) map[t] = { count: 0, total: 0 };
          map[t].count++;
          map[t].total += Math.abs(e.amount);
        }
      }
    }
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [expenses]);

  if (loading || !config)
    return (
      <div className="flex items-center justify-center h-96">
        <Icon icon="solar:loading-bold-duotone" className="animate-spin text-primary" width={48} />
      </div>
    );

  const categoryColors: Record<string, string> = {};
  (config.categories || []).forEach((c, i) => {
    categoryColors[c] = COLOR_PALETTE[i % COLOR_PALETTE.length];
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("stats.title")}</h1>
        <p className="text-default-400 text-sm">
          {t("stats.insights_across", { count: expenses.length })}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardBody className="text-center">
            <p className="text-xs text-default-400 uppercase">{t("stats.all_time_income")}</p>
            <p className="text-lg font-bold text-success">{formatCurrency(allTimeIncome, currency)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-xs text-default-400 uppercase">{t("stats.all_time_expenses")}</p>
            <p className="text-lg font-bold text-danger">{formatCurrency(allTimeExpenses, currency)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-xs text-default-400 uppercase">{t("stats.avg_monthly_spend")}</p>
            <p className="text-lg font-bold text-warning">{formatCurrency(avgMonthlySpend, currency)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-xs text-default-400 uppercase">{t("stats.savings_rate")}</p>
            <p className={`text-lg font-bold ${savingsRate >= 0 ? "text-success" : "text-danger"}`}>
              {savingsRate.toFixed(1)}%
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Monthly Bar Chart */}
      <Card>
        <CardHeader className="font-semibold text-lg">{t("stats.monthly_overview")}</CardHeader>
        <CardBody>
          {expenses.length > 0 ? (
            <div className="h-[300px]">
              <Bar
                data={barData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: "top", labels: { color: "#888" } },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? 0, currency)}`,
                      },
                    },
                  },
                  scales: {
                    x: { grid: { display: false }, ticks: { color: "#888" } },
                    y: {
                      grid: { color: "rgba(128,128,128,0.1)" },
                      ticks: {
                        color: "#888",
                        callback: (val) => formatCurrency(Number(val), currency),
                      },
                    },
                  },
                }}
              />
            </div>
          ) : (
            <div className="text-center py-12 text-default-400">{t("stats.no_data")}</div>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <Card>
          <CardHeader className="font-semibold text-lg">{t("stats.spending_by_category_alltime")}</CardHeader>
          <CardBody className="p-0">
            {categoryTotals.length === 0 ? (
              <div className="text-center py-12 text-default-400">{t("stats.no_expenses")}</div>
            ) : (
              <div className="divide-y divide-divider">
                {categoryTotals.map(([cat, total]) => {
                  const pct = allTimeExpenses > 0 ? (total / allTimeExpenses) * 100 : 0;
                  return (
                    <div key={cat} className="px-4 py-3">
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: categoryColors[cat] || "#999" }}
                          />
                          <span className="text-sm font-medium">{cat}</span>
                        </div>
                        <span className="text-sm font-semibold text-danger">
                          {formatCurrency(total, currency)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-default-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: categoryColors[cat] || "#999",
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-default-400 mt-0.5">{pct.toFixed(1)}%</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Top Expenses + Tags */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="font-semibold text-lg">{t("stats.top_10")}</CardHeader>
            <CardBody className="p-0">
              {topExpenses.length === 0 ? (
                <div className="text-center py-12 text-default-400">{t("stats.no_expenses")}</div>
              ) : (
                <div className="divide-y divide-divider">
                  {topExpenses.map((e, i) => (
                    <div key={e.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-default-400 w-5">#{i + 1}</span>
                        <div>
                          <p className="text-sm font-medium">{e.name}</p>
                          <p className="text-xs text-default-400">{e.category}</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-danger">
                        {formatCurrency(e.amount, e.currency || currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {tagTotals.length > 0 && (
            <Card>
              <CardHeader className="font-semibold text-lg">{t("stats.tag_analysis")}</CardHeader>
              <CardBody>
                <div className="flex flex-wrap gap-2">
                  {tagTotals.slice(0, 20).map(([tag, data]) => (
                    <Chip key={tag} variant="flat" size="sm">
                      {tag}: {formatCurrency(data.total, currency)} ({data.count}x)
                    </Chip>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
