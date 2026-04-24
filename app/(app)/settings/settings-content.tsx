"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Select,
  SelectItem,
  Chip,
  Divider,
  Alert,
} from "@heroui/react";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { AppConfig, SUPPORTED_CURRENCIES, CURRENCY_LABELS } from "@/lib/types";
import { useTranslation } from "@/lib/i18n";

export default function SettingsContent() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Categories
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");

  // Currency
  const [currency, setCurrency] = useState("usd");

  // Start date
  const [startDate, setStartDate] = useState("1");

  // Import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<{
    processed: number;
    imported: number;
    skipped: number;
    newCategories: string[];
  } | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      setConfig(data);
      setCategories(data.categories || []);
      setCurrency(data.currency || "usd");
      setStartDate(String(data.startDate || 1));
    } catch {
      addToast({ title: t("settings.failed_load"), color: "danger" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // ---- Categories ----
  const addCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      addToast({ title: t("settings.category_exists"), color: "warning" });
      return;
    }
    const updated = [...categories, trimmed];
    setCategories(updated);
    setNewCategory("");
    saveCategories(updated);
  };

  const removeCategory = (cat: string) => {
    const updated = categories.filter((c) => c !== cat);
    setCategories(updated);
    saveCategories(updated);
  };

  const moveCategory = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= categories.length) return;
    const updated = [...categories];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setCategories(updated);
    saveCategories(updated);
  };

  const saveCategories = async (cats: string[]) => {
    try {
      const res = await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: cats }),
      });
      if (!res.ok) throw new Error();
      addToast({ title: t("settings.categories_saved"), color: "success" });
    } catch {
      addToast({ title: t("settings.categories_save_failed"), color: "danger" });
    }
  };

  // ---- Currency ----
  const saveCurrency = async (val: string) => {
    setCurrency(val);
    try {
      const res = await fetch("/api/currency", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: val }),
      });
      if (!res.ok) throw new Error();
      addToast({ title: t("settings.currency_updated"), color: "success" });
    } catch {
      addToast({ title: t("settings.currency_update_failed"), color: "danger" });
    }
  };

  // ---- Start Date ----
  const saveStartDate = async (val: string) => {
    setStartDate(val);
    try {
      const res = await fetch("/api/startdate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: parseInt(val) }),
      });
      if (!res.ok) throw new Error();
      addToast({ title: t("settings.start_date_updated"), color: "success" });
    } catch {
      addToast({ title: t("settings.start_date_update_failed"), color: "danger" });
    }
  };

  // ---- Import ----
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const result = await res.json();
      setImportResult(result);
      addToast({ title: t("settings.imported_count", { count: result.imported }), color: "success" });
      fetchConfig(); // Refresh in case new categories were added
    } catch (err: unknown) {
      addToast({ title: String(err instanceof Error ? err.message : t("settings.import_failed")), color: "danger" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
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
      addToast({ title: t("settings.exported"), color: "success" });
    } catch {
      addToast({ title: t("settings.export_failed"), color: "danger" });
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
      <div>
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
        <p className="text-default-400 text-sm">{t("settings.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories */}
        <Card>
          <CardHeader className="font-semibold text-lg">
            <Icon icon="solar:tag-bold-duotone" className="text-primary mr-2" width={20} />
            {t("settings.categories")}
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder={t("settings.new_category_placeholder")}
                value={newCategory}
                onValueChange={setNewCategory}
                onKeyDown={(e) => e.key === "Enter" && addCategory()}
                size="sm"
              />
              <Button color="primary" size="sm" onPress={addCategory}>
                <Icon icon="solar:add-circle-bold" width={16} />
                {t("common.add")}
              </Button>
            </div>
            <Divider />
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {categories.map((cat, idx) => (
                <div
                  key={cat}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-default-50 transition-colors group"
                >
                  <span className="text-sm font-medium">{cat}</span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button isIconOnly size="sm" variant="light" onPress={() => moveCategory(idx, -1)} isDisabled={idx === 0}>
                      <Icon icon="solar:alt-arrow-up-bold" width={14} />
                    </Button>
                    <Button isIconOnly size="sm" variant="light" onPress={() => moveCategory(idx, 1)} isDisabled={idx === categories.length - 1}>
                      <Icon icon="solar:alt-arrow-down-bold" width={14} />
                    </Button>
                    <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => removeCategory(cat)}>
                      <Icon icon="solar:close-circle-bold" width={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Currency & Start Date */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="font-semibold text-lg">
              <Icon icon="solar:dollar-minimalistic-bold-duotone" className="text-primary mr-2" width={20} />
              {t("settings.currency")}
            </CardHeader>
            <CardBody>
              <Select
                label={t("settings.select_currency")}
                selectedKeys={[currency]}
                onSelectionChange={(keys) => saveCurrency(Array.from(keys)[0] as string)}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <SelectItem key={c}>{CURRENCY_LABELS[c] || c.toUpperCase()}</SelectItem>
                ))}
              </Select>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="font-semibold text-lg">
              <Icon icon="solar:calendar-bold-duotone" className="text-primary mr-2" width={20} />
              {t("settings.month_start_day")}
            </CardHeader>
            <CardBody>
              <Select
                label={t("settings.day_of_month")}
                selectedKeys={[startDate]}
                onSelectionChange={(keys) => saveStartDate(Array.from(keys)[0] as string)}
                description={t("settings.month_start_desc")}
              >
                {Array.from({ length: 31 }, (_, i) => (
                  <SelectItem key={String(i + 1)}>{String(i + 1)}</SelectItem>
                ))}
              </Select>
            </CardBody>
          </Card>

          {/* Import / Export */}
          <Card>
            <CardHeader className="font-semibold text-lg">
              <Icon icon="solar:import-bold-duotone" className="text-primary mr-2" width={20} />
              {t("settings.import_export")}
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="flex gap-3">
                <Button
                  variant="flat"
                  onPress={() => fileInputRef.current?.click()}
                  className="flex-1"
                >
                  <Icon icon="solar:import-bold" width={16} />
                  {t("settings.import_csv")}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleImport}
                />
                <Button variant="flat" onPress={handleExport} className="flex-1">
                  <Icon icon="solar:export-bold" width={16} />
                  {t("settings.export_csv")}
                </Button>
              </div>
              {importResult && (
                <Alert color="success" title={t("settings.import_complete")}>
                  <div className="text-sm space-y-1">
                    <p>{t("settings.processed")}: {importResult.processed} &middot; {t("settings.imported")}: {importResult.imported} &middot; {t("settings.skipped")}: {importResult.skipped}</p>
                    {importResult.newCategories.length > 0 && (
                      <div className="flex gap-1 flex-wrap items-center">
                        <span>{t("settings.new_categories")}:</span>
                        {importResult.newCategories.map((c) => (
                          <Chip key={c} size="sm" variant="flat" color="success">{c}</Chip>
                        ))}
                      </div>
                    )}
                  </div>
                </Alert>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Stats Overview */}
      <Card>
        <CardHeader className="font-semibold text-lg">
          <Icon icon="solar:info-circle-bold-duotone" className="text-primary mr-2" width={20} />
          About
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap gap-4 text-sm text-default-500">
            <div className="flex items-center gap-2">
              <Icon icon="solar:tag-bold" width={16} className="text-primary" />
              <span>{categories.length} {t("common.category").toLowerCase()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon icon="solar:dollar-minimalistic-bold" width={16} className="text-success" />
              <span>{currency.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon icon="solar:calendar-bold" width={16} className="text-warning" />
              <span>{t("settings.month_starts_on", { day: startDate })}</span>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
