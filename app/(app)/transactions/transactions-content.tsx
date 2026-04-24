"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Chip,
  Switch,
  Pagination,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Select,
  SelectItem,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { Expense, AppConfig, COLOR_PALETTE } from "@/lib/types";
import { formatCurrency, getMonthBounds, formatMonth, formatDate, toDateTimeLocal } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

const PAGE_SIZE = 15;

export default function TransactionsContent() {
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [sortField, setSortField] = useState<"date" | "amount" | "name">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTags, setEditTags] = useState("");

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
      addToast({ title: t("transactions.failed_load"), color: "danger" });
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

  const categoryColors = useMemo(() => {
    const cats = config?.categories || [];
    const map: Record<string, string> = {};
    cats.forEach((c, i) => {
      map[c] = COLOR_PALETTE[i % COLOR_PALETTE.length];
    });
    return map;
  }, [config?.categories]);

  const filteredExpenses = useMemo(() => {
    let list = showAll
      ? expenses
      : expenses.filter((e) => {
          const d = new Date(e.date);
          return d >= monthStart && d < monthEnd;
        });

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          (e.tags && e.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }

    if (filterCategory) {
      list = list.filter((e) => e.category === filterCategory);
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "date":
          cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case "amount":
          cmp = a.amount - b.amount;
          break;
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [expenses, showAll, monthStart, monthEnd, search, filterCategory, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / PAGE_SIZE));
  const pagedExpenses = filteredExpenses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = async (id: string) => {
    try {
      await fetch("/api/expenses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      addToast({ title: t("transactions.deleted"), color: "success" });
      fetchData();
    } catch {
      addToast({ title: t("transactions.delete_failed"), color: "danger" });
    }
  };

  const openEdit = (e: Expense) => {
    setEditExpense(e);
    setEditName(e.name);
    setEditAmount(String(Math.abs(e.amount)));
    setEditCategory(e.category);
    setEditDate(toDateTimeLocal(e.date));
    setEditTags((e.tags || []).join(", "));
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
          tags: editTags
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t),
        }),
      });
      if (!res.ok) throw new Error();
      addToast({ title: t("transactions.updated"), color: "success" });
      onClose();
      fetchData();
    } catch {
      addToast({ title: t("transactions.update_failed"), color: "danger" });
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `expenses_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      addToast({ title: t("transactions.exported"), color: "success" });
    } catch {
      addToast({ title: t("transactions.export_failed"), color: "danger" });
    }
  };

  if (loading || !config)
    return (
      <div className="flex items-center justify-center h-96">
        <Icon icon="solar:loading-bold-duotone" className="animate-spin text-primary" width={48} />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("transactions.title")}</h1>
          <p className="text-default-400 text-sm">
            {filteredExpenses.length} {filteredExpenses.length !== 1 ? t("transactions.transactions") : t("transactions.transaction")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!showAll && (
            <div className="flex items-center gap-1">
              <Button isIconOnly variant="flat" size="sm" onPress={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, d.getDate()))}>
                <Icon icon="solar:alt-arrow-left-bold" width={16} />
              </Button>
              <span className="text-sm font-medium min-w-[130px] text-center">{formatMonth(currentDate)}</span>
              <Button isIconOnly variant="flat" size="sm" onPress={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()))}>
                <Icon icon="solar:alt-arrow-right-bold" width={16} />
              </Button>
            </div>
          )}
          <Switch isSelected={showAll} onValueChange={setShowAll} size="sm">
            <span className="text-sm">{t("common.all")}</span>
          </Switch>
          <Button variant="flat" size="sm" onPress={handleExport}>
            <Icon icon="solar:export-bold" width={16} />
            {t("transactions.export_csv")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder={t("transactions.search_placeholder")}
          value={search}
          onValueChange={(v) => { setSearch(v); setPage(1); }}
          startContent={<Icon icon="solar:magnifer-bold" className="text-default-400" width={16} />}
          className="max-w-xs"
          size="sm"
        />
        <Select
          placeholder={t("transactions.all_categories")}
          selectedKeys={filterCategory ? [filterCategory] : []}
          onSelectionChange={(keys) => { setFilterCategory(Array.from(keys)[0] as string || ""); setPage(1); }}
          className="max-w-[200px]"
          size="sm"
        >
          {config.categories.map((c) => (
            <SelectItem key={c}>{c}</SelectItem>
          ))}
        </Select>
        <Dropdown>
          <DropdownTrigger>
            <Button variant="flat" size="sm">
              <Icon icon="solar:sort-bold" width={16} />
              {t("transactions.sort")}: {sortField} ({sortDir})
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            onAction={(key) => {
              const [field, dir] = String(key).split("-");
              setSortField(field as "date" | "amount" | "name");
              setSortDir(dir as "asc" | "desc");
            }}
          >
            <DropdownItem key="date-desc">{t("transactions.date_newest")}</DropdownItem>
            <DropdownItem key="date-asc">{t("transactions.date_oldest")}</DropdownItem>
            <DropdownItem key="amount-desc">{t("transactions.amount_highest")}</DropdownItem>
            <DropdownItem key="amount-asc">{t("transactions.amount_lowest")}</DropdownItem>
            <DropdownItem key="name-asc">{t("transactions.name_az")}</DropdownItem>
            <DropdownItem key="name-desc">{t("transactions.name_za")}</DropdownItem>
          </DropdownMenu>
        </Dropdown>
        {filterCategory && (
          <Button variant="flat" size="sm" color="danger" onPress={() => setFilterCategory("")}>
            {t("transactions.clear_filter")}
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardBody className="p-0">
          {pagedExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-default-400">
              <Icon icon="solar:document-text-line-duotone" width={48} />
              <p>{t("transactions.no_transactions")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-divider text-default-500 text-xs uppercase">
                    <th className="text-left px-4 py-3">{t("transactions.th_name")}</th>
                    <th className="text-left px-4 py-3">{t("transactions.th_category")}</th>
                    <th className="text-left px-4 py-3">{t("transactions.th_tags")}</th>
                    <th className="text-right px-4 py-3">{t("transactions.th_amount")}</th>
                    <th className="text-left px-4 py-3">{t("transactions.th_date")}</th>
                    <th className="text-right px-4 py-3">{t("transactions.th_actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedExpenses.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-divider/50 hover:bg-default-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">{e.name}</td>
                      <td className="px-4 py-3">
                        <Chip
                          size="sm"
                          variant="flat"
                          style={{ borderLeftColor: categoryColors[e.category], borderLeftWidth: 3 }}
                        >
                          {e.category}
                        </Chip>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {e.tags?.map((t) => (
                            <Chip key={t} size="sm" variant="flat" className="text-xs">
                              {t}
                            </Chip>
                          ))}
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${e.amount > 0 ? "text-success" : "text-danger"}`}>
                        {formatCurrency(e.amount, e.currency || currency)}
                      </td>
                      <td className="px-4 py-3 text-default-400">{formatDate(e.date)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button isIconOnly size="sm" variant="light" onPress={() => openEdit(e)}>
                            <Icon icon="solar:pen-bold" width={14} />
                          </Button>
                          <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => handleDelete(e.id)}>
                            <Icon icon="solar:trash-bin-minimalistic-bold" width={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination total={totalPages} page={page} onChange={setPage} showControls />
        </div>
      )}

      {/* Edit Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>{t("transactions.edit_transaction")}</ModalHeader>
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
            <Input label={t("transactions.tags_label")} value={editTags} onValueChange={setEditTags} />
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
