"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Select,
  SelectItem,
  Checkbox,
  Chip,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Expense, AppConfig, COLOR_PALETTE } from "@/lib/types";
import { formatCurrency, getMonthBounds, formatMonth, formatDate, toDateTimeLocal } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function DashboardContent() {
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [disabledCategories, setDisabledCategories] = useState<Set<string>>(new Set());

  // Add expense form
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(toDateTimeLocal());
  const [tags, setTags] = useState("");
  const [isIncome, setIsIncome] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Quick edit modal
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDate, setEditDate] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [configRes, expensesRes] = await Promise.all([
        fetch("/api/config"),
        fetch("/api/expenses"),
      ]);
      const configData = await configRes.json();
      const expensesData = await expensesRes.json();
      setConfig(configData);
      setExpenses(expensesData.expenses || []);
    } catch {
      addToast({ title: t("dashboard.failed_load"), color: "danger" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const startDay = config?.startDate || 1;
  const currency = config?.currency || "usd";

  const { start: monthStart, end: monthEnd } = useMemo(
    () => getMonthBounds(currentDate, startDay),
    [currentDate, startDay]
  );

  const monthExpenses = useMemo(
    () =>
      expenses.filter((e) => {
        const d = new Date(e.date);
        return d >= monthStart && d < monthEnd;
      }),
    [expenses, monthStart, monthEnd]
  );

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of monthExpenses) {
      if (e.amount < 0 && !disabledCategories.has(e.category)) {
        map[e.category] = (map[e.category] || 0) + Math.abs(e.amount);
      }
    }
    return map;
  }, [monthExpenses, disabledCategories]);

  const totalIncome = useMemo(
    () => monthExpenses.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0),
    [monthExpenses]
  );

  const totalExpenses = useMemo(
    () => monthExpenses.filter((e) => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0),
    [monthExpenses]
  );

  const balance = totalIncome - totalExpenses;

  // All-time total balance across all expenses
  const totalBalance = useMemo(
    () => expenses.reduce((s, e) => s + e.amount, 0),
    [expenses]
  );

  // Assign stable colors to categories
  const categoryColors = useMemo(() => {
    const cats = config?.categories || [];
    const map: Record<string, string> = {};
    cats.forEach((c, i) => {
      map[c] = COLOR_PALETTE[i % COLOR_PALETTE.length];
    });
    return map;
  }, [config?.categories]);

  const pieData = useMemo(() => {
    const labels = Object.keys(categoryBreakdown);
    return {
      labels,
      datasets: [
        {
          data: labels.map((l) => categoryBreakdown[l]),
          backgroundColor: labels.map((l) => categoryColors[l] || "#999"),
          borderWidth: 0,
        },
      ],
    };
  }, [categoryBreakdown, categoryColors]);

  const toggleCategory = (cat: string) => {
    setDisabledCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleAddExpense = async () => {
    if (!name.trim() || !category || !amount || !date) {
      addToast({ title: t("dashboard.fill_fields"), color: "warning" });
      return;
    }
    setSubmitting(true);
    try {
      const parsedAmount = parseFloat(amount);
      const finalAmount = isIncome ? Math.abs(parsedAmount) : -Math.abs(parsedAmount);
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t);

      const res = await fetch("/api/expenses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category,
          amount: finalAmount,
          date: new Date(date).toISOString(),
          tags: tagList,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      addToast({ title: t("dashboard.expense_added"), color: "success" });
      setName("");
      setAmount("");
      setTags("");
      setIsIncome(false);
      fetchData();
    } catch (err: unknown) {
      addToast({ title: String(err instanceof Error ? err.message : t("dashboard.failed_load")), color: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await fetch("/api/expenses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      addToast({ title: t("dashboard.deleted"), color: "success" });
      fetchData();
    } catch {
      addToast({ title: t("dashboard.delete_failed"), color: "danger" });
    }
  };

  const openEdit = (e: Expense) => {
    setEditExpense(e);
    setEditName(e.name);
    setEditAmount(String(Math.abs(e.amount)));
    setEditCategory(e.category);
    setEditDate(toDateTimeLocal(e.date));
    onOpen();
  };

  const handleEditSave = async () => {
    if (!editExpense) return;
    try {
      const finalAmount =
        editExpense.amount > 0
          ? Math.abs(parseFloat(editAmount))
          : -Math.abs(parseFloat(editAmount));

      const res = await fetch("/api/expenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editExpense.id,
          name: editName,
          amount: finalAmount,
          category: editCategory,
          date: new Date(editDate).toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Update failed");
      addToast({ title: t("dashboard.updated"), color: "success" });
      onClose();
      fetchData();
    } catch {
      addToast({ title: t("dashboard.update_failed"), color: "danger" });
    }
  };

  const prevMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, d.getDate()));
  };
  const nextMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()));
  };

  if (loading || !config)
    return (
      <div className="flex items-center justify-center h-96">
        <Icon icon="solar:loading-bold-duotone" className="animate-spin text-primary" width={48} />
      </div>
    );

  const recentExpenses = [...monthExpenses].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button isIconOnly variant="flat" onPress={prevMonth}>
          <Icon icon="solar:alt-arrow-left-bold" width={20} />
        </Button>
        <h1 className="text-2xl font-bold">{formatMonth(currentDate)}</h1>
        <Button isIconOnly variant="flat" onPress={nextMonth}>
          <Icon icon="solar:alt-arrow-right-bold" width={20} />
        </Button>
      </div>

      {/* Top Row: Cashflow Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-success">
          <CardBody className="flex flex-row items-center gap-3">
            <div className="rounded-lg bg-success/10 p-2.5">
              <Icon icon="solar:arrow-up-bold" className="text-success" width={24} />
            </div>
            <div>
              <p className="text-xs text-default-400 uppercase tracking-wide">{t("dashboard.income")}</p>
              <p className="text-xl font-bold text-success">{formatCurrency(totalIncome, currency)}</p>
            </div>
          </CardBody>
        </Card>
        <Card className="border-l-4 border-l-danger">
          <CardBody className="flex flex-row items-center gap-3">
            <div className="rounded-lg bg-danger/10 p-2.5">
              <Icon icon="solar:arrow-down-bold" className="text-danger" width={24} />
            </div>
            <div>
              <p className="text-xs text-default-400 uppercase tracking-wide">{t("dashboard.expenses")}</p>
              <p className="text-xl font-bold text-danger">{formatCurrency(totalExpenses, currency)}</p>
            </div>
          </CardBody>
        </Card>
        <Card className={`border-l-4 ${balance >= 0 ? "border-l-success" : "border-l-danger"}`}>
          <CardBody className="flex flex-row items-center gap-3">
            <div className={`rounded-lg p-2.5 ${balance >= 0 ? "bg-success/10" : "bg-danger/10"}`}>
              <Icon
                icon="solar:wallet-bold"
                className={balance >= 0 ? "text-success" : "text-danger"}
                width={24}
              />
            </div>
            <div>
              <p className="text-xs text-default-400 uppercase tracking-wide">{t("dashboard.monthly_balance")}</p>
              <p className={`text-xl font-bold ${balance >= 0 ? "text-success" : "text-danger"}`}>
                {formatCurrency(balance, currency)}
              </p>
            </div>
          </CardBody>
        </Card>
        <Card className={`border-l-4 ${totalBalance >= 0 ? "border-l-primary" : "border-l-danger"}`}>
          <CardBody className="flex flex-row items-center gap-3">
            <div className={`rounded-lg p-2.5 ${totalBalance >= 0 ? "bg-primary/10" : "bg-danger/10"}`}>
              <Icon
                icon="solar:safe-circle-bold"
                className={totalBalance >= 0 ? "text-primary" : "text-danger"}
                width={24}
              />
            </div>
            <div>
              <p className="text-xs text-default-400 uppercase tracking-wide">{t("dashboard.total_balance")}</p>
              <p className={`text-xl font-bold ${totalBalance >= 0 ? "text-primary" : "text-danger"}`}>
                {formatCurrency(totalBalance, currency)}
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pie Chart + Legend */}
        <div className="lg:col-span-5">
          <Card className="h-full">
            <CardHeader className="font-semibold text-lg">{t("dashboard.spending_by_category")}</CardHeader>
            <CardBody>
              {Object.keys(categoryBreakdown).length > 0 ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-full max-w-[280px]">
                    <Pie
                      data={pieData}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            callbacks: {
                              label: (ctx) =>
                                `${ctx.label}: ${formatCurrency(ctx.parsed, currency)}`,
                            },
                          },
                        },
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {(config.categories || []).map((cat) => {
                      const val = categoryBreakdown[cat];
                      if (!val && !disabledCategories.has(cat)) return null;
                      const disabled = disabledCategories.has(cat);
                      return (
                        <Chip
                          key={cat}
                          variant={disabled ? "flat" : "solid"}
                          className="cursor-pointer select-none"
                          style={{
                            backgroundColor: disabled ? undefined : categoryColors[cat],
                            opacity: disabled ? 0.4 : 1,
                          }}
                          onClose={undefined}
                          onClick={() => toggleCategory(cat)}
                        >
                          {cat}: {formatCurrency(val || 0, currency)}
                        </Chip>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-default-400">
                  <Icon icon="solar:chart-2-line-duotone" width={48} />
                  <p>{t("dashboard.no_expenses_month")}</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Add Expense Form */}
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader className="font-semibold text-lg">{t("dashboard.add_expense")}</CardHeader>
            <CardBody className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label={t("common.name")}
                  placeholder={t("dashboard.name_placeholder")}
                  value={name}
                  onValueChange={setName}
                  startContent={<Icon icon="solar:pen-bold" className="text-default-400" width={16} />}
                />
                <Select
                  label={t("common.category")}
                  placeholder={t("dashboard.select_category")}
                  selectedKeys={category ? [category] : []}
                  onSelectionChange={(keys) => setCategory(Array.from(keys)[0] as string)}
                >
                  {config.categories.map((c) => (
                    <SelectItem key={c}>{c}</SelectItem>
                  ))}
                </Select>
                <Input
                  label={t("common.amount")}
                  type="number"
                  placeholder={t("dashboard.amount_placeholder")}
                  value={amount}
                  onValueChange={setAmount}
                  startContent={<Icon icon="solar:dollar-minimalistic-bold" className="text-default-400" width={16} />}
                />
                <Input
                  label={t("common.date")}
                  type="datetime-local"
                  value={date}
                  onValueChange={setDate}
                />
              </div>
              <Input
                label={t("common.tags")}
                placeholder={t("dashboard.tags_placeholder")}
                value={tags}
                onValueChange={setTags}
                startContent={<Icon icon="solar:tag-bold" className="text-default-400" width={16} />}
              />
              <div className="flex items-center justify-between">
                <Checkbox isSelected={isIncome} onValueChange={setIsIncome}>
                  <span className="text-sm">{t("dashboard.this_is_income")}</span>
                </Checkbox>
                <Button color="primary" isLoading={submitting} onPress={handleAddExpense}>
                  <Icon icon="solar:add-circle-bold" width={18} />
                  Add
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader className="font-semibold text-lg flex items-center justify-between">
              <span>{t("dashboard.recent_transactions")}</span>
              <Chip size="sm" variant="flat">{monthExpenses.length}</Chip>
            </CardHeader>
            <CardBody className="p-0">
              {recentExpenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-default-400">
                  <Icon icon="solar:document-text-line-duotone" width={48} />
                  <p>{t("dashboard.no_transactions_month")}</p>
                </div>
              ) : (
                <div className="divide-y divide-divider max-h-[400px] overflow-y-auto">
                  {recentExpenses.slice(0, 20).map((e) => (
                    <div key={e.id} className="flex items-center justify-between px-4 py-3 hover:bg-default-50 transition-colors group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: categoryColors[e.category] || "#999" }}
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{e.name}</p>
                          <div className="flex items-center gap-2 text-xs text-default-400">
                            <span>{e.category}</span>
                            <span>&middot;</span>
                            <span>{formatDate(e.date)}</span>
                            {e.tags?.length > 0 && (
                              <>
                                <span>&middot;</span>
                                {e.tags.map((t) => (
                                  <Chip key={t} size="sm" variant="flat" className="text-[10px] h-4">
                                    {t}
                                  </Chip>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold text-sm whitespace-nowrap ${
                            e.amount > 0 ? "text-success" : "text-danger"
                          }`}
                        >
                          {formatCurrency(e.amount, e.currency || currency)}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            onPress={() => openEdit(e)}
                          >
                            <Icon icon="solar:pen-bold" width={14} />
                          </Button>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            onPress={() => handleDeleteExpense(e.id)}
                          >
                            <Icon icon="solar:trash-bin-minimalistic-bold" width={14} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>{t("dashboard.edit_expense")}</ModalHeader>
          <ModalBody className="space-y-3">
            <Input label={t("common.name")} value={editName} onValueChange={setEditName} />
            <Input label={t("common.amount")} type="number" value={editAmount} onValueChange={setEditAmount} />
            <Select
              label={t("common.category")}
              selectedKeys={editCategory ? [editCategory] : []}
              onSelectionChange={(keys) => setEditCategory(Array.from(keys)[0] as string)}
            >
              {config.categories.map((c) => (
                <SelectItem key={c}>{c}</SelectItem>
              ))}
            </Select>
            <Input label={t("common.date")} type="datetime-local" value={editDate} onValueChange={setEditDate} />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>{t("common.cancel")}</Button>
            <Button color="primary" onPress={handleEditSave}>{t("common.save")}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
